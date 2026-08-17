import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface Note {
  id: string;
  timestamp: number;
  content: string;
}

export interface Bookmark {
  id: string;
  timestamp: number;
  title: string;
}

interface PlayerState {
  // Persisted Settings
  volume: number;
  isMuted: boolean;
  playbackSpeed: number;
  autoplayNext: boolean;
  
  // Transient State (Not persisted to avoid stale state on reload)
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  isBuffering: boolean;
  showControls: boolean;
  
  // Interactive Data (Mocked for now)
  notes: Note[];
  bookmarks: Bookmark[];

  // Actions
  setVolume: (vol: number) => void;
  toggleMute: () => void;
  setPlaybackSpeed: (speed: number) => void;
  toggleAutoplay: () => void;
  
  setIsPlaying: (playing: boolean) => void;
  togglePlayPause: () => void;
  setCurrentTime: (time: number) => void;
  setDuration: (duration: number) => void;
  setIsBuffering: (buffering: boolean) => void;
  setShowControls: (show: boolean) => void;

  addNote: (note: Omit<Note, "id">) => void;
  updateNote: (id: string, content: string) => void;
  deleteNote: (id: string) => void;

  addBookmark: (bookmark: Omit<Bookmark, "id">) => void;
  deleteBookmark: (id: string) => void;
}

export const usePlayerStore = create<PlayerState>()(
  persist(
    (set) => ({
      // Default Persisted
      volume: 1,
      isMuted: false,
      playbackSpeed: 1,
      autoplayNext: true,
      
      // Default Transient
      isPlaying: false,
      currentTime: 0,
      duration: 0,
      isBuffering: false,
      showControls: true,

      // Initial Mock Data
      notes: [
        { id: "n-1", timestamp: 45, content: "React Server Components run only on the server." }
      ],
      bookmarks: [
        { id: "b-1", timestamp: 120, title: "Streaming Explanation" }
      ],

      // Actions
      setVolume: (vol) => set({ volume: vol, isMuted: vol === 0 }),
      toggleMute: () => set((state) => ({ isMuted: !state.isMuted })),
      setPlaybackSpeed: (speed) => set({ playbackSpeed: speed }),
      toggleAutoplay: () => set((state) => ({ autoplayNext: !state.autoplayNext })),
      
      setIsPlaying: (playing) => set({ isPlaying: playing }),
      togglePlayPause: () => set((state) => ({ isPlaying: !state.isPlaying })),
      setCurrentTime: (time) => set({ currentTime: time }),
      setDuration: (duration) => set({ duration: duration }),
      setIsBuffering: (buffering) => set({ isBuffering: buffering }),
      setShowControls: (show) => set({ showControls: show }),

      addNote: (note) => set((state) => ({
        notes: [...state.notes, { ...note, id: `n-${Date.now()}` }].sort((a, b) => a.timestamp - b.timestamp)
      })),
      updateNote: (id, content) => set((state) => ({
        notes: state.notes.map(n => n.id === id ? { ...n, content } : n)
      })),
      deleteNote: (id) => set((state) => ({
        notes: state.notes.filter(n => n.id !== id)
      })),

      addBookmark: (bookmark) => set((state) => ({
        bookmarks: [...state.bookmarks, { ...bookmark, id: `b-${Date.now()}` }].sort((a, b) => a.timestamp - b.timestamp)
      })),
      deleteBookmark: (id) => set((state) => ({
        bookmarks: state.bookmarks.filter(b => b.id !== id)
      })),
    }),
    {
      name: "speakarena-player-storage",
      partialize: (state) => ({ 
        volume: state.volume, 
        isMuted: state.isMuted, 
        playbackSpeed: state.playbackSpeed, 
        autoplayNext: state.autoplayNext 
      }),
    }
  )
);
