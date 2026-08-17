/**
 * useDebounce hook.
 *
 * Returns a debounced version of a value that only updates after
 * the specified delay has elapsed without the value changing.
 *
 * Primary use: Delaying search API calls until the user stops typing.
 *
 * @param value - The value to debounce
 * @param delay - Debounce delay in milliseconds (default: 300)
 */

"use client";

import { useState, useEffect } from "react";

export function useDebounce<T>(value: T, delay = 300): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}
