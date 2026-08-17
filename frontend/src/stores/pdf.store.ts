import { create } from "zustand";
import { persist } from "zustand/middleware";

export type FitMode = "width" | "page";
export type PdfLeftTab = "thumbnails" | "outline";
export type PdfRightTab = "notes" | "highlights";

export interface PdfNote {
  id: string;
  pageNumber: number;
  content: string;
  timestamp: number;
  color?: "yellow" | "green" | "blue" | "pink";
}

export interface PdfBookmark {
  pageNumber: number;
  title: string;
}

interface PdfState {
  // Viewer State
  currentPage: number;
  totalPages: number;
  zoomLevel: number;
  fitMode: FitMode;
  
  // Layout State
  isLeftPanelOpen: boolean;
  isRightPanelOpen: boolean;
  activeLeftTab: PdfLeftTab;
  activeRightTab: PdfRightTab;
  
  // Search State
  searchQuery: string;
  
  // User Data
  notes: PdfNote[];
  bookmarks: PdfBookmark[];
  
  // Actions
  setCurrentPage: (page: number) => void;
  setTotalPages: (total: number) => void;
  setZoomLevel: (zoom: number) => void;
  setFitMode: (mode: FitMode) => void;
  
  toggleLeftPanel: () => void;
  toggleRightPanel: () => void;
  setActiveLeftTab: (tab: PdfLeftTab) => void;
  setActiveRightTab: (tab: PdfRightTab) => void;
  
  setSearchQuery: (query: string) => void;
  
  addNote: (note: Omit<PdfNote, "id" | "timestamp">) => void;
  deleteNote: (id: string) => void;
  
  toggleBookmark: (pageNumber: number, title?: string) => void;
}

export const usePdfStore = create<PdfState>()(
  persist(
    (set) => ({
      currentPage: 1,
      totalPages: 10, // Mock default
      zoomLevel: 100,
      fitMode: "width",
      
      isLeftPanelOpen: true,
      isRightPanelOpen: false,
      activeLeftTab: "thumbnails",
      activeRightTab: "notes",
      
      searchQuery: "",
      
      notes: [
        { id: "n-1", pageNumber: 2, content: "Crucial definition of RSC boundaries here.", timestamp: Date.now(), color: "yellow" }
      ],
      bookmarks: [
        { pageNumber: 2, title: "Architecture Diagram" }
      ],
      
      setCurrentPage: (page) => set({ currentPage: page }),
      setTotalPages: (total) => set({ totalPages: total }),
      setZoomLevel: (zoom) => set({ zoomLevel: Math.max(25, Math.min(500, zoom)) }),
      setFitMode: (mode) => set({ fitMode: mode }),
      
      toggleLeftPanel: () => set((state) => ({ isLeftPanelOpen: !state.isLeftPanelOpen })),
      toggleRightPanel: () => set((state) => ({ isRightPanelOpen: !state.isRightPanelOpen })),
      setActiveLeftTab: (tab) => set({ activeLeftTab: tab }),
      setActiveRightTab: (tab) => set({ activeRightTab: tab }),
      
      setSearchQuery: (query) => set({ searchQuery: query }),
      
      addNote: (note) => set((state) => ({
        notes: [...state.notes, { ...note, id: `n-${Date.now()}`, timestamp: Date.now() }].sort((a, b) => a.pageNumber - b.pageNumber)
      })),
      
      deleteNote: (id) => set((state) => ({
        notes: state.notes.filter(n => n.id !== id)
      })),
      
      toggleBookmark: (pageNumber, title = `Page ${pageNumber}`) => set((state) => {
        const exists = state.bookmarks.some(b => b.pageNumber === pageNumber);
        if (exists) {
          return { bookmarks: state.bookmarks.filter(b => b.pageNumber !== pageNumber) };
        } else {
          return { bookmarks: [...state.bookmarks, { pageNumber, title }].sort((a, b) => a.pageNumber - b.pageNumber) };
        }
      }),
    }),
    {
      name: "speakarena-pdf-storage",
      partialize: (state) => ({ 
        isLeftPanelOpen: state.isLeftPanelOpen,
        isRightPanelOpen: state.isRightPanelOpen,
        fitMode: state.fitMode,
        zoomLevel: state.zoomLevel,
        activeLeftTab: state.activeLeftTab,
        activeRightTab: state.activeRightTab,
        notes: state.notes,
        bookmarks: state.bookmarks
      }),
    }
  )
);
