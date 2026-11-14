import { createHash, randomUUID } from 'node:crypto';
import { Client } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq, sql } from 'drizzle-orm';
import { db } from '../../src/db';
import {
  calendarHiddenGroups,
  calendarOccurrenceOverrides,
  plans,
  users,
} from '../../src/db/schema';
import { verifyCalendarTestDatabase } from './testDatabase';

// Opt-in and test-project-only. This suite tests Supabase Auth RLS policy
// semantics, NOT Better Auth session propagation through the backend.
const suite = process.env.CALENDAR_RLS_TEST === 'yes' ? describe : describe.skip;

suite('Calendar preferences: restricted-role RLS (Supabase Test only)', () => {
  const suffix = randomUUID();
  // auth.uid() returns a UUID; Better Auth normally uses separate text IDs.
  const ownerId = randomUUID();
  const outsiderId = randomUUID();
  const offering = `calendar-rls-${suffix}`;
  const groupId = 'lecture-A';
  const occurrenceKey = JSON.stringify(['series', offering, groupId, 'series-A', 1790000000000]);
  const occurrenceHash = createHash('sha256').update(occurrenceKey, 'utf8').digest('hex');
  let fixtureUsersCreated = false;
  let ownerPlan: string;
  let outsiderPlan: string;

  async function cleanup(): Promise<void> {
    // These uniquely generated fixture users cascade to their plans and rows.
    await db.delete(users).where(eq(users.id, ownerId));
    await db.delete(users).where(eq(users.id, outsiderId));
  }

  async function asRole<T>(
    role: 'anon' | 'authenticated',
    identity: string | null,
    operation: (client: Client) => Promise<T>,
  ): Promise<T> {
    const client = new Client({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
    });
    await client.connect();
    try {
      await client.query('BEGIN');
      await client.query(role === 'anon' ? 'SET LOCAL ROLE anon' : 'SET LOCAL ROLE authenticated');
      // Both claims are transaction-scoped on this physical connection.
      await client.query('SELECT set_config($1, $2, true)', [
        'request.jwt.claim.sub', identity ?? '',
      ]);
      await client.query('SELECT set_config($1, $2, true)', [
        'request.jwt.claims', JSON.stringify(identity ? { sub: identity, role } : { role }),
      ]);
      return await operation(client);
    } finally {
      // Also undo any INSERT/UPDATE/DELETE that a successful policy permitted.
      try { await client.query('ROLLBACK'); } finally { await client.end(); }
    }
  }

  beforeAll(async () => {
    verifyCalendarTestDatabase();
    const schema = await db.execute<{ groups: string | null; overrides: string | null }>(sql`
      SELECT to_regclass('public.calendar_hidden_groups')::text AS groups,
        to_regclass('public.calendar_occurrence_overrides')::text AS overrides
    `);
    if (!schema.rows[0]?.groups || !schema.rows[0]?.overrides) {
      throw new Error('Calendar migration 0005 is missing in Supabase Test');
    }
    try {
      await db.insert(users).values([
        { id: ownerId, name: 'Calendar RLS Owner', email: `calendar-rls-${ownerId}@example.invalid` },
        { id: outsiderId, name: 'Calendar RLS Outsider', email: `calendar-rls-${outsiderId}@example.invalid` },
      ]);
      fixtureUsersCreated = true;
      const [a] = await db.insert(plans).values({ userId: ownerId, name: 'RLS owner plan', isActive: true }).returning({ id: plans.id });
      ownerPlan = a.id;
      const [b] = await db.insert(plans).values({ userId: outsiderId, name: 'RLS outsider plan', isActive: true }).returning({ id: plans.id });
      outsiderPlan = b.id;
      await db.insert(calendarHiddenGroups).values([
        { planId: ownerPlan, courseOfferingId: offering, studyGroupId: groupId },
        { planId: outsiderPlan, courseOfferingId: offering, studyGroupId: groupId },
      ]);
      await db.insert(calendarOccurrenceOverrides).values([
        { planId: ownerPlan, courseOfferingId: offering, studyGroupId: groupId, occurrenceKeyVersion: 1, occurrenceKey, occurrenceKeyHash: occurrenceHash, visibility: 'hidden' },
        { planId: outsiderPlan, courseOfferingId: offering, studyGroupId: groupId, occurrenceKeyVersion: 1, occurrenceKey, occurrenceKeyHash: occurrenceHash, visibility: 'visible' },
      ]);
    } catch (error) {
      await cleanup();
      throw error;
    }
  });

  afterAll(async () => {
    if (fixtureUsersCreated) await cleanup();
  });

  it('denies anon access to both tables at the grant boundary', async () => {
    await asRole('anon', null, async client => {
      const result = await client.query<{ can_groups_read: boolean; can_overrides_read: boolean; can_groups_insert: boolean; can_overrides_insert: boolean }>(`
        SELECT
          has_table_privilege(current_user, 'public.calendar_hidden_groups', 'SELECT') AS can_groups_read,
          has_table_privilege(current_user, 'public.calendar_occurrence_overrides', 'SELECT') AS can_overrides_read,
          has_table_privilege(current_user, 'public.calendar_hidden_groups', 'INSERT') AS can_groups_insert,
          has_table_privilege(current_user, 'public.calendar_occurrence_overrides', 'INSERT') AS can_overrides_insert
      `);
      expect(result.rows[0]).toEqual({
        can_groups_read: false, can_overrides_read: false,
        can_groups_insert: false, can_overrides_insert: false,
      });
    });
  });

  it('exposes no preference rows to authenticated role without a JWT subject', async () => {
    await asRole('authenticated', null, async client => {
      expect((await client.query('SELECT * FROM public.calendar_hidden_groups')).rows).toEqual([]);
      expect((await client.query('SELECT * FROM public.calendar_occurrence_overrides')).rows).toEqual([]);
    });
  });

  for (const identity of ['owner', 'outsider'] as const) {
    it(`allows ${identity} to see their own plan and both preference types, but not foreign rows`, async () => {
      const userId = identity === 'owner' ? ownerId : outsiderId;
      const ownPlan = identity === 'owner' ? ownerPlan : outsiderPlan;
      await asRole('authenticated', userId, async client => {
        const ownPlans = await client.query('SELECT id FROM public.plans WHERE id = $1', [ownPlan]);
        expect(ownPlans.rows).toHaveLength(1);
        for (const table of ['calendar_hidden_groups', 'calendar_occurrence_overrides']) {
          const rows = await client.query(`SELECT plan_id FROM public.${table} WHERE course_offering_id = $1`, [offering]);
          expect(rows.rows).toEqual([{ plan_id: ownPlan }]);
        }
      });
    });
  }

  it('rejects an authenticated insert into another user’s plan for both preference tables', async () => {
    await asRole('authenticated', ownerId, async client => {
      await expect(client.query(
        'INSERT INTO public.calendar_hidden_groups (plan_id, course_offering_id, study_group_id) VALUES ($1, $2, $3)',
        [outsiderPlan, offering, 'foreign-attempt'],
      )).rejects.toMatchObject({ code: '42501' });
    });
    await asRole('authenticated', ownerId, async client => {
      await expect(client.query(`
        INSERT INTO public.calendar_occurrence_overrides
          (plan_id, course_offering_id, study_group_id, occurrence_key, occurrence_key_hash, visibility)
        VALUES ($1, $2, $3, $4, $5, 'hidden')
      `, [outsiderPlan, offering, 'foreign-attempt', occurrenceKey, occurrenceHash])).rejects.toMatchObject({ code: '42501' });
    });
  });

  it('does not update or delete foreign preferences', async () => {
    await asRole('authenticated', ownerId, async client => {
      const update = await client.query(`
        UPDATE public.calendar_occurrence_overrides SET visibility = 'hidden'
        WHERE plan_id = $1 AND course_offering_id = $2
      `, [outsiderPlan, offering]);
      expect(update.rowCount).toBe(0);
      const groupDelete = await client.query(
        'DELETE FROM public.calendar_hidden_groups WHERE plan_id = $1', [outsiderPlan],
      );
      expect(groupDelete.rowCount).toBe(0);
      const overrideDelete = await client.query(
        'DELETE FROM public.calendar_occurrence_overrides WHERE plan_id = $1', [outsiderPlan],
      );
      expect(overrideDelete.rowCount).toBe(0);
    });
    const foreign = await db.select().from(calendarOccurrenceOverrides).where(eq(calendarOccurrenceOverrides.planId, outsiderPlan));
    expect(foreign).toHaveLength(1);
    expect(foreign[0].visibility).toBe('visible');
  });

  it('allows owner writes within the restricted role without persisting test edits', async () => {
    await asRole('authenticated', ownerId, async client => {
      const insert = await client.query(
        'INSERT INTO public.calendar_hidden_groups (plan_id, course_offering_id, study_group_id) VALUES ($1, $2, $3)',
        [ownerPlan, offering, 'owner-new-group'],
      );
      expect(insert.rowCount).toBe(1);
      const update = await client.query(`
        UPDATE public.calendar_occurrence_overrides SET visibility = 'visible'
        WHERE plan_id = $1 AND course_offering_id = $2
      `, [ownerPlan, offering]);
      expect(update.rowCount).toBe(1);
      const remove = await client.query(
        'DELETE FROM public.calendar_hidden_groups WHERE plan_id = $1 AND study_group_id = $2',
        [ownerPlan, 'owner-new-group'],
      );
      expect(remove.rowCount).toBe(1);
    });
  });
});
