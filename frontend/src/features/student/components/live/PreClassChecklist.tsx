"use client";

import * as React from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import {
  Wifi,
  Mic,
  Camera,
  Headphones,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useJoinMeeting } from "@/hooks/queries/useMeetingQueries";

interface PreClassChecklistProps {
  liveClass: any | null;
  isOpen: boolean;
  onClose: () => void;
}

export function PreClassChecklist({
  liveClass,
  isOpen,
  onClose,
}: PreClassChecklistProps) {
  const [checking, setChecking] = React.useState(true);

  const joinMutation = useJoinMeeting();

  React.useEffect(() => {
    if (isOpen) {
      setChecking(true);
      const timer = setTimeout(() => {
        setChecking(false);
      }, 2500); // Simulate hardware check delay
      return () => clearTimeout(timer);
    }
    return () => {};
  }, [isOpen]);

  if (!liveClass) return null;

  const handleJoin = () => {
    joinMutation.mutate(liveClass.id, {
      onSuccess: () => {
        onClose();
      },
    });
  };

  const checks = [
    {
      label: "Network Connection",
      icon: <Wifi className="h-5 w-5" />,
      status: "ok",
    },
    {
      label: "Microphone Access",
      icon: <Mic className="h-5 w-5" />,
      status: "ok",
    },
    {
      label: "Camera Access",
      icon: <Camera className="h-5 w-5" />,
      status: "warning",
      message: "Camera blocked by browser",
    },
    {
      label: "Audio Output",
      icon: <Headphones className="h-5 w-5" />,
      status: "ok",
    },
  ];

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-md bg-background border-l border-border/50 flex flex-col p-0"
      >
        <SheetHeader className="p-6 border-b border-border/40 bg-card/80 backdrop-blur-xl shrink-0 text-left">
          <div className="flex items-center gap-3 mb-2">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center border border-primary/20">
              <Camera className="h-5 w-5 text-primary" />
            </div>
            <div>
              <SheetTitle className="text-xl text-foreground">
                Join Live Class
              </SheetTitle>
              <SheetDescription className="text-xs text-muted-foreground">
                Pre-flight hardware check
              </SheetDescription>
            </div>
          </div>

          <div className="mt-4 p-3 bg-background border border-border/50 rounded-xl">
            <p className="text-sm font-semibold text-foreground line-clamp-1">
              {liveClass.title}
            </p>
            <p className="text-xs text-muted-foreground mt-1">Course Session</p>
          </div>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
          {/* Status Animation Area */}
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <AnimatePresence mode="wait">
              {checking ? (
                <motion.div
                  key="checking"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  className="flex flex-col items-center"
                >
                  <div className="relative mb-4">
                    <div className="absolute inset-0 bg-primary/20 rounded-full animate-ping" />
                    <div className="h-16 w-16 bg-primary/10 rounded-full flex items-center justify-center relative z-10 border border-primary/30">
                      <Loader2 className="h-8 w-8 text-primary animate-spin" />
                    </div>
                  </div>
                  <h3 className="text-sm font-semibold text-foreground">
                    Testing Equipment...
                  </h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    Please allow browser permissions if prompted.
                  </p>
                </motion.div>
              ) : (
                <motion.div
                  key="ready"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="flex flex-col items-center"
                >
                  <div className="h-16 w-16 bg-emerald-500/10 rounded-full flex items-center justify-center mb-4 border border-emerald-500/30">
                    <CheckCircle2 className="h-8 w-8 text-emerald-500" />
                  </div>
                  <h3 className="text-sm font-semibold text-foreground">
                    Ready to Join!
                  </h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    Your equipment is configured correctly.
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Checklist */}
          <div>
            <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-4">
              System Check
            </h4>
            <div className="space-y-3">
              {checks.map((check, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.2 + (checking ? 0 : 0.5) }}
                  className="flex items-start gap-3 p-3 rounded-xl border border-border/40 bg-card/60 backdrop-blur"
                >
                  <div
                    className={`p-2 rounded-md ${
                      checking
                        ? "bg-secondary text-muted-foreground"
                        : check.status === "ok"
                        ? "bg-emerald-500/10 text-emerald-500"
                        : "bg-amber-500/10 text-amber-500"
                    }`}
                  >
                    {checking ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      check.icon
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">
                      {check.label}
                    </p>
                    {!checking && check.message && (
                      <p className="text-xs text-amber-500 mt-0.5">
                        {check.message}
                      </p>
                    )}
                  </div>
                  {!checking && check.status === "ok" && (
                    <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-1" />
                  )}
                  {!checking && check.status === "warning" && (
                    <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-1" />
                  )}
                </motion.div>
              ))}
            </div>
          </div>
        </div>

        <SheetFooter className="p-6 border-t border-border/40 bg-card/80 backdrop-blur-xl shrink-0 flex-col sm:flex-col gap-3">
          <Button
            className="btn-primary w-full h-12 text-base font-semibold press-scale"
            disabled={checking || joinMutation.isPending}
            onClick={handleJoin}
          >
            {checking
              ? "Testing..."
              : joinMutation.isPending
              ? "Joining..."
              : (
                  <>
                    Join Google Meet{" "}
                    <ExternalLink className="ml-2 h-4 w-4" />
                  </>
                )}
          </Button>
          <Button
            variant="ghost"
            className="w-full text-muted-foreground hover:text-foreground press-scale"
            onClick={onClose}
            disabled={joinMutation.isPending}
          >
            Cancel
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
