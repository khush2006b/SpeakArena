"use client";

import * as React from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Plus, Video, FileText, Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useBuilderStore } from "@/stores/builder.store";
import { cn } from "@/lib/utils";
import { VideoUploadModal } from "../VideoUploadModal";
import { apiClient } from "@/services/api/client";
import { toast } from "sonner";

interface Lesson {
  id: string;
  title: string;
  type: "video" | "pdf";
  duration?: string;
  sort_order?: number;
}

function SortableLessonItem({
  lesson,
  onDelete,
}: {
  lesson: Lesson;
  onDelete: (id: string) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: lesson.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex items-center justify-between p-3 mb-2 rounded-md border border-border bg-card shadow-sm transition-colors",
        isDragging && "opacity-50 ring-2 ring-primary border-transparent z-50",
        !isDragging && "hover:border-primary/30"
      )}
    >
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <button
          className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground touch-none p-1 shrink-0"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-4 w-4" />
        </button>

        <div className="flex h-8 w-8 items-center justify-center rounded bg-secondary/50 shrink-0">
          {lesson.type === "video" ? (
            <Video className="h-4 w-4 text-primary" />
          ) : (
            <FileText className="h-4 w-4 text-orange-500" />
          )}
        </div>

        <div className="flex flex-col min-w-0">
          <span className="text-sm font-semibold text-foreground truncate">{lesson.title}</span>
          {lesson.duration && (
            <span className="text-xs text-muted-foreground">{lesson.duration}</span>
          )}
        </div>
      </div>

      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 text-muted-foreground hover:text-destructive shrink-0 press-scale"
        onClick={() => onDelete(lesson.id)}
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}

export function CurriculumStep() {
  const { nextStep, prevStep, courseId, stagedLessons, setStagedLessons } = useBuilderStore();
  const [lessons, setLessons] = React.useState<Lesson[]>([]);
  const [loadingLessons, setLoadingLessons] = React.useState(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = React.useState(false);
  const [newLessonTitle, setNewLessonTitle] = React.useState("");
  const [isAddingLesson, setIsAddingLesson] = React.useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // Fetch existing lessons when courseId is available (editing existing course)
  React.useEffect(() => {
    if (!courseId) {
      setLessons(stagedLessons.map((l) => ({ id: l.id, title: l.title, type: l.type })));
      return;
    }
    setLoadingLessons(true);
    apiClient
      .get(`/api/v1/teacher/courses/${courseId}/videos`)
      .then((res) => {
        const raw = res.data;
        const items: any[] = Array.isArray(raw)
          ? raw
          : Array.isArray(raw?.items)
          ? raw.items
          : Array.isArray(raw?.data)
          ? raw.data
          : [];
        setLessons(
          items.map((v: any) => ({
            id: v.id,
            title: v.title,
            type: "video" as const,
            sort_order: v.sort_order,
          }))
        );
      })
      .catch(() => {
        // Silently ignore — will start with empty list
      })
      .finally(() => setLoadingLessons(false));
  }, [courseId, stagedLessons]);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setLessons((items) => {
        const oldIndex = items.findIndex((i) => i.id === active.id);
        const newIndex = items.findIndex((i) => i.id === over.id);
        const reordered = arrayMove(items, oldIndex, newIndex);
        if (!courseId) {
          setStagedLessons(reordered.map((l) => ({ id: l.id, title: l.title, section: "Module 1", type: l.type })));
        }
        return reordered;
      });
    }
  };

  const handleDelete = async (lessonId: string) => {
    setLessons((prev) => prev.filter((l) => l.id !== lessonId));
    if (!courseId) {
      setStagedLessons((prev) => prev.filter((l) => l.id !== lessonId));
    } else {
      try {
        await apiClient.delete(`/api/v1/teacher/courses/${courseId}/videos/${lessonId}`);
      } catch {
        toast.error("Could not delete lesson from server.");
      }
    }
  };

  const handleAddStagedLesson = () => {
    if (!newLessonTitle.trim()) return;
    const newLesson = {
      id: `staged-${Date.now()}`,
      title: newLessonTitle.trim(),
      section: "Module 1",
      type: "video" as const,
    };
    setStagedLessons((prev) => [...prev, newLesson]);
    setLessons((prev) => [...prev, { id: newLesson.id, title: newLesson.title, type: newLesson.type }]);
    setNewLessonTitle("");
    setIsAddingLesson(false);
    toast.success("Lesson added to curriculum!");
  };

  const handleUploadSuccess = (data: any) => {
    setLessons((prev) => [
      ...prev,
      {
        id: data.id || data.resource_id || `l${prev.length + 1}`,
        title: data.title || "New Video Lesson",
        type: "video" as const,
      },
    ]);
    toast.success("Video lesson added to curriculum!");
  };

  const handleAddClick = () => {
    if (courseId) {
      setIsUploadModalOpen(true);
    } else {
      setIsAddingLesson(true);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-foreground">Curriculum Builder</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Add and reorder lessons for your course curriculum.
        </p>
      </div>

      <div className="bg-secondary/10 border border-border/50 rounded-xl p-4 sm:p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-foreground">Module 1: Fundamentals</h3>
          <Button
            variant="outline"
            size="sm"
            className="h-8 press-scale"
            onClick={handleAddClick}
          >
            <Plus className="h-3 w-3 mr-1.5" />
            Add Lesson
          </Button>
        </div>

        {isAddingLesson && (
          <div className="mb-4 p-4 rounded-lg border border-primary/30 bg-card space-y-3">
            <label className="text-xs font-semibold text-foreground uppercase tracking-wider">Lesson Title</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={newLessonTitle}
                onChange={(e) => setNewLessonTitle(e.target.value)}
                placeholder="e.g. Lesson 1: Getting Started"
                className="flex-1 h-9 rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleAddStagedLesson();
                  if (e.key === "Escape") setIsAddingLesson(false);
                }}
              />
              <Button size="sm" onClick={handleAddStagedLesson} disabled={!newLessonTitle.trim()}>
                Add
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setIsAddingLesson(false)}>
                Cancel
              </Button>
            </div>
          </div>
        )}

        {loadingLessons ? (
          <div className="flex items-center gap-3 py-8 justify-center text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="text-sm">Loading lessons...</span>
          </div>
        ) : lessons.length === 0 ? (
          <div
            onClick={handleAddClick}
            className="border-2 border-dashed border-border/60 rounded-lg p-8 text-center transition-colors hover:border-primary/40 hover:bg-primary/5 cursor-pointer"
          >
            <Plus className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm font-medium text-foreground">Add your first lesson</p>
            <p className="text-xs text-muted-foreground mt-1">Click to add lesson topics to curriculum</p>
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={lessons.map((l) => l.id)}
              strategy={verticalListSortingStrategy}
            >
              <div>
                {lessons.map((lesson) => (
                  <SortableLessonItem
                    key={lesson.id}
                    lesson={lesson}
                    onDelete={handleDelete}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </div>

      <div className="pt-6 border-t border-border flex justify-between">
        <Button variant="outline" onClick={prevStep}>
          ← Back to Information
        </Button>
        <Button
          onClick={nextStep}
          className="shadow-sm shadow-primary/20 px-8 press-scale"
        >
          Continue to Resources →
        </Button>
      </div>

      <VideoUploadModal
        open={isUploadModalOpen}
        onOpenChange={setIsUploadModalOpen}
        courseId={courseId || ""}
        onUploadSuccess={handleUploadSuccess}
      />
    </div>
  );
}
