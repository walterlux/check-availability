import type { CalSlot, CalAvailabilityResponse, Env } from './types';

export interface CalAvailabilityOptions {
  dateFrom: string; // ISO 8601
  dateTo: string;
  eventTypeId: string;
  duration: number;
  timeZone: string;
}

/**
 * Query Cal.com availability API with timeout
 */
export async function queryCalAvailability(
  options: CalAvailabilityOptions,
  env: Env
): Promise<CalSlot[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000); // 5s timeout

  try {
    const baseUrl = env.CAL_API_URL || 'https://api.cal.com/v2';

    const params = new URLSearchParams({
      startTime: options.dateFrom,
      endTime: options.dateTo,
      eventTypeId: options.eventTypeId,
      duration: options.duration.toString(),
      timeZone: options.timeZone,
    });

    const url = `${baseUrl}/slots/available?${params}`;

    console.log(
      JSON.stringify({
        event: 'cal_api_request',
        url,
        params: {
          dateFrom: options.dateFrom,
          dateTo: options.dateTo,
          eventTypeId: options.eventTypeId,
        },
      })
    );

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${env.CAL_API_KEY}`,
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(
        JSON.stringify({
          event: 'cal_api_error',
          status: response.status,
          statusText: response.statusText,
          error: errorText,
        })
      );
      throw new Error(`Cal.com API error: ${response.status} - ${errorText}`);
    }

    const data: CalAvailabilityResponse = await response.json();

    // Transform Cal.com response format to our format
    const slots: CalSlot[] = [];
    if (data.data?.slots) {
      for (const [_date, timeSlots] of Object.entries(data.data.slots)) {
        for (const slot of timeSlots) {
          // Each slot only has a start time, we need to calculate end time based on duration
          const start = slot.time;
          const end = new Date(
            new Date(start).getTime() + options.duration * 60 * 1000
          ).toISOString();
          slots.push({ start, end });
        }
      }
    }

    console.log(
      JSON.stringify({
        event: 'cal_api_success',
        slots_count: slots.length,
      })
    );

    return slots;
  } catch (error) {
    clearTimeout(timeout);

    if (error instanceof Error && error.name === 'AbortError') {
      console.error('Cal.com API timeout');
      throw new Error('Cal.com API timeout');
    }
    throw error;
  }
}
