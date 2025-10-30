// Test the Cal.com slots API to verify it exists
import fs from 'fs';

// Read API key from .dev.vars
const devVars = fs.readFileSync('.dev.vars', 'utf-8');
const calApiKeyMatch = devVars.match(/CAL_API_KEY=(.+)/);

if (!calApiKeyMatch) {
  console.error('❌ CAL_API_KEY not found in .dev.vars');
  process.exit(1);
}

const CAL_API_KEY = calApiKeyMatch[1].trim();
const CAL_API_URL = 'https://api.cal.com/v2';

// Test parameters
const eventTypeId = '3788110'; // Your 30 Min Meeting
const dateFrom = new Date().toISOString();
const dateTo = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(); // +7 days
const duration = 30;
const timeZone = 'America/Los_Angeles';

const params = new URLSearchParams({
  startTime: dateFrom,
  endTime: dateTo,
  eventTypeId,
  duration: duration.toString(),
  timeZone,
});

const url = `${CAL_API_URL}/slots/available?${params}`;

console.log('🔍 Testing Cal.com slots API...\n');
console.log('📍 URL:', url);
console.log('');

try {
  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${CAL_API_KEY}`,
      'Content-Type': 'application/json',
    },
  });

  console.log(`📊 Response Status: ${response.status} ${response.statusText}\n`);

  const text = await response.text();

  if (!response.ok) {
    console.error('❌ API Error Response:');
    console.error(text);
    process.exit(1);
  }

  const data = JSON.parse(text);
  console.log('✅ Success! API Response:\n');
  console.log(JSON.stringify(data, null, 2));

} catch (error) {
  console.error('❌ Error:', error.message);
  process.exit(1);
}
