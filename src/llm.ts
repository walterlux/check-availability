import Anthropic from '@anthropic-ai/sdk';
import { DateTime } from 'luxon';
import type { LLMDateParseResponse, PromptContext, Env } from './types';
import { validateLLMResponse } from './validation';

/**
 * Build the prompt for date/time parsing
 */
function buildDateParsingPrompt(context: PromptContext): string {
  // Use custom prompt if provided
  if (context.systemPrompt) {
    return context.systemPrompt
      .replace('{currentTime}', context.currentTime)
      .replace('{timezone}', context.timezone)
      .replace('{userQuery}', context.userQuery)
      .replace('{rejectedTimes}', formatRejectedTimes(context.rejectedTimes));
  }

  // Default optimized prompt for Haiku
  return `You are a precise date/time parser for a calendar booking system.

**Current Context:**
- Current time: ${context.currentTime}
- Timezone: ${context.timezone}
${context.rejectedTimes && context.rejectedTimes.trim().length > 0
  ? `- Previously rejected times (AVOID these): ${formatRejectedTimes(context.rejectedTimes)}`
  : ''}

**User Query:** "${context.userQuery}"

**Your Task:**
Parse the user's natural language query into a specific date/time range. Return JSON with:
1. startTime: Beginning of the desired time range (ISO 8601)
2. endTime: End of the desired time range (ISO 8601)
3. interpretation: Brief explanation of your parsing
4. confidence: Score 0.0-1.0 indicating certainty

**Parsing Rules:**

1. **Relative Dates:**
   - "today" → today's date
   - "tomorrow" → current date + 1 day
   - "next Tuesday", "this Friday" → upcoming day of week
   - "in 2 days", "3 days from now" → current date + N days
   - "next week" → 7 days from now

2. **Absolute Dates:**
   - "March 31st" → March 31 of current year (or next year if past)
   - "12/25", "Dec 25" → December 25
   - "March 31st 2026" → specific year

3. **Time Expressions:**
   - "morning" → 9:00 AM - 12:00 PM
   - "around lunch" / "lunchtime" → 11:30 AM - 1:30 PM
   - "afternoon" → 1:00 PM - 5:00 PM
   - "evening" → 5:00 PM - 8:00 PM
   - "same time" → use current hour from context
   - Specific times: "2pm", "14:00", "2:30pm"

4. **Default Ranges:**
   - If no time specified → assume 9:00 AM - 5:00 PM (business hours)
   - If only start time → end time = start + 1 hour
   - Be conservative: prefer 1-2 hour ranges

5. **Rejected Times:**
   - These are ISO 8601 timestamps (comma-separated) that the user has already declined
   - Do NOT suggest times that match or overlap with rejected times
   - Avoid suggesting times within 30 minutes of rejected slots
   - Consider these as unavailable when interpreting the user's query

6. **Confidence Scoring:**
   - 0.9-1.0: Explicit date + time ("tomorrow at 2pm")
   - 0.7-0.9: Explicit date, implied time ("tomorrow afternoon")
   - 0.5-0.7: Relative date with time phrase ("in a few days around lunch")
   - 0.3-0.5: Vague query ("sometime next week")
   - 0.0-0.3: Unparseable or ambiguous

**Output Format (MUST be valid JSON):**
{
  "startTime": "2025-10-31T14:00:00-04:00",
  "endTime": "2025-10-31T15:00:00-04:00",
  "interpretation": "User requested tomorrow afternoon, suggesting 2-3pm",
  "confidence": 0.85
}

**Critical:**
- All times MUST include timezone offset matching ${context.timezone}
- All times MUST be in ISO 8601 format
- Return ONLY the JSON object, no additional text`;
}

function formatRejectedTimes(rejectedTimes?: string): string {
  if (!rejectedTimes || rejectedTimes.trim().length === 0) return '';

  return rejectedTimes.trim();
}

/**
 * LLM Date Parser using Claude Haiku
 */
export class LLMDateParser {
  private anthropic: Anthropic;
  private timeout: number;
  private model: string;

  constructor(apiKey: string, timeout: number = 10000) {
    this.anthropic = new Anthropic({ apiKey });
    this.timeout = timeout;
    this.model = 'claude-3-haiku-20240307';
  }

  /**
   * Parse natural language date query
   * Returns null if parsing fails or confidence too low
   */
  async parse(context: PromptContext): Promise<LLMDateParseResponse | null> {
    const startTime = Date.now();

    try {
      const prompt = buildDateParsingPrompt(context);

      // Call Claude with timeout using AbortController
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      try {
        const response = await this.anthropic.messages.create(
          {
            model: this.model,
            max_tokens: 300,
            temperature: 0.3, // Low temperature for consistency
            messages: [
              {
                role: 'user',
                content: prompt,
              },
            ],
          },
          {
            signal: controller.signal as AbortSignal,
          }
        );

        clearTimeout(timeoutId);

        // Extract text response
        const textContent = response.content.find(
          (block) => block.type === 'text'
        );

        if (!textContent || textContent.type !== 'text') {
          console.error('No text content in LLM response');
          return null;
        }

        // Parse JSON (extract from response in case LLM adds extra text)
        let parsed: unknown;
        try {
          const jsonMatch = textContent.text.match(/\{[\s\S]*\}/);
          const jsonStr = jsonMatch ? jsonMatch[0] : textContent.text;
          parsed = JSON.parse(jsonStr);
        } catch (jsonError) {
          console.error('Failed to parse LLM JSON:', textContent.text);
          return null;
        }

        // Validate schema
        const validated = validateLLMResponse(parsed);
        if (!validated) {
          return null;
        }

        // Check confidence threshold
        if (validated.confidence < 0.5) {
          console.warn(
            `LLM confidence too low: ${validated.confidence}, using fallback`
          );
          return null;
        }

        // Validate times are reasonable
        const start = DateTime.fromISO(validated.startTime);
        const end = DateTime.fromISO(validated.endTime);

        if (!start.isValid || !end.isValid) {
          console.error('Invalid ISO dates from LLM');
          return null;
        }

        if (end <= start) {
          console.error('End time before start time');
          return null;
        }

        // Log metrics
        const latency = Date.now() - startTime;
        console.log(
          JSON.stringify({
            event: 'llm_parse_success',
            latency_ms: latency,
            confidence: validated.confidence,
            query: context.userQuery,
            input_tokens: response.usage.input_tokens,
            output_tokens: response.usage.output_tokens,
            cost:
              (response.usage.input_tokens * 0.25) / 1_000_000 +
              (response.usage.output_tokens * 1.25) / 1_000_000,
          })
        );

        return validated;
      } catch (fetchError) {
        clearTimeout(timeoutId);

        if (fetchError instanceof Error && fetchError.name === 'AbortError') {
          console.error('LLM call timed out');
        } else {
          console.error('LLM API error:', fetchError);
        }
        return null;
      }
    } catch (error) {
      console.error('LLM parsing error:', error);
      return null;
    }
  }
}

/**
 * Factory function for creating LLM parser
 */
export function createLLMParser(env: Env): LLMDateParser {
  return new LLMDateParser(env.ANTHROPIC_API_KEY, 10000);
}
