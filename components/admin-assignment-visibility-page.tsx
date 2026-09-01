"use client";
import { useEffect,useMemo,useState } from "react";
import { Eye,EyeOff,RefreshCw,Search,ShieldCheck } from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import type { ClassroomAssignment } from "@/lib/classroom";
import { isAdmin } from "@/lib/school-data";
import { assignmentVisibilityId,hideAssignment,restoreAssignment,subscribeHiddenAssignments } from "@/lib/assignment-visibility";
import { subscribeCollection } from "@/lib/data";

type AssignmentRow=ClassroomAssignment&{key:string};
export function AdminAssignmentVisibilityPage(){
 const{user}=useAuth();const[allowed,setAllowed]=useState<boolean|null>(null),[assignments,setAssignments]=useState<AssignmentRow[]>([]),[hiddenIds,setHiddenIds]=useState<Set<string>>(new Set()),[query,setQuery]=useState(""),[status,setStatus]=useState("");
 useEffect(()=>{if(user)void isAdmin(user.uid).then(setAllowed).catch(()=>setAllowed(false));},[user]);
 useEffect(()=>allowed?subscribeHiddenAssignments(setHiddenIds):undefined,[allowed]);
 useEffect(()=>user&&allowed?subscribeCollection<ClassroomAssignment>(user.uid,"classroomAssignments",items=>setAssignments(items.map(item=>({...item,key:assignmentVisibilityId(item.courseId,item.id)}))),{orderByCreatedAt:false}):undefined,[user,allowed]);
 const rows=useMemo(()=>assignments.filter(item=>`${item.title} ${item.description||""}`.toLowerCase().includes(query.trim().toLowerCase())),[assignments,query]);
 if(allowed===null)return <section className="page"><p>Checking admin access…</p></section>;
 if(!allowed)return <section className="page"><div className="admin-lock"><ShieldCheck size={30}/><h1>Admin access required</h1><p>You need an MPlace Study admin account to manage assignment visibility.</p></div></section>;
 return <section className="page"><div className="page-head"><div><p className="eyebrow">Student assignment controls</p><h1>Assignment Visibility</h1><p>Hide irrelevant Google Classroom assignments from every student in MPlace Study without deleting them from Classroom.</p></div><a className="secondary-button" href="/classroom"><RefreshCw size={16}/> Sync Classroom</a></div>{status?<div className="notice">{status}</div>:null}<label className="assignment-admin-search"><Search size={17}/><input value={query} onChange={event=>setQuery(event.target.value)} placeholder="Search assignments"/></label><div className="classroom-assignment-list">{rows.map(item=>{const isHidden=hiddenIds.has(item.key);return <article className="classroom-assignment" key={item.key}><div className="assignment-main"><span className="assignment-course">Google Classroom</span><h3>{item.title}</h3>{item.description?<p>{item.description}</p>:null}<small>{item.dueDate?`Due ${item.dueDate}`:"No due date"}</small></div><div className="assignment-side"><span className={isHidden?"priority high":"pill"}>{isHidden?"Hidden":"Visible"}</span><button className={isHidden?"secondary-button":"text-button danger"} onClick={()=>void(isHidden?restoreAssignment(item.key):hideAssignment(item.courseId,item.id)).then(()=>setStatus(isHidden?"Assignment restored for students.":"Assignment hidden from students."))}>{isHidden?<><Eye size={15}/> Restore</>:<><EyeOff size={15}/> Hide from students</>}</button></div></article>;})}</div>{rows.length===0?<div className="empty-state"><strong>No assignments found</strong><span>Sync Google Classroom with this admin account, then return here.</span></div>:null}</section>;
}
