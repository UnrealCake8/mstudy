"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { CalendarDays, ExternalLink, Plus, RefreshCw, Trash2, Unplug } from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import { addItem, deleteItem, subscribeCollection, TimetableClass } from "@/lib/data";
import { GoogleCalendarEvent, loadGoogleCalendar } from "@/lib/google-calendar";

const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

function eventDate(event: GoogleCalendarEvent) {
  const date = new Date(event.start);
  return new Intl.DateTimeFormat(undefined, { weekday: "short", day: "numeric", month: "short" }).format(date);
}

function eventTime(event: GoogleCalendarEvent) {
  if (event.allDay) return "All day";
  const start = new Date(event.start);
  const end = new Date(event.end);
  const fmt = new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" });
  return `${fmt.format(start)} – ${fmt.format(end)}`;
}

export function TimetablePage() {
  const { user } = useAuth();
  const [items, setItems] = useState<TimetableClass[]>([]);
  const [open, setOpen] = useState(false);
  const [calendarEvents, setCalendarEvents] = useState<GoogleCalendarEvent[]>([]);
  const [calendarEmail, setCalendarEmail] = useState("");
  const [calendarBusy, setCalendarBusy] = useState(false);
  const [calendarError, setCalendarError] = useState<string | null>(null);

  useEffect(() => user ? subscribeCollection<TimetableClass>(user.uid, "timetable", setItems) : undefined, [user]);

  const groupedEvents = useMemo(() => {
    const groups = new Map<string, GoogleCalendarEvent[]>();
    for (const event of calendarEvents) {
      const key = eventDate(event);
      groups.set(key, [...(groups.get(key) || []), event]);
    }
    return [...groups.entries()];
  }, [calendarEvents]);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!user) return;
    const f = new FormData(e.currentTarget);
    await addItem(user.uid, "timetable", Object.fromEntries(["subject", "day", "startTime", "endTime", "room", "teacher"].map(k => [k, String(f.get(k) || "")])));
    e.currentTarget.reset();
    setOpen(false);
  }

  async function connectCalendar() {
    if (!user) return;
    setCalendarBusy(true);
    setCalendarError(null);
    try {
      const result = await loadGoogleCalendar(user);
      setCalendarEmail(result.googleEmail);
      setCalendarEvents(result.events);
    } catch (error) {
      setCalendarError(error instanceof Error ? error.message : "Could not connect Google Calendar.");
    } finally {
      setCalendarBusy(false);
    }
  }

  function disconnectCalendar() {
    setCalendarEvents([]);
    setCalendarEmail("");
    setCalendarError(null);
  }

  return <section className="page">
    <div className="page-head">
      <div><p className="eyebrow">Your week</p><h1>Timetable</h1><p>Your classes and Google Calendar, together in one place.</p></div>
      <button className="primary-button" onClick={() => setOpen(v => !v)}><Plus size={17}/> Add class</button>
    </div>

    <section className="calendar-connect-card">
      <div className="calendar-connect-copy">
        <div className="connect-icon"><CalendarDays size={24}/></div>
        <div><h2>Google Calendar</h2><p>{calendarEmail ? `Connected as ${calendarEmail}. Showing the next 14 days.` : "Connect your Google Calendar to see upcoming lessons, clubs and events here."}</p></div>
      </div>
      <div className="form-actions">
        {calendarEmail ? <button className="text-button" onClick={disconnectCalendar} disabled={calendarBusy}><Unplug size={15}/> Disconnect</button> : null}
        <button className="primary-button" onClick={connectCalendar} disabled={calendarBusy}><RefreshCw size={17}/>{calendarBusy ? "Loading…" : calendarEmail ? "Refresh Calendar" : "Connect Calendar"}</button>
      </div>
    </section>

    {calendarError ? <div className="notice error-notice">{calendarError}</div> : null}
    {calendarEmail ? <section className="calendar-agenda">
      <div className="section-row"><div><h2 className="section-title">Upcoming from Google Calendar</h2><p className="section-help">Read-only events from your primary Google Calendar.</p></div></div>
      {calendarEvents.length === 0 ? <div className="empty-state calendar-empty"><strong>No upcoming events</strong><span>Your primary calendar has no events in the next 14 days.</span></div> : groupedEvents.map(([date, events]) => <div className="calendar-day-group" key={date}>
        <h3>{date}</h3>
        <div className="calendar-event-list">{events.map(event => <article className="calendar-event-card" key={`${event.calendarId}_${event.id}`}>
          <div className="calendar-event-time">{eventTime(event)}</div>
          <div className="calendar-event-main"><strong>{event.title}</strong><span>{event.calendarName}{event.location ? ` · ${event.location}` : ""}</span></div>
          {event.htmlLink ? <a className="icon-button" href={event.htmlLink} target="_blank" rel="noreferrer" aria-label={`Open ${event.title} in Google Calendar`}><ExternalLink size={16}/></a> : null}
        </article>)}</div>
      </div>)}
    </section> : null}

    {open && <form className="editor-card compact" onSubmit={submit}>
      <input name="subject" placeholder="Subject" required/>
      <select name="day" required>{days.map(d => <option key={d}>{d}</option>)}</select>
      <input name="startTime" type="time" required/>
      <input name="endTime" type="time" required/>
      <input name="room" placeholder="Room"/>
      <input name="teacher" placeholder="Teacher"/>
      <button className="primary-button">Save class</button>
    </form>}

    <h2 className="section-title">Weekly timetable</h2>
    <div className="week-grid">{days.map(day => <section className="day-column" key={day}><h2>{day}</h2>{items.filter(i => i.day===day).sort((a,b)=>a.startTime.localeCompare(b.startTime)).map(i=><article className="class-card" key={i.id}><div><strong>{i.subject}</strong><span>{i.startTime}–{i.endTime}</span><small>{[i.room,i.teacher].filter(Boolean).join(" · ")}</small></div><button className="icon-button danger" onClick={()=>user&&deleteItem(user.uid,"timetable",i.id)}><Trash2 size={15}/></button></article>)}</section>)}</div>
  </section>;
}
