import type { Env } from './types';
import { AvailabilityRequestSchema } from './validation';
import { checkAvailability } from './availability';
import { jsonResponse, handleCORS, errorResponse } from './utils';
import { ZodError } from 'zod';

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return handleCORS();
    }

    // Only accept POST requests
    if (request.method !== 'POST') {
      return errorResponse(
        'Method not allowed. Use POST.',
        'METHOD_NOT_ALLOWED',
        405
      );
    }

    const url = new URL(request.url);

    try {
      // Route to check-availability endpoint
      if (url.pathname === '/check-availability') {
        return await handleCheckAvailability(request, env);
      }

      // Root endpoint - documentation
      if (url.pathname === '/') {
        return jsonResponse({
          service: 'Cal.com Availability Checker API',
          version: '1.0.0',
          endpoints: {
            '/check-availability': {
              method: 'POST',
              description:
                'Check calendar availability using natural language queries',
              requiredFields: {
                timezone: 'US timezone (America/New_York, etc.)',
                userQuery: 'Natural language date/time query',
                calendarId: 'Cal.com event type ID',
              },
              optionalFields: {
                flexibilityHours: 'number (default: 2)',
                systemPrompt: 'Custom LLM prompt',
                rejectedTimes: 'Array of ISO 8601 timestamps to avoid',
                duration: 'Meeting duration in minutes (default: 30)',
              },
            },
          },
          documentation: 'https://github.com/your-repo/cal-availability-checker',
        });
      }

      // Unknown endpoint
      return errorResponse(
        'Endpoint not found. Use /check-availability',
        'NOT_FOUND',
        404
      );
    } catch (error) {
      console.error('Unhandled error:', error);
      return errorResponse(
        'Internal server error',
        'INTERNAL_ERROR',
        500,
        error instanceof Error ? error.message : undefined
      );
    }
  },
};

/**
 * Handle availability checking request
 */
async function handleCheckAvailability(
  request: Request,
  env: Env
): Promise<Response> {
  const requestStart = Date.now();

  try {
    // Parse request body
    let body: unknown;
    try {
      body = await request.json();
    } catch (jsonError) {
      return errorResponse(
        'Invalid JSON in request body',
        'INVALID_JSON',
        400
      );
    }

    // Validate request schema
    let validatedRequest;
    try {
      validatedRequest = AvailabilityRequestSchema.parse(body);
    } catch (validationError) {
      if (validationError instanceof ZodError) {
        return errorResponse(
          'Request validation failed',
          'VALIDATION_ERROR',
          400,
          validationError.errors
        );
      }
      throw validationError;
    }

    // Validate environment variables
    if (!env.ANTHROPIC_API_KEY) {
      console.error('ANTHROPIC_API_KEY not configured');
      return errorResponse(
        'Service configuration error',
        'CONFIG_ERROR',
        500
      );
    }

    if (!env.CAL_API_KEY) {
      console.error('CAL_API_KEY not configured');
      return errorResponse(
        'Service configuration error',
        'CONFIG_ERROR',
        500
      );
    }

    // Log incoming request
    console.log(
      JSON.stringify({
        event: 'availability_request',
        timezone: validatedRequest.timezone,
        query: validatedRequest.userQuery,
        calendarId: validatedRequest.calendarId,
        flexibilityHours: validatedRequest.flexibilityHours,
      })
    );

    // Process availability check
    const result = await checkAvailability(validatedRequest, env);

    // Log success
    const totalMs = Date.now() - requestStart;
    console.log(
      JSON.stringify({
        event: 'availability_success',
        total_ms: totalMs,
        available_count: result.available.length,
        proposed_count: result.proposed.length,
        parsing_method: result.metadata.parsedIntent.parsingMethod,
      })
    );

    return jsonResponse(result);
  } catch (error) {
    const totalMs = Date.now() - requestStart;
    console.error(
      JSON.stringify({
        event: 'availability_error',
        total_ms: totalMs,
        error: error instanceof Error ? error.message : 'Unknown error',
      })
    );

    // Handle specific error types
    if (error instanceof Error) {
      // Cal.com API errors
      if (error.message.includes('Cal.com API')) {
        return errorResponse(
          'Failed to fetch calendar availability',
          'CAL_API_ERROR',
          503,
          error.message
        );
      }

      // No availability found
      if (error.message.includes('No availability found')) {
        return errorResponse(
          error.message,
          'NO_AVAILABILITY',
          200, // 200 because it's a valid response, just no slots
          { suggestion: 'Try a different time range or contact directly' }
        );
      }

      // LLM errors (already fallback handled, shouldn't reach here)
      if (error.message.includes('LLM')) {
        return errorResponse(
          'Failed to parse date/time query',
          'PARSING_ERROR',
          400,
          error.message
        );
      }
    }

    // Generic error
    return errorResponse(
      'Failed to check availability',
      'PROCESSING_ERROR',
      500,
      error instanceof Error ? error.message : undefined
    );
  }
}
