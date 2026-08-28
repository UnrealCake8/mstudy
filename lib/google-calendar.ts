"use client";

import { GoogleAuthProvider, reauthenticateWithPopup, type User } from "firebase/auth";

const CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar.events.readonly";

export type GoogleCalendarEvent = {
  id: string;
  calendarId: string;
  calendarName: string;
  title: string;
  description?: string;
  location?: string;
  start: string;
  end: string;
  allDay: boolean;
  htmlLink?: string;
};

type EventListResponse = {
  items?: Array<{
    id?: string;
    summary?: string;
    description?: string;
    location?: string;
    htmlLink?: string;
    status?: string;
    start?: { dateTime?: string; date?: string };
    end?: { dateTime?: string; date?: string };
  }>;
  nextPageToken?: string;
};

function provider() {
  const p = new GoogleAuthProvider();
  p.addScope(CALENDAR_SCOPE);
  p.setCustomParameters({ prompt: "consent", include_granted_scopes: "true" });
  return p;
}

async function googleFetch<T>(url: string, token: string): Promise<T> {
  const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { error?: { message?: string } } | null;
    throw new Error(body?.error?.message || `Google Calendar request failed (${response.status}).`);
  }
  return response.json() as Promise<T>;
}

function friendlyError(error: unknown) {
  const raw = error instanceof Error ? error.message : String(error || "");
  const lower = raw.toLowerCase();
  if (lower.includes("calendar.googleapis.com") && lower.includes("disabled")) return new Error("The Google Calendar API is not enabled for the MStudy Google Cloud project yet.");
  if (lower.includes("access blocked") || lower.includes("admin_policy_enforced")) return new Error("Your school Google Workspace administrator has blocked Google Calendar access for MStudy.");
  if (lower.includes("auth/user-mismatch")) return new Error("Please connect the same Google account you use to sign in to MStudy.");
  return error instanceof Error ? error : new Error("Could not connect Google Calendar.");
}

async function eventsForPrimaryCalendar(token: string, timeMin: string, timeMax: string) {
  const events: GoogleCalendarEvent[] = [];
  let pageToken = "";
  do {
    const qs = new URLSearchParams({ singleEvents: "true", orderBy: "startTime", timeMin, timeMax, maxResults: "250" });
    if (pageToken) qs.set("pageToken", pageToken);
    const data = await googleFetch<EventListResponse>(`https://www.googleapis.com/calendar/v3/calendars/primary/events?${qs.toString()}`, token);
    for (const item of data.items || []) {
      if (!item.id || item.status === "cancelled" || (!item.start?.dateTime && !item.start?.date)) continue;
      const allDay = Boolean(item.start.date && !item.start.dateTime);
      events.push({
        id: item.id,
        calendarId: "primary",
        calendarName: "Primary calendar",
        title: item.summary || "Untitled event",
        description: item.description || "",
        location: item.location || "",
        start: item.start.dateTime || item.start.date || "",
        end: item.end?.dateTime || item.end?.date || item.start.dateTime || item.start.date || "",
        allDay,
        htmlLink: item.htmlLink || "",
      });
    }
    pageToken = data.nextPageToken || "";
  } while (pageToken);
  return events;
}

export async function loadGoogleCalendar(user: User, daysAhead = 14) {
  try {
    const result = await reauthenticateWithPopup(user, provider());
    const credential = GoogleAuthProvider.credentialFromResult(result);
    const token = credential?.accessToken;
    if (!token) throw new Error("Google did not return Calendar access. Try connecting again.");

    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + daysAhead);

    const events = await eventsForPrimaryCalendar(token, start.toISOString(), end.toISOString());
    return { googleEmail: result.user.email || user.email || "Google account", events: events.sort((a,b) => a.start.localeCompare(b.start)) };
  } catch (error) {
    throw friendlyError(error);
  }
}
