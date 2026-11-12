import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PgDialect } from 'drizzle-orm/pg-core';

const database = vi.hoisted(() => {
  const selectRows: unknown[][] = [];
  const returning = vi.fn();
  const onConflictDoUpdate = vi.fn((_config: { setWhere: any }) => ({ returning }));
  const insertValues = vi.fn((_value: unknown) => ({ onConflictDoUpdate }));
  const deleteWhere = vi.fn(async (_clause: unknown) => undefined);
  const select = vi.fn(() => ({
    from: () => ({
      where: () => ({ limit: async () => selectRows.shift() ?? [] }),
    }),
  }));
  return {
    selectRows,
    returning,
    onConflictDoUpdate,
    insertValues,
    deleteWhere,
    db: {
      select,
      insert: vi.fn(() => ({ values: insertValues })),
      delete: vi.fn(() => ({ where: deleteWhere })),
    },
  };
});

vi.mock('../../src/db', () => ({ db: database.db }));

import { CalendarPreferencesService } from '../../src/services/CalendarPreferencesService';
import { CalendarIdentityCollisionError } from '../../src/domain/calendar/preferences';
import { hashOccurrenceKey } from '../../src/domain/calendar/occurrenceKey';

const userId = 'user-test';
const planId = '11111111-1111-4111-8111-111111111111';
const offeringId = 'offering-1';
const groupId = 'group-1';
const occurrence = {
  courseOfferingId: offeringId,
  studyGroupId: groupId,
  occurrenceKeyVersion: 1,
  occurrenceKey: JSON.stringify(['series', offeringId, groupId, 'series-1', 1790000000000]),
};
const otherKey = JSON.stringify(['series', offeringId, groupId, 'series-2', 1790000000000]);
const dialect = new PgDialect();

beforeEach(() => {
  vi.clearAllMocks();
  database.selectRows.length = 0;
});

describe('Calendar occurrence digest collision protection', () => {
  it('refuses an upsert when a matching digest belongs to another serialized key', async () => {
    database.selectRows.push([{ id: planId }], [{ instanceId: offeringId }]);
    // PostgreSQL returns zero rows when ON CONFLICT DO UPDATE ... WHERE
    // rejects an existing row. This simulates that result without violating
    // the live database's SHA-256 consistency constraint.
    database.returning.mockResolvedValueOnce([]);

    await expect(CalendarPreferencesService.setOccurrenceVisibility(
      userId, planId, { ...occurrence, visibility: 'hidden' },
    )).rejects.toBeInstanceOf(CalendarIdentityCollisionError);

    expect(database.onConflictDoUpdate).toHaveBeenCalledTimes(1);
    const config = database.onConflictDoUpdate.mock.calls[0]![0];
    const condition = dialect.sqlToQuery(config.setWhere);
    expect(condition.params).toContain(occurrence.occurrenceKey);
    expect(database.deleteWhere).not.toHaveBeenCalled();
  });

  it('accepts a matching-key upsert', async () => {
    database.selectRows.push([{ id: planId }], [{ instanceId: offeringId }]);
    database.returning.mockResolvedValueOnce([{ occurrenceKey: occurrence.occurrenceKey }]);

    await expect(CalendarPreferencesService.setOccurrenceVisibility(
      userId, planId, { ...occurrence, visibility: 'visible' },
    )).resolves.toBeUndefined();
    expect(database.insertValues).toHaveBeenCalledWith(expect.objectContaining({
      occurrenceKey: occurrence.occurrenceKey,
      occurrenceKeyHash: hashOccurrenceKey(occurrence),
    }));
  });

  it('refuses to reset an occurrence when the digest resolves to another key', async () => {
    database.selectRows.push([{ id: planId }], [{ occurrenceKey: otherKey }]);

    await expect(CalendarPreferencesService.resetOccurrenceVisibility(
      userId, planId, occurrence,
    )).rejects.toBeInstanceOf(CalendarIdentityCollisionError);
    expect(database.deleteWhere).not.toHaveBeenCalled();
  });

  it('deletes only the exact serialized key on reset', async () => {
    database.selectRows.push([{ id: planId }], [{ occurrenceKey: occurrence.occurrenceKey }]);

    await expect(CalendarPreferencesService.resetOccurrenceVisibility(
      userId, planId, occurrence,
    )).resolves.toBeUndefined();
    expect(database.deleteWhere).toHaveBeenCalledTimes(1);
    const clause = database.deleteWhere.mock.calls[0]![0];
    const query = dialect.sqlToQuery(clause);
    expect(query.params).toContain(occurrence.occurrenceKey);
    expect(query.params).toContain(hashOccurrenceKey(occurrence));
  });

  it('treats reset of an absent override as successful', async () => {
    database.selectRows.push([{ id: planId }], []);

    await expect(CalendarPreferencesService.resetOccurrenceVisibility(
      userId, planId, occurrence,
    )).resolves.toBeUndefined();
    expect(database.deleteWhere).toHaveBeenCalledTimes(1);
  });
});
