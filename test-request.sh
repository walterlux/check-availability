#!/bin/bash

# Test script for Cal.com Availability Checker API
# Usage: ./test-request.sh [local|production] [EVENT_TYPE_ID]

ENVIRONMENT=${1:-local}
EVENT_TYPE_ID=${2:-"YOUR_EVENT_TYPE_ID"}

if [ "$ENVIRONMENT" = "local" ]; then
  URL="http://localhost:8787/check-availability"
  echo "Testing LOCAL environment: $URL"
else
  URL="https://cal-availability-checker.YOUR_SUBDOMAIN.workers.dev/check-availability"
  echo "Testing PRODUCTION environment: $URL"
  echo "⚠️  Update the URL in this script with your actual Worker URL"
fi

echo ""
echo "📅 Test 1: Tomorrow around lunch"
curl -X POST "$URL" \
  -H "Content-Type: application/json" \
  -d '{
    "timezone": "America/New_York",
    "userQuery": "tomorrow around lunch",
    "calendarId": "'"$EVENT_TYPE_ID"'",
    "flexibilityHours": 2,
    "duration": 30
  }' | jq '.'

echo ""
echo ""
echo "📅 Test 2: Next Tuesday morning"
curl -X POST "$URL" \
  -H "Content-Type: application/json" \
  -d '{
    "timezone": "America/Los_Angeles",
    "userQuery": "next Tuesday morning",
    "calendarId": "'"$EVENT_TYPE_ID"'",
    "duration": 30
  }' | jq '.'

echo ""
echo ""
echo "📅 Test 3: With rejected times"
curl -X POST "$URL" \
  -H "Content-Type: application/json" \
  -d '{
    "timezone": "America/Chicago",
    "userQuery": "today at 2pm",
    "calendarId": "'"$EVENT_TYPE_ID"'",
    "rejectedTimes": ["2025-10-29T14:00:00-05:00"],
    "duration": 30
  }' | jq '.'

echo ""
echo ""
echo "📅 Test 4: Error handling - invalid timezone"
curl -X POST "$URL" \
  -H "Content-Type: application/json" \
  -d '{
    "timezone": "Invalid/Timezone",
    "userQuery": "tomorrow",
    "calendarId": "'"$EVENT_TYPE_ID"'"
  }' | jq '.'

echo ""
echo ""
echo "✅ Tests complete!"
echo ""
echo "Notes:"
echo "- Make sure to replace YOUR_EVENT_TYPE_ID with your actual Cal.com event type ID"
echo "- For production tests, update the Worker URL in this script"
echo "- Install jq for pretty JSON output: brew install jq"
