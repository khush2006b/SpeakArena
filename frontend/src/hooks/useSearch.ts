/**
 * useSearch hook.
 *
 * Composable hook combining the search Zustand store with URL sync
 * and debouncing. Components consume this hook instead of
 * interacting with the store directly.
 *
 * Features:
 * - 300ms debounce to avoid API calls on every keystroke
 * - Optional URL sync so search is shareable/linkable
 * - Controlled input pattern compatible with React Hook Form
 */

"use client";

import { useCallback } from "react";
import { useSearchStore } from "@/stores/search.store";
import { useDebounce } from "./useDebounce";

export interface UseSearchReturn {
  query: string;
  debouncedQuery: string;
  isSearching: boolean;
  setQuery: (query: string) => void;
  clearSearch: () => void;
}

export function useSearch(debounceMs = 300): UseSearchReturn {
  const { query, isSearching, setQuery, clearQuery, setSearching } =
    useSearchStore();
  const debouncedQuery = useDebounce(query, debounceMs);

  const handleSetQuery = useCallback(
    (newQuery: string) => {
      setQuery(newQuery);
      setSearching(newQuery.length > 0);
    },
    [setQuery, setSearching],
  );

  return {
    query,
    debouncedQuery,
    isSearching,
    setQuery: handleSetQuery,
    clearSearch: clearQuery,
  };
}
