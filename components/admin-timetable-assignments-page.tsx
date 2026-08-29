"use client";

import { useEffect, useState } from "react";
import { ShieldCheck } from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import { isAdmin } from "@/lib/school-data";
import { AdminTimetableAssignments } from "@/components/admin-timetable-assignments";

export function AdminTimetableAssignmentsPage() {
  const { user } = useAuth();
  const [allowed, setAllowed] = useState<boolean | null>(null);

  useEffect(() => {
    if (!user) return;
    void isAdmin(user.uid).then(setAllowed).catch(() => setAllowed(false));
  }, [user]);

  if (allowed === null) return <section className="page"><p>Checking admin access…</p></section>;
  if (!allowed) return <section className="page"><div className="admin-lock"><ShieldCheck size={30}/><h1>Admin access required</h1><p>You need an MPlace Study admin account to manage timetable assignments.</p></div></section>;

  return <section className="page">
    <div className="page-head"><div><p className="eyebrow">Student assignments</p><h1>Timetable Assignments</h1><p>Create master timetables and assign the correct one to each student.</p></div></div>
    <AdminTimetableAssignments />
  </section>;
}
