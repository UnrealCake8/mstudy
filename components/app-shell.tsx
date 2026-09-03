"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { signOut } from "firebase/auth";
import {
  CalendarDays,
  Clock3,
  Gamepad2,
  Home,
  LogOut,
  Menu,
  MoreHorizontal,
  Settings,
  X,
} from "lucide-react";
import { auth } from "@/lib/firebase";
import { useAuth } from "@/components/auth/auth-provider";
import { ThemeToggle } from "@/components/theme-toggle";

const MPLACE_LOGO = "https://unrealcake8.github.io/cdn-hls/mplace.png";

const mainNav = [
  ["/", "Today", Home],
  ["/planner", "Planner", CalendarDays],
  ["/classes", "Classes", Clock3],
  ["/study", "Study", Gamepad2],
] as const;

const sectionRoutes: Record<string, string[]> = {
  "/planner": ["/planner", "/homework", "/calendar", "/events", "/classroom", "/after-school"],
  "/classes": ["/classes", "/timetable", "/class-locator"],
  "/study": ["/study", "/notes", "/play", "/team", "/practice-papers"],
};

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.replace("/auth");
  }, [loading, user, router]);

  useEffect(() => setMenuOpen(false), [pathname]);

  if (loading || !user)
    return (
      <main className="center-screen">
        <div className="spinner" />
        <p>Loading MPlace Study…</p>
      </main>
    );

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
    <div className="app-frame simple-shell">
      <aside className="sidebar simple-sidebar">
        <div className="simple-brand-row">
          <Link href="/" className="mplace-product-brand" aria-label="MPlace Study home">
            <img src={MPLACE_LOGO} alt="MPlace" className="mplace-parent-logo" />
            <strong>MPlace Study</strong>
          </Link>
        </div>

        <nav className="side-nav simple-primary-nav" aria-label="Main navigation">
          {mainNav.map(([href, label, Icon]) => (
            <Link key={href} href={href} className={isActive(href) ? "nav-link active" : "nav-link"}>
              <Icon size={18} />
              <span>{label}</span>
            </Link>
          ))}
        </nav>

        <div className="simple-sidebar-spacer" />

        <Link href="/settings" className="nav-link subtle-nav-link">
          <Settings size={18} />
          <span>Settings</span>
        </Link>
        <button className="nav-link subtle-nav-link shell-more-button" onClick={() => setMenuOpen(true)}>
          <MoreHorizontal size={18} />
          <span>More</span>
        </button>

        <div className="user-block compact-user-block">
          <Link href="/settings" className="avatar" aria-label="Open profile and settings">{avatarLetter}</Link>
          <Link href="/settings" className="user-meta">
            <strong>{user.displayName ?? "Student"}</strong>
            <small>{user.email}</small>
          </Link>
          <button aria-label="Sign out" className="icon-button" onClick={() => signOut(auth)}>
            <LogOut size={17} />
          </button>
        </div>
      </aside>

      <header className="tablet-topbar simple-topbar">
        <Link href="/" className="tablet-brand" aria-label="MPlace Study home">
          <img src={MPLACE_LOGO} alt="MPlace" />
          <strong>MPlace Study</strong>
        </Link>
        <button className="tablet-menu-button" aria-label="Open navigation" onClick={() => setMenuOpen(true)}>
          <Menu size={21} />
        </button>
      </header>

      <button className={menuOpen ? "tablet-nav-backdrop open" : "tablet-nav-backdrop"} aria-label="Close navigation" onClick={() => setMenuOpen(false)} />
      <aside className={menuOpen ? "tablet-nav-drawer open simple-more-drawer" : "tablet-nav-drawer simple-more-drawer"} aria-hidden={!menuOpen}>
        <div className="tablet-nav-head">
          <div>
            <strong>More</strong>
            <small>Extra tools and account options</small>
          </div>
          <button className="tablet-menu-button" aria-label="Close navigation" onClick={() => setMenuOpen(false)}>
            <X size={20} />
          </button>
        </div>
        <nav className="more-link-list">
          <Link href="/notices">Announcements</Link>
          <Link href="/cca">CCA</Link>
          <Link href="/school-guide">School guide</Link>
          <Link href="/support">Support</Link>
          <Link href="/settings">Settings</Link>
        </nav>
        <div className="drawer-theme-row">
          <span>Appearance</span>
          <ThemeToggle compact />
        </div>
      </aside>

      <main className="main-content">{children}</main>

      <nav className="bottom-nav simple-bottom-nav">
        {mainNav.map(([href, label, Icon]) => (
          <Link key={href} href={href} className={isActive(href) ? "bottom-link active" : "bottom-link"}>
            <Icon size={19} />
            <span>{label}</span>
          </Link>
        ))}
        <button className="bottom-link bottom-more" onClick={() => setMenuOpen(true)}>
          <MoreHorizontal size={19} />
          <span>More</span>
        </button>
      </nav>
    </div>
  );
}
