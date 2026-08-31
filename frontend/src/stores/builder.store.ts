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
  isUploadingThumbnail: boolean;
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
  uploadThumbnail: (file?: File | null, overrideCourseId?: string) => Promise<string | null>;
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
  isUploadingThumbnail: false,
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

  // ── uploadThumbnail (Directly uploads thumbnail to backend) ───────
  uploadThumbnail: async (fileOverride?: File | null, overrideCourseId?: string) => {
    const { courseId, thumbnailFile } = get();
    const file = fileOverride || thumbnailFile;
    const targetId = overrideCourseId || courseId;

    if (!file || !targetId) return null;

    set({ isUploadingThumbnail: true });
    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await apiClient.post<any>(
        `/api/v1/teacher/courses/${targetId}/thumbnail/upload`,
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        }
      );

      const data = res.data?.data || res.data;
      const uploadedUrl = data?.thumbnail_url
        ? `${data.thumbnail_url}${data.thumbnail_url.includes("?") ? "&" : "?"}t=${Date.now()}`
        : `/api/v1/teacher/courses/${targetId}/thumbnail?t=${Date.now()}`;

      set({
        thumbnailUrl: uploadedUrl,
        thumbnailFile: null,
        isUploadingThumbnail: false,
      });

      return uploadedUrl;
    } catch (err: any) {
      console.error("[Builder] Failed to upload thumbnail:", err);
      set({ isUploadingThumbnail: false });
      return null;
    }
  },

  // ── createCourse (Step 1 transition + updates metadata if course exists) ─
  createCourse: async () => {
    const { courseId, courseTitle, description, thumbnailFile, uploadThumbnail } = get();

    if (!courseTitle.trim()) {
      set({ error: "Please enter a course title before continuing." });
      return null;
    }

    if (courseId) {
      set({ isCreating: true });
      try {
        // 1. Save metadata
        await apiClient.patch(`/api/v1/teacher/courses/${courseId}/update`, {
          title: courseTitle.trim(),
          description: description.trim() || undefined,
        }).catch(() => {});

        // 2. Upload thumbnail if new file selected
        if (thumbnailFile) {
          await uploadThumbnail(thumbnailFile, courseId);
        }
      } catch (err) {
        console.warn("[Builder] Warning while updating course details in Step 1:", err);
      } finally {
        set({ isCreating: false });
      }
    }

    set({ error: null, currentStep: 2 });
    return courseId || "client-only-draft";
  },

  // ── saveDraft (Updates course in DB if existing) ──────────────────
  saveDraft: async () => {
    const { courseId, courseTitle, description, price, accessType, maxStudents, thumbnailFile, uploadThumbnail } = get();
    if (courseId) {
      set({ isSaving: true });
      try {
        await apiClient.patch(`/api/v1/teacher/courses/${courseId}/update`, {
          title: courseTitle.trim(),
          description: description.trim() || undefined,
          price: typeof price === "number" ? price : 0,
          visibility: accessType === "private" ? "private" : "public",
          max_students: maxStudents || 50,
        });
        if (thumbnailFile) {
          await uploadThumbnail(thumbnailFile, courseId);
        }
        set({ isDirty: false, lastSaved: new Date().toLocaleTimeString() });
      } catch {
        // ignore
      } finally {
        set({ isSaving: false });
      }
    } else {
      set({ isDirty: false });
    }
  },

  // ── publishCourse (Creates/Updates course in DB and uploads thumbnail) ─
  publishCourse: async () => {
    const { courseId, courseTitle, description, price, accessType, maxStudents, stagedLessons, thumbnailFile, uploadThumbnail } = get();

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

      // 2. Upload thumbnail via backend direct upload endpoint with multipart/form-data
      const thumbnailFileAtPublish = get().thumbnailFile || thumbnailFile;
      if (thumbnailFileAtPublish) {
        await uploadThumbnail(thumbnailFileAtPublish, targetCourseId);
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
