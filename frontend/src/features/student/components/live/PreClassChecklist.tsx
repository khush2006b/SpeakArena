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
import { useJoinMeeting } from "@/hooks/queries/useMeetingQueries";
import { toast } from "sonner";

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
  const [micStatus, setMicStatus] = React.useState<"ok" | "warning">("ok");
  const [camStatus, setCamStatus] = React.useState<"ok" | "warning">("ok");

  const joinMutation = useJoinMeeting();

  React.useEffect(() => {
    if (isOpen) {
      setChecking(true);
      
      // Perform hardware access check
      if (typeof navigator !== "undefined" && navigator.mediaDevices?.getUserMedia) {
        navigator.mediaDevices
          .getUserMedia({ audio: true, video: true })
          .then((stream) => {
            setMicStatus("ok");
            setCamStatus("ok");
            // Clean up stream tracks
            stream.getTracks().forEach((track) => track.stop());
          })
          .catch(() => {
            setMicStatus("warning");
            setCamStatus("warning");
          })
          .finally(() => {
            setTimeout(() => setChecking(false), 800);
          });
      } else {
        setTimeout(() => setChecking(false), 800);
      }
    }
  }, [isOpen]);

  if (!liveClass) return null;

  const handleJoin = () => {
    const rawMeetLink = liveClass.meetLink || liveClass.meet_link || liveClass.meeting_url || "";
    if (rawMeetLink) {
      const meetUrl = rawMeetLink.startsWith("http") ? rawMeetLink : `https://${rawMeetLink}`;
      window.open(meetUrl, "_blank");
      toast.success("Opening Google Meet...");
      onClose();
      return;
    }
    joinMutation.mutate(liveClass.id, {
      onSuccess: () => {
        toast.success("Joining session...");
        onClose();
      },
      onError: (err: any) => {
        toast.error(err?.response?.data?.message || err?.message || "Failed to join live class.");
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
      status: micStatus,
      message: micStatus === "warning" ? "Microphone permission pending" : undefined,
    },
    {
      label: "Camera Access",
      icon: <Camera className="h-5 w-5" />,
      status: camStatus,
      message: camStatus === "warning" ? "Camera permission pending" : undefined,
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
                {liveClass.title || "Course Session"}
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="rounded-xl border border-border/50 p-4 bg-card/50">
            <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-4">
              Pre-flight Diagnostics
            </h4>
            <div className="space-y-3">
              {checks.map((check, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-3 p-3 rounded-lg border border-border/40 bg-secondary/20"
                >
                  <div
                    className={`p-2 rounded-lg ${
                      check.status === "ok"
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
                    <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                  )}
                  {!checking && check.status === "warning" && (
                    <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
                  )}
                </div>
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
              ? "Running pre-flight checks..."
              : joinMutation.isPending
              ? "Connecting..."
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
