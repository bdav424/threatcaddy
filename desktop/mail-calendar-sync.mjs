// desktop/mail-calendar-sync.mjs
//
// Google Calendar + Microsoft Graph calendar adapters. Runs in the Electron main process.
// All tokens are passed in by main.mjs (loaded from safeStorage); this module is stateless.
//
// Implements: fetchGoogleCalendar, createGoogleEvent, updateGoogleEvent, deleteGoogleEvent,
//             fetchMicrosoftCalendar, createMicrosoftEvent, updateMicrosoftEvent,
//             deleteMicrosoftEvent, getGraphToken
//
// Google uses the Calendar API v3 (https://www.googleapis.com/calendar/v3).
// Microsoft uses the Graph API v1.0 (https://graph.microsoft.com/v1.0).
// Proton has no calendar API — no-op: the sync hook simply won't call these for Proton.

// ─── helpers ─────────────────────────────────────────────────────────────────

async function gFetch(token, path, opts = {}) {
  const res = await fetch(`https://www.googleapis.com/calendar/v3${path}`, {
    ...opts,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(opts.headers ?? {}) },
  });
  if (!res.ok) throw new Error(`Google Calendar API ${res.status}: ${await res.text()}`);
  return res.status === 204 ? null : res.json();
}

async function msFetch(token, path, opts = {}) {
  const res = await fetch(`https://graph.microsoft.com/v1.0${path}`, {
    ...opts,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(opts.headers ?? {}) },
  });
  if (!res.ok) throw new Error(`Microsoft Graph API ${res.status}: ${await res.text()}`);
  return res.status === 204 ? null : res.json();
}

// Convert Google event → CalendarEvent shape
function fromGoogleEvent(e) {
  const allDay = Boolean(e.start?.date && !e.start?.dateTime);
  return {
    id: `gcal-${e.id}`,
    remoteId: e.id,
    title: e.summary ?? '(no title)',
    start: allDay ? `${e.start.date}T00:00:00.000Z` : e.start.dateTime,
    end:   allDay ? `${e.end.date}T23:59:59.000Z`   : e.end.dateTime,
    allDay,
    source: 'Google Calendar',
    detail: e.description ?? '',
    location: e.location ?? '',
    conferenceApp: e.conferenceData?.conferenceSolution?.name ?? '',
    conferenceUrl: e.conferenceData?.entryPoints?.find(ep => ep.entryPointType === 'video')?.uri ?? '',
    etag: e.etag ?? undefined,
    updatedAt: e.updated ? new Date(e.updated).getTime() : undefined,
    syncState: 'synced',
  };
}

// Convert CalendarEvent → Google event body
function toGoogleEvent(event) {
  const body = {
    summary: event.title,
    description: event.detail ?? '',
    location: event.location ?? '',
  };
  if (event.allDay) {
    const date = event.start.slice(0, 10);
    body.start = { date };
    body.end   = { date: event.end.slice(0, 10) };
  } else {
    body.start = { dateTime: event.start };
    body.end   = { dateTime: event.end };
  }
  return body;
}

// Convert Microsoft event → CalendarEvent shape
function fromMicrosoftEvent(e) {
  const allDay = e.isAllDay ?? false;
  return {
    id: `mscal-${e.id}`,
    remoteId: e.id,
    title: e.subject ?? '(no title)',
    start: e.start?.dateTime ? `${e.start.dateTime}Z` : e.start.dateTime,
    end:   e.end?.dateTime   ? `${e.end.dateTime}Z`   : e.end.dateTime,
    allDay,
    source: 'Microsoft 365',
    detail: e.bodyPreview ?? '',
    location: e.location?.displayName ?? '',
    conferenceApp: e.onlineMeeting ? 'Teams' : '',
    conferenceUrl: e.onlineMeeting?.joinUrl ?? '',
    etag: e['@odata.etag'] ?? undefined,
    updatedAt: e.lastModifiedDateTime ? new Date(e.lastModifiedDateTime).getTime() : undefined,
    syncState: 'synced',
  };
}

// Convert CalendarEvent → Microsoft event body
function toMicrosoftEvent(event) {
  return {
    subject: event.title,
    body: { contentType: 'Text', content: event.detail ?? '' },
    location: { displayName: event.location ?? '' },
    isAllDay: event.allDay,
    start: { dateTime: event.start.replace('Z', ''), timeZone: 'UTC' },
    end:   { dateTime: event.end.replace('Z', ''),   timeZone: 'UTC' },
  };
}

// ─── Google Calendar ──────────────────────────────────────────────────────────

export async function fetchGoogleCalendar(token, { timeMinISO, timeMaxISO }) {
  const params = new URLSearchParams({
    calendarId: 'primary',
    timeMin: timeMinISO,
    timeMax: timeMaxISO,
    singleEvents: 'true',
    orderBy: 'startTime',
    maxResults: '2500',
  });
  const data = await gFetch(token, `/calendars/primary/events?${params}`);
  return (data.items ?? []).map(fromGoogleEvent);
}

export async function createGoogleEvent(token, event) {
  const data = await gFetch(token, '/calendars/primary/events', {
    method: 'POST',
    body: JSON.stringify(toGoogleEvent(event)),
  });
  return { remoteId: data.id, etag: data.etag };
}

export async function updateGoogleEvent(token, event) {
  const data = await gFetch(token, `/calendars/primary/events/${encodeURIComponent(event.remoteId)}`, {
    method: 'PUT',
    body: JSON.stringify(toGoogleEvent(event)),
  });
  return { remoteId: data.id, etag: data.etag };
}

export async function deleteGoogleEvent(token, remoteId) {
  await gFetch(token, `/calendars/primary/events/${encodeURIComponent(remoteId)}`, { method: 'DELETE' });
  return { ok: true };
}

// ─── Microsoft Graph Calendar ─────────────────────────────────────────────────

// Exchange a refresh token for a Graph-scoped access token.
// Microsoft mail (IMAP/SMTP) tokens use the Office 365 Exchange audience;
// Graph Calendar needs Calendars.ReadWrite in the Graph audience — must re-exchange.
export async function getGraphToken(refreshToken, clientId) {
  const body = new URLSearchParams({
    client_id: clientId,
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    scope: 'https://graph.microsoft.com/Calendars.ReadWrite offline_access',
  });
  const res = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!res.ok) throw new Error(`Graph token exchange failed: ${res.status} ${await res.text()}`);
  const tok = await res.json();
  return tok.access_token;
}

export async function fetchMicrosoftCalendar(token, { timeMinISO, timeMaxISO }) {
  const params = new URLSearchParams({
    startDateTime: timeMinISO,
    endDateTime:   timeMaxISO,
    $top: '999',
    $select: 'id,subject,start,end,isAllDay,location,bodyPreview,onlineMeeting,lastModifiedDateTime,@odata.etag',
  });
  const data = await msFetch(token, `/me/calendarView?${params}`);
  return (data.value ?? []).map(fromMicrosoftEvent);
}

export async function createMicrosoftEvent(token, event) {
  const data = await msFetch(token, '/me/events', {
    method: 'POST',
    body: JSON.stringify(toMicrosoftEvent(event)),
  });
  return { remoteId: data.id, etag: data['@odata.etag'] };
}

export async function updateMicrosoftEvent(token, event) {
  const data = await msFetch(token, `/me/events/${encodeURIComponent(event.remoteId)}`, {
    method: 'PATCH',
    body: JSON.stringify(toMicrosoftEvent(event)),
  });
  return { remoteId: data.id, etag: data['@odata.etag'] };
}

export async function deleteMicrosoftEvent(token, remoteId) {
  await msFetch(token, `/me/events/${encodeURIComponent(remoteId)}`, { method: 'DELETE' });
  return { ok: true };
}
