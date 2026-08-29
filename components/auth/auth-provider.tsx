"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";

type AuthState = { user: User | null; loading: boolean };
const AuthContext = createContext<AuthState>({ user: null, loading: true });

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => onAuthStateChanged(auth, async (nextUser) => {
    setUser(nextUser);
    if (nextUser) {
      const email = nextUser.email ?? "";
      await setDoc(doc(db, "users", nextUser.uid), {
        uid: nextUser.uid,
        name: nextUser.displayName ?? "Student",
        email,
        emailLower: email.trim().toLowerCase(),
        photoURL: nextUser.photoURL ?? null,
        lastSeenAt: serverTimestamp(),
      }, { merge: true });
    }
    setLoading(false);
  }), []);

  const value = useMemo(() => ({ user, loading }), [user, loading]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() { return useContext(AuthContext); }
