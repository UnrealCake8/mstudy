"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { signOut } from "firebase/auth";
import { CalendarDays, CheckSquare, Clock3, Gamepad2, GraduationCap, Home, LogOut, MapPinned, NotebookPen, Settings, ShieldCheck, Users } from "lucide-react";
import { auth } from "@/lib/firebase";
import { isAdmin } from "@/lib/school-data";
import { useAuth } from "@/components/auth/auth-provider";
import { ThemeToggle } from "@/components/theme-toggle";

const MPLACE_LOGO = "https://unrealcake8.github.io/cdn-hls/mplace.png";

const baseNav = [
  ["/", "Home", Home], ["/homework", "Homework", CheckSquare], ["/play", "Play", Gamepad2], ["/team", "Team Mode", Users], ["/timetable", "Timetable", Clock3],
  ["/class-locator", "Class Locator", MapPinned], ["/notes", "Notes", NotebookPen], ["/events", "Events", CalendarDays], ["/classroom", "Classroom", GraduationCap], ["/settings", "Settings", Settings],
] as const;

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [admin, setAdmin] = useState(false);

  useEffect(() => { if (!loading && !user) router.replace("/auth"); }, [loading, user, router]);
  useEffect(() => { if (user) void isAdmin(user.uid).then(setAdmin).catch(() => setAdmin(false)); else setAdmin(false); }, [user]);

  const nav = useMemo(() => admin ? [...baseNav, ["/admin", "Admin", ShieldCheck] as const] : [...baseNav], [admin]);
  if (loading || !user) return <main className="center-screen"><div className="spinner" /><p>Loading MStudy…</p></main>;

  return <div className="app-frame">
    <aside className="sidebar">
      <div className="sidebar-brand-row">
        <Link href="/" className="mplace-product-brand" aria-label="MStudy by MPlace home">
          <img src={MPLACE_LOGO} alt="MPlace" className="mplace-parent-logo" />
          <span><strong>MStudy</strong><small>by MPlace</small></span>
        </Link>
        <ThemeToggle compact />
      </div>
      <nav className="side-nav">{nav.map(([href, label, Icon]) => <Link key={href} href={href} className={pathname === href ? "nav-link active" : "nav-link"}><Icon size={19}/><span>{label}</span></Link>)}</nav>
      <a href="https://mplace.cc" className="mplace-family-link">Explore MPlace</a>
      <div className="user-block"><div className="avatar">{(user.displayName?.[0] ?? "S").toUpperCase()}</div><div className="user-meta"><strong>{user.displayName ?? "Student"}</strong><small>{user.email}</small></div><button aria-label="Sign out" className="icon-button" onClick={() => signOut(auth)}><LogOut size={18}/></button></div>
    </aside>
    <main className="main-content">{children}</main>
    <nav className="bottom-nav">{baseNav.slice(0,5).map(([href,label,Icon]) => <Link key={href} href={href} className={pathname === href ? "bottom-link active" : "bottom-link"}><Icon size={20}/><span>{label}</span></Link>)}</nav>
  </div>;
}
