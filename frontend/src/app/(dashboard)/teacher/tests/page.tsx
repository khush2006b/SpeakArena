"use client";

import React, { useState, useEffect } from "react";
import { 
  ClipboardCheck, Plus, Calendar, Clock, ExternalLink, Trash2, Edit2, 
  Save, Users, ChevronDown, ChevronUp, BookOpen
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { testService, TeacherTest } from "@/services/test.service";
import { courseService, Course } from "@/services/course.service";

export default function TeacherTestsPage() {
  const [tests, setTests] = useState<TeacherTest[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourseFilter, setSelectedCourseFilter] = useState<string>("ALL");
  const [isLoading, setIsLoading] = useState(true);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTestId, setEditingTestId] = useState<string | null>(null);
  const [formCourseId, setFormCourseId] = useState("");
  const [formTitle, setFormTitle] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formGoogleUrl, setFormGoogleUrl] = useState("");
  const [formStartTime, setFormStartTime] = useState("");
  const [formEndTime, setFormEndTime] = useState("");
  const [formMaxScore, setFormMaxScore] = useState(100);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Expanded Accordion State
  const [expandedTestIds, setExpandedTestIds] = useState<Record<string, boolean>>({});
  // Inline Grade Input State
  const [gradeInputs, setGradeInputs] = useState<Record<string, Record<string, { score: number; feedback: string }>>>({});
  const [isSavingGrades, setIsSavingGrades] = useState<Record<string, boolean>>({});

  const fetchData = async () => {
    try {
      setIsLoading(true);
      const [testData, courseData] = await Promise.all([
        testService.listTeacherTests(),
        courseService.list({ page: 1, pageSize: 100 }),
      ]);
      setTests(testData);
      setCourses(courseData.items || []);

      // Pre-fill grade inputs state
      const initialGradeInputs: Record<string, Record<string, { score: number; feedback: string }>> = {};
      testData.forEach((t) => {
        initialGradeInputs[t.id] = {};
        t.grades.forEach((g) => {
          initialGradeInputs[t.id][g.studentId] = {
            score: g.score || 0,
            feedback: g.feedback || "",
          };
        });
      });
      setGradeInputs(initialGradeInputs);
    } catch (err: any) {
      toast.error(err?.message || "Failed to load tests and courses");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const openCreateModal = (courseId?: string) => {
    setEditingTestId(null);
    setFormCourseId(courseId || (courses[0]?.id || ""));
    setFormTitle("");
    setFormDescription("");
    setFormGoogleUrl("");
    // Default start time: now; End time: 2 hours from now formatted for datetime-local
    const now = new Date();
    const end = new Date(now.getTime() + 2 * 60 * 60 * 1000);
    setFormStartTime(now.toISOString().slice(0, 16));
    setFormEndTime(end.toISOString().slice(0, 16));
    setFormMaxScore(100);
    setIsModalOpen(true);
  };

  const openEditModal = (t: TeacherTest) => {
    setEditingTestId(t.id);
    setFormCourseId(t.courseId);
    setFormTitle(t.title);
    setFormDescription(t.description || "");
    setFormGoogleUrl(t.googleFormUrl);
    setFormStartTime(new Date(t.startTime).toISOString().slice(0, 16));
    setFormEndTime(new Date(t.endTime).toISOString().slice(0, 16));
    setFormMaxScore(t.maxScore || 100);
    setIsModalOpen(true);
  };

  const handleSaveTest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formCourseId) { toast.error("Please select a course"); return; }
    if (!formTitle.trim()) { toast.error("Please enter a test title"); return; }
    if (!formGoogleUrl.trim()) { toast.error("Please enter a Google Form URL"); return; }
    if (!formStartTime || !formEndTime) { toast.error("Please set start and end window times"); return; }
    if (new Date(formEndTime) <= new Date(formStartTime)) { toast.error("End time must be after start time"); return; }

    try {
      setIsSubmitting(true);
      if (editingTestId) {
        await testService.updateTest(editingTestId, {
          title: formTitle,
          description: formDescription,
          google_form_url: formGoogleUrl,
          start_time: new Date(formStartTime).toISOString(),
          end_time: new Date(formEndTime).toISOString(),
          max_score: Number(formMaxScore),
        });
        toast.success("Test updated successfully!");
      } else {
        await testService.createTest({
          course_id: formCourseId,
          title: formTitle,
          description: formDescription,
          google_form_url: formGoogleUrl,
          start_time: new Date(formStartTime).toISOString(),
          end_time: new Date(formEndTime).toISOString(),
          max_score: Number(formMaxScore),
        });
        toast.success("Test created successfully!");
      }
      setIsModalOpen(false);
      fetchData();
    } catch (err: any) {
      toast.error(err?.message || "Failed to save test");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteTest = async (testId: string, title: string) => {
    if (!confirm(`Are you sure you want to delete test "${title}"?`)) return;
    try {
      await testService.deleteTest(testId);
      toast.success("Test deleted");
      fetchData();
    } catch (err: any) {
      toast.error(err?.message || "Failed to delete test");
    }
  };

  const toggleTestAccordion = (testId: string) => {
    setExpandedTestIds((prev) => ({ ...prev, [testId]: !prev[testId] }));
  };

  const handleGradeChange = (testId: string, studentId: string, field: "score" | "feedback", val: any) => {
    setGradeInputs((prev) => ({
      ...prev,
      [testId]: {
        ...(prev[testId] || {}),
        [studentId]: {
          ...(prev[testId]?.[studentId] || { score: 0, feedback: "" }),
          [field]: field === "score" ? Number(val) : val,
        },
      },
    }));
  };

  const handleSaveStudentGrades = async (testId: string) => {
    const studentGrades = gradeInputs[testId] || {};
    const gradeList = Object.entries(studentGrades).map(([studentId, data]) => ({
      student_id: studentId,
      score: Number(data.score || 0),
      feedback: data.feedback || "",
    }));

    if (gradeList.length === 0) { toast.info("No student grades to save"); return; }

    try {
      setIsSavingGrades((prev) => ({ ...prev, [testId]: true }));
      await testService.saveGrades(testId, gradeList);
      toast.success("Student grades saved successfully!");
      fetchData();
    } catch (err: any) {
      toast.error(err?.message || "Failed to save grades");
    } finally {
      setIsSavingGrades((prev) => ({ ...prev, [testId]: false }));
    }
  };

  // Group tests by course
  const filteredCourses = courses.filter((c) => selectedCourseFilter === "ALL" || c.id === selectedCourseFilter);

  return (
    <div className="space-y-8 pb-20">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 sm:p-8 rounded-2xl bg-gradient-to-r from-purple-900/30 via-primary/10 to-transparent border border-white/10 shadow-xl">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2.5 rounded-xl bg-primary/20 text-primary border border-primary/30">
              <ClipboardCheck className="h-6 w-6" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">Course Tests &amp; Grading</h1>
          </div>
          <p className="text-sm text-muted-foreground max-w-xl">
            Configure Google Form tests with custom open windows for your courses and grade enrolled students seamlessly.
          </p>
        </div>
        <Button onClick={() => openCreateModal()} className="h-11 px-5 rounded-xl font-semibold shadow-lg press-scale shrink-0">
          <Plus className="mr-2 h-4 w-4" /> Create Test
        </Button>
      </div>

      {/* Filters & Controls */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-xl border border-white/10 bg-white/[0.01] backdrop-blur-md">
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Course Filter:</span>
          <select
            value={selectedCourseFilter}
            onChange={(e) => setSelectedCourseFilter(e.target.value)}
            className="h-10 px-3 rounded-lg border border-white/10 bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="ALL">All Courses ({courses.length})</option>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>{c.title}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Course Sections */}
      {isLoading ? (
        <div className="text-center py-20 text-muted-foreground">Loading course tests...</div>
      ) : filteredCourses.length === 0 ? (
        <div className="text-center py-20 border border-dashed border-white/10 rounded-2xl">
          <p className="font-bold text-foreground text-lg">No courses found</p>
          <p className="text-sm text-muted-foreground mt-1">Create a course to add tests.</p>
        </div>
      ) : (
        <div className="space-y-10">
          {filteredCourses.map((course) => {
            const courseTests = tests.filter(
              (t) => t.courseId === course.id
            );

            return (
              <div key={course.id} className="space-y-4 rounded-2xl border border-white/10 bg-white/[0.01] p-6 shadow-sm">
                {/* Course Section Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary/10 text-primary border border-primary/20">
                      <BookOpen className="h-5 w-5" />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-foreground">{course.title}</h2>
                      <p className="text-xs text-muted-foreground">{courseTests.length} Tests Configured</p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => openCreateModal(course.id)}
                    className="h-8 text-xs font-semibold press-scale border-primary/30 text-primary hover:bg-primary/10"
                  >
                    <Plus className="mr-1.5 h-3.5 w-3.5" /> Add Test for {course.title}
                  </Button>
                </div>

                {/* Course Tests List */}
                {courseTests.length === 0 ? (
                  <div className="text-center py-8 text-sm text-muted-foreground border border-dashed border-white/5 rounded-xl">
                    No tests scheduled for this course yet.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {courseTests.map((t) => {
                      const isExpanded = expandedTestIds[t.id] ?? true;

                      return (
                        <div key={t.id} className="rounded-xl border border-white/10 bg-background/50 overflow-hidden transition-all shadow-md">
                          {/* Test Top Bar */}
                          <div className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white/[0.02]">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2.5">
                                <h3 className="text-lg font-bold text-foreground">{t.title}</h3>
                                <Badge
                                  variant="outline"
                                  className={
                                    t.status === "OPEN"
                                      ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                                      : t.status === "UPCOMING"
                                      ? "bg-amber-500/10 text-amber-400 border-amber-500/30"
                                      : "bg-rose-500/10 text-rose-400 border-rose-500/30"
                                  }
                                >
                                  {t.status === "OPEN" ? "🟢 OPEN NOW" : t.status === "UPCOMING" ? "⏳ UPCOMING" : "🔴 CLOSED"}
                                </Badge>
                              </div>
                              {t.description && <p className="text-xs text-muted-foreground max-w-2xl">{t.description}</p>}

                              <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground pt-1">
                                <span className="flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5 text-primary" /> Opens: {new Date(t.startTime).toLocaleString()}</span>
                                <span className="flex items-center gap-1.5"><Clock className="h-3.5 w-3.5 text-rose-400" /> Closes: {new Date(t.endTime).toLocaleString()}</span>
                                <span className="flex items-center gap-1.5"><ClipboardCheck className="h-3.5 w-3.5 text-amber-400" /> Max Score: {t.maxScore} pts</span>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              <a
                                href={t.googleFormUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center h-8 px-3 text-xs font-semibold rounded-lg bg-white/5 hover:bg-white/10 text-foreground transition-colors border border-white/10"
                              >
                                <ExternalLink className="mr-1.5 h-3.5 w-3.5 text-primary" /> Test Link
                              </a>

                              <Button size="sm" variant="ghost" onClick={() => openEditModal(t)} className="h-8 w-8 p-0">
                                <Edit2 className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => handleDeleteTest(t.id, t.title)} className="h-8 w-8 p-0 text-rose-400 hover:text-rose-300">
                                <Trash2 className="h-4 w-4" />
                              </Button>

                              <Button size="sm" variant="ghost" onClick={() => toggleTestAccordion(t.id)} className="h-8 w-8 p-0">
                                {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                              </Button>
                            </div>
                          </div>

                          {/* Test Grading Accordion Content */}
                          {isExpanded && (
                            <div className="p-5 border-t border-white/10 bg-black/20 space-y-4">
                              <div className="flex items-center justify-between">
                                <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
                                  <Users className="h-4 w-4 text-primary" /> Enrolled Students &amp; Grades ({t.grades.length})
                                </h4>
                                <Button
                                  size="sm"
                                  disabled={isSavingGrades[t.id]}
                                  onClick={() => handleSaveStudentGrades(t.id)}
                                  className="h-8 px-4 text-xs font-bold rounded-lg shadow press-scale bg-emerald-600 hover:bg-emerald-500 text-white"
                                >
                                  <Save className="mr-1.5 h-3.5 w-3.5" />
                                  {isSavingGrades[t.id] ? "Saving..." : "Save Grades"}
                                </Button>
                              </div>

                              {t.grades.length === 0 ? (
                                <p className="text-xs text-muted-foreground italic">No students currently enrolled in this course.</p>
                              ) : (
                                <div className="overflow-x-auto rounded-xl border border-white/10 bg-background/60">
                                  <table className="w-full text-left text-xs">
                                    <thead className="bg-white/5 border-b border-white/10 text-muted-foreground uppercase text-[11px] font-bold">
                                      <tr>
                                        <th className="p-3">Student</th>
                                        <th className="p-3">Status</th>
                                        <th className="p-3 w-36">Score (out of {t.maxScore})</th>
                                        <th className="p-3">Teacher Remarks / Feedback</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/5">
                                      {t.grades.map((g) => {
                                        const currentVal = gradeInputs[t.id]?.[g.studentId] || {
                                          score: g.score || 0,
                                          feedback: g.feedback || "",
                                        };
                                        const isGraded = Boolean(g.gradedAt);

                                        return (
                                          <tr key={g.id || g.studentId} className="hover:bg-white/[0.02]">
                                            <td className="p-3 font-medium text-foreground">
                                              <div>{g.studentName}</div>
                                              <div className="text-[11px] text-muted-foreground">{g.studentEmail}</div>
                                            </td>
                                            <td className="p-3">
                                              <Badge
                                                variant="outline"
                                                className={isGraded ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "bg-amber-500/10 text-amber-400 border-amber-500/20"}
                                              >
                                                {isGraded ? "Graded" : "Pending"}
                                              </Badge>
                                            </td>
                                            <td className="p-3">
                                              <input
                                                type="number"
                                                min="0"
                                                max={t.maxScore}
                                                step="0.5"
                                                value={currentVal.score}
                                                onChange={(e) => handleGradeChange(t.id, g.studentId, "score", e.target.value)}
                                                className="w-24 h-8 px-2 rounded-lg border border-white/10 bg-background font-bold text-foreground text-center focus:ring-1 focus:ring-primary"
                                              />
                                            </td>
                                            <td className="p-3">
                                              <input
                                                type="text"
                                                placeholder="Add teacher feedback notes..."
                                                value={currentVal.feedback}
                                                onChange={(e) => handleGradeChange(t.id, g.studentId, "feedback", e.target.value)}
                                                className="w-full h-8 px-3 rounded-lg border border-white/10 bg-background text-foreground text-xs focus:ring-1 focus:ring-primary"
                                              />
                                            </td>
                                          </tr>
                                        );
                                      })}
                                    </tbody>
                                  </table>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Create / Edit Test Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-card p-6 shadow-2xl space-y-5">
            <h3 className="text-xl font-bold text-foreground">{editingTestId ? "Edit Course Test" : "Create New Test"}</h3>

            <form onSubmit={handleSaveTest} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-muted-foreground uppercase mb-1">Select Course</label>
                <select
                  disabled={Boolean(editingTestId)}
                  value={formCourseId}
                  onChange={(e) => setFormCourseId(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg border border-white/10 bg-background text-foreground text-sm"
                >
                  {courses.map((c) => (
                    <option key={c.id} value={c.id}>{c.title}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-muted-foreground uppercase mb-1">Test Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Weekly Assessment 1"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg border border-white/10 bg-background text-foreground text-sm"
                />
              </div>

              <div>
                <label className="block font-bold text-muted-foreground uppercase mb-1">Description (Optional)</label>
                <textarea
                  rows={2}
                  placeholder="Instructions for students..."
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  className="w-full p-3 rounded-lg border border-white/10 bg-background text-foreground text-sm"
                />
              </div>

              <div>
                <label className="block font-bold text-muted-foreground uppercase mb-1">Google Form Test Link</label>
                <input
                  type="url"
                  required
                  placeholder="https://forms.gle/..."
                  value={formGoogleUrl}
                  onChange={(e) => setFormGoogleUrl(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg border border-white/10 bg-background text-foreground text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-muted-foreground uppercase mb-1">Open Window Start</label>
                  <input
                    type="datetime-local"
                    required
                    value={formStartTime}
                    onChange={(e) => setFormStartTime(e.target.value)}
                    className="w-full h-10 px-3 rounded-lg border border-white/10 bg-background text-foreground text-xs"
                  />
                </div>
                <div>
                  <label className="block font-bold text-muted-foreground uppercase mb-1">Open Window End</label>
                  <input
                    type="datetime-local"
                    required
                    value={formEndTime}
                    onChange={(e) => setFormEndTime(e.target.value)}
                    className="w-full h-10 px-3 rounded-lg border border-white/10 bg-background text-foreground text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-muted-foreground uppercase mb-1">Max Score (Points)</label>
                <input
                  type="number"
                  min="1"
                  required
                  value={formMaxScore}
                  onChange={(e) => setFormMaxScore(Number(e.target.value))}
                  className="w-full h-10 px-3 rounded-lg border border-white/10 bg-background text-foreground text-sm"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/10">
                <Button type="button" variant="ghost" onClick={() => setIsModalOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={isSubmitting} className="px-6 font-bold shadow-lg">
                  {isSubmitting ? "Saving..." : editingTestId ? "Update Test" : "Create Test"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
