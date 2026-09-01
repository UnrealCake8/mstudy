"use client";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import {
  addItem,
  AfterSchoolBlock,
  deleteItem,
  subscribeCollection,
} from "@/lib/data";
const days = [
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
    "Sunday",
  ],
  types = ["Homework", "CCA", "Dinner", "Revision", "Free time"] as const;
export function AfterSchoolPlannerPage() {
  const { user } = useAuth(),
    [items, setItems] = useState<AfterSchoolBlock[]>([]);
  useEffect(
    () =>
      user
        ? subscribeCollection<AfterSchoolBlock>(
            user.uid,
            "afterSchoolBlocks",
            setItems,
          )
        : undefined,
    [user],
  );
  const grouped = useMemo(
    () =>
      new Map(
        days.map((day) => [
          day,
          items
            .filter((i) => i.day === day)
            .sort((a, b) => a.startTime.localeCompare(b.startTime)),
        ]),
      ),
    [items],
  );
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!user) return;
    const f = new FormData(e.currentTarget);
    await addItem(user.uid, "afterSchoolBlocks", {
      day: String(f.get("day")),
      startTime: String(f.get("startTime")),
      endTime: String(f.get("endTime")),
      type: String(f.get("type")),
      title: String(f.get("title")),
    });
    e.currentTarget.reset();
  }
  return (
    <section className="page">
      <div className="page-head">
        <div>
          <p className="eyebrow">Plan your evenings</p>
          <h1>After-school Planner</h1>
          <p>Balance homework, CCAs, dinner, revision and free time.</p>
        </div>
      </div>
      <form className="editor-card compact" onSubmit={submit}>
        <label>
          Day
          <select name="day">
            {days.map((d) => (
              <option key={d}>{d}</option>
            ))}
          </select>
        </label>
        <label>
          Block type
          <select name="type">
            {types.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </label>
        <label>
          Starts
          <input type="time" name="startTime" required />
        </label>
        <label>
          Ends
          <input type="time" name="endTime" required />
        </label>
        <label>
          What are you doing?
          <input name="title" placeholder="e.g. Maths homework" required />
        </label>
        <button className="primary-button">
          <Plus size={16} /> Add block
        </button>
      </form>
      <div className="after-school-grid">
        {days.map((day) => (
          <section className="day-column" key={day}>
            <h2>{day}</h2>
            {grouped.get(day)?.map((item) => (
              <article className="after-school-block" key={item.id}>
                <span className="pill">{item.type}</span>
                <strong>{item.title}</strong>
                <small>
                  {item.startTime}–{item.endTime}
                </small>
                <button
                  className="icon-button danger"
                  aria-label={`Delete ${item.title}`}
                  onClick={() =>
                    user && deleteItem(user.uid, "afterSchoolBlocks", item.id)
                  }
                >
                  <Trash2 size={14} />
                </button>
              </article>
            ))}
          </section>
        ))}
      </div>
    </section>
  );
}
