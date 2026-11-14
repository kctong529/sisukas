import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { and, eq } from 'drizzle-orm';
import { db } from '../../src/db';
import {
  calendarHiddenGroups,
  calendarOccurrenceOverrides,
  planInstances,
  plans,
  users,
} from '../../src/db/schema';
import { CalendarPreferencesService as service } from '../../src/services/CalendarPreferencesService';
import {
  CalendarOfferingNotInPlanError,
  CalendarPlanNotFoundError,
} from '../../src/domain/calendar/preferences';
import { InvalidOccurrenceKeyError } from '../../src/domain/calendar/occurrenceKey';
import { verifyCalendarTestDatabase } from './testDatabase';

// This suite is deliberately opt-in. The regular unit-test run must not create
// users/plans or write to any configured database.
const enabled = process.env.CALENDAR_DB_TEST === 'yes';
const suite = enabled ? describe : describe.skip;

suite('Calendar preferences: PostgreSQL integration (Supabase Test only)', () => {
  const id = randomUUID();
  const owner = `calendar-it-owner-${id}`;
  const outsider = `calendar-it-outsider-${id}`;
  const offering = `calendar-it-${id}`;
  const group = { courseOfferingId: offering, studyGroupId: 'lecture-A' };
  const occurrenceKey = JSON.stringify(['series', offering, group.studyGroupId, 'series-A', 1790000000000]);
  const occurrence = { ...group, occurrenceKeyVersion: 1 as const, occurrenceKey };
  const created: string[] = [];
  let ownerPlan: string;
  let outsiderPlan: string;

  beforeAll(async () => {
    verifyCalendarTestDatabase();
    const schemaCheck = await db.execute<{ hidden: string | null; overrides: string | null }>(
      // Drizzle's tagged SQL avoids interpolating user input here.
      (await import('drizzle-orm')).sql`SELECT to_regclass('public.calendar_hidden_groups')::text AS hidden,
        to_regclass('public.calendar_occurrence_overrides')::text AS overrides`,
    );
    if (!schemaCheck.rows[0]?.hidden || !schemaCheck.rows[0]?.overrides) {
      throw new Error('Calendar migration 0005 is not installed in the selected test database');
    }

    try {
      await db.insert(users).values([
        { id: owner, name: 'Calendar IT Owner', email: `${owner}@example.invalid` },
        { id: outsider, name: 'Calendar IT Outsider', email: `${outsider}@example.invalid` },
      ]);
      created.push(owner, outsider);
      const [a] = await db.insert(plans).values({ userId: owner, name: 'Calendar IT owner plan', isActive: true }).returning({ id: plans.id });
      ownerPlan = a.id;
      const [b] = await db.insert(plans).values({ userId: outsider, name: 'Calendar IT outsider plan', isActive: true }).returning({ id: plans.id });
      outsiderPlan = b.id;
      await db.insert(planInstances).values({ planId: ownerPlan, instanceId: offering });
    } catch (error) {
      await cleanup();
      throw error;
    }
  });

  async function cleanup() {
    // Removing only our unique fixture users cascades their plans and preferences.
    for (const userId of created) {
      await db.delete(users).where(eq(users.id, userId));
    }
  }

  afterAll(async () => {
    await cleanup();
  });

  it('returns confirmed-empty state and isolates foreign plans', async () => {
    expect(await service.getPreferences(owner, ownerPlan)).toEqual({ hiddenGroups: [], occurrenceOverrides: [] });
    await expect(service.getPreferences(outsider, ownerPlan)).rejects.toBeInstanceOf(CalendarPlanNotFoundError);
    await expect(service.setGroupHidden(outsider, ownerPlan, group, true)).rejects.toBeInstanceOf(CalendarPlanNotFoundError);
    await expect(service.setOccurrenceVisibility(outsider, ownerPlan, { ...occurrence, visibility: 'hidden' })).rejects.toBeInstanceOf(CalendarPlanNotFoundError);
    expect(await service.getPreferences(outsider, outsiderPlan)).toEqual({ hiddenGroups: [], occurrenceOverrides: [] });
  });

  it('writes and resets sparse preferences idempotently', async () => {
    await service.setGroupHidden(owner, ownerPlan, group, true);
    await service.setGroupHidden(owner, ownerPlan, group, true);
    await service.setOccurrenceVisibility(owner, ownerPlan, { ...occurrence, visibility: 'visible' });
    await service.setOccurrenceVisibility(owner, ownerPlan, { ...occurrence, visibility: 'hidden' });
    const saved = await service.getPreferences(owner, ownerPlan);
    expect(saved.hiddenGroups).toEqual([group]);
    expect(saved.occurrenceOverrides).toEqual([{ ...occurrence, visibility: 'hidden' }]);
    await service.resetOccurrenceVisibility(owner, ownerPlan, occurrence);
    await service.resetOccurrenceVisibility(owner, ownerPlan, occurrence);
    await service.setGroupHidden(owner, ownerPlan, group, false);
    await service.setGroupHidden(owner, ownerPlan, group, false);
    expect(await service.getPreferences(owner, ownerPlan)).toEqual({ hiddenGroups: [], occurrenceOverrides: [] });
  });

  it('rejects absent offerings for new writes', async () => {
    const missing = { courseOfferingId: 'not-in-this-plan', studyGroupId: 'lecture-A' };
    await expect(service.setGroupHidden(owner, ownerPlan, missing, true)).rejects.toBeInstanceOf(CalendarOfferingNotInPlanError);
  });

  it('isolates identical study-group IDs across different offerings', async () => {
    const otherOffering = `calendar-it-other-${id}`;
    const otherGroup = { courseOfferingId: otherOffering, studyGroupId: group.studyGroupId };
    const otherOccurrence = {
      ...otherGroup,
      occurrenceKeyVersion: 1 as const,
      occurrenceKey: JSON.stringify([
        'series', otherOffering, otherGroup.studyGroupId, 'series-A', 1790000000000,
      ]),
    };

    await db.insert(planInstances).values({ planId: ownerPlan, instanceId: otherOffering });
    try {
      await service.setGroupHidden(owner, ownerPlan, group, true);
      await service.setOccurrenceVisibility(owner, ownerPlan, {
        ...occurrence, visibility: 'hidden',
      });

      // The same group ID under another offering must not inherit A's preferences.
      expect(await service.getPreferences(owner, ownerPlan)).toEqual({
        hiddenGroups: [group],
        occurrenceOverrides: [{ ...occurrence, visibility: 'hidden' }],
      });

      await service.setGroupHidden(owner, ownerPlan, otherGroup, true);
      await service.setOccurrenceVisibility(owner, ownerPlan, {
        ...otherOccurrence, visibility: 'visible',
      });
      const both = await service.getPreferences(owner, ownerPlan);
      expect(both.hiddenGroups).toHaveLength(2);
      expect(both.hiddenGroups).toEqual(expect.arrayContaining([group, otherGroup]));
      expect(both.occurrenceOverrides).toHaveLength(2);
      expect(both.occurrenceOverrides).toEqual(expect.arrayContaining([
        { ...occurrence, visibility: 'hidden' },
        { ...otherOccurrence, visibility: 'visible' },
      ]));

      // Resetting A must not remove or change B's preferences.
      await service.setGroupHidden(owner, ownerPlan, group, false);
      await service.resetOccurrenceVisibility(owner, ownerPlan, occurrence);
      expect(await service.getPreferences(owner, ownerPlan)).toEqual({
        hiddenGroups: [otherGroup],
        occurrenceOverrides: [{ ...otherOccurrence, visibility: 'visible' }],
      });
    } finally {
      await service.setGroupHidden(owner, ownerPlan, group, false);
      await service.resetOccurrenceVisibility(owner, ownerPlan, occurrence);
      await service.setGroupHidden(owner, ownerPlan, otherGroup, false);
      await service.resetOccurrenceVisibility(owner, ownerPlan, otherOccurrence);
      await db.delete(planInstances).where(and(
        eq(planInstances.planId, ownerPlan),
        eq(planInstances.instanceId, otherOffering),
      ));
    }
  });

  it('retains dormant rows after offering removal and permits reset', async () => {
    await service.setGroupHidden(owner, ownerPlan, group, true);
    await service.setOccurrenceVisibility(owner, ownerPlan, { ...occurrence, visibility: 'visible' });
    await db.delete(planInstances).where(and(eq(planInstances.planId, ownerPlan), eq(planInstances.instanceId, offering)));
    const dormant = await service.getPreferences(owner, ownerPlan);
    expect(dormant.hiddenGroups).toHaveLength(1);
    expect(dormant.occurrenceOverrides).toHaveLength(1);
    await expect(service.setGroupHidden(owner, ownerPlan, group, true)).rejects.toBeInstanceOf(CalendarOfferingNotInPlanError);
    await service.resetOccurrenceVisibility(owner, ownerPlan, occurrence);
    await service.setGroupHidden(owner, ownerPlan, group, false);
    expect(await service.getPreferences(owner, ownerPlan)).toEqual({ hiddenGroups: [], occurrenceOverrides: [] });
    await db.insert(planInstances).values({ planId: ownerPlan, instanceId: offering });
  });

  it('accepts long keys and rejects invalid keys', async () => {
    const longKey = JSON.stringify(['fallback', offering, group.studyGroupId, 1790000000000, 1790003600000, ['room-A'], false, false, 'ä漢'.repeat(1500)]);
    const longOccurrence = { ...group, occurrenceKeyVersion: 1 as const, occurrenceKey: longKey };
    await service.setOccurrenceVisibility(owner, ownerPlan, { ...longOccurrence, visibility: 'hidden' });
    expect((await service.getPreferences(owner, ownerPlan)).occurrenceOverrides[0].occurrenceKey).toBe(longKey);
    await service.resetOccurrenceVisibility(owner, ownerPlan, longOccurrence);
    await expect(service.setOccurrenceVisibility(owner, ownerPlan, { ...occurrence, occurrenceKey: 'invalid', visibility: 'hidden' })).rejects.toBeInstanceOf(InvalidOccurrenceKeyError);
  });

  it('cascades preferences when the plan is deleted', async () => {
    await service.setGroupHidden(owner, ownerPlan, group, true);
    await service.setOccurrenceVisibility(owner, ownerPlan, { ...occurrence, visibility: 'visible' });
    await db.delete(plans).where(eq(plans.id, ownerPlan));
    expect(await db.select().from(calendarHiddenGroups).where(eq(calendarHiddenGroups.planId, ownerPlan))).toEqual([]);
    expect(await db.select().from(calendarOccurrenceOverrides).where(eq(calendarOccurrenceOverrides.planId, ownerPlan))).toEqual([]);
    await expect(service.getPreferences(owner, ownerPlan)).rejects.toBeInstanceOf(CalendarPlanNotFoundError);
  });
});
