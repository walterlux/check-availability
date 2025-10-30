# Deployment Guide

## Prerequisites

1. Cloudflare account with Workers enabled
2. Anthropic API key (get from https://console.anthropic.com/)
3. Cal.com API key (get from https://app.cal.com/settings/developer/api-keys)

## Quick Start

### 1. Install Wrangler CLI (if not already installed)

```bash
npm install -g wrangler
```

### 2. Authenticate with Cloudflare

```bash
wrangler login
```

### 3. Set up secrets

```bash
# Set Anthropic API key
wrangler secret put ANTHROPIC_API_KEY
# Enter your key when prompted

# Set Cal.com API key
wrangler secret put CAL_API_KEY
# Enter your key when prompted
```

### 4. Deploy to production

```bash
npm run deploy
```

## Local Development

### 1. Create .dev.vars file

```bash
cp .dev.vars.example .dev.vars
```

### 2. Edit .dev.vars with your keys

```
ANTHROPIC_API_KEY=sk-ant-api03-...
CAL_API_KEY=cal_live_...
```

### 3. Start development server

```bash
npm run dev
```

The server will start at `http://localhost:8787`

### 4. Test locally

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

## Configuration

### Update wrangler.toml (optional)

```toml
name = "cal-availability-checker"
main = "src/index.ts"
compatibility_date = "2024-10-29"

[vars]
DEFAULT_FLEXIBILITY_HOURS = "2"
DEFAULT_DURATION_MINUTES = "30"
CAL_API_URL = "https://api.cal.com/v2"
```

## Getting Your Cal.com Event Type ID

1. Go to https://app.cal.com/event-types
2. Click on your event type
3. The ID is in the URL: `https://app.cal.com/event-types/[EVENT_TYPE_ID]`

## Monitoring

### View logs in real-time

```bash
wrangler tail
```

### View deployment info

```bash
wrangler deployments list
```

## Rollback

If you need to rollback to a previous version:

```bash
wrangler rollback [DEPLOYMENT_ID]
```

## Performance Targets

- **p95 Latency**: <2s
- **Error Rate**: <1%
- **LLM Fallback Rate**: <10%

## Cost Monitoring

Expected costs for 10,000 requests/day:

- **Cloudflare Workers**: Free (under 100K req/day)
- **Anthropic API**: ~$1.70/day (~$51/month)
- **Total**: ~$51/month

Set up billing alerts in Anthropic console to monitor usage.

## Troubleshooting

### "Missing ANTHROPIC_API_KEY"

Make sure you've set the secret:
```bash
wrangler secret put ANTHROPIC_API_KEY
```

### "Cal.com API error"

1. Verify your Cal.com API key is valid
2. Check that your event type ID is correct
3. Ensure Cal.com API v2 is accessible

### Build errors

```bash
# Clear cache and reinstall
rm -rf node_modules package-lock.json
npm install
```

### TypeScript errors

```bash
# Run type check
npm run build
```

## Production Checklist

- [ ] ANTHROPIC_API_KEY secret is set
- [ ] CAL_API_KEY secret is set
- [ ] Test with real Cal.com calendar
- [ ] Verify all timezones work correctly
- [ ] Test error handling (invalid requests)
- [ ] Set up monitoring/alerting
- [ ] Document your API endpoint for clients
- [ ] Test CORS if calling from browser

## Next Steps

1. Test the API with your Cal.com calendar
2. Set up monitoring dashboard
3. Configure rate limiting if needed
4. Add custom domain (optional)
5. Set up staging environment (optional)

## Support

For issues:
1. Check `wrangler tail` logs
2. Review error response details
3. Test with curl examples in README.md
