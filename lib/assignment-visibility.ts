"use client";
import { arrayRemove,arrayUnion,doc,onSnapshot,updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
export function assignmentVisibilityId(courseId:string,assignmentId:string){return `${courseId}_${assignmentId}`;}
const schoolRef=doc(db,"schools","ses");
export function subscribeHiddenAssignments(callback:(ids:Set<string>)=>void){return onSnapshot(schoolRef,snapshot=>callback(new Set(Array.isArray(snapshot.data()?.hiddenClassroomAssignments)?snapshot.data()?.hiddenClassroomAssignments:[])));}
export async function hideAssignment(courseId:string,assignmentId:string){await updateDoc(schoolRef,{hiddenClassroomAssignments:arrayUnion(assignmentVisibilityId(courseId,assignmentId))});}
export async function restoreAssignment(id:string){await updateDoc(schoolRef,{hiddenClassroomAssignments:arrayRemove(id)});}
