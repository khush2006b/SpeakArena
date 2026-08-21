import { apiClient } from "./api/client";

export interface TestGradeItem {
  id: string;
  studentId: string;
  studentName: string;
  studentEmail: string;
  score: number;
  feedback?: string | null;
  gradedAt?: string;
}

export interface TeacherTest {
  id: string;
  courseId: string;
  courseTitle: string;
  title: string;
  description?: string | null;
  googleFormUrl: string;
  startTime: string;
  endTime: string;
  maxScore: number;
  isOpen: boolean;
  status: "UPCOMING" | "OPEN" | "CLOSED";
  grades: TestGradeItem[];
}

export interface StudentTest {
  id: string;
  courseId: string;
  courseTitle: string;
  title: string;
  description?: string | null;
  googleFormUrl?: string | null;
  startTime: string;
  endTime: string;
  maxScore: number;
  isOpen: boolean;
  status: "UPCOMING" | "OPEN" | "CLOSED";
  score?: number | null;
  feedback?: string | null;
  isGraded: boolean;
}

export interface CreateTestPayload {
  course_id: string;
  title: string;
  description?: string;
  google_form_url: string;
  start_time: string;
  end_time: string;
  max_score: number;
}

export interface UpdateTestPayload {
  title?: string;
  description?: string;
  google_form_url?: string;
  start_time?: string;
  end_time?: string;
  max_score?: number;
}

export const testService = {
  /** GET /api/v1/teacher/tests */
  listTeacherTests: async (courseId?: string): Promise<TeacherTest[]> => {
    const params = courseId ? { course_id: courseId } : {};
    const { data } = await apiClient.get<any>("/api/v1/teacher/tests", { params });
    const raw = data?.data ?? data ?? [];
    return raw.map((t: any) => ({
      id: t.id,
      courseId: t.course_id,
      courseTitle: t.course_title,
      title: t.title,
      description: t.description,
      googleFormUrl: t.google_form_url,
      startTime: t.start_time,
      endTime: t.end_time,
      maxScore: t.max_score,
      isOpen: t.is_open,
      status: t.status,
      grades: (t.grades || []).map((g: any) => ({
        id: g.id,
        studentId: g.student_id,
        studentName: g.student_name,
        studentEmail: g.student_email,
        score: g.score,
        feedback: g.feedback,
        gradedAt: g.graded_at,
      })),
    }));
  },

  /** POST /api/v1/teacher/tests */
  createTest: async (payload: CreateTestPayload): Promise<TeacherTest> => {
    const { data } = await apiClient.post<any>("/api/v1/teacher/tests", payload);
    const t = data?.data ?? data;
    return {
      id: t.id,
      courseId: t.course_id,
      courseTitle: t.course_title,
      title: t.title,
      description: t.description,
      googleFormUrl: t.google_form_url,
      startTime: t.start_time,
      endTime: t.end_time,
      maxScore: t.max_score,
      isOpen: t.is_open,
      status: t.status,
      grades: t.grades || [],
    };
  },

  /** PUT /api/v1/teacher/tests/:id */
  updateTest: async (testId: string, payload: UpdateTestPayload): Promise<TeacherTest> => {
    const { data } = await apiClient.put<any>(`/api/v1/teacher/tests/${testId}`, payload);
    const t = data?.data ?? data;
    return {
      id: t.id,
      courseId: t.course_id,
      courseTitle: t.course_title,
      title: t.title,
      description: t.description,
      googleFormUrl: t.google_form_url,
      startTime: t.start_time,
      endTime: t.end_time,
      maxScore: t.max_score,
      isOpen: t.is_open,
      status: t.status,
      grades: t.grades || [],
    };
  },

  /** DELETE /api/v1/teacher/tests/:id */
  deleteTest: async (testId: string): Promise<void> => {
    await apiClient.delete(`/api/v1/teacher/tests/${testId}`);
  },

  /** POST /api/v1/teacher/tests/:id/grades */
  saveGrades: async (
    testId: string,
    grades: Array<{ student_id: string; score: number; feedback?: string }>
  ): Promise<TeacherTest> => {
    const { data } = await apiClient.post<any>(`/api/v1/teacher/tests/${testId}/grades`, { grades });
    const t = data?.data ?? data;
    return {
      id: t.id,
      courseId: t.course_id,
      courseTitle: t.course_title,
      title: t.title,
      description: t.description,
      googleFormUrl: t.google_form_url,
      startTime: t.start_time,
      endTime: t.end_time,
      maxScore: t.max_score,
      isOpen: t.is_open,
      status: t.status,
      grades: t.grades || [],
    };
  },

  /** GET /api/v1/student/tests */
  listStudentTests: async (): Promise<StudentTest[]> => {
    const { data } = await apiClient.get<any>("/api/v1/student/tests");
    const raw = data?.data ?? data ?? [];
    return raw.map((t: any) => ({
      id: t.id,
      courseId: t.course_id,
      courseTitle: t.course_title,
      title: t.title,
      description: t.description,
      googleFormUrl: t.google_form_url,
      startTime: t.start_time,
      endTime: t.end_time,
      maxScore: t.max_score,
      isOpen: t.is_open,
      status: t.status,
      score: t.score,
      feedback: t.feedback,
      isGraded: t.is_graded,
    }));
  },
};
