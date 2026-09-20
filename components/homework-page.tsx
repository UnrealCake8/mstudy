"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Check, ExternalLink, GraduationCap, Plus, Trash2 } from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import { addItem, deleteItem, Homework, subscribeCollection, updateItem } from "@/lib/data";
import {
  isCurrentClassroomItem,
  type ClassroomAssignment,
  type ClassroomCourse,
} from "@/lib/classroom";
import {
  assignmentVisibilityId,
  subscribeHiddenAssignments,
} from "@/lib/assignment-visibility";

function friendlyDate(value: string) {
  if (!value) return "No due date";
  const date = new Date(`${value}T12:00:00`);
  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(date);
}

type HomeworkItem =
  | { kind: "manual"; id: string; title: string; subject: string; dueDate: string; item: Homework }
  | { kind: "classroom"; id: string; title: string; subject: string; dueDate: string; item: ClassroomAssignment };

export function HomeworkPage() {
  const { user } = useAuth();
  const [manualItems, setManualItems] = useState<Homework[]>([]);
  const [classroomItems, setClassroomItems] = useState<ClassroomAssignment[]>([]);
  const [courses, setCourses] = useState<ClassroomCourse[]>([]);
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!user) return;
    const stops = [
      subscribeCollection<Homework>(user.uid, "homework", setManualItems),
      subscribeCollection<ClassroomAssignment>(
        user.uid,
        "classroomAssignments",
        setClassroomItems,
        { orderByCreatedAt: false },
      ),
      subscribeCollection<ClassroomCourse>(
        user.uid,
        "classroomCourses",
        setCourses,
        { orderByCreatedAt: false },
      ),
    ];
    return () => stops.forEach((stop) => stop());
  }, [user]);

  useEffect(() => subscribeHiddenAssignments(setHidden), []);

  const courseNames = useMemo(
    () => new Map(courses.map((course) => [course.id, course.name])),
    [courses],
  );

  const allItems = useMemo<HomeworkItem[]>(
    () => [
      ...manualItems
        .filter((item) => !item.completed)
        .map((item): HomeworkItem => ({
          kind: "manual",
          id: `manual-${item.id}`,
          title: item.title,
          subject: item.subject || "General",
          dueDate: item.dueDate || "",
          item,
        })),
      ...classroomItems
        .filter(
          (item) =>
            isCurrentClassroomItem(item) &&
            !hidden.has(assignmentVisibilityId(item.courseId, item.id)),
        )
        .map((item): HomeworkItem => ({
          kind: "classroom",
          id: `classroom-${item.courseId}-${item.id}`,
          title: item.title,
          subject: courseNames.get(item.courseId) || "Google Classroom",
          dueDate: item.dueDate || "",
          item,
        })),
    ],
    [manualItems, classroomItems, hidden, courseNames],
  );

  const dueItems = useMemo(
    () =>
      allItems
        .filter((item) => item.dueDate)
        .sort((a, b) => a.dueDate.localeCompare(b.dueDate)),
    [allItems],
  );
  const noDueItems = useMemo(
    () => allItems.filter((item) => !item.dueDate),
    [allItems],
  );

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user) return;
    const form = new FormData(event.currentTarget);
    await addItem(user.uid, "homework", {
      title: String(form.get("title")),
      subject: String(form.get("subject") || "General"),
      teacher: String(form.get("teacher") || ""),
      duration: String(form.get("duration") || ""),
      dueDate: String(form.get("dueDate") || ""),
      priority: String(form.get("priority") || "medium"),
      completed: false,
    });
    event.currentTarget.reset();
    setOpen(false);
  }

  function renderItem(task: HomeworkItem) {
    if (task.kind === "manual") {
      const item = task.item;
      return (
        <article className="task-row" key={task.id}>
          <button
            className="check-button"
            aria-label={`Mark ${item.title} as done`}
            onClick={() => user && updateItem(user.uid, "homework", item.id, { completed: true })}
          >
            <Check size={16}/>
          </button>
          <div className="task-copy">
            <strong>{item.subject} – {item.teacher || "Teacher"} – HW – {item.title}{item.duration ? ` – ${item.duration}` : ""}</strong>
            <span>{item.dueDate ? `Due ${friendlyDate(item.dueDate)}` : "No due date"}</span>
          </div>
          <span className={`priority ${item.priority}`}>{item.priority}</span>
          <button
            className="icon-button danger"
            aria-label={`Delete ${item.title}`}
            onClick={() => user && deleteItem(user.uid, "homework", item.id)}
          >
            <Trash2 size={17}/>
          </button>
        </article>
      );
    }

    const item = task.item;
    return (
      <article className="task-row classroom-homework-row" key={task.id}>
        <div className="classroom-task-icon"><GraduationCap size={17}/></div>
        <div className="task-copy">
          <strong>{task.subject} – {task.title}</strong>
          <span>{item.dueDate ? `Due ${friendlyDate(item.dueDate)}${item.dueTime ? ` at ${item.dueTime}` : ""}` : "No due date"} · Google Classroom</span>
        </div>
        {item.alternateLink ? (
          <a className="secondary-button homework-open-button" href={item.alternateLink} target="_blank" rel="noreferrer">
            Open <ExternalLink size={14}/>
          </a>
        ) : <span className="priority classroom">Classroom</span>}
      </article>
    );
  }

  return (
    <section className="page">
      <div className="page-head">
        <div>
          <p className="eyebrow">Planner</p>
          <h1>Classwork</h1>
          <p>{allItems.length === 0 ? "Nothing left to do." : `${allItems.length} assignment${allItems.length === 1 ? "" : "s"} left across MPlace Study and Classroom.`}</p>
        </div>
        <button className="primary-button" onClick={() => setOpen((value) => !value)}>
          <Plus size={17}/> Add classwork
        </button>
      </div>

      {open ? (
        <form className="editor-card compact student-form" onSubmit={submit}>
          <div className="notice homework-format"><strong>SES homework format</strong><span>Subject – Teacher – HW – Title – Duration</span></div>
          <label><span>Classwork title</span><input name="title" placeholder="e.g. Algebra questions 1–10" required/></label>
          <label><span>Subject</span><input name="subject" placeholder="e.g. Maths"/></label>
          <label><span>Teacher</span><input name="teacher" placeholder="e.g. Mr Ahmed"/></label>
          <label><span>Estimated duration</span><input name="duration" placeholder="e.g. 30 minutes"/></label>
          <label><span>Due date</span><input name="dueDate" type="date"/></label>
          <label><span>Priority</span><select name="priority" defaultValue="medium"><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select></label>
          <button className="primary-button">Add task</button>
        </form>
      ) : null}

      {!allItems.length ? (
        <div className="empty-state homework-empty"><strong>You’re all caught up</strong><span>Manually added work and Google Classroom assignments will appear here.</span></div>
      ) : null}

      {dueItems.length ? (
        <section className="homework-category">
          <div className="homework-category-heading"><div><span>Scheduled</span><h2>Due soon</h2></div><strong>{dueItems.length}</strong></div>
          <div className="task-list">{dueItems.map(renderItem)}</div>
        </section>
      ) : null}

      {noDueItems.length ? (
        <section className="homework-category">
          <div className="homework-category-heading muted"><div><span>Unscheduled</span><h2>No due date</h2></div><strong>{noDueItems.length}</strong></div>
          <p className="homework-category-help">These assignments are still active, but the teacher has not set a deadline.</p>
          <div className="task-list">{noDueItems.map(renderItem)}</div>
        </section>
      ) : null}
    </section>
  );
}
