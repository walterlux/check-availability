# Cal.com Availability Checker API

Smart calendar availability checker with LLM-powered natural language date parsing.

## Features

- 🤖 **Natural Language Parsing**: Parse queries like "tomorrow around lunch", "March 31st", "two days same time"
- 🧠 **LLM Integration**: Uses Claude Haiku for intelligent date/time understanding
- ⚡ **Fast Fallback**: chrono-node backup parser for reliability
- 📅 **Cal.com Integration**: Direct integration with Cal.com API v2
- 🎯 **Guaranteed Results**: Expanding search ensures non-empty proposed slots
- 🌍 **Timezone Support**: Full support for US timezones with DST handling
- 🚀 **Cloudflare Workers**: Edge deployment for <2s p95 latency

## Architecture

```
Request → LLM Parser (Claude Haiku) → Cal.com API → Response
            ↓ (fallback)
         chrono-node parser
```

## Installation

```bash
cd /Users/samuelcho/cloudflare/check-availability
npm install
```

## Configuration

### 1. Local Development - Set up `.dev.vars`

For local development, create a `.dev.vars` file in the project root:

```bash
# Copy the example file
cp .dev.vars.example .dev.vars
```

Then add your API keys to `.dev.vars`:

```bash
ANTHROPIC_API_KEY=sk-ant-your-anthropic-api-key-here
CAL_API_KEY=cal_live_your-cal-api-key-here
```

**How to get your API keys:**

- **Anthropic API Key**: Get from https://console.anthropic.com/settings/keys
- **Cal.com API Key**: Get from https://app.cal.com/settings/developer/api-keys

**Important:** `.dev.vars` is gitignored and will never be committed to the repository. Your secrets are safe!

### 2. Production - Set up Cloudflare Secrets

For production deployment, use Cloudflare secrets:

```bash
# Anthropic API key
wrangler secret put ANTHROPIC_API_KEY

# Cal.com API key
wrangler secret put CAL_API_KEY
```

### 3. Update wrangler.toml (optional)

```toml
[vars]
DEFAULT_FLEXIBILITY_HOURS = "2"
DEFAULT_DURATION_MINUTES = "30"
CAL_API_URL = "https://api.cal.com/v2"
```

## Getting Your Cal.com Calendar ID

You need a Cal.com event type ID (calendar ID) to make requests. Here's how to find it:

### Option 1: Use the helper script

```bash
node get-calendar-ids.js
```

This will list all your event types with their IDs.

### Option 2: Find it in the Cal.com dashboard

1. Go to https://app.cal.com/event-types
2. Click on an event type
3. Look at the URL - the number at the end is your `calendarId`
   - Example: `https://app.cal.com/event-types/123456` → ID is `123456`

## Usage

### Development

```bash
npm run dev
# or
npx wrangler dev
```

The dev server will start at `http://localhost:8787` (or similar port).

### Deployment

```bash
npm run deploy
```

## API Reference

### POST /check-availability

Check calendar availability using natural language queries.

#### Request

```json
{
  "timezone": "America/New_York",
  "userQuery": "tomorrow around lunch",
  "calendarId": "your-event-type-id",
  "flexibilityHours": 2,
  "duration": 30,
  "rejectedTimes": ["2025-10-30T12:00:00-04:00"],
  "systemPrompt": "Optional custom LLM prompt"
}
```

**Required Fields:**
- `timezone` (string): US timezone enum
  - `America/New_York`, `America/Chicago`, `America/Denver`, `America/Los_Angeles`, `America/Phoenix`, `America/Anchorage`, `Pacific/Honolulu`
- `userQuery` (string): Natural language date/time query (max 500 chars)
- `calendarId` (string): Cal.com event type ID

**Optional Fields:**
- `flexibilityHours` (number): Time range flexibility, default: 2
- `duration` (number): Meeting duration in minutes, default: 30
- `rejectedTimes` (string[]): ISO 8601 timestamps to avoid (max 50)
- `systemPrompt` (string): Custom LLM prompt template (max 2000 chars)

#### Response (Success)

```json
{
  "success": true,
  "available": [
    {
      "start": "2025-10-30T12:00:00-04:00",
      "end": "2025-10-30T12:30:00-04:00"
    }
  ],
  "proposed": [
    {
      "start": "2025-10-30T14:00:00-04:00",
      "end": "2025-10-30T14:30:00-04:00",
      "reason": "Very close to requested time",
      "distanceMinutes": 120
    }
  ],
  "metadata": {
    "parsedIntent": {
      "requestedStart": "2025-10-30T12:00:00-04:00",
      "requestedEnd": "2025-10-30T13:00:00-04:00",
      "interpretation": "User requested tomorrow at lunch",
      "confidence": 0.85,
      "parsingMethod": "llm"
    },
    "searchRange": {
      "start": "2025-10-30T10:00:00-04:00",
      "end": "2025-10-30T15:00:00-04:00"
    },
    "timings": {
      "llmMs": 743,
      "calApiMs": 456,
      "totalMs": 1850
    }
  }
}
```

#### Response (Error)

```json
{
  "success": false,
  "error": "Request validation failed",
  "code": "VALIDATION_ERROR",
  "details": [...],
  "timestamp": "2025-10-29T12:00:00Z"
}
```

**Error Codes:**
- `METHOD_NOT_ALLOWED` (405): Use POST method
- `INVALID_JSON` (400): Request body is not valid JSON
- `VALIDATION_ERROR` (400): Request validation failed
- `CONFIG_ERROR` (500): Missing API keys
- `CAL_API_ERROR` (503): Cal.com API failure
- `NO_AVAILABILITY` (200): No slots found
- `PROCESSING_ERROR` (500): Generic processing error
- `INTERNAL_ERROR` (500): Unhandled server error

## Query Examples

| Query | Interpretation |
|-------|----------------|
| "tomorrow around lunch" | Tomorrow 11:30 AM - 1:30 PM |
| "next Tuesday morning" | Next Tuesday 9:00 AM - 12:00 PM |
| "March 31st at 2pm" | March 31st 2:00 PM - 3:00 PM |
| "in 2 days same time" | 2 days from now at current hour |
| "today at 3pm" | Today 3:00 PM - 4:00 PM |
| "afternoon" | Today 1:00 PM - 5:00 PM |
| "next week" | 7 days from now, business hours |

## How It Works

### 1. Date/Time Parsing

```
User Query → Claude Haiku LLM (10s timeout)
              ↓ (if fails or low confidence <0.5)
           chrono-node parser
              ↓ (if fails)
           Default: tomorrow 10 AM
```

### 2. Availability Search (Expanding)

```
1. Search: LLM time range ± flexibility hours
   ↓ (if no slots)
2. Expand: ± 24 hours
   ↓ (if no slots)
3. Expand: ± 7 days
   ↓ (if no slots)
4. Expand: Next 30 days
   ↓ (guaranteed non-empty)
```

### 3. Slot Categorization

- **Available**: Slots within LLM-suggested time range
- **Proposed**: Alternative slots sorted by proximity

## Performance

- **Target**: <2s p95 latency
- **LLM**: 500ms - 800ms typical (Claude Haiku)
- **Cal.com API**: 300ms - 800ms typical
- **Total**: ~1.2s - 1.8s typical

## Cost Estimate

- **LLM**: ~$0.00008 per request (Claude Haiku)
- **Cloudflare Workers**: Free tier: 100K req/day
- **10K requests/day**: ~$1.70/day = ~$51/month

## Monitoring

All operations are logged in JSON format:

```json
{
  "event": "availability_success",
  "total_ms": 1850,
  "available_count": 3,
  "proposed_count": 10,
  "parsing_method": "llm"
}
```

**Key Metrics to Track:**
- `total_ms`: Total request latency
- `llm_ms`: LLM parsing latency
- `cal_api_ms`: Cal.com API latency
- `parsing_method`: "llm" vs "fallback_chrono" vs "fallback_default"
- `available_count`: Number of exact matches
- `proposed_count`: Number of alternatives

**Alerts:**
- Error rate >5% for 5 minutes
- p95 latency >5s for 5 minutes
- LLM fallback rate >20% for 10 minutes

## Testing

### Manual Test

```bash
curl -X POST https://your-worker.workers.dev/check-availability \
  -H "Content-Type: application/json" \
  -d '{
    "timezone": "America/New_York",
    "userQuery": "tomorrow around lunch",
    "calendarId": "your-event-type-id",
    "duration": 30
  }'
```

### Test with rejected times

```bash
curl -X POST https://your-worker.workers.dev/check-availability \
  -H "Content-Type: application/json" \
  -d '{
    "timezone": "America/Los_Angeles",
    "userQuery": "next Tuesday afternoon",
    "calendarId": "your-event-type-id",
    "rejectedTimes": ["2025-11-04T14:00:00-08:00"]
  }'
```

## Project Structure

```
check-availability/
├── src/
│   ├── index.ts           # Main entry point, routing
│   ├── types.ts           # TypeScript interfaces
│   ├── validation.ts      # Zod schemas
│   ├── availability.ts    # Core orchestration
│   ├── llm.ts            # Claude Haiku integration
│   ├── fallback-parser.ts # chrono-node backup
│   ├── cal-client.ts     # Cal.com API client
│   └── utils.ts          # Utilities
├── wrangler.toml         # Cloudflare config
├── package.json
├── tsconfig.json
└── README.md
```

## Troubleshooting

### LLM timeouts

- Check `ANTHROPIC_API_KEY` is set correctly
- Verify network connectivity to api.anthropic.com
- Monitor fallback rate in logs

### Cal.com API errors

- Verify `CAL_API_KEY` is valid
- Check `calendarId` matches your event type ID
- Ensure Cal.com API v2 is accessible

### No availability found

- Try wider `flexibilityHours` (e.g., 4-6 hours)
- Check calendar actually has available slots
- Verify timezone is correct

## License

MIT

## Support

For issues, please check:
1. Cloudflare Workers logs: `wrangler tail`
2. Error response `details` field
3. Structured JSON logs for debugging
