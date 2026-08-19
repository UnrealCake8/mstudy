"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { signOut } from "firebase/auth";
import { CalendarDays, CheckSquare, Clock3, Gamepad2, GraduationCap, Home, LogOut, NotebookPen, Settings } from "lucide-react";
import { auth } from "@/lib/firebase";
import { useAuth } from "@/components/auth/auth-provider";
import { ThemeToggle } from "@/components/theme-toggle";

const nav = [
  ["/", "Home", Home], ["/homework", "Homework", CheckSquare], ["/play", "Play", Gamepad2], ["/timetable", "Timetable", Clock3],
  ["/notes", "Notes", NotebookPen], ["/events", "Events", CalendarDays], ["/classroom", "Classroom", GraduationCap], ["/settings", "Settings", Settings],
] as const;

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth(); const router = useRouter(); const pathname = usePathname();
  useEffect(() => { if (!loading && !user) router.replace("/auth"); }, [loading, user, router]);
  if (loading || !user) return <main className="center-screen"><div className="spinner" /><p>Loading MStudy…</p></main>;

  return <div className="app-frame">
    <aside className="sidebar">
      <div className="sidebar-brand-row"><Link href="/" className="brand">MStudy</Link><ThemeToggle compact /></div>
      <nav className="side-nav">{nav.map(([href, label, Icon]) => <Link key={href} href={href} className={pathname === href ? "nav-link active" : "nav-link"}><Icon size={19}/><span>{label}</span></Link>)}</nav>
      <div className="user-block"><div className="avatar">{(user.displayName?.[0] ?? "S").toUpperCase()}</div><div className="user-meta"><strong>{user.displayName ?? "Student"}</strong><small>{user.email}</small></div><button aria-label="Sign out" className="icon-button" onClick={() => signOut(auth)}><LogOut size={18}/></button></div>
    </aside>
    <main className="main-content">{children}</main>
    <nav className="bottom-nav">{nav.slice(0,5).map(([href,label,Icon]) => <Link key={href} href={href} className={pathname === href ? "bottom-link active" : "bottom-link"}><Icon size={20}/><span>{label}</span></Link>)}</nav>
  </div>;
}
