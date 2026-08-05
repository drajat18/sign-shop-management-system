import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { apiFetch } from "../api/client.js";
import type { ShopPlan } from "../types/index.js";
import { useAuth } from "./AuthContext.js";

// Lets nav items and buttons hide themselves up front instead of every
// gated action just failing with a 403 after the fact — the backend
// checks (requirePlanFeature, the employee-limit check in
// users.routes.ts) are the real gate; this is only ever a convenience.
interface PlanContextValue {
  plan: ShopPlan | null;
  refetch: () => void;
}

const PlanContext = createContext<PlanContextValue>({ plan: null, refetch: () => {} });

export function PlanProvider({ children }: { children: ReactNode }) {
  const { token, user } = useAuth();
  const [plan, setPlan] = useState<ShopPlan | null>(null);

  const load = useCallback(() => {
    if (!token || !user) {
      setPlan(null);
      return;
    }
    apiFetch<ShopPlan>("/shop/plan", { token }).then(setPlan).catch(console.error);
  }, [token, user]);

  useEffect(load, [load]);

  return <PlanContext.Provider value={{ plan, refetch: load }}>{children}</PlanContext.Provider>;
}

// Null while loading (or logged out) — callers should treat that as "not
// known yet" rather than "not included," same spirit as useAuth's user
// being null pre-login.
export function usePlan(): ShopPlan | null {
  return useContext(PlanContext).plan;
}

// Lets a self-serve billing/storage action refresh the plan immediately
// after completing, instead of waiting for the next full page load.
export function usePlanRefetch(): () => void {
  return useContext(PlanContext).refetch;
}
