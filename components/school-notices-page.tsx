"use client";
import { useEffect, useMemo, useState } from "react";
import { ExternalLink, Megaphone, RefreshCw } from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import { subscribeCollection } from "@/lib/data";
import type { ClassroomAnnouncement, ClassroomCourse } from "@/lib/classroom";
export function SchoolNoticesPage() {
  const { user } = useAuth(),
    [notices, setNotices] = useState<ClassroomAnnouncement[]>([]),
    [courses, setCourses] = useState<ClassroomCourse[]>([]);
  useEffect(() => {
    if (!user) return;
    const a = subscribeCollection<ClassroomAnnouncement>(
        user.uid,
        "classroomAnnouncements",
        setNotices,
        { orderByCreatedAt: false },
      ),
      b = subscribeCollection<ClassroomCourse>(
        user.uid,
        "classroomCourses",
        setCourses,
        { orderByCreatedAt: false },
      );
    return () => {
      a();
      b();
    };
  }, [user]);
  const names = useMemo(
      () => new Map(courses.map((c) => [c.id, c.name])),
      [courses],
    ),
    grouped = useMemo(
      () => ({
        house: notices.filter((n) =>
          /house|gecko|falcon|fox|lynx|stingray/i.test(
            names.get(n.courseId) || "",
          ),
        ),
        secondary: notices.filter((n) =>
          /secondary/i.test(names.get(n.courseId) || ""),
        ),
        classes: notices.filter(
          (n) =>
            !/secondary|house|gecko|falcon|fox|lynx|stingray/i.test(
              names.get(n.courseId) || "",
            ),
        ),
      }),
      [notices, names],
    );
  const section = (title: string, items: ClassroomAnnouncement[]) => (
    <section>
      <h2 className="section-title">{title}</h2>
      {items.length ? (
        <div className="notice-feed">
          {[...items]
            .sort((a, b) =>
              (b.updateTime || "").localeCompare(a.updateTime || ""),
            )
            .map((item) => (
              <article
                className="notice-card"
                key={`${item.courseId}_${item.id}`}
              >
                <div>
                  <span className="pill">
                    {names.get(item.courseId) || "Google Classroom"}
                  </span>
                  <p>{item.text}</p>
                  <small>
                    {item.updateTime
                      ? new Date(item.updateTime).toLocaleString()
                      : "Published notice"}
                  </small>
                </div>
                {item.alternateLink ? (
                  <a
                    className="icon-button"
                    href={item.alternateLink}
                    target="_blank"
                    rel="noreferrer"
                    aria-label="Open announcement in Classroom"
                  >
                    <ExternalLink size={17} />
                  </a>
                ) : null}
              </article>
            ))}
        </div>
      ) : (
        <div className="empty-state compact">
          <strong>No {title.toLowerCase()} synced</strong>
        </div>
      )}
    </section>
  );
  return (
    <section className="page">
      <div className="page-head">
        <div>
          <p className="eyebrow">Google Classroom announcements</p>
          <h1>School Notices</h1>
          <p>
            Secondary and House announcements stay separate from homework and
            assignments.
          </p>
        </div>
        <a className="secondary-button" href="/classroom">
          <RefreshCw size={16} /> Sync Classroom
        </a>
      </div>
      {notices.length === 0 ? (
        <div className="connect-card">
          <div className="connect-icon">
            <Megaphone size={25} />
          </div>
          <div>
            <h2>No announcements yet</h2>
            <p>
              Sync Google Classroom after approving announcement read access.
            </p>
          </div>
        </div>
      ) : null}
      {section("Secondary notices", grouped.secondary)}
      {section("House notices", grouped.house)}
      {grouped.classes.length
        ? section("Class notices", grouped.classes)
        : null}
    </section>
  );
}
