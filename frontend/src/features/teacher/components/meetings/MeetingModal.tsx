"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Calendar as CalendarIcon, Clock, Link as LinkIcon, Video, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useMeetingStore } from "@/stores/meeting.store";
import { Label } from "@/components/ui/label";
import { courseService, Course } from "@/services/course.service";
import { useCreateMeeting } from "@/hooks/queries/useTeacherQueries";
import { toast } from "sonner";

export function MeetingModal() {
  const { isCreateModalOpen, setCreateModalOpen } = useMeetingStore();
  const [courses, setCourses] = React.useState<Course[]>([]);
  const [isLoadingCourses, setIsLoadingCourses] = React.useState(false);

  const createMeetingMutation = useCreateMeeting();

  const [formData, setFormData] = React.useState({
    title: "",
    courseId: "",
    date: "",
    time: "10:00",
    duration: "60",
    meetLink: "",
    description: "",
  });

  React.useEffect(() => {
    if (isCreateModalOpen) {
      const fetchCourses = async () => {
        try {
          setIsLoadingCourses(true);
          const res = await courseService.list({ page: 1, pageSize: 100 });
          setCourses(res.items || []);
          if (res.items && res.items.length > 0) {
            setFormData((prev) => ({
              ...prev,
              courseId: prev.courseId || res.items[0].id,
            }));
          }
        } catch {
          // ignore
        } finally {
          setIsLoadingCourses(false);
        }
      };
      fetchCourses();

      // Pre-fill today date and smart default future start time
      const now = new Date();
      now.setHours(now.getHours() + 1);
      const hours = String(now.getHours()).padStart(2, "0");
      const minutes = now.getMinutes() < 30 ? "00" : "30";
      const defaultTime = `${hours}:${minutes}`;

      const todayStr = new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD format local date

      setFormData((prev) => ({
        ...prev,
        date: prev.date || todayStr,
        time: prev.time || defaultTime,
      }));
    }
  }, [isCreateModalOpen]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.courseId) {
      toast.error("Please select a course for this meeting.");
      return;
    }
    if (!formData.title.trim()) {
      toast.error("Please enter a meeting title.");
      return;
    }
    if (formData.title.trim().length < 3) {
      toast.error("Meeting title must be at least 3 characters long.");
      return;
    }
    if (!formData.date || !formData.time) {
      toast.error("Please select date and start time.");
      return;
    }

    const scheduledDate = new Date(`${formData.date}T${formData.time}:00`);
    if (isNaN(scheduledDate.getTime())) {
      toast.error("Please enter a valid date and time.");
      return;
    }

    if (scheduledDate.getTime() <= Date.now()) {
      toast.error("Meeting must be scheduled in the future. Please select a future time.");
      return;
    }

    const scheduledAt = scheduledDate.toISOString();

    createMeetingMutation.mutate(
      {
        courseId: formData.courseId,
        title: formData.title.trim(),
        description: formData.description,
        meetLink: formData.meetLink.trim(),
        scheduledAt,
        durationMinutes: Number(formData.duration),
      },
      {
        onSuccess: () => {
          toast.success("Meeting scheduled successfully!");
          setCreateModalOpen(false);
          setFormData({
            title: "",
            courseId: "",
            date: "",
            time: "10:00",
            duration: "60",
            meetLink: "",
            description: "",
          });
        },
        onError: (err: any) => {
          const detailMsg = typeof err?.response?.data?.detail === "string" 
            ? err.response.data.detail 
            : Array.isArray(err?.response?.data?.detail)
            ? err.response.data.detail[0]?.msg
            : null;
          toast.error(detailMsg || err?.response?.data?.message || err?.message || "Failed to schedule meeting.");
        },
      }
    );
  };

  return (
    <AnimatePresence>
      {isCreateModalOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setCreateModalOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="bg-card/95 backdrop-blur-xl w-full max-w-2xl rounded-2xl border border-border/60 overflow-hidden flex flex-col max-h-full shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-border/50">
                <div className="flex items-center gap-2">
                  <Video className="h-5 w-5 text-primary" />
                  <h2 className="text-foreground text-lg font-extrabold tracking-tight">Schedule Live Class</h2>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setCreateModalOpen(false)}
                  className="h-8 w-8 rounded-full text-muted-foreground hover:text-foreground hover:bg-accent"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              {/* Scrollable Body */}
              <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
                <form onSubmit={onSubmit} className="flex flex-col gap-6">

                  <div className="flex flex-col gap-2">
                    <Label htmlFor="title" className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">
                      Meeting Title
                    </Label>
                    <Input
                      id="title"
                      placeholder="e.g. Weekly Live Q&A Session"
                      required
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      className="input-glass"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="courseId" className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">
                        Associated Course
                      </Label>
                      <div className="relative">
                        <select
                          id="courseId"
                          required
                          value={formData.courseId}
                          onChange={(e) => setFormData({ ...formData, courseId: e.target.value })}
                          className="input-glass cursor-pointer bg-card text-foreground appearance-none pr-9 w-full"
                        >
                          <option value="" disabled className="bg-card text-foreground">
                            {isLoadingCourses ? "Loading courses..." : "Select a course"}
                          </option>
                          {courses.map((c) => (
                            <option key={c.id} value={c.id} className="bg-card text-foreground">
                              {c.title}
                            </option>
                          ))}
                        </select>
                        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                      </div>
                    </div>

                    <div className="flex flex-col gap-2">
                      <Label htmlFor="duration" className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">Duration</Label>
                      <div className="relative">
                        <select
                          id="duration"
                          value={formData.duration}
                          onChange={(e) => setFormData({ ...formData, duration: e.target.value })}
                          className="input-glass cursor-pointer bg-card text-foreground appearance-none pr-9 w-full"
                        >
                          <option value="30" className="bg-card text-foreground">30 minutes</option>
                          <option value="60" className="bg-card text-foreground">1 hour</option>
                          <option value="90" className="bg-card text-foreground">1.5 hours</option>
                          <option value="120" className="bg-card text-foreground">2 hours</option>
                        </select>
                        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                      </div>
                    </div>
                  </div>

                  {/* Google Meet Link Input Field */}
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="meetLink" className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">
                      Google Meet Link <span className="font-normal normal-case">(Optional)</span>
                    </Label>
                    <div className="relative">
                      <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                      <Input
                        id="meetLink"
                        type="url"
                        placeholder="https://meet.google.com/abc-defg-hij"
                        value={formData.meetLink}
                        onChange={(e) => setFormData({ ...formData, meetLink: e.target.value })}
                        className="input-glass pl-9"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="date" className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">Date</Label>
                      <div className="relative">
                        <CalendarIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none z-10" />
                        <Input
                          id="date"
                          type="date"
                          required
                          value={formData.date}
                          onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                          className="input-glass pl-9 input-glass-picker cursor-pointer text-foreground"
                        />
                      </div>
                    </div>

                    <div className="flex flex-col gap-2">
                      <Label htmlFor="time" className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">Start Time</Label>
                      <div className="relative">
                        <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none z-10" />
                        <Input
                          id="time"
                          type="time"
                          required
                          value={formData.time}
                          onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                          className="input-glass pl-9 input-glass-picker cursor-pointer text-foreground"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2">
                    <Label htmlFor="description" className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">
                      Description / Agenda <span className="font-normal normal-case">(Optional)</span>
                    </Label>
                    <Textarea
                      id="description"
                      placeholder="Add meeting notes, agenda, or prerequisites for students..."
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      className="resize-none h-24 bg-background border-border/60 rounded-xl text-foreground placeholder:text-muted-foreground focus:border-primary/50"
                    />
                  </div>

                  <div className="flex items-center justify-end gap-3 pt-4 border-t border-border/50">
                    <Button
                      variant="outline"
                      type="button"
                      onClick={() => setCreateModalOpen(false)}
                      className="bg-secondary/50 border-border text-muted-foreground hover:text-foreground rounded-xl"
                    >
                      Cancel
                    </Button>
                    <button
                      type="submit"
                      disabled={createMeetingMutation.isPending}
                      className="btn-primary press-scale disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {createMeetingMutation.isPending ? "Scheduling..." : "Schedule Meeting"}
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
