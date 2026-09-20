"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import {
  Bell,
  BookOpen,
  CalendarDays,
  GraduationCap,
  Home,
  LogOut,
  Menu,
  MessageCircle,
  MoreHorizontal,
  Settings,
  X,
} from "lucide-react";
import { auth, db } from "@/lib/firebase";
import { syncClassroomInBackground } from "@/lib/classroom";
import { useAuth } from "@/components/auth/auth-provider";
import { ThemeToggle } from "@/components/theme-toggle";

const MPLACE_LOGO = "https://unrealcake8.github.io/cdn-hls/mplace.png";

const mainNav = [
  ["/", "Today", Home],
  ["/planner", "Planner", CalendarDays],
  ["/messages", "Messages", MessageCircle],
  ["/classes", "Classes", GraduationCap],
  ["/study", "Study", BookOpen],
] as const;

const sectionRoutes: Record<string, string[]> = {
  "/planner": ["/planner", "/classwork", "/calendar", "/events", "/classroom", "/after-school"],
  "/messages": ["/messages"],
  "/classes": ["/classes", "/timetable", "/class-locator"],
  "/study": ["/study", "/notes", "/play", "/team", "/practice-papers"],
};

const extraLinks = [
  ["/notices", "Announcements"],
  ["/cca", "Activities & CCA"],
  ["/school-guide", "School guide"],
  ["/support", "Support"],
] as const;

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.replace("/auth");
  }, [loading, user, router]);

  useEffect(() => setMenuOpen(false), [pathname]);

  useEffect(() => {
    if (!user) return;
    void (async () => {
      try {
        const profile = await getDoc(doc(db, "users", user.uid));
        if (profile.data()?.classroomConnected) await syncClassroomInBackground(user);
      } catch (error) {
        console.warn("Automatic Classroom sync was skipped.", error);
      }
    })();
  }, [user]);

  if (loading || !user) {
    return (
      <main className="center-screen">
        <div className="spinner" />
        <p>Getting your day ready…</p>
      </main>
    );
  }

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    if (sectionRoutes[href]) {
      return sectionRoutes[href].some(
        (route) => pathname === route || pathname.startsWith(`${route}/`),
      );
    }
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  const avatarLetter = (user.displayName?.[0] ?? "S").toUpperCase();

  return (
    <div className="app-frame student-shell">
      <header className="student-topbar">
        <Link href="/" className="student-brand" aria-label="MPlace Study home">
          <img src={MPLACE_LOGO} alt="MPlace" />
          <span className="student-brand-divider" />
          <strong>Study</strong>
        </Link>

        <nav className="student-primary-nav" aria-label="Main navigation">
          {mainNav.map(([href, label, Icon]) => (
            <Link key={href} href={href} className={isActive(href) ? "student-nav-link active" : "student-nav-link"}>
              <Icon size={18} />
              <span>{label}</span>
            </Link>
          ))}
        </nav>

        <div className="student-account-actions">
          <Link className="student-round-button" href="/notices" aria-label="Announcements">
            <Bell size={19} />
          </Link>
          <button className="student-round-button" aria-label="Open more tools" onClick={() => setMenuOpen(true)}>
            <MoreHorizontal size={20} />
          </button>
          <Link href="/settings" className="student-avatar" aria-label="Open profile and settings">
            {user.photoURL ? <img src={user.photoURL} alt="" /> : avatarLetter}
          </Link>
        </div>

        <button className="student-mobile-menu" aria-label="Open navigation" onClick={() => setMenuOpen(true)}>
          <Menu size={22} />
        </button>
      </header>

      <button
        className={menuOpen ? "tablet-nav-backdrop open" : "tablet-nav-backdrop"}
        aria-label="Close navigation"
        onClick={() => setMenuOpen(false)}
      />
      <aside
        className={menuOpen ? "tablet-nav-drawer open student-drawer" : "tablet-nav-drawer student-drawer"}
        aria-hidden={!menuOpen}
      >
        <div className="student-drawer-head">
          <div className="student-drawer-identity">
            <div className="student-avatar large">{user.photoURL ? <img src={user.photoURL} alt="" /> : avatarLetter}</div>
            <div>
              <strong>{user.displayName ?? "Student"}</strong>
              <small>{user.email}</small>
            </div>
          </div>
          <button className="student-round-button" aria-label="Close navigation" onClick={() => setMenuOpen(false)}>
            <X size={20} />
          </button>
        </div>

        <nav className="student-drawer-primary" aria-label="Mobile navigation">
          {mainNav.map(([href, label, Icon]) => (
            <Link key={href} href={href} className={isActive(href) ? "drawer-main-link active" : "drawer-main-link"}>
              <Icon size={19} />
              <span>{label}</span>
            </Link>
          ))}
        </nav>

        <p className="drawer-label">School</p>
        <nav className="student-extra-links">
          {extraLinks.map(([href, label]) => <Link href={href} key={href}>{label}</Link>)}
        </nav>

        <div className="student-drawer-footer">
          <Link href="/settings"><Settings size={18} /> Settings</Link>
          <div><span>Appearance</span><ThemeToggle compact /></div>
          <button onClick={() => signOut(auth)}><LogOut size={18} /> Sign out</button>
        </div>
      </aside>

      <main className="main-content student-main">{children}</main>

      <nav className="bottom-nav student-bottom-nav">
        {mainNav.map(([href, label, Icon]) => (
          <Link key={href} href={href} className={isActive(href) ? "bottom-link active" : "bottom-link"}>
            <Icon size={20} />
            <span>{label}</span>
          </Link>
        ))}
        <button className="bottom-link bottom-more" onClick={() => setMenuOpen(true)}>
          <MoreHorizontal size={20} />
          <span>More</span>
        </button>
      </nav>
    </div>
  );
}
