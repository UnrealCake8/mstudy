"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { FileText, Plus, Search, Trash2 } from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import { addItem, deleteItem, subscribeCollection } from "@/lib/data";

type Kind = "notes" | "events";
type Item = { id:string; title:string; subject?:string; content?:string; date?:string; details?:string };

export function CollectionPage({ kind }: { kind: Kind }) {
  const { user } = useAuth();
  const [items,setItems]=useState<Item[]>([]);
  const [open,setOpen]=useState(false);
  const [busy,setBusy]=useState(false);
  const [search,setSearch]=useState("");

  useEffect(() => user ? subscribeCollection<Item>(user.uid, kind, setItems) : undefined, [user,kind]);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); if(!user)return;
    setBusy(true);
    const fd=new FormData(e.currentTarget);
    const title=String(fd.get("title")||"").trim();
    if(!title){setBusy(false);return;}
    const data=kind==="notes"
      ?{title,subject:String(fd.get("subject")||"General").trim()||"General",content:String(fd.get("content")||"").trim()}
      :{title,date:String(fd.get("date")||""),details:String(fd.get("details")||"").trim()};
    await addItem(user.uid,kind,data);
    e.currentTarget.reset(); setOpen(false); setBusy(false);
  }

  const title=kind==="notes"?"Notes":"Events";
  const visible=useMemo(()=>{
    if(kind!=="notes"||!search.trim()) return items;
    const q=search.toLowerCase();
    return items.filter(item=>[item.title,item.subject,item.content].some(value=>value?.toLowerCase().includes(q)));
  },[items,kind,search]);

  if(kind==="notes") return <section className="page">
    <div className="page-head">
      <div><p className="eyebrow">Study notebook</p><h1>Notes</h1><p>Save what matters from each lesson and find it again quickly.</p></div>
      <button className="primary-button" onClick={()=>setOpen(v=>!v)}><Plus size={17}/> New note</button>
    </div>

    <div className="notes-toolbar">
      <div className="search-box"><Search size={17}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search your notes" aria-label="Search notes"/></div>
    </div>

    {open&&<form className="editor-card note-editor" onSubmit={submit}>
      <div className="form-heading"><FileText size={20}/><div><strong>New note</strong><span>Give it a clear title so you can find it later.</span></div></div>
      <label><span>Title</span><input name="title" placeholder="e.g. Photosynthesis summary" required/></label>
      <label><span>Subject</span><input name="subject" placeholder="e.g. Biology"/></label>
      <label><span>Your notes</span><textarea name="content" placeholder="Write the important points from the lesson…" rows={9}/></label>
      <div className="form-actions"><button type="button" className="secondary-button" onClick={()=>setOpen(false)}>Cancel</button><button className="primary-button" disabled={busy}>{busy?"Saving…":"Save note"}</button></div>
    </form>}

    {visible.length===0?<div className="empty-state notes-empty"><FileText size={24}/><strong>{search?"No matching notes":"No notes yet"}</strong><span>{search?"Try another subject or keyword.":"Create a note after a lesson, revision session or homework task."}</span></div>:<div className="notes-grid">{visible.map(i=><article className="note-card" key={i.id}><div className="note-card-top"><span className="pill">{i.subject||"General"}</span><button className="icon-button danger" aria-label={`Delete ${i.title}`} onClick={()=>user&&deleteItem(user.uid,kind,i.id)}><Trash2 size={17}/></button></div><h2>{i.title}</h2>{i.content?<p>{i.content}</p>:<p className="muted-copy">No note text yet.</p>}</article>)}</div>}
  </section>;

  return <section className="page"><div className="page-head"><div><p className="eyebrow">Calendar</p><h1>Events</h1><p>Keep track of exams, school events and important dates.</p></div><button className="primary-button" onClick={()=>setOpen(v=>!v)}><Plus size={17}/> Add event</button></div>
  {open&&<form className="editor-card student-form" onSubmit={submit}><label><span>Event</span><input name="title" placeholder="e.g. Science test" required/></label><label><span>Date</span><input name="date" type="date" required/></label><label><span>Details</span><textarea name="details" placeholder="Anything you need to remember" rows={3}/></label><button className="primary-button" disabled={busy}>{busy?"Saving…":"Save event"}</button></form>}
  <div className="list-grid">{items.length===0?<div className="empty-state"><strong>No events yet</strong></div>:items.map(i=><article className="data-card" key={i.id}><div>{i.date&&<span className="pill">{i.date}</span>}<h2>{i.title}</h2>{i.details&&<p>{i.details}</p>}</div><button className="icon-button danger" aria-label="Delete" onClick={()=>user&&deleteItem(user.uid,kind,i.id)}><Trash2 size={17}/></button></article>)}</div></section>;
}
