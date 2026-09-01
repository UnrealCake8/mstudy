import type { Metadata } from "next";
import { HeartHandshake, LockKeyhole, ShieldCheck, Users } from "lucide-react";
import { AppShell } from "@/components/app-shell";
export const metadata: Metadata = { title: "Student Support" };
export default function Page() {
  return (
    <AppShell>
      <section className="page">
        <div className="page-head">
          <div>
            <p className="eyebrow">Personal, social and emotional support</p>
            <h1>Student Support</h1>
            <p>
              Support information provided in the SES Tutor Day presentation.
            </p>
          </div>
        </div>
        <div className="support-grid">
          <article className="support-card">
            <HeartHandshake />
            <h2>Secondary counsellor</h2>
            <strong>Ms Farhaanah Amir</strong>
            <p>
              The counselling service supports students’ personal, social,
              emotional and academic development.
            </p>
          </article>
          <article className="support-card">
            <Users />
            <h2>What is available</h2>
            <p>
              Individual counselling, small-group counselling, consultation and
              referrals to external professionals. The counsellor works
              alongside Heads of House.
            </p>
          </article>
          <article className="support-card">
            <LockKeyhole />
            <h2>Consent and confidentiality</h2>
            <p>
              The presentation states that parental consent is not required for
              students over 12. Counselling is confidential unless there is a
              safeguarding concern.
            </p>
          </article>
          <article className="support-card">
            <ShieldCheck />
            <h2>Safeguarding concern</h2>
            <p>
              Tell a trusted member of staff, your tutor, Head of House or the
              counsellor.
            </p>
          </article>
        </div>
        <div className="notice">
          <strong>If something is not okay, speak up.</strong>
          <span>
            SES says staff are trained to respond and the school safeguarding
            team has Level 3 DSL training.
          </span>
        </div>
      </section>
    </AppShell>
  );
}
