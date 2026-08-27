import { create } from "zustand";
import { apiClient } from "@/services/api/client";
import { ENDPOINTS } from "@/services/api/endpoints";

export type AccessType = "public" | "private";

export interface StagedLesson {
  id: string;
  title: string;
  section: string;
  type: "video" | "pdf";
  duration?: string;
  file?: File;
}

export interface StagedResource {
  id: string;
  name: string;
  size: number;
  type: string;
  file?: File;
}

export interface BuilderState {
  // ── Course identity ──────────────────────────────────────────────
  courseId: string | null;
  courseTitle: string;
  subtitle: string;
  description: string;
  thumbnailUrl: string | null;
  thumbnailFile: File | null;

  // ── Pricing ──────────────────────────────────────────────────────
  price: number;
  discountedPrice: number | null;
  accessType: AccessType;
  maxStudents: number;

  // ── Staged Content ───────────────────────────────────────────────
  stagedLessons: StagedLesson[];
  stagedResources: StagedResource[];

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
  setThumbnailFile: (file: File | null) => void;
  setPrice: (price: number) => void;
  setDiscountedPrice: (price: number | null) => void;
  setAccessType: (type: AccessType) => void;
  setMaxStudents: (count: number) => void;
  setStagedLessons: (lessons: StagedLesson[] | ((prev: StagedLesson[]) => StagedLesson[])) => void;
  setStagedResources: (resources: StagedResource[] | ((prev: StagedResource[]) => StagedResource[])) => void;
  setDirty: (dirty: boolean) => void;
  setLastSaved: (time: string | null) => void;
  clearError: () => void;

  // ── API actions ───────────────────────────────────────────────────
  loadCourse: (id: string) => Promise<void>;
  createCourse: () => Promise<string | null>;
  saveDraft: () => Promise<void>;
  publishCourse: () => Promise<boolean>;
  reset: () => void;
}

const DEFAULT_STATE = {
  courseId: null,
  courseTitle: "",
  subtitle: "",
  description: "",
  thumbnailUrl: null,
  thumbnailFile: null,
  price: 0,
  discountedPrice: null,
  accessType: "public" as AccessType,
  maxStudents: 50,
  stagedLessons: [],
  stagedResources: [],
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
  setThumbnailFile: (file) => set({ thumbnailFile: file, isDirty: true }),
  setPrice: (price) => set({ price, isDirty: true }),
  setDiscountedPrice: (price) => set({ discountedPrice: price, isDirty: true }),
  setAccessType: (type) => set({ accessType: type, isDirty: true }),
  setMaxStudents: (count) => set({ maxStudents: count, isDirty: true }),
  setStagedLessons: (updater) =>
    set((state) => ({
      stagedLessons: typeof updater === "function" ? updater(state.stagedLessons) : updater,
      isDirty: true,
    })),
  setStagedResources: (updater) =>
    set((state) => ({
      stagedResources: typeof updater === "function" ? updater(state.stagedResources) : updater,
      isDirty: true,
    })),
  setDirty: (dirty) => set({ isDirty: dirty }),
  setLastSaved: (time) => set({ lastSaved: time, isDirty: false }),
  clearError: () => set({ error: null }),

  // ── loadCourse (Loads existing course for editing) ─────────────────
  loadCourse: async (id: string) => {
    try {
      const { data } = await apiClient.get<any>(`/api/v1/teacher/courses/${id}`);
      const course = data?.data ?? data;
      if (course) {
        set({
          courseId: course.id,
          courseTitle: course.title || "",
          description: course.description || "",
          price: Number(course.price) || 0,
          accessType: course.visibility === "private" ? "private" : "public",
          maxStudents: course.max_students || 50,
          thumbnailUrl: course.thumbnail_url || null,
          thumbnailFile: null,
        });
      }
    } catch (e) {
      console.warn("Failed to load existing course into builder:", e);
    }
  },

  // ── createCourse (Client-only step transition, no draft DB save) ─
  createCourse: async () => {
    const { courseTitle } = get();

    if (!courseTitle.trim()) {
      set({ error: "Please enter a course title before continuing." });
      return null;
    }

    set({ error: null, currentStep: 2 });
    return "client-only-draft";
  },

  // ── saveDraft (No DB save requested by user) ──────────────────────
  saveDraft: async () => {
    set({ isDirty: false });
  },

  // ── publishCourse (Creates/Updates course in DB and uploads thumbnail) ─
  publishCourse: async () => {
    const { courseId, courseTitle, description, price, accessType, maxStudents, stagedLessons, thumbnailFile } = get();

    if (!courseTitle.trim()) {
      set({ error: "Please enter a course title before publishing." });
      return false;
    }

    set({ isPublishing: true, error: null });
    try {
      let targetCourseId = courseId;

      if (!targetCourseId) {
        // 1. Create the course as a draft via the TEACHER endpoint
        const { data: createData } = await apiClient.post<{ data: { id: string } }>(
          ENDPOINTS.COURSES.TEACHER_CREATE,
          {
            title: courseTitle.trim(),
            description: description.trim() || undefined,
            price: typeof price === "number" ? price : 0,
            currency: "INR",
            language: "en",
            level: "beginner",
            visibility: accessType === "private" ? "private" : "public",
            max_students: maxStudents || 50,
          }
        );

        targetCourseId = createData?.data?.id ?? (createData as any)?.id;
        if (!targetCourseId) throw new Error("No course ID returned from server.");
      } else {
        // Update existing course metadata using the dedicated update endpoint
        await apiClient.patch(`/api/v1/teacher/courses/${targetCourseId}/update`, {
          title: courseTitle.trim(),
          description: description.trim() || undefined,
          price: typeof price === "number" ? price : 0,
          visibility: accessType === "private" ? "private" : "public",
          max_students: maxStudents || 50,
        });
      }

      // 2. Upload thumbnail via backend direct upload endpoint
      const thumbnailFileAtPublish = get().thumbnailFile;
      if (thumbnailFileAtPublish) {
        try {
          const formData = new FormData();
          formData.append("file", thumbnailFileAtPublish);

          await apiClient.post(
            `/api/v1/teacher/courses/${targetCourseId}/thumbnail/upload`,
            formData
          );
        } catch (thumbErr) {
          console.error("[Builder] Failed to upload thumbnail via backend:", thumbErr);
        }
      }

      // 3. If new course creation (was draft), trigger publish
      if (!courseId) {
        try {
          await apiClient.post(ENDPOINTS.COURSES.TEACHER_PUBLISH(targetCourseId));
        } catch (pubErr: any) {
          if (pubErr?.response?.status !== 409) {
            console.warn("[Builder] Teacher publish endpoint call warning:", pubErr);
          }
        }
      }

      // 4. Sync any staged video lessons to the course
      if (stagedLessons.length > 0) {
        for (let i = 0; i < stagedLessons.length; i++) {
          const lesson = stagedLessons[i];
          try {
            await apiClient.post(`/api/v1/teacher/courses/${targetCourseId}/videos`, {
              title: lesson.title.trim(),
              section: lesson.section || "Module 1",
              sort_order: i + 1,
              visibility: "private",
              is_free_preview: false,
              mime_type: lesson.file?.type || "video/mp4",
            });
          } catch (e) {
            console.warn("Failed to attach staged lesson:", lesson.title, e);
          }
        }
      }

      set({
        courseId: targetCourseId,
        isPublishing: false,
        isDirty: false,
      });
      return true;
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      const msg =
        Array.isArray(detail)
          ? detail.map((d: any) => `${d.loc?.join(".")}: ${d.msg}`).join(" | ")
          : detail || err?.response?.data?.message || err?.message || "Failed to publish course.";
      set({ error: msg, isPublishing: false });
      return false;
    }
  },

  // ── reset ─────────────────────────────────────────────────────────
  reset: () => set(DEFAULT_STATE),
}));
