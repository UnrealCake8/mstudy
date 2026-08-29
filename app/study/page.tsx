"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Gamepad2, NotebookPen, Users } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { useAuth } from "@/components/auth/auth-provider";
import { Note, subscribeCollection } from "@/lib/data";

export default function StudyPage() {
  const { user } = useAuth();
  const [notes, setNotes] = useState<Note[]>([]);

  useEffect(() => {
    if (!user) return;
    return subscribeCollection<Note>(user.uid, "notes", setNotes, { orderByCreatedAt: false });
  }, [user]);

  const subjects = useMemo(() => Array.from(new Set(notes.map(note => note.subject).filter(Boolean))).sort(), [notes]);

  const tools = [
    ["/notes", "Notes", "Keep revision notes organised by subject.", NotebookPen],
    ["/play", "Study Games", "Turn your material into something more interactive.", Gamepad2],
    ["/team", "Team Mode", "Study and play together when you want a group session.", Users],
  ] as const;

  return <AppShell><section className="page">
    <div className="page-head"><div><p className="eyebrow">Learn and revise</p><h1>Study</h1><p>Your notes and study tools, without the school-admin clutter.</p></div></div>

    <div className="stats-grid">
      <div className="stat"><span>Notes</span><strong>{notes.length}</strong></div>
      <div className="stat"><span>Subjects in notes</span><strong>{subjects.length}</strong></div>
      <div className="stat"><span>Study modes</span><strong>2</strong></div>
    </div>

    <h2 className="section-title">Study tools</h2>
    <div className="tool-grid">{tools.map(([href, title, description, Icon]) => <Link className="tool-card" href={href} key={href}><div className="icon"><Icon size={20}/></div><h2>{title}</h2><p>{description}</p></Link>)}</div>

    <h2 className="section-title">Recent notes</h2>
    <div className="panel">{notes.length === 0 ? <div className="empty-state"><strong>No notes yet.</strong><p>Create a note when you start revising a subject.</p></div> : notes.slice(0, 5).map(note => <Link href="/notes" className="row" key={note.id}><div><strong>{note.title}</strong><br/><small>{note.subject || "No subject"}</small></div><span>Open notes</span></Link>)}</div>
  </section></AppShell>;
}
