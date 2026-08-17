"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signInWithPopup } from "firebase/auth";
import { auth, googleProvider } from "@/lib/firebase";

export function GoogleSignInButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function signIn() {
    setLoading(true); setError(null);
    try {
      await signInWithPopup(auth, googleProvider);
      router.replace("/");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not sign in with Google.";
      setError(message.includes("popup-closed") ? "Sign-in was cancelled." : message);
    } finally { setLoading(false); }
  }

  return <div>
    <button className="primary-button full" onClick={signIn} disabled={loading}>{loading ? "Signing in…" : "Continue with Google"}</button>
    {error ? <p className="form-error">{error}</p> : null}
  </div>;
}
