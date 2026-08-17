/**
 * Video player Zustand store.
 *
 * Manages playback state for the custom video player. Progress is
 * persisted per-video to localStorage (via a custom serialiser) so
 * that students can resume where they left off across sessions.
 *
 * State is intentionally flat for O(1) reads during playback
 * (called on requestAnimationFrame via HTMLVideoElement events).
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";

type ProgressMap = Record<string, number>;

interface VideoPlayerState {
  currentVideoId: string | null;
  currentTime: number;
  duration: number;
  playbackRate: number;
  volume: number;
  isMuted: boolean;
  isPlaying: boolean;
  isFullscreen: boolean;
  isPiP: boolean;
  isBuffering: boolean;
  /** Per-video progress map: videoId → last watched timestamp (seconds). */
  savedProgress: ProgressMap;
}

interface VideoPlayerActions {
  setCurrentVideo: (videoId: string) => void;
  setCurrentTime: (time: number) => void;
  setDuration: (duration: number) => void;
  setPlaybackRate: (rate: number) => void;
  setVolume: (volume: number) => void;
  toggleMute: () => void;
  setPlaying: (isPlaying: boolean) => void;
  setFullscreen: (isFullscreen: boolean) => void;
  setPiP: (isPiP: boolean) => void;
  setBuffering: (isBuffering: boolean) => void;
  /** Save the current timestamp for resume-on-next-visit. */
  saveProgress: (videoId: string, time: number) => void;
  /** Get the saved timestamp for a given video. Returns 0 if none. */
  getSavedProgress: (videoId: string) => number;
  reset: () => void;
}

type VideoPlayerStore = VideoPlayerState & VideoPlayerActions;

const initialState: VideoPlayerState = {
  currentVideoId: null,
  currentTime: 0,
  duration: 0,
  playbackRate: 1,
  volume: 1,
  isMuted: false,
  isPlaying: false,
  isFullscreen: false,
  isPiP: false,
  isBuffering: false,
  savedProgress: {},
};

export const useVideoPlayerStore = create<VideoPlayerStore>()(
  persist(
    (set, get) => ({
      ...initialState,

      setCurrentVideo: (videoId) =>
        set((s) => ({
          currentVideoId: videoId,
          currentTime: s.savedProgress[videoId] ?? 0,
          isPlaying: false,
        })),

      setCurrentTime: (time) => set({ currentTime: time }),
      setDuration: (duration) => set({ duration }),
      setPlaybackRate: (rate) => set({ playbackRate: rate }),
      setVolume: (volume) => set({ volume, isMuted: volume === 0 }),
      toggleMute: () => set((s) => ({ isMuted: !s.isMuted })),
      setPlaying: (isPlaying) => set({ isPlaying }),
      setFullscreen: (isFullscreen) => set({ isFullscreen }),
      setPiP: (isPiP) => set({ isPiP }),
      setBuffering: (isBuffering) => set({ isBuffering }),

      saveProgress: (videoId, time) =>
        set((s) => ({
          savedProgress: { ...s.savedProgress, [videoId]: time },
        })),

      getSavedProgress: (videoId) => get().savedProgress[videoId] ?? 0,

      reset: () =>
        set((s) => ({
          ...initialState,
          savedProgress: s.savedProgress, // preserve across video changes
        })),
    }),
    {
      name: "speakarena-video-progress",
      // Only persist the progress map — not volatile playback state
      partialize: (state) => ({ savedProgress: state.savedProgress, volume: state.volume, playbackRate: state.playbackRate }),
    },
  ),
);
