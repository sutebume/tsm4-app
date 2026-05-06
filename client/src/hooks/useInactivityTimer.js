import { useEffect, useRef, useState, useCallback } from 'react';

const TIMEOUT_MS  = 10 * 60 * 1000; // 10 minutes
const WARNING_MS  =  1 * 60 * 1000; // show warning 1 minute before logout

/**
 * Tracks user inactivity and calls onLogout after TIMEOUT_MS of no activity.
 * Returns { showWarning, remaining (seconds), extend } so the caller can
 * render a "You'll be logged out in X seconds" modal.
 *
 * Activity events that reset the timer:
 *   mousemove, mousedown, keydown, touchstart, scroll, click
 */
export function useInactivityTimer(onLogout, enabled = true) {
  const [showWarning, setShowWarning] = useState(false);
  const [remaining, setRemaining]     = useState(0);

  const logoutRef    = useRef(null);
  const warningRef   = useRef(null);
  const intervalRef  = useRef(null);
  const onLogoutRef  = useRef(onLogout);

  // Keep ref up-to-date so the timers always call the latest version
  useEffect(() => { onLogoutRef.current = onLogout; }, [onLogout]);

  const clear = useCallback(() => {
    clearTimeout(logoutRef.current);
    clearTimeout(warningRef.current);
    clearInterval(intervalRef.current);
  }, []);

  const reset = useCallback(() => {
    clear();
    setShowWarning(false);

    // Warning fires at (TIMEOUT_MS - WARNING_MS)
    warningRef.current = setTimeout(() => {
      setShowWarning(true);
      setRemaining(WARNING_MS / 1000);

      intervalRef.current = setInterval(() => {
        setRemaining(r => {
          if (r <= 1) {
            clearInterval(intervalRef.current);
            return 0;
          }
          return r - 1;
        });
      }, 1000);
    }, TIMEOUT_MS - WARNING_MS);

    // Logout fires at TIMEOUT_MS
    logoutRef.current = setTimeout(() => {
      setShowWarning(false);
      onLogoutRef.current();
    }, TIMEOUT_MS);
  }, [clear]);

  useEffect(() => {
    if (!enabled) { clear(); return; }

    const events = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'click'];
    const handle = () => reset();

    events.forEach(ev => window.addEventListener(ev, handle, { passive: true }));
    reset(); // kick off initial timers

    return () => {
      events.forEach(ev => window.removeEventListener(ev, handle));
      clear();
    };
  }, [enabled, reset, clear]);

  return { showWarning, remaining, extend: reset };
}
