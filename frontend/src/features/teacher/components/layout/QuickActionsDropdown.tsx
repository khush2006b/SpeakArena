"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus, Video, FileText, Megaphone, Presentation } from "lucide-react";
import { useMeetingStore } from "@/stores/meeting.store";

export function QuickActionsDropdown() {
  const [isOpen, setIsOpen] = React.useState(false);
  const router = useRouter();
  const setCreateModalOpen = useMeetingStore((s) => s.setCreateModalOpen);

  const close = () => setIsOpen(false);

  const handleCreateCourse = () => {
    close();
    router.push("/teacher/builder");
  };

  const handleScheduleMeeting = () => {
    close();
    setCreateModalOpen(true);
    router.push("/teacher/meetings");
  };

  const handleUploadResource = () => {
    close();
    router.push("/teacher/resources");
  };

  const handlePostAnnouncement = () => {
    close();
    router.push("/teacher/communication");
  };

  return (
    <div style={{ position: "relative" }}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        style={{
          display: "inline-flex",
          alignItems: "center",
          height: 36,
          padding: "0 16px",
          background: "hsl(var(--primary))",
          color: "hsl(var(--foreground))",
          border: "none",
          borderRadius: 10,
          fontSize: 14,
          fontWeight: 700,
          cursor: "pointer",
          boxShadow: "0 4px 12px rgba(124,58,237,0.3)",
          transition: "all 0.2s"
        }}
      >
        <Plus style={{ marginRight: 6, height: 16, width: 16 }} />
        Create
      </button>

      {isOpen && (
        <>
          <div 
            style={{ position: "fixed", inset: 0, zIndex: 40 }} 
            onClick={close} 
          />
          <div style={{
            position: "absolute",
            right: 0,
            top: "calc(100% + 8px)",
            width: 224,
            background: "hsl(var(--card))",
            border: "1px solid hsl(var(--border))",
            borderRadius: 12,
            padding: 8,
            boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.5)",
            zIndex: 50,
            display: "flex",
            flexDirection: "column",
            gap: 4
          }}>
            <div style={{ padding: "8px 12px", borderBottom: "1px solid rgba(255,255,255,0.05)", marginBottom: 4 }}>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "hsl(var(--foreground))" }}>Quick Actions</p>
            </div>
            
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <button style={menuItemStyle} onClick={handleCreateCourse}>
                <Presentation style={{ width: 16, height: 16, color: "#60a5fa" }} />
                <span>Create Course</span>
              </button>
              <button style={menuItemStyle} onClick={handleScheduleMeeting}>
                <Video style={{ width: 16, height: 16, color: "#10b981" }} />
                <span>Schedule Meeting</span>
              </button>
            </div>
            
            <div style={{ height: 1, background: "rgba(255,255,255,0.05)", margin: "4px 0" }} />
            
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <button style={menuItemStyle} onClick={handleUploadResource}>
                <FileText style={{ width: 16, height: 16, color: "#f59e0b" }} />
                <span>Upload PDF/Resource</span>
              </button>
              <button style={menuItemStyle} onClick={handlePostAnnouncement}>
                <Megaphone style={{ width: 16, height: 16, color: "#a78bfa" }} />
                <span>Post Announcement</span>
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

const menuItemStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 12,
  padding: "8px 12px",
  fontSize: 14,
  fontWeight: 500,
  color: "#e5e7eb",
  background: "transparent",
  border: "none",
  textAlign: "left",
  textDecoration: "none",
  borderRadius: 6,
  transition: "background 0.2s",
  cursor: "pointer",
  width: "100%"
};
