"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarDays, MapPin } from "lucide-react";
import { MasterCalendarEvent, subscribeMasterCalendar } from "@/lib/master-calendar";

function eventDate(value: string) {
  const date = new Date(value.length === 10 ? `${value}T00:00:00` : value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat(undefined, { weekday: "short", day: "numeric", month: "short", year: "numeric", ...(value.length === 10 ? {} : { hour: "numeric", minute: "2-digit" }) }).format(date);
}

export function MasterCalendarPage() {
  const [events, setEvents] = useState<MasterCalendarEvent[]>([]);
  useEffect(() => subscribeMasterCalendar(setEvents), []);
  const upcoming = useMemo(() => events.filter(event => new Date(event.end || event.start).getTime() >= Date.now() - 86400000), [events]);

  return <section className="page">
    <div className="page-head"><div><p className="eyebrow">School-wide dates</p><h1>Master Calendar</h1><p>Important events, activities and dates happening across school.</p></div></div>
    <section className="admin-section">
      <div className="section-row"><div><h2 className="section-title">Upcoming events</h2><p className="section-help">Maintained by MPlace Study administrators.</p></div></div>
      {upcoming.length === 0 ? <div className="school-empty">There are no upcoming school events yet.</div> : <div className="collection-list">
        {upcoming.map(event => <article className="collection-card" key={event.id}>
          <div className="collection-icon"><CalendarDays size={19}/></div>
          <div><strong>{event.title}</strong><span>{eventDate(event.start)}{event.end ? ` to ${eventDate(event.end)}` : ""}</span>{event.location ? <small><MapPin size={12}/> {event.location}</small> : null}{event.description ? <p>{event.description}</p> : null}</div>
        </article>)}
      </div>}
    </section>
  </section>;
}
