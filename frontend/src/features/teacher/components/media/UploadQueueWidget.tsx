"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  X, 
  ChevronDown, 
  ChevronUp, 
  CheckCircle2, 
  AlertCircle,
  Loader2
} from "lucide-react";
import { useMediaStore } from "@/stores/media.store";
import { Button } from "@/components/ui/button";

export function UploadQueueWidget() {
  const { uploadQueue, removeUploadTask } = useMediaStore();
  const [isMinimized, setIsMinimized] = React.useState(false);
  const [isDismissed, setIsDismissed] = React.useState(false);

  // Auto-dismiss logic if queue is empty or entirely successful
  React.useEffect(() => {
    if (uploadQueue.length === 0) return;
    setIsDismissed(false);
  }, [uploadQueue.length]);

  if (uploadQueue.length === 0 || isDismissed) return null;

  const totalTasks = uploadQueue.length;
  const completedTasks = uploadQueue.filter(t => t.status === "Ready" || t.status === "Failed").length;
  const isAllComplete = totalTasks === completedTasks;

  return (
    <motion.div
      initial={{ opacity: 0, y: 50, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 50, scale: 0.95 }}
      className="fixed bottom-6 right-6 w-80 bg-background/90 backdrop-blur-xl border border-white/10 shadow-[0_10px_40px_-10px_rgba(0,0,0,0.5)] rounded-2xl overflow-hidden z-50 flex flex-col elevation-2"
    >
      {/* Header */}
      <div 
        className="bg-white/[0.02] px-5 py-4 border-b border-white/10 flex items-center justify-between cursor-pointer hover:bg-white/[0.05] transition-colors"
        onClick={() => setIsMinimized(!isMinimized)}
      >
        <div className="flex flex-col">
          <span className="text-sm font-bold tracking-tight text-foreground flex items-center gap-2">
            {isAllComplete ? (
              <>
                <CheckCircle2 className="h-4 w-4 text-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.5)]" />
                Uploads Complete
              </>
            ) : (
              <>
                <Loader2 className="h-4 w-4 text-primary animate-spin" />
                Uploading {totalTasks - completedTasks} item{totalTasks - completedTasks > 1 ? 's' : ''}
              </>
            )}
          </span>
          {isAllComplete && (
            <span className="text-[11px] font-semibold text-muted-foreground opacity-80">{completedTasks} files processed</span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground hover:bg-white/10 rounded-full transition-colors press-scale" onClick={(e) => { e.stopPropagation(); setIsMinimized(!isMinimized); }}>
            {isMinimized ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-red-400 hover:bg-red-500/10 rounded-full transition-colors press-scale" onClick={(e) => { e.stopPropagation(); setIsDismissed(true); }}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Queue List */}
      <AnimatePresence>
        {!isMinimized && (
          <motion.div 
            initial={{ height: 0 }}
            animate={{ height: "auto" }}
            exit={{ height: 0 }}
            className="max-h-64 overflow-y-auto hide-scrollbar"
          >
            <div className="divide-y divide-white/5">
              {uploadQueue.map((task) => {
                const isFailed = task.status === "Failed";
                const isReady = task.status === "Ready";
                const isProcessing = task.status === "Processing";

                return (
                  <div key={task.id} className="p-4 bg-transparent flex flex-col gap-3 hover:bg-white/[0.02] transition-colors group">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 overflow-hidden">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/5 shrink-0">
                          {isReady ? (
                            <CheckCircle2 className="h-4 w-4 text-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.5)]" />
                          ) : isFailed ? (
                            <AlertCircle className="h-4 w-4 text-red-400 drop-shadow-[0_0_8px_rgba(248,113,113,0.5)]" />
                          ) : (
                            <Loader2 className="h-4 w-4 text-primary animate-spin" />
                          )}
                        </div>
                        <span className="text-xs font-semibold text-foreground truncate" title={task.filename}>
                          {task.filename}
                        </span>
                      </div>
                      <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100 hover:bg-white/10 shrink-0 rounded-full transition-all press-scale" onClick={() => removeUploadTask(task.id)}>
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>

                    {!isReady && !isFailed && (
                      <div className="space-y-1.5 pl-11 pr-2">
                        <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full transition-all duration-300 ${isProcessing ? "bg-emerald-500 shadow-[0_0_8px_rgba(52,211,153,0.8)]" : "bg-primary shadow-[0_0_8px_rgba(var(--primary-rgb),0.8)]"}`} style={{ width: `${task.progress}%` }} />
                        </div>
                        <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-widest text-muted-foreground opacity-70">
                          <span>{isProcessing ? "Processing..." : `${task.progress}%`}</span>
                          <span>{task.eta}</span>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
