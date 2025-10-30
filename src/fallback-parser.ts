import * as chrono from 'chrono-node';
import { DateTime } from 'luxon';
import type { LLMDateParseResponse } from './types';

/**
 * Fallback date parser using chrono-node
 */
export function fallbackParse(
  userQuery: string,
  currentTime: string,
  timezone: string,
  rejectedTimes?: string[]
): LLMDateParseResponse {
  const now = DateTime.fromISO(currentTime, { zone: timezone });

  // Parse with chrono-node
  const parsed = chrono.parse(userQuery, now.toJSDate(), {
    forwardDate: true, // Always interpret dates in future
  });

  // Default to tomorrow 10 AM if no parse
  if (parsed.length === 0) {
    return defaultTimeSlot(now, 'fallback_no_parse');
  }

  // Take first parsed result
  const result = parsed[0];
  let start = DateTime.fromJSDate(result.start.date(), { zone: timezone });
  let end = result.end
    ? DateTime.fromJSDate(result.end.date(), { zone: timezone })
    : start.plus({ hours: 1 });

  // Apply time-of-day heuristics
  const queryLower = userQuery.toLowerCase();

  if (queryLower.includes('lunch')) {
    start = start.set({ hour: 11, minute: 30, second: 0, millisecond: 0 });
    end = start.plus({ hours: 2 });
  } else if (queryLower.includes('morning')) {
    start = start.set({ hour: 9, minute: 0, second: 0, millisecond: 0 });
    end = start.set({ hour: 12, minute: 0 });
  } else if (queryLower.includes('afternoon')) {
    start = start.set({ hour: 13, minute: 0, second: 0, millisecond: 0 });
    end = start.set({ hour: 17, minute: 0 });
  } else if (queryLower.includes('evening')) {
    start = start.set({ hour: 17, minute: 0, second: 0, millisecond: 0 });
    end = start.set({ hour: 20, minute: 0 });
  } else if (!result.start.isCertain('hour')) {
    // No time specified - default to 10 AM - 11 AM
    start = start.set({ hour: 10, minute: 0, second: 0, millisecond: 0 });
    end = start.plus({ hours: 1 });
  }

  // Handle "same time" query
  if (queryLower.includes('same time')) {
    start = start.set({
      hour: now.hour,
      minute: now.minute,
      second: 0,
      millisecond: 0,
    });
    end = start.plus({ hours: 1 });
  }

  // Avoid rejected times
  if (rejectedTimes && rejectedTimes.length > 0) {
    start = avoidRejectedTimes(start, rejectedTimes, timezone);
    end = start.plus({ hours: 1 });
  }

  return {
    startTime: start.toISO()!,
    endTime: end.toISO()!,
    interpretation: `Fallback parsing: "${userQuery}"`,
    confidence: 0.6, // Medium confidence for chrono-node
  };
}

/**
 * Default time slot when no parsing succeeds
 */
function defaultTimeSlot(
  now: DateTime,
  reason: string
): LLMDateParseResponse {
  // Default: tomorrow at 10 AM
  const tomorrow10am = now
    .plus({ days: 1 })
    .set({ hour: 10, minute: 0, second: 0, millisecond: 0 });

  return {
    startTime: tomorrow10am.toISO()!,
    endTime: tomorrow10am.plus({ hours: 1 }).toISO()!,
    interpretation: `No specific time detected, defaulting to tomorrow morning (${reason})`,
    confidence: 0.3,
  };
}

/**
 * Avoid rejected times by shifting proposed time
 */
function avoidRejectedTimes(
  proposedStart: DateTime,
  rejectedTimes: string[],
  timezone: string
): DateTime {
  const rejected = rejectedTimes.map((t) =>
    DateTime.fromISO(t, { zone: timezone })
  );

  // Check if proposed start is too close to any rejected time
  for (const rejectedTime of rejected) {
    const diffMinutes = Math.abs(
      proposedStart.diff(rejectedTime, 'minutes').minutes
    );

    if (diffMinutes < 30) {
      // Too close, shift by 1 hour
      return proposedStart.plus({ hours: 1 });
    }
  }

  return proposedStart;
}
