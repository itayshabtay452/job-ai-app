// hooks/useDebounce.ts
"use client";

import { useEffect, useState } from "react";

/**
 * מחזיר ערך "דחוי" אחרי delayms; כל שינוי חדש מאפס את הטיימר.
 * שימושי להמתין לפני פנייה ל-API בזמן הקלדה.
 */
export function useDebounce<T>(value: T, delay = 350): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);

  return debounced;
}
