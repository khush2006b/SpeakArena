import { create } from "zustand";
import { apiClient } from "@/services/api/client";
import { ENDPOINTS } from "@/services/api/endpoints";

export type AccessType = "public" | "private";

export interface BuilderState {
  // ── Course identity ──────────────────────────────────────────────
  courseId: string | null;
  courseTitle: string;
  subtitle: string;
  description: string;
  thumbnailUrl: string | null;

  // ── Pricing ──────────────────────────────────────────────────────
  price: number;
  discountedPrice: number | null;
  accessType: AccessType;

  // ── UI state ─────────────────────────────────────────────────────
  currentStep: number;
  isDirty: boolean;
  lastSaved: string | null;
  isSaving: boolean;
  isPublishing: boolean;
  isCreating: boolean;
  error: string | null;

  // ── Step navigation ───────────────────────────────────────────────
  setStep: (step: number) => void;
  nextStep: () => void;
  prevStep: () => void;

  // ── Field setters ─────────────────────────────────────────────────
  setCourseTitle: (title: string) => void;
  setSubtitle: (subtitle: string) => void;
  setDescription: (description: string) => void;
  setThumbnailUrl: (url: string | null) => void;
  setPrice: (price: number) => void;
  setDiscountedPrice: (price: number | null) => void;
  setAccessType: (type: AccessType) => void;
  setDirty: (dirty: boolean) => void;
  setLastSaved: (time: string) => void;
  clearError: () => void;

  // ── API actions ───────────────────────────────────────────────────
  /**
   * Creates a new draft course on the backend.
   * Called when teacher clicks "Continue to Curriculum" on Step 1.
   * Returns the created courseId on success.
   */
  createCourse: () => Promise<string | null>;

  /**
   * Saves current field state to the backend (PATCH).
   * Called by the header "Save Draft" button.
   */
  saveDraft: () => Promise<void>;

  /**
   * Publishes the course (sets status = PUBLISHED).
   */
  publishCourse: () => Promise<boolean>;

  /** Reset entire store (after publish or navigating away) */
  reset: () => void;
}

const DEFAULT_STATE = {
  courseId: null,
  courseTitle: "",
  subtitle: "",
  description: "",
  thumbnailUrl: null,
  price: 0,
  discountedPrice: null,
  accessType: "public" as AccessType,
  currentStep: 1,
  isDirty: false,
  lastSaved: null,
  isSaving: false,
  isPublishing: false,
  isCreating: false,
  error: null,
};

export const useBuilderStore = create<BuilderState>((set, get) => ({
  ...DEFAULT_STATE,

  // ── Navigation ────────────────────────────────────────────────────
  setStep: (step) => set({ currentStep: Math.max(1, Math.min(6, step)) }),
  nextStep: () => {
    const { currentStep } = get();
    if (currentStep < 6) set({ currentStep: currentStep + 1 });
  },
  prevStep: () => {
    const { currentStep } = get();
    if (currentStep > 1) set({ currentStep: currentStep - 1 });
  },

  // ── Field setters ─────────────────────────────────────────────────
  setCourseTitle: (title) => set({ courseTitle: title, isDirty: true }),
  setSubtitle: (subtitle) => set({ subtitle, isDirty: true }),
  setDescription: (description) => set({ description, isDirty: true }),
  setThumbnailUrl: (url) => set({ thumbnailUrl: url, isDirty: true }),
  setPrice: (price) => set({ price, isDirty: true }),
  setDiscountedPrice: (price) => set({ discountedPrice: price, isDirty: true }),
  setAccessType: (type) => set({ accessType: type, isDirty: true }),
  setDirty: (dirty) => set({ isDirty: dirty }),
  setLastSaved: (time) => set({ lastSaved: time, isDirty: false }),
  clearError: () => set({ error: null }),

  // ── createCourse ──────────────────────────────────────────────────
  createCourse: async () => {
    const { courseId, courseTitle, description, price, accessType } = get();

    // If course already created, just advance
    if (courseId) return courseId;

    if (!courseTitle.trim()) {
      set({ error: "Please enter a course title before continuing." });
      return null;
    }

    set({ isCreating: true, error: null });
    try {
      const { data } = await apiClient.post<{ data: { id: string } }>(
        ENDPOINTS.COURSES.LIST,
        {
          title: courseTitle.trim(),
          description: description.trim() || undefined,
          price: price || 0,
          currency: "INR",
          language: "en",
          level: "beginner",
          visibility: accessType === "private" ? "private" : "public",
        }
      );
      const newCourseId = data?.data?.id ?? (data as any)?.id;
      if (!newCourseId) throw new Error("No course ID returned from server.");
      set({
        courseId: newCourseId,
        isDirty: false,
        currentStep: 2,
        lastSaved: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      });
      return newCourseId;
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      const msg =
        Array.isArray(detail)
          ? detail.map((d: any) => `${d.loc?.join(".")}: ${d.msg}`).join(" | ")
          : detail || err?.response?.data?.message || err?.message || "Failed to create course. Check your connection.";
      set({ error: msg });
      return null;
    } finally {
      set({ isCreating: false });
    }
  },

  // ── saveDraft ─────────────────────────────────────────────────────
  saveDraft: async () => {
    const { courseId, courseTitle, description, price } = get();
    if (!courseId) {
      // No course yet — just mark clean
      set({ isDirty: false, lastSaved: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) });
      return;
    }
    set({ isSaving: true, error: null });
    try {
      await apiClient.patch(ENDPOINTS.COURSES.DETAIL(courseId), {
        title: courseTitle.trim(),
        description: description.trim() || undefined,
        price: price || undefined,
      });
      set({
        isDirty: false,
        lastSaved: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      });
    } catch (err: any) {
      // Silently handle draft save failures — don't block the UI
      console.warn("Draft save failed:", err?.message);
      set({ isDirty: false, lastSaved: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) });
    } finally {
      set({ isSaving: false });
    }
  },

  // ── publishCourse ─────────────────────────────────────────────────
  publishCourse: async () => {
    const { courseId } = get();
    if (!courseId) {
      set({ error: "No course created yet. Complete Step 1 first." });
      return false;
    }
    set({ isPublishing: true, error: null });
    try {
      await apiClient.post(`/api/v1/teacher/courses/${courseId}/publish`);
      set({ isPublishing: false });
      return true;
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      const msg =
        Array.isArray(detail)
          ? detail.map((d: any) => d.msg).join(" | ")
          : detail || err?.response?.data?.message || err?.message || "Failed to publish course.";
      set({ error: msg, isPublishing: false });
      return false;
    }
  },

  // ── reset ─────────────────────────────────────────────────────────
  reset: () => set(DEFAULT_STATE),
}));
