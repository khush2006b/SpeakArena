"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Calendar as CalendarIcon, Clock, Link as LinkIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useMeetingStore } from "@/stores/meeting.store";
import { Label } from "@/components/ui/label";

export function MeetingModal() {
  const { isCreateModalOpen, setCreateModalOpen } = useMeetingStore();
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const [formData, setFormData] = React.useState({
    title: "",
    courseId: "",
    date: "",
    time: "",
    duration: "60",
    meetLink: "",
    isRecurring: false,
    description: "",
  });

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    await new Promise((resolve) => setTimeout(resolve, 800));
    setIsSubmitting(false);
    setCreateModalOpen(false);
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
                <h2 className="text-foreground text-lg font-extrabold tracking-tight">Schedule Meeting</h2>
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
                      placeholder="e.g. System Design Q&A"
                      required
                      value={formData.title}
                      onChange={e => setFormData({...formData, title: e.target.value})}
                      className="input-glass"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="courseId" className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">
                        Associated Course
                      </Label>
                      <select
                        id="courseId"
                        required
                        value={formData.courseId}
                        onChange={e => setFormData({...formData, courseId: e.target.value})}
                        className="input-glass cursor-pointer"
                      >
                        <option value="" disabled className="bg-card text-foreground">Select a course</option>
                        <option value="course-1" className="bg-card text-foreground">System Design Masterclass</option>
                        <option value="course-2" className="bg-card text-foreground">Advanced React Patterns</option>
                        <option value="course-3" className="bg-card text-foreground">UI/UX for Developers</option>
                      </select>
                    </div>

                    <div className="flex flex-col gap-2">
                      <Label htmlFor="meetLink" className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">
                        Google Meet Link <span className="font-normal normal-case">(Optional)</span>
                      </Label>
                      <div className="relative">
                        <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                        <Input
                          id="meetLink"
                          type="url"
                          placeholder="https://meet.google.com/..."
                          value={formData.meetLink}
                          onChange={e => setFormData({...formData, meetLink: e.target.value})}
                          className="input-glass pl-9"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="date" className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">Date</Label>
                      <div className="relative">
                        <CalendarIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                        <Input
                          id="date"
                          type="date"
                          required
                          value={formData.date}
                          onChange={e => setFormData({...formData, date: e.target.value})}
                          className="input-glass pl-9"
                        />
                      </div>
                    </div>

                    <div className="flex flex-col gap-2">
                      <Label htmlFor="time" className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">Start Time</Label>
                      <div className="relative">
                        <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                        <Input
                          id="time"
                          type="time"
                          required
                          value={formData.time}
                          onChange={e => setFormData({...formData, time: e.target.value})}
                          className="input-glass pl-9"
                        />
                      </div>
                    </div>

                    <div className="flex flex-col gap-2">
                      <Label htmlFor="duration" className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">Duration</Label>
                      <select
                        id="duration"
                        value={formData.duration}
                        onChange={e => setFormData({...formData, duration: e.target.value})}
                        className="input-glass cursor-pointer"
                      >
                        <option value="30" className="bg-card text-foreground">30 minutes</option>
                        <option value="60" className="bg-card text-foreground">1 hour</option>
                        <option value="90" className="bg-card text-foreground">1.5 hours</option>
                        <option value="120" className="bg-card text-foreground">2 hours</option>
                      </select>
                    </div>
                  </div>

                  {/* Recurring Toggle */}
                  <div className="flex items-center justify-between rounded-xl border border-border/50 p-4 bg-secondary/20">
                    <div className="flex flex-col gap-0.5">
                      <Label className="text-foreground font-bold text-sm cursor-pointer">Recurring Meeting</Label>
                      <p className="text-muted-foreground text-xs">Set up this meeting to repeat weekly.</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        className="sr-only"
                        checked={formData.isRecurring}
                        onChange={e => setFormData({...formData, isRecurring: e.target.checked})}
                      />
                      <div
                        className={`w-11 h-6 rounded-full relative transition-colors duration-200 ${
                          formData.isRecurring ? "bg-violet-600" : "bg-secondary"
                        }`}
                      >
                        <div
                          className={`absolute top-1 w-4 h-4 bg-foreground rounded-full transition-all duration-200 ${
                            formData.isRecurring ? "left-6" : "left-1"
                          }`}
                        />
                      </div>
                    </label>
                  </div>

                  <div className="flex flex-col gap-2">
                    <Label htmlFor="description" className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">
                      Description / Agenda <span className="font-normal normal-case">(Optional)</span>
                    </Label>
                    <Textarea
                      id="description"
                      placeholder="Add meeting notes, agenda, or prerequisites for students..."
                      value={formData.description}
                      onChange={e => setFormData({...formData, description: e.target.value})}
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
                      disabled={isSubmitting}
                      className="btn-primary press-scale disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isSubmitting ? "Scheduling..." : "Schedule Meeting"}
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
