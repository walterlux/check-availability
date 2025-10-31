// Environment bindings for Cloudflare Worker
export interface Env {
  ANTHROPIC_API_KEY: string;
  CAL_API_KEY: string;
  CAL_API_URL?: string;
  CALENDAR_ID: string;
  DEFAULT_FLEXIBILITY_HOURS?: string;
  DEFAULT_DURATION_MINUTES?: string;
}

// US Timezones
export const US_TIMEZONES = [
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Phoenix',
  'America/Anchorage',
  'Pacific/Honolulu',
] as const;

export type USTimezone = typeof US_TIMEZONES[number];

// LLM parsing result
export interface LLMDateParseResponse {
  startTime: string; // ISO 8601 with timezone
  endTime: string;
  interpretation: string;
  confidence: number; // 0.0 - 1.0
}

export interface ParseDateResult extends LLMDateParseResponse {
  method: 'llm' | 'fallback_chrono' | 'fallback_default';
}

// Cal.com API types
export interface CalSlot {
  start: string; // ISO 8601
  end: string;
}

export interface CalAvailabilityResponse {
  data: {
    slots: {
      [date: string]: Array<{ time: string }>;
    };
  };
}

// Conversation message for context
export interface ConversationMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
}

// API Request/Response types
export interface AvailabilityRequest {
  timeZone: USTimezone;
  userMessage: string;
  flexibilityHours: number;
  systemPrompt?: string;
  rejectedTimes?: string;
  duration: number;
  conversationHistory?: ConversationMessage[];
}

export interface ProposedSlot extends CalSlot {
  reason: string;
  distanceMinutes: number;
}

export interface AvailabilityResponse {
  success: true;
  available: string[];
  proposed: string[];
  metadata: {
    parsedIntent: {
      requestedStart: string;
      requestedEnd: string;
      interpretation: string;
      confidence: number;
      parsingMethod: string;
    };
    searchRange: {
      start: string;
      end: string;
    };
    timings: {
      llmMs?: number;
      calApiMs: number;
      totalMs: number;
    };
  };
}

export interface ErrorResponse {
  success: false;
  error: string;
  code: string;
  details?: unknown;
  timestamp: string;
}

// Prompt context for LLM
export interface PromptContext {
  currentTime: string;
  timezone: string;
  userQuery: string;
  rejectedTimes?: string;
  systemPrompt?: string;
}
