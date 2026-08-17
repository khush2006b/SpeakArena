/**
 * Global search Zustand store.
 *
 * Manages the search query and result state for the Command Palette
 * (CMD+K) and any search-driven data tables.
 *
 * Note: The actual search results are fetched via TanStack Query,
 * not stored here. This store holds only the input state.
 */

import { create } from "zustand";

interface SearchState {
  /** Current raw query string entered by the user. */
  query: string;
  /** Whether a search is currently in flight. */
  isSearching: boolean;
}

interface SearchActions {
  setQuery: (query: string) => void;
  clearQuery: () => void;
  setSearching: (isSearching: boolean) => void;
}

type SearchStore = SearchState & SearchActions;

export const useSearchStore = create<SearchStore>()((set) => ({
  query: "",
  isSearching: false,

  setQuery: (query) => set({ query }),
  clearQuery: () => set({ query: "", isSearching: false }),
  setSearching: (isSearching) => set({ isSearching }),
}));
