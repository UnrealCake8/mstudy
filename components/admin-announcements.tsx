"use client";

import { FormEvent, useEffect, useState } from "react";
import { Megaphone, Pencil, Plus, Trash2 } from "lucide-react";
import {
  createSchoolAnnouncement,
  deleteSchoolAnnouncement,
  SchoolAnnouncement,
  subscribeSchoolAnnouncements,
  updateSchoolAnnouncement,
} from "@/lib/school-announcements";

export function AdminAnnouncements({ adminUid }: { adminUid: string }) {
  const [items, setItems] = useState<SchoolAnnouncement[]>([]),
    [editing, setEditing] = useState<SchoolAnnouncement | null>(null),
    [status, setStatus] = useState("");
  useEffect(() => subscribeSchoolAnnouncements(setItems), []);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget,
      data = new FormData(form),
      value = {
        title: String(data.get("title") || "").trim(),
        body: String(data.get("body") || "").trim(),
        group: String(data.get("group") || "General").trim(),
        audience: String(
          data.get("audience") || "all",
        ) as SchoolAnnouncement["audience"],
        pinned: data.get("pinned") === "on",
        createdBy: adminUid,
      };
    if (editing) {
      await updateSchoolAnnouncement(editing.id, value);
      setStatus("Announcement updated.");
      setEditing(null);
    } else {
      await createSchoolAnnouncement(value);
      setStatus("Announcement published to students.");
    }
    form.reset();
  }
  return (
    <section className="admin-section">
      <div className="section-row">
        <div>
          <h2 className="section-title">Announcements</h2>
          <p className="section-help">
            Publish MPlace Study notices and organise them with a group label.
          </p>
        </div>
        <Megaphone size={22} />
      </div>
      {status ? <div className="notice">{status}</div> : null}
      <form
        className="editor-card"
        onSubmit={submit}
        key={editing?.id || "new"}
      >
        <div className="admin-select-grid">
          <label>
            Title
            <input name="title" defaultValue={editing?.title || ""} required />
          </label>
          <label>
            Group
            <input
              name="group"
              defaultValue={editing?.group || "General"}
              placeholder="e.g. Exams, Trips, House"
              required
            />
          </label>
          <label>
            Audience
            <select name="audience" defaultValue={editing?.audience || "all"}>
              <option value="all">All students</option>
              <option value="secondary">Secondary</option>
              <option value="house">House</option>
            </select>
          </label>
          <label className="checkbox-label">
            <input
              name="pinned"
              type="checkbox"
              defaultChecked={editing?.pinned || false}
            />{" "}
            Pin announcement
          </label>
        </div>
        <label>
          Announcement
          <textarea
            name="body"
            rows={5}
            defaultValue={editing?.body || ""}
            required
          />
        </label>
        <div className="form-actions">
          <button className="primary-button">
            <Plus size={16} />
            {editing ? "Save changes" : "Publish announcement"}
          </button>
          {editing ? (
            <button
              type="button"
              className="text-button"
              onClick={() => setEditing(null)}
            >
              Cancel
            </button>
          ) : null}
        </div>
      </form>
      <div className="collection-list">
        {items.map((item) => (
          <article className="collection-card" key={item.id}>
            <div>
              <span className="pill">{item.group}</span>
              <strong>{item.title}</strong>
              <span>{item.body}</span>
              <small>
                {item.audience}
                {item.pinned ? " · pinned" : ""}
              </small>
            </div>
            <div className="form-actions">
              <button
                className="icon-button"
                aria-label={`Edit ${item.title}`}
                onClick={() => setEditing(item)}
              >
                <Pencil size={15} />
              </button>
              <button
                className="icon-button danger"
                aria-label={`Delete ${item.title}`}
                onClick={() => void deleteSchoolAnnouncement(item.id)}
              >
                <Trash2 size={15} />
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
