import { useEffect } from "react";

// Call `onEscape` when the Escape key is pressed (for closing modals/drawers).
export function useEscape(onEscape) {
  useEffect(() => {
    const handler = (e) => { if (e.key === "Escape") onEscape(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onEscape]);
}
