import { and, eq } from 'drizzle-orm';
import { db } from '../db';
import {
  calendarHiddenGroups,
  calendarOccurrenceOverrides,
  planInstances,
  plans,
} from '../db/schema';
import {
  CalendarIdentityCollisionError,
  CalendarOfferingNotInPlanError,
  CalendarPlanNotFoundError,
} from '../domain/calendar/preferences';
import type {
  CalendarGroupIdentity,
  CalendarOccurrenceIdentity,
  CalendarOccurrencePreference,
  CalendarPreferences,
} from '../domain/calendar/preferences';
import {
  CALENDAR_GROUP_ID_MAX_BYTES,
  CALENDAR_OFFERING_ID_MAX_CHARACTERS,
  hashOccurrenceKey,
  InvalidOccurrenceKeyError,
  validateOccurrenceKey,
} from '../domain/calendar/occurrenceKey';

function validateGroup(input: CalendarGroupIdentity): void {
  if (
    typeof input?.courseOfferingId !== 'string' ||
    input.courseOfferingId.length === 0 ||
    input.courseOfferingId.length > CALENDAR_OFFERING_ID_MAX_CHARACTERS ||
    typeof input.studyGroupId !== 'string' ||
    Buffer.byteLength(input.studyGroupId, 'utf8') < 1 ||
    Buffer.byteLength(input.studyGroupId, 'utf8') > CALENDAR_GROUP_ID_MAX_BYTES
  ) {
    throw new InvalidOccurrenceKeyError('Invalid Calendar group identity');
  }
}

function validateOccurrence(input: CalendarOccurrenceIdentity): void {
  validateGroup(input);
  validateOccurrenceKey(input);
}

async function requirePlanOwner(userId: string, planId: string): Promise<void> {
  const [plan] = await db
    .select({ id: plans.id })
    .from(plans)
    .where(and(eq(plans.id, planId), eq(plans.userId, userId)))
    .limit(1);

  if (!plan) throw new CalendarPlanNotFoundError();
}

async function requireOffering(planId: string, courseOfferingId: string): Promise<void> {
  const [offering] = await db
    .select({ instanceId: planInstances.instanceId })
    .from(planInstances)
    .where(and(
      eq(planInstances.planId, planId),
      eq(planInstances.instanceId, courseOfferingId),
    ))
    .limit(1);

  if (!offering) throw new CalendarOfferingNotInPlanError();
}

function groupWhere(planId: string, input: CalendarGroupIdentity) {
  return and(
    eq(calendarHiddenGroups.planId, planId),
    eq(calendarHiddenGroups.courseOfferingId, input.courseOfferingId),
    eq(calendarHiddenGroups.studyGroupId, input.studyGroupId),
  );
}

function occurrenceWhere(planId: string, input: CalendarOccurrenceIdentity, hash: string) {
  return and(
    eq(calendarOccurrenceOverrides.planId, planId),
    eq(calendarOccurrenceOverrides.courseOfferingId, input.courseOfferingId),
    eq(calendarOccurrenceOverrides.studyGroupId, input.studyGroupId),
    eq(calendarOccurrenceOverrides.occurrenceKeyVersion, input.occurrenceKeyVersion),
    eq(calendarOccurrenceOverrides.occurrenceKeyHash, hash),
  );
}

export class CalendarPreferencesService {
  static async getPreferences(userId: string, planId: string): Promise<CalendarPreferences> {
    await requirePlanOwner(userId, planId);

    const hiddenGroups = await db
      .select({
        courseOfferingId: calendarHiddenGroups.courseOfferingId,
        studyGroupId: calendarHiddenGroups.studyGroupId,
      })
      .from(calendarHiddenGroups)
      .where(eq(calendarHiddenGroups.planId, planId));

    const occurrenceOverrides = await db
      .select({
        courseOfferingId: calendarOccurrenceOverrides.courseOfferingId,
        studyGroupId: calendarOccurrenceOverrides.studyGroupId,
        occurrenceKeyVersion: calendarOccurrenceOverrides.occurrenceKeyVersion,
        occurrenceKey: calendarOccurrenceOverrides.occurrenceKey,
        visibility: calendarOccurrenceOverrides.visibility,
      })
      .from(calendarOccurrenceOverrides)
      .where(eq(calendarOccurrenceOverrides.planId, planId));

    return { hiddenGroups, occurrenceOverrides };
  }

  static async setGroupHidden(
    userId: string,
    planId: string,
    input: CalendarGroupIdentity,
    hidden: boolean,
  ): Promise<void> {
    validateGroup(input);
    if (typeof hidden !== 'boolean') {
      throw new InvalidOccurrenceKeyError('Expected a boolean hidden flag');
    }
    await requirePlanOwner(userId, planId);

    if (!hidden) {
      // Resets work even if the offering has been removed from the plan.
      await db.delete(calendarHiddenGroups).where(groupWhere(planId, input));
      return;
    }

    await requireOffering(planId, input.courseOfferingId);
    await db.insert(calendarHiddenGroups)
      .values({ planId, ...input })
      .onConflictDoUpdate({
        target: [
          calendarHiddenGroups.planId,
          calendarHiddenGroups.courseOfferingId,
          calendarHiddenGroups.studyGroupId,
        ],
        set: { updatedAt: new Date() },
      });
  }

  static async setOccurrenceVisibility(
    userId: string,
    planId: string,
    input: CalendarOccurrencePreference,
  ): Promise<void> {
    validateOccurrence(input);
    if (input.visibility !== 'visible' && input.visibility !== 'hidden') {
      throw new InvalidOccurrenceKeyError('Invalid visibility');
    }
    await requirePlanOwner(userId, planId);
    await requireOffering(planId, input.courseOfferingId);

    const updated = await db.insert(calendarOccurrenceOverrides)
      .values({ planId, ...input, occurrenceKeyHash: hashOccurrenceKey(input) })
      .onConflictDoUpdate({
        target: [
          calendarOccurrenceOverrides.planId,
          calendarOccurrenceOverrides.courseOfferingId,
          calendarOccurrenceOverrides.studyGroupId,
          calendarOccurrenceOverrides.occurrenceKeyVersion,
          calendarOccurrenceOverrides.occurrenceKeyHash,
        ],
        set: { visibility: input.visibility, updatedAt: new Date() },
        // A digest match must never overwrite a different serialized key.
        setWhere: eq(calendarOccurrenceOverrides.occurrenceKey, input.occurrenceKey),
      })
      .returning({ occurrenceKey: calendarOccurrenceOverrides.occurrenceKey });

    if (updated.length !== 1) throw new CalendarIdentityCollisionError();
  }

  static async resetOccurrenceVisibility(
    userId: string,
    planId: string,
    input: CalendarOccurrenceIdentity,
  ): Promise<void> {
    validateOccurrence(input);
    await requirePlanOwner(userId, planId);
    const keyHash = hashOccurrenceKey(input);
    const where = occurrenceWhere(planId, input, keyHash);

    // Check for a digest collision; the delete also matches the exact key.
    const [stored] = await db
      .select({ occurrenceKey: calendarOccurrenceOverrides.occurrenceKey })
      .from(calendarOccurrenceOverrides)
      .where(where)
      .limit(1);
    if (stored && stored.occurrenceKey !== input.occurrenceKey) {
      throw new CalendarIdentityCollisionError();
    }

    await db.delete(calendarOccurrenceOverrides).where(and(
      where,
      eq(calendarOccurrenceOverrides.occurrenceKey, input.occurrenceKey),
    ));
  }
}
