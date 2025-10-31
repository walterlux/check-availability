var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// src/index.ts
var EVENT_TYPE_ID = 3731065;
var src_default = {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return handleCORS();
    }
    if (request.method !== "POST") {
      return jsonResponse({
        success: false,
        error: "Method not allowed. Use POST."
      }, 405);
    }
    const url = new URL(request.url);
    if (url.pathname === "/availability" || url.pathname === "/") {
      return handleAvailability(request, env);
    } else if (url.pathname === "/booking") {
      return handleBooking(request, env);
    } else {
      return jsonResponse({
        success: false,
        error: "Invalid endpoint. Use /availability or /booking"
      }, 404);
    }
  }
};
async function handleAvailability(request, env) {
  try {
    const body = await request.json();
    const validation = validateRequest(body);
    if (!validation.valid) {
      return jsonResponse({
        success: false,
        error: validation.error
      }, 400);
    }
    const slots = await getCalAvailability(body, env.CAL_API_KEY);
    const filteredSlots = filterSlotsByTimeRange(
      slots,
      body.startTime,
      body.endTime
    );
    const response = {
      success: true,
      slots: filteredSlots,
      summary: generateSummary(filteredSlots),
      totalSlots: filteredSlots.length
    };
    return jsonResponse(response, 200);
  } catch (error) {
    console.error("Error processing availability request:", error);
    return jsonResponse({
      success: false,
      error: error instanceof Error ? error.message : "Internal server error"
    }, 500);
  }
}
__name(handleAvailability, "handleAvailability");
async function handleBooking(request, env) {
  try {
    const body = await request.json();
    const validation = validateBookingRequest(body);
    if (!validation.valid) {
      return jsonResponse({
        success: false,
        error: validation.error
      }, 400);
    }
    const booking = await createCalBooking(body, env.CAL_API_KEY);
    const response = {
      success: true,
      booking: {
        id: booking.id,
        uid: booking.uid,
        status: booking.status,
        start: booking.start,
        end: booking.end,
        bookingUrl: `https://cal.com/booking/${booking.uid}`
      }
    };
    return jsonResponse(response, 201);
  } catch (error) {
    console.error("Error processing booking request:", error);
    return jsonResponse({
      success: false,
      error: error instanceof Error ? error.message : "Internal server error"
    }, 500);
  }
}
__name(handleBooking, "handleBooking");
function validateRequest(body) {
  if (!body.startDate) {
    return { valid: false, error: "startDate is required (format: YYYY-MM-DD)" };
  }
  if (!body.endDate) {
    return { valid: false, error: "endDate is required (format: YYYY-MM-DD)" };
  }
  if (!body.startTime) {
    return { valid: false, error: "startTime is required (format: HH:MM in 24hr)" };
  }
  if (!body.endTime) {
    return { valid: false, error: "endTime is required (format: HH:MM in 24hr)" };
  }
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(body.startDate) || !dateRegex.test(body.endDate)) {
    return { valid: false, error: "Invalid date format. Use YYYY-MM-DD" };
  }
  const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
  if (!timeRegex.test(body.startTime) || !timeRegex.test(body.endTime)) {
    return { valid: false, error: "Invalid time format. Use HH:MM in 24-hour format" };
  }
  return { valid: true };
}
__name(validateRequest, "validateRequest");
async function getCalAvailability(params, apiKey) {
  const url = new URL("https://api.cal.com/v1/slots");
  url.searchParams.append("apiKey", apiKey);
  url.searchParams.append("startTime", `${params.startDate}T00:00:00`);
  url.searchParams.append("endTime", `${params.endDate}T23:59:59`);
  url.searchParams.append("eventTypeId", EVENT_TYPE_ID.toString());
  const response = await fetch(url.toString(), {
    method: "GET",
    headers: {
      "Content-Type": "application/json"
    }
  });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Cal.com API error (${response.status}): ${errorText}`);
  }
  return await response.json();
}
__name(getCalAvailability, "getCalAvailability");
function filterSlotsByTimeRange(calResponse, startTime, endTime) {
  const filtered = [];
  const [startHour, startMin] = startTime.split(":").map(Number);
  const [endHour, endMin] = endTime.split(":").map(Number);
  const startMinutes = startHour * 60 + startMin;
  const endMinutes = endHour * 60 + endMin;
  for (const [date, slots] of Object.entries(calResponse.slots)) {
    for (const slot of slots) {
      const slotDate = new Date(slot.time);
      const slotMinutes = slotDate.getHours() * 60 + slotDate.getMinutes();
      if (slotMinutes >= startMinutes && slotMinutes < endMinutes) {
        filtered.push({
          date,
          time: slot.time,
          displayTime: formatDisplayTime(slotDate),
          timezone: extractTimezone(slot.time)
        });
      }
    }
  }
  return filtered;
}
__name(filterSlotsByTimeRange, "filterSlotsByTimeRange");
function formatDisplayTime(date) {
  const options = {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZoneName: "short"
  };
  return date.toLocaleString("en-US", options);
}
__name(formatDisplayTime, "formatDisplayTime");
function extractTimezone(isoString) {
  const match = isoString.match(/([+-]\d{2}:\d{2}|Z)$/);
  return match ? match[1] : "UTC";
}
__name(extractTimezone, "extractTimezone");
function validateBookingRequest(body) {
  if (!body.startTime) {
    return { valid: false, error: "startTime is required (ISO 8601 format)" };
  }
  if (!body.attendeeEmail) {
    return { valid: false, error: "attendeeEmail is required" };
  }
  if (!body.attendeeName) {
    return { valid: false, error: "attendeeName is required" };
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(body.attendeeEmail)) {
    return { valid: false, error: "Invalid email format" };
  }
  return { valid: true };
}
__name(validateBookingRequest, "validateBookingRequest");
async function createCalBooking(params, apiKey) {
  const url = "https://api.cal.com/v2/bookings";
  const requestBody = {
    start: params.startTime,
    eventTypeId: EVENT_TYPE_ID,
    attendee: {
      name: params.attendeeName,
      email: params.attendeeEmail,
      timeZone: params.attendeeTimeZone || "UTC",
      ...params.attendeePhone && { phoneNumber: params.attendeePhone }
    },
    metadata: {
      source: "elevenlabs-ai-agent"
    }
  };
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
      "cal-api-version": "2024-08-13"
    },
    body: JSON.stringify(requestBody)
  });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Cal.com API error (${response.status}): ${errorText}`);
  }
  const result = await response.json();
  return result.data;
}
__name(createCalBooking, "createCalBooking");
function generateSummary(slots) {
  if (slots.length === 0) {
    return "No available slots found in the requested time range.";
  }
  const byDate = {};
  for (const slot of slots) {
    if (!byDate[slot.date]) {
      byDate[slot.date] = [];
    }
    byDate[slot.date].push(slot);
  }
  const dateCount = Object.keys(byDate).length;
  const totalSlots = slots.length;
  if (dateCount === 1) {
    const date = Object.keys(byDate)[0];
    const times = byDate[date].map((s) => s.displayTime).join(", ");
    return `Found ${totalSlots} available slot${totalSlots > 1 ? "s" : ""} on ${formatDate(date)}: ${times}`;
  }
  return `Found ${totalSlots} available slot${totalSlots > 1 ? "s" : ""} across ${dateCount} day${dateCount > 1 ? "s" : ""}`;
}
__name(generateSummary, "generateSummary");
function formatDate(dateString) {
  const date = /* @__PURE__ */ new Date(dateString + "T00:00:00");
  return date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric"
  });
}
__name(formatDate, "formatDate");
function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    }
  });
}
__name(jsonResponse, "jsonResponse");
function handleCORS() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    }
  });
}
__name(handleCORS, "handleCORS");
export {
  src_default as default
};
//# sourceMappingURL=index.js.map
