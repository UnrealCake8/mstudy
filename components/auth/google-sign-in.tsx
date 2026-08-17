"use client";

import { useState } from "react";
import { signInWithPopup } from "firebase/auth";
import { auth, googleProvider } from "@/lib/firebase";

export function GoogleSignInButton() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function signIn() {
    setLoading(true);
    setError(null);

    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not sign in with Google.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <button className="google-button" onClick={signIn} disabled={loading}>
        {loading ? "Signing in…" : "Continue with Google"}
      </button>
      {error ? <p className="auth-error">{error}</p> : null}
    </div>
  );
}
