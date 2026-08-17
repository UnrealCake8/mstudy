"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Check, Plus, Trash2 } from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import { addItem, deleteItem, Homework, subscribeCollection, updateItem } from "@/lib/data";

function friendlyDate(value: string) {
  if (!value) return "No due date";
  const date = new Date(`${value}T12:00:00`);
  return new Intl.DateTimeFormat(undefined, { weekday: "short", day: "numeric", month: "short" }).format(date);
}

export function HomeworkPage(){
  const{user}=useAuth();
  const[items,setItems]=useState<Homework[]>([]);
  const[open,setOpen]=useState(false);
  useEffect(()=>user?subscribeCollection<Homework>(user.uid,"homework",setItems):undefined,[user]);
  const pending=useMemo(()=>items.filter(i=>!i.completed).sort((a,b)=>a.dueDate.localeCompare(b.dueDate)),[items]);

  async function submit(e:FormEvent<HTMLFormElement>){
    e.preventDefault();if(!user)return;
    const f=new FormData(e.currentTarget);
    await addItem(user.uid,"homework",{title:String(f.get("title")),subject:String(f.get("subject")||"General"),dueDate:String(f.get("dueDate")),priority:String(f.get("priority")||"medium"),completed:false});
    e.currentTarget.reset();setOpen(false)
  }

  return <section className="page">
    <div className="page-head"><div><p className="eyebrow">Planner</p><h1>Homework</h1><p>{pending.length===0?"Nothing left to do.":`${pending.length} task${pending.length===1?"":"s"} left.`}</p></div><button className="primary-button" onClick={()=>setOpen(v=>!v)}><Plus size={17}/> Add homework</button></div>
    {open&&<form className="editor-card compact student-form" onSubmit={submit}>
      <label><span>Task</span><input name="title" placeholder="e.g. Finish algebra questions" required/></label>
      <label><span>Subject</span><input name="subject" placeholder="e.g. Maths"/></label>
      <label><span>Due date</span><input name="dueDate" type="date" required/></label>
      <label><span>Priority</span><select name="priority" defaultValue="medium"><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select></label>
      <button className="primary-button">Add task</button>
    </form>}
    <div className="task-list">{pending.length===0?<div className="empty-state"><strong>You’re all caught up</strong><span>New homework will appear here.</span></div>:pending.map(i=><article className="task-row" key={i.id}><button className="check-button" aria-label={`Mark ${i.title} as done`} onClick={()=>user&&updateItem(user.uid,"homework",i.id,{completed:true})}><Check size={16}/></button><div className="task-copy"><strong>{i.title}</strong><span>{i.subject} · Due {friendlyDate(i.dueDate)}</span></div><span className={`priority ${i.priority}`}>{i.priority}</span><button className="icon-button danger" aria-label={`Delete ${i.title}`} onClick={()=>user&&deleteItem(user.uid,"homework",i.id)}><Trash2 size={17}/></button></article>)}</div>
  </section>
}
