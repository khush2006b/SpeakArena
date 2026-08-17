"use client";

import * as React from "react";
import { AlertTriangle, Download, Trash2, ArchiveRestore } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmModal } from "@/components/layout/ConfirmModal";
import { useNotificationsStore } from "@/stores/notifications.store";

export function DangerZone() {
  const [isArchiveModalOpen, setIsArchiveModalOpen] = React.useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = React.useState(false);
  const { addToast } = useNotificationsStore();

  const handleArchive = async () => {
    await new Promise(r => setTimeout(r, 1000));
    addToast({ title: "Account Archived", description: "Your account is now hidden from the public.", variant: "info" });
  };

  const handleDelete = async () => {
    await new Promise(r => setTimeout(r, 1500));
    addToast({ title: "Account Deleted", description: "Your account has been permanently deleted.", variant: "error" });
  };

  return (
    <div className="space-y-8 animate-fade-up relative pb-24">
      <div>
        <h2 className="text-responsive-lg font-extrabold tracking-tight text-destructive">Danger Zone</h2>
        <p className="text-[15px] font-semibold text-muted-foreground mt-2">Irreversible and highly destructive actions. Proceed with caution.</p>
      </div>

      {/* Main Danger Card */}
      <div className="rounded-2xl border border-destructive/30 bg-destructive/10 backdrop-blur-xl overflow-hidden relative">
        <div className="absolute inset-0 bg-gradient-to-b from-destructive/5 to-transparent pointer-events-none"></div>

        <div className="relative z-10 flex flex-col">
          {/* Export Data */}
          <div className="p-6 sm:p-8 flex flex-col sm:flex-row sm:items-center justify-between gap-6 border-b border-destructive/10 hover:bg-card/10 transition-colors group">
            <div className="space-y-1">
              <h4 className="text-[17px] font-extrabold text-foreground group-hover:text-primary transition-colors">Export Account Data</h4>
              <p className="text-[14px] font-medium text-muted-foreground">Download all your profile data, course content, and student lists in a ZIP archive.</p>
            </div>
            <Button variant="outline" className="shrink-0 h-11 px-6 rounded-xl font-bold tracking-wide border-border/50 bg-card/40 hover:bg-card/80 transition-all press-scale">
              <Download className="mr-2 h-4 w-4" /> Export Data
            </Button>
          </div>

          {/* Archive Account */}
          <div className="p-6 sm:p-8 flex flex-col sm:flex-row sm:items-center justify-between gap-6 border-b border-destructive/10 hover:bg-orange-500/5 transition-colors group">
            <div className="space-y-1">
              <h4 className="text-[17px] font-extrabold text-foreground group-hover:text-orange-400 transition-colors">Archive Account</h4>
              <p className="text-[14px] font-medium text-muted-foreground">Hide your profile and courses from the public. You can reactivate your account at any time.</p>
            </div>
            <Button variant="outline" className="shrink-0 h-11 px-6 rounded-xl font-bold tracking-wide text-orange-400 border-orange-500/30 bg-orange-500/10 hover:bg-orange-500/20 hover:text-orange-400 transition-all press-scale" onClick={() => setIsArchiveModalOpen(true)}>
              <ArchiveRestore className="mr-2 h-4 w-4" /> Archive Account
            </Button>
          </div>

          {/* Delete Account */}
          <div className="p-6 sm:p-8 flex flex-col sm:flex-row sm:items-center justify-between gap-6 bg-destructive/15">
            <div className="space-y-1">
              <h4 className="text-[17px] font-extrabold text-destructive">Delete Account</h4>
              <p className="text-[14px] font-medium text-destructive/70">Permanently remove your account, all courses, and all data. This action CANNOT be undone.</p>
            </div>
            <Button variant="destructive" className="shrink-0 h-11 px-6 rounded-xl font-extrabold tracking-widest uppercase hover:scale-105 transition-all press-scale" onClick={() => setIsDeleteModalOpen(true)}>
              <Trash2 className="mr-2 h-5 w-5" /> Delete Account
            </Button>
          </div>
        </div>
      </div>

      {/* Warning Banner */}
      <div className="p-6 rounded-2xl bg-orange-500/10 border border-orange-500/20 flex items-start gap-4">
        <AlertTriangle className="h-6 w-6 text-orange-500 shrink-0 mt-0.5" />
        <p className="text-[14px] font-semibold text-orange-200/80 leading-relaxed">
          <strong className="text-orange-400">Warning:</strong> Deleting your account will immediately sever all active integrations and immediately cancel any recurring payouts. You will be prompted to re-enter your password to confirm any destructive actions.
        </p>
      </div>

      <ConfirmModal
        open={isArchiveModalOpen}
        onOpenChange={setIsArchiveModalOpen}
        title="Archive Account?"
        description="Your courses will no longer be visible to new students. You can reverse this action by logging back in."
        confirmText="Archive Account"
        onConfirm={handleArchive}
        variant="default"
      />

      <ConfirmModal
        open={isDeleteModalOpen}
        onOpenChange={setIsDeleteModalOpen}
        title="Permanently Delete Account?"
        description="This action cannot be undone. All your courses, student data, and earnings history will be permanently deleted."
        confirmText="Delete Account"
        onConfirm={handleDelete}
        variant="destructive"
      />

    </div>
  );
}
