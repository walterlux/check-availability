import { DateTime } from 'luxon';
import { createLLMParser } from './llm';
import { fallbackParse } from './fallback-parser';
import { queryCalAvailability } from './cal-client';
import type {
  AvailabilityRequest,
  AvailabilityResponse,
  ParseDateResult,
  CalSlot,
  ProposedSlot,
  Env,
} from './types';

/**
 * Parse user query into start/end times using LLM or fallback
 */
async function parseUserQuery(
  userQuery: string,
  timezone: string,
  rejectedTimes: string[] | undefined,
  systemPrompt: string | undefined,
  env: Env
): Promise<ParseDateResult> {
  const currentTime = DateTime.now().setZone(timezone).toISO()!;

  // Attempt 1: LLM parsing (primary)
  const llmParser = createLLMParser(env);
  const llmResult = await llmParser.parse({
    currentTime,
    timezone,
    userQuery,
    rejectedTimes,
    systemPrompt,
  });

  if (llmResult) {
    // LLM success with good confidence
    return {
      ...llmResult,
      method: 'llm',
    };
  }

  // Attempt 2: Fallback to chrono-node
  console.log(
    'LLM parsing failed or low confidence, using chrono-node fallback'
  );

  const fallbackResult = fallbackParse(
    userQuery,
    currentTime,
    timezone,
    rejectedTimes
  );

  return {
    ...fallbackResult,
    method:
      fallbackResult.confidence > 0.5 ? 'fallback_chrono' : 'fallback_default',
  };
}

/**
 * Apply flexibility hours to time range
 */
function applyFlexibility(
  start: string,
  end: string,
  flexibilityHours: number
): { start: string; end: string } {
  const startDt = DateTime.fromISO(start);
  const endDt = DateTime.fromISO(end);

  return {
    start: startDt.minus({ hours: flexibilityHours }).toISO()!,
    end: endDt.plus({ hours: flexibilityHours }).toISO()!,
  };
}

/**
 * Get guaranteed slots with expanding search
 */
async function getGuaranteedSlots(
  parseResult: ParseDateResult,
  flexibilityHours: number,
  calendarId: string,
  duration: number,
  timezone: string,
  rejectedTimes: string[] | undefined,
  env: Env
): Promise<{ available: CalSlot[]; proposed: ProposedSlot[] }> {
  const llmStart = DateTime.fromISO(parseResult.startTime);
  const llmEnd = DateTime.fromISO(parseResult.endTime);

  // Define search attempts with expanding ranges
  const attempts = [
    {
      range: applyFlexibility(
        parseResult.startTime,
        parseResult.endTime,
        flexibilityHours
      ),
      label: 'requested_range',
    },
    {
      range: {
        start: llmStart.minus({ hours: 24 }).toISO()!,
        end: llmEnd.plus({ hours: 24 }).toISO()!,
      },
      label: 'plus_24h',
    },
    {
      range: {
        start: llmStart.minus({ days: 7 }).toISO()!,
        end: llmEnd.plus({ days: 7 }).toISO()!,
      },
      label: 'plus_7d',
    },
    {
      range: {
        start: llmStart.toISO()!,
        end: llmStart.plus({ days: 30 }).toISO()!,
      },
      label: 'next_30d',
    },
  ];

  let allSlots: CalSlot[] = [];
  let attemptNumber = 0;
  const calApiStart = Date.now();

  for (const attempt of attempts) {
    attemptNumber++;
    console.log(`Attempt ${attemptNumber}: Searching ${attempt.label}`);

    try {
      const slots = await queryCalAvailability(
        {
          dateFrom: attempt.range.start,
          dateTo: attempt.range.end,
          eventTypeId: calendarId,
          duration,
          timeZone: timezone,
        },
        env
      );

      // Filter rejected times
      const filtered = slots.filter(
        (slot) => !rejectedTimes?.includes(slot.start)
      );

      if (filtered.length > 0) {
        allSlots = filtered;
        console.log(`Found ${filtered.length} slots in ${attempt.label}`);
        break; // Found slots, stop expanding
      }
    } catch (error) {
      console.error(`Attempt ${attemptNumber} failed:`, error);
      // Continue to next attempt
    }
  }

  const calApiMs = Date.now() - calApiStart;

  // GUARANTEE: If still no slots, throw error
  if (allSlots.length === 0) {
    throw new Error(
      'No availability found in the next 30 days. Please contact directly.'
    );
  }

  // Categorize: available vs proposed
  const available = allSlots.filter((slot) => {
    const slotStart = DateTime.fromISO(slot.start);
    return slotStart >= llmStart && slotStart <= llmEnd;
  });

  const proposed = allSlots
    .filter((slot) => !available.some((a) => a.start === slot.start))
    .map((slot) => {
      const slotStart = DateTime.fromISO(slot.start);
      const distanceMinutes = Math.abs(
        slotStart.diff(llmStart, 'minutes').minutes
      );
      return {
        ...slot,
        distanceMinutes,
        reason: calculateReason(slotStart, llmStart),
      };
    })
    .sort((a, b) => a.distanceMinutes - b.distanceMinutes)
    .slice(0, 10); // Top 10 alternatives

  return { available, proposed, calApiMs } as any;
}

/**
 * Calculate reason for proposed slot
 */
function calculateReason(slotStart: DateTime, requestedStart: DateTime): string {
  const diff = slotStart.diff(requestedStart, 'hours').hours;

  if (Math.abs(diff) < 3) {
    return 'Very close to requested time';
  } else if (diff > 0 && diff < 24) {
    return 'Same day, later time';
  } else if (diff < 0 && diff > -24) {
    return 'Same day, earlier time';
  } else if (diff > 0) {
    return `${Math.floor(diff / 24)} days later`;
  } else {
    return `${Math.floor(Math.abs(diff) / 24)} days earlier`;
  }
}

/**
 * Main orchestrator: Check availability
 */
export async function checkAvailability(
  request: AvailabilityRequest,
  env: Env
): Promise<AvailabilityResponse> {
  const totalStart = Date.now();
  const llmStart = Date.now();

  // Step 1: Parse user query
  const parseResult = await parseUserQuery(
    request.userQuery,
    request.timezone,
    request.rejectedTimes,
    request.systemPrompt,
    env
  );

  const llmMs = Date.now() - llmStart;

  // Step 2: Get slots with guaranteed non-empty proposed list
  const { available, proposed, calApiMs } = (await getGuaranteedSlots(
    parseResult,
    request.flexibilityHours,
    request.calendarId,
    request.duration,
    request.timezone,
    request.rejectedTimes,
    env
  )) as any;

  const totalMs = Date.now() - totalStart;

  // Step 3: Build response with metadata
  const searchRange = applyFlexibility(
    parseResult.startTime,
    parseResult.endTime,
    request.flexibilityHours
  );

  return {
    success: true,
    available,
    proposed,
    metadata: {
      parsedIntent: {
        requestedStart: parseResult.startTime,
        requestedEnd: parseResult.endTime,
        interpretation: parseResult.interpretation,
        confidence: parseResult.confidence,
        parsingMethod: parseResult.method,
      },
      searchRange,
      timings: {
        llmMs: parseResult.method === 'llm' ? llmMs : undefined,
        calApiMs,
        totalMs,
      },
    },
  };
}
