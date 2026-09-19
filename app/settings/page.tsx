"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { Camera, GraduationCap, MessageCircle, Save } from "lucide-react";
import { signOut, updateProfile } from "firebase/auth";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { AppShell } from "@/components/app-shell";
import { useAuth } from "@/components/auth/auth-provider";
import { ThemeToggle } from "@/components/theme-toggle";
import { auth, db } from "@/lib/firebase";
import { saveChatProfile } from "@/lib/chat";
import { StudentProfile, subscribeStudentProfile } from "@/lib/student-timetables";

export default function Page() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [name, setName] = useState("");
  const [photoURL, setPhotoURL] = useState("");
  const [status, setStatus] = useState("");
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(() => user ? subscribeStudentProfile(user.uid, value => {
    setProfile(value);
    setName(value?.name || user.displayName || "");
    setPhotoURL((value as (StudentProfile & { photoURL?: string }) | null)?.photoURL || user.photoURL || "");
    setStatus((value as (StudentProfile & { status?: string }) | null)?.status || "");
  }) : undefined, [user]);

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!user || !user.email) return;
    const cleanName = name.trim().slice(0, 80) || "Student";
    const cleanPhoto = photoURL.trim().slice(0, 1000);
    const cleanStatus = status.trim().slice(0, 120);
    setSaving(true);
    setNotice("");
    try {
      await updateProfile(user, { displayName: cleanName, photoURL: cleanPhoto || null });
      await setDoc(doc(db, "users", user.uid), {
        name: cleanName,
        photoURL: cleanPhoto,
        status: cleanStatus,
        profileUpdatedAt: serverTimestamp(),
      }, { merge: true });
      await saveChatProfile(user.uid, user.email, {
        name: cleanName,
        photoURL: cleanPhoto,
        status: cleanStatus,
      });
      setNotice("Profile saved.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not save your profile.");
    } finally {
      setSaving(false);
    }
  }

  const initial = (name || user?.displayName || "S")[0].toUpperCase();

  return (
    <AppShell>
      <section className="page narrow profile-settings-page">
        <div className="page-head">
          <div><p className="eyebrow">Your account</p><h1>Profile & settings</h1><p>Choose how your name and picture appear across MPlace Study and Messages.</p></div>
        </div>

        <form className="profile-editor-card" onSubmit={save}>
          <div className="profile-picture-preview">
            {photoURL ? <img src={photoURL} alt="" onError={event => { event.currentTarget.style.display = "none"; }}/> : <span>{initial}</span>}
            <div className="profile-camera"><Camera size={16}/></div>
          </div>
          <div className="profile-fields">
            <label>Display name<input value={name} onChange={event => setName(event.target.value)} maxLength={80} required/></label>
            <label>Profile picture URL<input type="url" value={photoURL} onChange={event => setPhotoURL(event.target.value)} placeholder="https://…"/></label>
            <label>Status or short bio<input value={status} onChange={event => setStatus(event.target.value)} maxLength={120} placeholder="What are you working on?"/></label>
            <p className="profile-email">{profile?.email || user?.email}</p>
            <button className="primary-button" disabled={saving}><Save size={16}/>{saving ? "Saving…" : "Save profile"}</button>
            {notice ? <p className="profile-save-notice">{notice}</p> : null}
          </div>
        </form>

        <div className="settings-link-grid">
          <Link href="/messages" className="settings-card settings-link"><div className="connect-icon small"><MessageCircle size={20}/></div><div><h2>Messages</h2><p>Open chats, groups and your school contacts.</p></div><span className="settings-arrow">→</span></Link>
          <Link href="/classroom" className="settings-card settings-link"><div className="connect-icon small"><GraduationCap size={20}/></div><div><h2>Google Classroom</h2><p>Manage the Classroom connection and automatic sync.</p></div><span className="settings-arrow">→</span></Link>
        </div>

        <div className="settings-actions"><ThemeToggle/><button className="secondary-button" onClick={() => signOut(auth)} type="button">Sign out</button></div>
      </section>
    </AppShell>
  );
}
