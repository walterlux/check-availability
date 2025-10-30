import type { ErrorResponse } from './types';

/**
 * Create JSON response helper
 */
export function jsonResponse(
  data: unknown,
  status: number = 200
): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}

/**
 * Handle CORS preflight
 */
export function handleCORS(): Response {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
    },
  });
}

/**
 * Create error response
 */
export function errorResponse(
  error: string,
  code: string,
  status: number = 500,
  details?: unknown
): Response {
  const response: ErrorResponse = {
    success: false,
    error,
    code,
    details,
    timestamp: new Date().toISOString(),
  };

  return jsonResponse(response, status);
}
