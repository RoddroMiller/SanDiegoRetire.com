import { useEffect, useRef, useCallback } from 'react';

/**
 * Session timeout hook for BOSP compliance
 * Logs out user after 15 minutes of inactivity
 */

const TIMEOUT_MINUTES = 15;
const TIMEOUT_MS = TIMEOUT_MINUTES * 60 * 1000;
const WARNING_BEFORE_MS = 60 * 1000; // 1 minute warning

export const useSessionTimeout = (onTimeout, isAuthenticated) => {
  const timeoutRef = useRef(null);
  const warningRef = useRef(null);
  const lastActivityRef = useRef(Date.now());

  const resetTimer = useCallback(() => {
    lastActivityRef.current = Date.now();

    // Clear existing timers
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (warningRef.current) clearTimeout(warningRef.current);

    if (!isAuthenticated) return;

    // Set warning timer (1 minute before timeout)
    warningRef.current = setTimeout(() => {
      const warningEvent = new CustomEvent('sessionWarning', {
        detail: { secondsRemaining: 60 }
      });
      window.dispatchEvent(warningEvent);
    }, TIMEOUT_MS - WARNING_BEFORE_MS);

    // Set logout timer
    timeoutRef.current = setTimeout(() => {
      console.log('Session timeout - logging out due to inactivity');
      if (onTimeout) onTimeout();
    }, TIMEOUT_MS);
  }, [onTimeout, isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) return;

    // Activity events to track
    const events = ['mousedown', 'keydown', 'scroll', 'touchstart', 'mousemove'];

    // Throttle activity updates to avoid excessive timer resets
    let lastReset = 0;
    const throttledReset = () => {
      const now = Date.now();
      if (now - lastReset > 1000) { // Only reset once per second max
        lastReset = now;
        resetTimer();
      }
    };

    // Add event listeners
    events.forEach(event => {
      window.addEventListener(event, throttledReset, { passive: true });
    });

    // Initialize timer
    resetTimer();

    // Cleanup
    return () => {
      events.forEach(event => {
        window.removeEventListener(event, throttledReset);
      });
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (warningRef.current) clearTimeout(warningRef.current);
    };
  }, [isAuthenticated, resetTimer]);

  return {
    resetTimer,
    getTimeRemaining: () => {
      const elapsed = Date.now() - lastActivityRef.current;
      return Math.max(0, TIMEOUT_MS - elapsed);
    }
  };
};

export default useSessionTimeout;
