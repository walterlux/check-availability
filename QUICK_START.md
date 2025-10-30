# Quick Start Guide

Get your Cal.com Availability Checker API running in 5 minutes!

## 1. Prerequisites

- Node.js 18+ installed
- Cloudflare account ([sign up free](https://dash.cloudflare.com/sign-up))
- Anthropic API key ([get here](https://console.anthropic.com/))
- Cal.com API key ([get here](https://app.cal.com/settings/developer/api-keys))

## 2. Install Dependencies

```bash
cd /Users/samuelcho/cloudflare/check-availability
npm install
```

## 3. Set Up Local Development

### Create `.dev.vars` file:

```bash
cp .dev.vars.example .dev.vars
```

### Edit `.dev.vars` with your keys:

```
ANTHROPIC_API_KEY=sk-ant-api03-YOUR_KEY_HERE
CAL_API_KEY=cal_live_YOUR_KEY_HERE
```

## 4. Start Development Server

```bash
npm run dev
```

The API will be available at: `http://localhost:8787`

## 5. Test It!

### Get your Cal.com Event Type ID:

1. Go to https://app.cal.com/event-types
2. Click on your event type
3. Copy the ID from the URL

### Test with curl:

```bash
curl -X POST http://localhost:8787/check-availability \
  -H "Content-Type: application/json" \
  -d '{
    "timezone": "America/New_York",
    "userQuery": "tomorrow around lunch",
    "calendarId": "YOUR_EVENT_TYPE_ID",
    "duration": 30
  }'
```

### Or use the test script:

```bash
./test-request.sh local YOUR_EVENT_TYPE_ID
```

## 6. Deploy to Production

### Authenticate with Cloudflare:

```bash
wrangler login
```

### Set production secrets:

```bash
wrangler secret put ANTHROPIC_API_KEY
# Enter your key when prompted

wrangler secret put CAL_API_KEY
# Enter your key when prompted
```

### Deploy:

```bash
npm run deploy
```

Your API will be live at: `https://cal-availability-checker.YOUR_SUBDOMAIN.workers.dev`

## 7. Verify Deployment

```bash
curl -X POST https://cal-availability-checker.YOUR_SUBDOMAIN.workers.dev/check-availability \
  -H "Content-Type: application/json" \
  -d '{
    "timezone": "America/New_York",
    "userQuery": "tomorrow at 2pm",
    "calendarId": "YOUR_EVENT_TYPE_ID"
  }'
```

## Example Response

```json
{
  "success": true,
  "available": [
    {
      "start": "2025-10-30T14:00:00-04:00",
      "end": "2025-10-30T14:30:00-04:00"
    }
  ],
  "proposed": [
    {
      "start": "2025-10-30T15:00:00-04:00",
      "end": "2025-10-30T15:30:00-04:00",
      "reason": "Very close to requested time",
      "distanceMinutes": 60
    }
  ],
  "metadata": {
    "parsedIntent": {
      "requestedStart": "2025-10-30T14:00:00-04:00",
      "requestedEnd": "2025-10-30T15:00:00-04:00",
      "interpretation": "User requested tomorrow at 2pm",
      "confidence": 0.95,
      "parsingMethod": "llm"
    },
    "timings": {
      "llmMs": 743,
      "calApiMs": 456,
      "totalMs": 1850
    }
  }
}
```

## Common Query Examples

| Query | What it means |
|-------|---------------|
| `"tomorrow around lunch"` | Tomorrow 11:30 AM - 1:30 PM |
| `"next Tuesday morning"` | Next Tuesday 9:00 AM - 12:00 PM |
| `"today at 3pm"` | Today 3:00 PM |
| `"in 2 days same time"` | 2 days from now at current hour |
| `"March 31st at 2pm"` | March 31st 2:00 PM |

## Troubleshooting

### "Missing ANTHROPIC_API_KEY"
- Local: Check your `.dev.vars` file
- Production: Run `wrangler secret put ANTHROPIC_API_KEY`

### "Cal.com API error"
- Verify your Cal.com API key is valid
- Check your event type ID is correct
- Make sure the event type is active

### Can't connect to localhost
- Make sure `npm run dev` is running
- Check port 8787 is not in use

## Next Steps

- ✅ Read full [README.md](./README.md) for detailed API documentation
- ✅ Check [DEPLOYMENT.md](./DEPLOYMENT.md) for production best practices
- ✅ Review [IMPLEMENTATION_SUMMARY.md](./IMPLEMENTATION_SUMMARY.md) for architecture details
- ✅ Monitor logs with `wrangler tail`

## Need Help?

- Check the logs: `wrangler tail`
- Review error codes in README.md
- Test with the included `test-request.sh` script

---

**You're all set! 🚀**

Your API is now parsing natural language date queries and checking Cal.com availability.
