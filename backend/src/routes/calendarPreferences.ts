import { Router, type Request, type Response } from 'express';
import { requireAuth } from '../middleware/auth';
import { CalendarPreferencesService } from '../services/CalendarPreferencesService';
import {
  CalendarIdentityCollisionError,
  CalendarOfferingNotInPlanError,
  CalendarPlanNotFoundError,
} from '../domain/calendar/preferences';
import type {
  CalendarGroupIdentity,
  CalendarOccurrenceIdentity,
  CalendarOccurrencePreference,
} from '../domain/calendar/preferences';
import { InvalidOccurrenceKeyError } from '../domain/calendar/occurrenceKey';

// Mounted at /api/plans/:planId/calendar. mergeParams exposes the plan ID.
const router = Router({ mergeParams: true });
router.use(requireAuth);

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function bodyRecord(value: unknown): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new InvalidOccurrenceKeyError('Expected a JSON object');
  }
  return value as Record<string, unknown>;
}

function groupInput(value: unknown): CalendarGroupIdentity {
  const body = bodyRecord(value);
  if (typeof body.courseOfferingId !== 'string' || typeof body.studyGroupId !== 'string') {
    throw new InvalidOccurrenceKeyError('Expected courseOfferingId and studyGroupId strings');
  }
  return {
    courseOfferingId: body.courseOfferingId,
    studyGroupId: body.studyGroupId,
  };
}

function occurrenceInput(value: unknown): CalendarOccurrenceIdentity {
  const body = bodyRecord(value);
  const group = groupInput(body);
  if (typeof body.occurrenceKeyVersion !== 'number' || typeof body.occurrenceKey !== 'string') {
    throw new InvalidOccurrenceKeyError('Expected occurrenceKeyVersion and occurrenceKey');
  }
  return {
    ...group,
    occurrenceKeyVersion: body.occurrenceKeyVersion,
    occurrenceKey: body.occurrenceKey,
  };
}

function planIdFrom(req: Request): string {
  const value = req.params.planId;
  if (typeof value !== 'string' || !uuidPattern.test(value)) {
    throw new InvalidOccurrenceKeyError('Invalid plan ID');
  }
  return value;
}

function handleError(res: Response, error: unknown): void {
  if (error instanceof InvalidOccurrenceKeyError) {
    res.status(400).json({ error: 'Validation failed', message: error.message });
    return;
  }
  if (error instanceof CalendarPlanNotFoundError) {
    res.status(404).json({ error: 'Plan not found' });
    return;
  }
  if (error instanceof CalendarOfferingNotInPlanError) {
    res.status(409).json({ error: 'Offering not in plan' });
    return;
  }
  if (error instanceof CalendarIdentityCollisionError) {
    res.status(409).json({ error: 'Occurrence identity collision' });
    return;
  }
  console.error('Calendar preferences request failed:', error);
  res.status(500).json({ error: 'Calendar preference operation failed' });
}

router.get('/', async (req: Request, res: Response) => {
  try {
    const result = await CalendarPreferencesService.getPreferences(res.locals.user.id, planIdFrom(req));
    res.json(result);
  } catch (error) {
    handleError(res, error);
  }
});

router.put('/groups', async (req: Request, res: Response) => {
  try {
    const body = bodyRecord(req.body);
    if (typeof body.hidden !== 'boolean') {
      throw new InvalidOccurrenceKeyError('Expected boolean hidden');
    }
    await CalendarPreferencesService.setGroupHidden(
      res.locals.user.id, planIdFrom(req), groupInput(body), body.hidden,
    );
    res.status(204).end();
  } catch (error) {
    handleError(res, error);
  }
});

router.put('/occurrences', async (req: Request, res: Response) => {
  try {
    const body = bodyRecord(req.body);
    const identity = occurrenceInput(body);
    const planId = planIdFrom(req);
    if (body.visibility === null) {
      await CalendarPreferencesService.resetOccurrenceVisibility(res.locals.user.id, planId, identity);
    } else {
      if (body.visibility !== 'visible' && body.visibility !== 'hidden') {
        throw new InvalidOccurrenceKeyError('Expected visible, hidden, or null visibility');
      }
      const input: CalendarOccurrencePreference = { ...identity, visibility: body.visibility };
      await CalendarPreferencesService.setOccurrenceVisibility(res.locals.user.id, planId, input);
    }
    res.status(204).end();
  } catch (error) {
    handleError(res, error);
  }
});

export default router;
