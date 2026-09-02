"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ExternalLink,
  FolderPlus,
  Megaphone,
  RefreshCw,
  Trash2,
  X,
} from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import { subscribeCollection } from "@/lib/data";
import type { ClassroomAnnouncement, ClassroomCourse } from "@/lib/classroom";
import {
  addNoticeToFolder,
  AnnouncementFolder,
  createAnnouncementFolder,
  deleteAnnouncementFolder,
  removeNoticeFromFolder,
  SchoolAnnouncement,
  subscribeAnnouncementFolders,
  subscribeSchoolAnnouncements,
} from "@/lib/school-announcements";

type NoticeItem = {
  id: string;
  title: string;
  body: string;
  group: string;
  source: "MPlace Study" | "Google Classroom";
  date: string;
  link?: string;
  pinned?: boolean;
};

export function SchoolNoticesPage() {
  const { user } = useAuth(),
    [classroom, setClassroom] = useState<ClassroomAnnouncement[]>([]),
    [courses, setCourses] = useState<ClassroomCourse[]>([]),
    [school, setSchool] = useState<SchoolAnnouncement[]>([]),
    [folders, setFolders] = useState<AnnouncementFolder[]>([]),
    [active, setActive] = useState("all");
  useEffect(() => {
    if (!user) return;
    const stops = [
      subscribeCollection<ClassroomAnnouncement>(
        user.uid,
        "classroomAnnouncements",
        setClassroom,
        { orderByCreatedAt: false },
      ),
      subscribeCollection<ClassroomCourse>(
        user.uid,
        "classroomCourses",
        setCourses,
        { orderByCreatedAt: false },
      ),
      subscribeSchoolAnnouncements(setSchool),
      subscribeAnnouncementFolders(user.uid, setFolders),
    ];
    return () => stops.forEach((stop) => stop());
  }, [user]);
  const names = useMemo(
    () => new Map(courses.map((course) => [course.id, course.name])),
    [courses],
  );
  const notices = useMemo<NoticeItem[]>(() => {
    const google: NoticeItem[] = classroom.map((item) => {
      const course = names.get(item.courseId) || "Class";
      const automatic = /house|gecko|falcon|fox|lynx|stingray/i.test(course)
        ? "House"
        : /secondary/i.test(course)
          ? "Secondary"
          : course;
      return {
        id: `classroom:${item.courseId}:${item.id}`,
        title: course,
        body: item.text,
        group: automatic,
        source: "Google Classroom" as const,
        date: item.updateTime || item.creationTime || "",
        link: item.alternateLink,
      };
    });
    const native: NoticeItem[] = school.map((item) => ({
      id: `school:${item.id}`,
      title: item.title,
      body: item.body,
      group: item.group || "General",
      source: "MPlace Study" as const,
      date:
        typeof item.createdAt === "string"
          ? item.createdAt
          : item.createdAt?.toDate?.().toISOString() || "",
      pinned: item.pinned,
    }));
    return [...native, ...google].sort(
      (a, b) =>
        Number(Boolean(b.pinned)) - Number(Boolean(a.pinned)) ||
        b.date.localeCompare(a.date),
    );
  }, [classroom, school, names]);
  const automaticGroups = useMemo(
    () => Array.from(new Set(notices.map((item) => item.group))).sort(),
    [notices],
  );
  const selectedFolder = folders.find((folder) => folder.id === active);
  const visible =
    active === "all"
      ? notices
      : selectedFolder
        ? notices.filter((item) => selectedFolder.noticeIds.includes(item.id))
        : notices.filter((item) => item.group === active);
  async function newFolder() {
    if (!user) return;
    const name = window.prompt("Folder name, e.g. Important or Exams")?.trim();
    if (name) await createAnnouncementFolder(user.uid, name);
  }
  return (
    <section className="page">
      <div className="page-head">
        <div>
          <p className="eyebrow">School communication</p>
          <h1>School Notices</h1>
          <p>
            Group Classroom and MPlace Study announcements so important
            information is easier to find.
          </p>
        </div>
        <div className="form-actions">
          <button className="secondary-button" onClick={() => void newFolder()}>
            <FolderPlus size={16} /> New folder
          </button>
          <a className="secondary-button" href="/classroom">
            <RefreshCw size={16} /> Sync Classroom
          </a>
        </div>
      </div>
      <div className="notice-group-tabs">
        <button
          className={active === "all" ? "active" : ""}
          onClick={() => setActive("all")}
        >
          All
        </button>
        {automaticGroups.map((group) => (
          <button
            className={active === group ? "active" : ""}
            key={group}
            onClick={() => setActive(group)}
          >
            {group}
          </button>
        ))}
        {folders.map((folder) => (
          <span className="notice-custom-group" key={folder.id}>
            <button
              className={active === folder.id ? "active custom" : "custom"}
              onClick={() => setActive(folder.id)}
            >
              {folder.name}
            </button>
            <button
              className="notice-group-delete"
              onClick={() =>
                user && void deleteAnnouncementFolder(user.uid, folder.id)
              }
              aria-label={`Delete ${folder.name}`}
            >
              <X size={12} />
            </button>
          </span>
        ))}
      </div>
      {notices.length === 0 ? (
        <div className="connect-card">
          <div className="connect-icon">
            <Megaphone size={25} />
          </div>
          <div>
            <h2>No announcements yet</h2>
            <p>
              Sync Google Classroom or wait for an MPlace Study administrator to
              publish one.
            </p>
          </div>
        </div>
      ) : null}
      <div className="notice-feed">
        {visible.map((item) => (
          <article
            className={item.pinned ? "notice-card pinned" : "notice-card"}
            key={item.id}
          >
            <div className="notice-card-main">
              <div className="notice-meta">
                <span className="pill">{item.group}</span>
                <small>
                  {item.source}
                  {item.pinned ? " · Pinned" : ""}
                </small>
              </div>
              <h2>{item.title}</h2>
              <p>{item.body}</p>
              <small>
                {item.date
                  ? new Date(item.date).toLocaleString()
                  : "Published notice"}
              </small>
              <div className="notice-folder-actions">
                {folders.length ? (
                  <label>
                    Save to folder
                    <select
                      defaultValue=""
                      onChange={(event) => {
                        if (user && event.target.value)
                          void addNoticeToFolder(
                            user.uid,
                            event.target.value,
                            item.id,
                          );
                        event.currentTarget.value = "";
                      }}
                    >
                      <option value="">Choose…</option>
                      {folders
                        .filter((folder) => !folder.noticeIds.includes(item.id))
                        .map((folder) => (
                          <option key={folder.id} value={folder.id}>
                            {folder.name}
                          </option>
                        ))}
                    </select>
                  </label>
                ) : null}
                {selectedFolder?.noticeIds.includes(item.id) ? (
                  <button
                    className="text-button danger"
                    onClick={() =>
                      user &&
                      void removeNoticeFromFolder(
                        user.uid,
                        selectedFolder.id,
                        item.id,
                      )
                    }
                  >
                    <Trash2 size={13} /> Remove from folder
                  </button>
                ) : null}
              </div>
            </div>
            {item.link ? (
              <a
                className="icon-button"
                href={item.link}
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
      {visible.length === 0 && notices.length ? (
        <div className="empty-state">
          <strong>No announcements in this group</strong>
          <span>Choose another group or add notices to this folder.</span>
        </div>
      ) : null}
    </section>
  );
}
