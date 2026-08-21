"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile } from "firebase/auth";
import { auth } from "@/lib/firebase";

export function EmailPasswordAuth() {
  const router = useRouter();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (mode === "signup") {
        const credential = await createUserWithEmailAndPassword(auth, email.trim(), password);
        if (name.trim()) await updateProfile(credential.user, { displayName: name.trim() });
      } else {
        await signInWithEmailAndPassword(auth, email.trim(), password);
      }
      router.replace("/");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not continue with email and password.";
      setError(message.replace(/^Firebase:\s*/i, ""));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-email-block">
      <form onSubmit={submit} className="auth-email-form">
        {mode === "signup" ? (
          <label>
            Name
            <input value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" placeholder="Your name" />
          </label>
        ) : null}
        <label>
          Email
          <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" placeholder="you@example.com" required />
        </label>
        <label>
          Password
          <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete={mode === "signup" ? "new-password" : "current-password"} minLength={6} placeholder="At least 6 characters" required />
        </label>
        <button className="primary-button full" type="submit" disabled={loading}>
          {loading ? "Please wait…" : mode === "signup" ? "Create account" : "Sign in with email"}
        </button>
      </form>
      {error ? <p className="form-error">{error}</p> : null}
      <button className="text-button full" type="button" onClick={() => { setMode(mode === "signin" ? "signup" : "signin"); setError(null); }}>
        {mode === "signin" ? "New to MStudy? Create an account" : "Already have an account? Sign in"}
      </button>
    </div>
  );
}
