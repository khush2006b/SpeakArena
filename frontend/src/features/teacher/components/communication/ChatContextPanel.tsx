"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  X, 
  Pin, 
  FileText, 
  Users,
  Info,
  ShieldAlert
} from "lucide-react";
import { useCommunicationStore } from "@/stores/communication.store";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { format, parseISO } from "date-fns";

export function ChatContextPanel() {
  const {
    activeChannelId,
    channels,
    messages,
    isRightPanelOpen,
    toggleRightPanel,
    moderationMode,
    setModerationMode,
  } = useCommunicationStore();

  if (!isRightPanelOpen) return null;

  const channel = channels.find((c) => c.id === activeChannelId) ?? channels[0];

  // Real pinned messages from the store
  const pinnedMessages = messages.filter((m) => m.isPinned);

  // Real file attachments from messages
  const recentFiles = messages
    .flatMap((m) => (m.attachments ?? []).map((a) => ({ ...a, timestamp: m.timestamp })))
    .slice(0, 5);

  // Unique senders from real messages
  const uniqueSenders = Object.values(
    messages
      .filter((m) => m.user)
      .reduce((acc: Record<string, NonNullable<typeof m.user>>, m) => {
        if (m.user && !acc[m.user.id]) acc[m.user.id] = m.user;
        return acc;
      }, {} as Record<string, NonNullable<(typeof messages)[number]["user"]>>)
  );

  return (
    <AnimatePresence>
      <motion.div
        initial={{ width: 0, opacity: 0 }}
        animate={{ width: 320, opacity: 1 }}
        exit={{ width: 0, opacity: 0 }}
        transition={{ duration: 0.2, type: "spring", bounce: 0 }}
        style={{
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background: "rgba(8,12,20,0.5)",
          borderLeft: "1px solid hsl(var(--border))",
          flexShrink: 0,
          overflow: "hidden",
        }}
      >
        {/* Panel Header */}
        <div
          style={{
            height: "56px",
            flexShrink: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 16px",
            borderBottom: "1px solid hsl(var(--border))",
            background: "rgba(8,12,20,0.95)",
            backdropFilter: "blur(8px)",
            zIndex: 20,
          }}
        >
          <h3 style={{ fontSize: "14px", fontWeight: 700, color: "hsl(var(--foreground))", margin: 0 }}>
            Channel Details
          </h3>
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleRightPanel}
            style={{ height: "32px", width: "32px", background: "transparent", color: "hsl(var(--muted-foreground))", border: "none" }}
            className="lg:hidden press-scale"
          >
            <X style={{ height: "16px", width: "16px" }} />
          </Button>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "16px", display: "flex", flexDirection: "column", gap: "24px" }}>
          
          {/* Moderation Toggle */}
          <div
            style={{
              padding: "16px",
              borderRadius: "12px",
              border: "1px solid rgba(239,68,68,0.2)",
              background: "rgba(239,68,68,0.05)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "14px", fontWeight: 700, color: "#ef4444" }}>
                <ShieldAlert style={{ height: "16px", width: "16px" }} /> Moderation
              </div>
              <span style={{ fontSize: "12px", color: "hsl(var(--muted-foreground))" }}>Enable bulk actions &amp; locks</span>
            </div>
            <Switch checked={moderationMode} onCheckedChange={setModerationMode} />
          </div>

          {/* About */}
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <h4 style={{ fontSize: "11px", fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.08em", display: "flex", alignItems: "center", gap: "8px", margin: 0 }}>
              <Info style={{ height: "14px", width: "14px" }} /> About
            </h4>
            <div
              style={{
                padding: "12px",
                borderRadius: "10px",
                border: "1px solid hsl(var(--border))",
                background: "hsl(var(--border))",
                fontSize: "14px",
              }}
            >
              <p style={{ color: "hsl(var(--muted-foreground))", margin: 0 }}>
                {channel ? `Discussion channel for ${channel.name}.` : "Select a channel to see details."}
              </p>
              {channel && (
                <div style={{ marginTop: "12px", paddingTop: "12px", borderTop: "1px solid hsl(var(--border))", display: "flex", flexDirection: "column", gap: "8px", fontSize: "12px", color: "hsl(var(--muted-foreground))" }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span>Type</span>
                    <span style={{ textTransform: "capitalize" }}>{channel.type}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span>Privacy</span>
                    <span>{channel.isPrivate ? "Private" : "Public Channel"}</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Active Participants (from real messages) */}
          {uniqueSenders.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <h4 style={{ fontSize: "11px", fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.08em", display: "flex", alignItems: "center", gap: "8px", margin: 0 }}>
                <Users style={{ height: "14px", width: "14px" }} /> Participants ({uniqueSenders.length})
              </h4>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {uniqueSenders.map((u) => (
                  <div
                    key={u.id}
                    style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px", borderRadius: "8px", transition: "background 0.2s" }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "hsl(var(--border))")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", position: "relative" }}>
                      {u.avatar ? (
                        <img src={u.avatar} alt={u.name} style={{ height: "24px", width: "24px", borderRadius: "4px", border: "1px solid hsl(var(--border))" }} />
                      ) : (
                        <div style={{ height: "24px", width: "24px", borderRadius: "4px", background: "hsl(var(--primary))", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "10px", color: "#fff", fontWeight: 700 }}>
                          {u.name.charAt(0)}
                        </div>
                      )}
                      {u.status === "online" && (
                        <span style={{ position: "absolute", bottom: "-2px", right: "-2px", height: "8px", width: "8px", borderRadius: "50%", background: "#10b981", border: "1px solid #080c14" }} />
                      )}
                      <span style={{ fontSize: "14px", fontWeight: 600, color: "hsl(var(--foreground))" }}>{u.name}</span>
                    </div>
                    {u.role === "teacher" && (
                      <Badge variant="secondary" style={{ fontSize: "9px", height: "16px", padding: "0 4px", background: "rgba(124,58,237,0.15)", color: "hsl(var(--primary))", border: "none" }}>
                        Admin
                      </Badge>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Pinned Messages */}
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <h4 style={{ fontSize: "11px", fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.08em", display: "flex", alignItems: "center", gap: "8px", margin: 0 }}>
              <Pin style={{ height: "14px", width: "14px" }} /> Pinned ({pinnedMessages.length})
            </h4>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {pinnedMessages.length === 0 ? (
                <p style={{ fontSize: "12px", color: "hsl(var(--muted-foreground))", margin: 0 }}>No pinned messages.</p>
              ) : (
                pinnedMessages.map((msg) => (
                  <div key={msg.id} style={{ padding: "12px", borderRadius: "10px", border: "1px solid hsl(var(--border))", background: "hsl(var(--border))", fontSize: "14px" }}>
                    <p style={{ fontSize: "12px", color: "hsl(var(--muted-foreground))", margin: 0, display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                      {msg.content}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Recent Files */}
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <h4 style={{ fontSize: "11px", fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.08em", display: "flex", alignItems: "center", gap: "8px", margin: 0 }}>
              <FileText style={{ height: "14px", width: "14px" }} /> Recent Files
            </h4>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {recentFiles.length === 0 ? (
                <p style={{ fontSize: "12px", color: "hsl(var(--muted-foreground))", margin: 0 }}>No files shared yet.</p>
              ) : (
                recentFiles.map((file, i) => (
                  <a
                    key={i}
                    href={file.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      padding: "8px",
                      borderRadius: "10px",
                      border: "1px solid hsl(var(--border))",
                      background: "hsl(var(--border))",
                      textDecoration: "none",
                      transition: "border-color 0.2s",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.borderColor = "rgba(124,58,237,0.5)")}
                    onMouseLeave={(e) => (e.currentTarget.style.borderColor = "hsl(var(--border))")}
                  >
                    <div style={{ height: "32px", width: "32px", borderRadius: "4px", background: "rgba(124,58,237,0.1)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <FileText style={{ height: "16px", width: "16px", color: "hsl(var(--primary))" }} />
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
                      <span style={{ fontSize: "12px", fontWeight: 600, color: "hsl(var(--foreground))", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {file.name}
                      </span>
                      <span style={{ fontSize: "10px", color: "hsl(var(--muted-foreground))" }}>
                        {format(parseISO(file.timestamp), "MMM d")}
                      </span>
                    </div>
                  </a>
                ))
              )}
            </div>
          </div>

        </div>
      </motion.div>
    </AnimatePresence>
  );
}
