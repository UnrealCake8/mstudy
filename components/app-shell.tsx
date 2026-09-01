"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { signOut } from "firebase/auth";
import { BookOpen, CalendarDays, Clock3, EyeOff, Gamepad2, HeartHandshake, Home, LogOut, Megaphone, Menu, MessageCircle, ShieldCheck, Sparkles, X } from "lucide-react";
import { auth } from "@/lib/firebase";
import { isAdmin } from "@/lib/school-data";
import { ensureChatProfile, isChatDomainAllowed } from "@/lib/chat";
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
  "/study": ["/study", "/notes", "/play", "/team"],
};

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [admin, setAdmin] = useState(false);
  const [chatAllowed, setChatAllowed] = useState(false);
  const [tabletMenuOpen, setTabletMenuOpen] = useState(false);

  useEffect(() => { if (!loading && !user) router.replace("/auth"); }, [loading, user, router]);
  useEffect(() => {
    if (user) {
      void isAdmin(user.uid).then(setAdmin).catch(() => setAdmin(false));
      void isChatDomainAllowed(user.email).then(async ok => {
        setChatAllowed(ok);
        if (ok && user.email) await ensureChatProfile(user.uid, user.email, user.displayName);
      }).catch(() => setChatAllowed(false));
    } else {
      setAdmin(false);
      setChatAllowed(false);
    }
  }, [user]);
  useEffect(() => { setTabletMenuOpen(false); }, [pathname]);

  const utilityNav = useMemo(() => {
    const items: Array<readonly [string, string, typeof Home]> = [
      ["/notices", "School Notices", Megaphone], ["/cca", "CCA Hub", Sparkles], ["/support", "Support", HeartHandshake], ["/school-guide", "School Guide", BookOpen]
    ];
    if (chatAllowed) items.push(["/messages", "Messages", MessageCircle]);
    if (admin) {
      items.push(["/admin", "Admin", ShieldCheck]);
      items.push(["/admin/assignments", "Assignment Visibility", EyeOff]);
      items.push(["/admin/timetables", "Timetable Assignments", Clock3]);
      items.push(["/admin/messages", "Chat Admin", MessageCircle]);
    }
    return items;
  }, [admin, chatAllowed]);

  if (loading || !user) return <main className="center-screen"><div className="spinner"/><p>Loading MPlace Study…</p></main>;

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    if (sectionRoutes[href]) return sectionRoutes[href].some(route => pathname === route || pathname.startsWith(`${route}/`));
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  const renderLink = ([href, label, Icon]: readonly [string, string, typeof Home], className: string) => (
    <Link key={href} href={href} className={isActive(href) ? `${className} active` : className}>
      <Icon size={19}/><span>{label}</span>
    </Link>
  );

  const avatarLetter = (user.displayName?.[0] ?? "S").toUpperCase();

  return <div className="app-frame">
    <aside className="sidebar">
      <div className="sidebar-brand-row"><Link href="/" className="mplace-product-brand" aria-label="MPlace Study home"><img src={MPLACE_LOGO} alt="MPlace" className="mplace-parent-logo"/><span><strong>MPlace Study</strong></span></Link><ThemeToggle compact/></div>
      <nav className="side-nav" aria-label="Main navigation">{mainNav.map(item => renderLink(item, "nav-link"))}</nav>
      {utilityNav.length > 0 && <nav className="side-nav" aria-label="Communication and admin">{utilityNav.map(item => renderLink(item, "nav-link"))}</nav>}
      <a href="https://search.mplace.cc" className="mplace-family-link">Explore MPlace</a>
      <div className="user-block"><Link href="/settings" className="avatar" aria-label="Open profile and settings">{avatarLetter}</Link><Link href="/settings" className="user-meta"><strong>{user.displayName ?? "Student"}</strong><small>{user.email}</small></Link><button aria-label="Sign out" className="icon-button" onClick={() => signOut(auth)}><LogOut size={18}/></button></div>
    </aside>

    <header className="tablet-topbar"><Link href="/" className="tablet-brand" aria-label="MPlace Study home"><img src={MPLACE_LOGO} alt="MPlace"/><span><strong>MPlace Study</strong></span></Link><div className="tablet-topbar-actions"><ThemeToggle compact/><button className="tablet-menu-button" aria-label="Open navigation" aria-expanded={tabletMenuOpen} onClick={() => setTabletMenuOpen(true)}><Menu size={22}/></button></div></header>

    <button className={tabletMenuOpen ? "tablet-nav-backdrop open" : "tablet-nav-backdrop"} aria-label="Close navigation" onClick={() => setTabletMenuOpen(false)}/>
    <aside className={tabletMenuOpen ? "tablet-nav-drawer open" : "tablet-nav-drawer"} aria-hidden={!tabletMenuOpen}>
      <div className="tablet-nav-head"><strong>MPlace Study</strong><button className="tablet-menu-button" aria-label="Close navigation" onClick={() => setTabletMenuOpen(false)}><X size={21}/></button></div>
      <nav className="tablet-nav-grid">{mainNav.map(item => renderLink(item, "tablet-nav-link"))}{utilityNav.map(item => renderLink(item, "tablet-nav-link"))}</nav>
      <div className="tablet-nav-footer"><a href="https://search.mplace.cc" className="secondary-button">Explore MPlace</a><div className="tablet-user"><Link href="/settings" className="avatar">{avatarLetter}</Link><Link href="/settings" className="tablet-user-copy"><strong>{user.displayName ?? "Student"}</strong><small>{user.email}</small></Link><button aria-label="Sign out" className="icon-button" onClick={() => signOut(auth)}><LogOut size={18}/></button></div></div>
    </aside>

    <main className="main-content">{children}</main>
    <nav className="bottom-nav">{mainNav.map(([href,label,Icon]) => <Link key={href} href={href} className={isActive(href) ? "bottom-link active" : "bottom-link"}><Icon size={20}/><span>{label}</span></Link>)}</nav>
  </div>;
}
