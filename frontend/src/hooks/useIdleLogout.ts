import { useEffect, useRef } from "react";

// Front desk terminals are the realistic threat model here — a shared
// workstation left logged in between customers, not someone stepping away
// from a personal laptop. 30 minutes balances that against logging out an
// employee mid-task just because they were on a phone call.
const IDLE_TIMEOUT_MS = 30 * 60 * 1000;

const ACTIVITY_EVENTS = ["mousedown", "keydown", "scroll", "touchstart"] as const;

// Auto-logs out after a stretch of no interaction, on top of the JWT's own
// server-side expiry — that only ever gets checked on the next API call, so
// a session left open in a background tab stays "logged in" client-side
// indefinitely without this.
export function useIdleLogout(onIdle: () => void): void {
  const onIdleRef = useRef(onIdle);
  onIdleRef.current = onIdle;

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;

    function resetTimer() {
      clearTimeout(timer);
      timer = setTimeout(() => onIdleRef.current(), IDLE_TIMEOUT_MS);
    }

    resetTimer();
    ACTIVITY_EVENTS.forEach((event) => window.addEventListener(event, resetTimer));

    return () => {
      clearTimeout(timer);
      ACTIVITY_EVENTS.forEach((event) => window.removeEventListener(event, resetTimer));
    };
  }, []);
}
