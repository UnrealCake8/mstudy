"use client";

import { useEffect, useMemo, useState } from "react";
import { ExternalLink, FileText } from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import {
  SchoolTimetable,
  StudentProfile,
  subscribeSchoolTimetables,
  subscribeStudentProfile,
} from "@/lib/student-timetables";

const BASE_TIMETABLE_URL = "/files/base-timetable/base.pdf";

export function TimetablePage() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [schoolTimetables, setSchoolTimetables] = useState<SchoolTimetable[]>([]);

  useEffect(() => user ? subscribeStudentProfile(user.uid, setProfile) : undefined, [user]);
  useEffect(() => subscribeSchoolTimetables(setSchoolTimetables), []);

  const assignedTimetable = useMemo(
    () => schoolTimetables.find((item) => item.id === profile?.assignedTimetableId),
    [schoolTimetables, profile?.assignedTimetableId],
  );
  const pdfUrl = assignedTimetable?.pdfUrl || BASE_TIMETABLE_URL;
  const label = assignedTimetable?.label || profile?.assignedTimetableLabel || "School timetable";

  return (
    <section className="page timetable-pdf-page">
      <div className="page-head">
        <div>
          <p className="eyebrow">Your school week</p>
          <h1>Timetable</h1>
          <p>Your timetable is supplied by school as a PDF, so the same official version is shown here.</p>
        </div>
        <a className="primary-button" href={pdfUrl} target="_blank" rel="noreferrer">
          <ExternalLink size={17}/> Open PDF
        </a>
      </div>

      <div className="timetable-file-heading">
        <span className="timetable-file-icon"><FileText size={20}/></span>
        <div><strong>{label}</strong><small>{assignedTimetable ? "Assigned to your account" : "Shared school timetable"}</small></div>
      </div>
      <div className="timetable-pdf-frame">
        <iframe src={pdfUrl} title={label}/>
      </div>
    </section>
  );
}
