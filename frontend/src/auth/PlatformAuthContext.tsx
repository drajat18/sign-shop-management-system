import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import type { PlatformUser } from "../types/index.js";

interface PlatformAuthState {
  user: PlatformUser | null;
  token: string | null;
  login: (user: PlatformUser, token: string) => void;
  logout: () => void;
}

const PlatformAuthContext = createContext<PlatformAuthState | undefined>(undefined);
// Deliberately a different key from the shop session ("sign-shop-auth") so
// a platform team member can hold a platform session and a shop session
// (e.g. via impersonation) at the same time without one clobbering the other.
const STORAGE_KEY = "sign-shop-platform-auth";

function loadStored(): { user: PlatformUser; token: string } | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function PlatformAuthProvider({ children }: { children: ReactNode }) {
  const stored = loadStored();
  const [user, setUser] = useState<PlatformUser | null>(stored?.user ?? null);
  const [token, setToken] = useState<string | null>(stored?.token ?? null);

  const value = useMemo<PlatformAuthState>(
    () => ({
      user,
      token,
      login: (u, t) => {
        setUser(u);
        setToken(t);
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ user: u, token: t }));
      },
      logout: () => {
        setUser(null);
        setToken(null);
        localStorage.removeItem(STORAGE_KEY);
      },
    }),
    [user, token]
  );

  return <PlatformAuthContext.Provider value={value}>{children}</PlatformAuthContext.Provider>;
}

export function usePlatformAuth(): PlatformAuthState {
  const ctx = useContext(PlatformAuthContext);
  if (!ctx) throw new Error("usePlatformAuth must be used within PlatformAuthProvider");
  return ctx;
}
