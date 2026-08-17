import { BookOpen, CalendarDays, CheckCircle2, Clock3, FileText, GraduationCap, NotebookPen, Sparkles } from "lucide-react";

const tools = [
  { title: "Timetable", description: "Keep your school week in one place.", icon: Clock3 },
  { title: "Homework", description: "Track work, deadlines and priorities.", icon: CheckCircle2 },
  { title: "Notes", description: "Keep study notes organised by subject.", icon: NotebookPen },
  { title: "Revision", description: "Turn what you learn into focused study.", icon: Sparkles },
  { title: "Calendar", description: "See exams, events and important dates.", icon: CalendarDays },
  { title: "Resources", description: "Save useful files and school links.", icon: FileText },
  { title: "Subjects", description: "Build your own school setup.", icon: BookOpen },
  { title: "Google Classroom", description: "Connect school work when you are ready.", icon: GraduationCap },
];

export default function HomePage() {
  return (
    <main className="shell">
      <div className="container">
        <header className="topbar">
          <div className="brand">MStudy</div>
          <div className="badge">Foundation build</div>
        </header>

        <section className="hero">
          <h1>Your school life,<br />organised.</h1>
          <p>MStudy is a student-first workspace for planning your week, tracking homework, keeping notes and connecting the school tools you already use.</p>
        </section>

        <h2 className="section-title">Your MStudy</h2>
        <section className="grid">
          {tools.map(({ title, description, icon: Icon }) => (
            <article className="card" key={title}>
              <div className="icon"><Icon size={20} /></div>
              <h2>{title}</h2>
              <p>{description}</p>
            </article>
          ))}
        </section>

        <h2 className="section-title">Coming up</h2>
        <section className="panel">
          <div className="row"><div><strong>No homework yet</strong><br /><small>Your upcoming tasks will appear here.</small></div><span>✓</span></div>
          <div className="row"><div><strong>Connect Google later</strong><br /><small>Classroom and Calendar integration will be optional.</small></div><span>→</span></div>
        </section>
      </div>
    </main>
  );
}
