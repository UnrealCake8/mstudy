"use client";
import { FormEvent, useEffect, useState } from "react";
import {
  CalendarPlus,
  Download,
  ExternalLink,
  Plus,
  Trash2,
} from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import {
  addItem,
  CcaActivity,
  deleteItem,
  subscribeCollection,
} from "@/lib/data";
const SOCS_LOGIN = "https://www.socscms.com/login/28127/pupil";
function icsDate(day: string, time: string) {
  const days = [
      "Sunday",
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
    ],
    now = new Date(),
    offset = (days.indexOf(day) - now.getDay() + 7) % 7 || 7,
    d = new Date(now);
  d.setDate(now.getDate() + offset);
  const [h, m] = time.split(":").map(Number);
  d.setHours(h, m, 0, 0);
  return d
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");
}
export function CcaPage() {
  const { user } = useAuth(),
    [items, setItems] = useState<CcaActivity[]>([]);
  useEffect(
    () =>
      user
        ? subscribeCollection<CcaActivity>(user.uid, "ccaActivities", setItems)
        : undefined,
    [user],
  );
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!user) return;
    const f = new FormData(e.currentTarget);
    await addItem(user.uid, "ccaActivities", {
      name: String(f.get("name")),
      day: String(f.get("day")),
      startTime: String(f.get("startTime")),
      endTime: String(f.get("endTime")),
      location: String(f.get("location") || ""),
    });
    e.currentTarget.reset();
  }
  function download() {
    const events = items
      .map(
        (i) =>
          `BEGIN:VEVENT\nSUMMARY:${i.name}\nDTSTART:${icsDate(i.day, i.startTime)}\nDTEND:${icsDate(i.day, i.endTime)}\nLOCATION:${i.location || "SES"}\nRRULE:FREQ=WEEKLY\nEND:VEVENT`,
      )
      .join("\n");
    const blob = new Blob(
        [
          `BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//MPlace Study//CCA//EN\n${events}\nEND:VCALENDAR`,
        ],
        { type: "text/calendar" },
      ),
      url = URL.createObjectURL(blob),
      a = document.createElement("a");
    a.href = url;
    a.download = "mplace-study-ccas.ics";
    a.click();
    URL.revokeObjectURL(url);
  }
  return (
    <section className="page">
      <div className="page-head">
        <div>
          <p className="eyebrow">Co-curricular activities</p>
          <h1>CCA Hub</h1>
          <p>
            The SES presentation says CCAs run at lunch and after school. Year 7
            students are encouraged to take at least three each term.
          </p>
        </div>
        <button
          className="secondary-button"
          disabled={!items.length}
          onClick={download}
        >
          <Download size={16} /> Add to calendar
        </button>
      </div>
      <div className="notice">
        <strong>SOCS</strong>
        <span>
          SES uses SOCS for sign-up, changes and team selections.
        </span>
        <a href={SOCS_LOGIN} target="_blank" rel="noreferrer">
          Open SES pupil SOCS <ExternalLink size={13} />
        </a>
      </div>
      <form className="editor-card compact" onSubmit={submit}>
        <input name="name" placeholder="CCA name" required />
        <select name="day">
          {["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"].map((d) => (
            <option key={d}>{d}</option>
          ))}
        </select>
        <label>
          Starts
          <input name="startTime" type="time" required />
        </label>
        <label>
          Ends
          <input name="endTime" type="time" required />
        </label>
        <input name="location" placeholder="Location (if known)" />
        <button className="primary-button">
          <Plus size={16} /> Add CCA
        </button>
      </form>
      <div className="list-grid">
        {items.map((item) => (
          <article className="data-card" key={item.id}>
            <div>
              <span className="pill">{item.day}</span>
              <h2>{item.name}</h2>
              <p>
                {item.startTime}–{item.endTime}
                {item.location ? ` · ${item.location}` : ""}
              </p>
            </div>
            <button
              className="icon-button danger"
              onClick={() =>
                user && deleteItem(user.uid, "ccaActivities", item.id)
              }
            >
              <Trash2 size={15} />
            </button>
          </article>
        ))}
      </div>
      {items.length ? (
        <button className="text-button" onClick={download}>
          <CalendarPlus size={15} /> Download recurring calendar events
        </button>
      ) : null}
    </section>
  );
}
