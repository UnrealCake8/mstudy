"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { GoogleSignInButton } from "@/components/auth/google-sign-in";
import { EmailPasswordAuth } from "@/components/auth/email-password-auth";
import { useAuth } from "@/components/auth/auth-provider";

export default function AuthPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) router.replace("/");
  }, [loading, user, router]);

  return (
    <main className="auth-shell">
      <section className="auth-card">
        <Link href="/" className="auth-brand">MStudy</Link>
        <p className="auth-kicker">Your school life, organised.</p>
        <h1>Welcome to MStudy</h1>
        <p className="auth-copy">Sign in with email and password, or continue with Google. Classroom connections can be added later and are never required.</p>
        <EmailPasswordAuth />
        <div className="auth-divider" role="separator"><span>or</span></div>
        <GoogleSignInButton />
        <p className="auth-note">Your MStudy data is private to your account.</p>
      </section>
    </main>
  );
}
