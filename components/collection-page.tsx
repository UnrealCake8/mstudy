"use client";

import { FormEvent, useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import { addItem, deleteItem, subscribeCollection } from "@/lib/data";

type Kind = "notes" | "events";
type Item = { id:string; title:string; subject?:string; content?:string; date?:string; details?:string };

export function CollectionPage({ kind }: { kind: Kind }) {
  const { user } = useAuth(); const [items,setItems]=useState<Item[]>([]); const [open,setOpen]=useState(false); const [busy,setBusy]=useState(false);
  useEffect(() => user ? subscribeCollection<Item>(user.uid, kind, setItems) : undefined, [user,kind]);
  async function submit(e: FormEvent<HTMLFormElement>) { e.preventDefault(); if(!user)return; setBusy(true); const fd=new FormData(e.currentTarget); const title=String(fd.get("title")||"").trim(); if(!title){setBusy(false);return;} const data=kind==="notes"?{title,subject:String(fd.get("subject")||"General"),content:String(fd.get("content")||"")}:{title,date:String(fd.get("date")||""),details:String(fd.get("details")||"")}; await addItem(user.uid,kind,data); e.currentTarget.reset(); setOpen(false); setBusy(false); }
  const title=kind==="notes"?"Notes":"Events";
  return <section className="page"><div className="page-head"><div><p className="eyebrow">{kind==="notes"?"Study":"Calendar"}</p><h1>{title}</h1><p>{kind==="notes"?"Keep everything you learn organised by subject.":"Keep track of exams, school events and important dates."}</p></div><button className="primary-button" onClick={()=>setOpen(v=>!v)}><Plus size={17}/> Add {kind==="notes"?"note":"event"}</button></div>
  {open&&<form className="editor-card" onSubmit={submit}><input name="title" aria-label="Title" required/>{kind==="notes"?<><input name="subject" aria-label="Subject"/><textarea name="content" aria-label="Note content" rows={6}/></>:<><input name="date" type="date" aria-label="Date" required/><textarea name="details" aria-label="Event details" rows={3}/></>}<button className="primary-button" disabled={busy}>{busy?"Saving…":"Save"}</button></form>}
  <div className="list-grid">{items.length===0?<div className="empty-state"><strong>No {title.toLowerCase()}</strong></div>:items.map(i=><article className="data-card" key={i.id}><div>{(i.subject||i.date)&&<span className="pill">{i.subject||i.date}</span>}<h2>{i.title}</h2>{(i.content||i.details)&&<p>{i.content||i.details}</p>}</div><button className="icon-button danger" aria-label="Delete" onClick={()=>user&&deleteItem(user.uid,kind,i.id)}><Trash2 size={17}/></button></article>)}</div></section>;
}
