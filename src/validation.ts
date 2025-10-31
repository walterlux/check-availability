import { z } from 'zod';
import { US_TIMEZONES } from './types';

// Conversation message schema
const ConversationMessageSchema = z.object({
  role: z.enum(['user', 'assistant', 'system']),
  content: z.string(),
  timestamp: z.string(),
});

// Request validation schema (matches ElevenLabs tool schema)
export const AvailabilityRequestSchema = z.object({
  timeZone: z.enum(US_TIMEZONES),
  userMessage: z.string().min(1).max(2000),
  flexibilityHours: z.number().min(0).max(24).default(2),
  systemPrompt: z.string().max(10000).optional(),
  rejectedTimes: z.array(z.string()).max(50).optional(),
  duration: z.number().int().min(15).max(180).default(30),
  conversationHistory: z.array(ConversationMessageSchema).optional(),
});

// LLM response validation schema
export const LLMDateParseResponseSchema = z.object({
  startTime: z.string().datetime({ offset: true }),
  endTime: z.string().datetime({ offset: true }),
  interpretation: z.string().min(10).max(200),
  confidence: z.number().min(0).max(1),
});

export type AvailabilityRequestInput = z.infer<typeof AvailabilityRequestSchema>;
export type LLMDateParseResponseValidated = z.infer<typeof LLMDateParseResponseSchema>;

// Validate LLM response helper
export function validateLLMResponse(raw: unknown): LLMDateParseResponseValidated | null {
  try {
    return LLMDateParseResponseSchema.parse(raw);
  } catch (error) {
    console.error('LLM response validation failed:', error);
    return null;
  }
}
