// Quick script to fetch your Cal.com event types and their IDs
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

console.log('🔍 Fetching your Cal.com event types...\n');

try {
  const response = await fetch(`${CAL_API_URL}/event-types`, {
    headers: {
      'Authorization': `Bearer ${CAL_API_KEY}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const error = await response.text();
    console.error(`❌ API Error (${response.status}):`, error);
    process.exit(1);
  }

  const data = await response.json();

  // Extract event types from nested structure
  let eventTypes = [];

  if (data.data?.eventTypeGroups) {
    // Flatten all event types from all groups
    data.data.eventTypeGroups.forEach(group => {
      if (group.eventTypes && Array.isArray(group.eventTypes)) {
        eventTypes = eventTypes.concat(group.eventTypes);
      }
    });
  }

  if (!eventTypes || eventTypes.length === 0) {
    console.log('⚠️  No event types found. Create one at https://app.cal.com/event-types\n');
    process.exit(0);
  }

  console.log(`✅ Found ${eventTypes.length} event type(s):\n`);

  eventTypes.forEach((eventType, index) => {
    console.log(`${index + 1}. "${eventType.title}"`);
    console.log(`   📅 ID: ${eventType.id}`);
    console.log(`   🔗 Slug: ${eventType.slug}`);
    console.log(`   ⏱️  Duration: ${eventType.length} minutes`);
    console.log(`   👁️  Hidden: ${eventType.hidden ? 'Yes' : 'No'}`);
    console.log('');
  });

  console.log('💡 Use any of these IDs as "calendarId" in your API requests\n');

} catch (error) {
  console.error('❌ Error:', error.message);
  process.exit(1);
}
