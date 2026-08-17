import Link from "next/link";
import { GoogleSignInButton } from "@/components/auth/google-sign-in";

export default function AuthPage() {
  return (
    <main className="auth-shell">
      <section className="auth-card">
        <Link href="/" className="auth-brand">MStudy</Link>
        <p className="auth-kicker">Your school life, organised.</p>
        <h1>Welcome to MStudy</h1>
        <p className="auth-copy">Sign in with Google. You can connect Classroom and other school tools later if you want.</p>
        <GoogleSignInButton />
        <p className="auth-note">MStudy is designed to work even if your school does not use Google Classroom.</p>
      </section>
    </main>
  );
}
