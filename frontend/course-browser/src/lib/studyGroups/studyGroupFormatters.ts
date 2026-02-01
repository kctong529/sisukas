// src/lib/studyGroups/studyGroupFormatters.ts
import type { StudyEvent } from "../../domain/models/StudyEvent";

type EventLike = {
  startIso?: string;
  start: string;
  endIso?: string;
  end: string;
};

function toDate(x: string | undefined): Date | null {
  if (!x) return null;
  const d = new Date(x);
  return Number.isNaN(d.getTime()) ? null : d;
}

function eventStart(e: EventLike): Date | null {
  return toDate(e.startIso ?? e.start);
}

function eventEnd(e: EventLike): Date | null {
  return toDate(e.endIso ?? e.end);
}

/**
 * Aggregates a set of events into a compact weekly-ish pattern:
 * "Mon, Wed 10:15 - 12:00 | Fri 14:15 - 16:00"
 */
export function formatSchedulePattern(events: EventLike[]): string {
  if (!events?.length) return "No events";

  const timeSlotMap = new Map<string, Set<string>>();

  for (const e of events) {
    const start = eventStart(e);
    const end = eventEnd(e);
    if (!start || !end) continue;

    const day = start.toLocaleDateString("en-US", { weekday: "short" });
    const startTime = start.toLocaleTimeString("en-FI", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    const endTime = end.toLocaleTimeString("en-FI", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });

    const slot = `${startTime} - ${endTime}`;
    if (!timeSlotMap.has(slot)) timeSlotMap.set(slot, new Set());
    timeSlotMap.get(slot)!.add(day);
  }

  if (timeSlotMap.size === 0) return "No events";

  const patterns: string[] = [];
  for (const [slot, days] of timeSlotMap.entries()) {
    patterns.push(`${Array.from(days).join(", ")} ${slot}`);
  }

  return patterns.join(" | ");
}

/**
 * Formats a concrete event instance time:
 * "Mon 1.2 10:15 – 12:00"
 */
export function formatEventTimeRange(e: EventLike): string {
  const start = eventStart(e);
  const end = eventEnd(e);

  if (!start || !end) return "Invalid time";

  const dateStr = start.toLocaleDateString("en-FI", {
    weekday: "short",
    month: "numeric",
    day: "numeric",
  });

  const startTime = start.toLocaleTimeString("en-FI", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  const endTime = end.toLocaleTimeString("en-FI", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  return `${dateStr} ${startTime} – ${endTime}`;
}

/**
 * Convenience wrappers for your domain type, so components can pass StudyEvent[] directly.
 */
export function formatStudyEventSchedule(events: StudyEvent[]): string {
  return formatSchedulePattern(events);
}

export function formatStudyEventTime(e: StudyEvent): string {
  return formatEventTimeRange(e);
}
