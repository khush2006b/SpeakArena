"use client";

import * as React from "react";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bell, X, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { useUIStore } from "@/stores/ui.store";
import { apiClient } from "@/services/api/client";
import { toast } from "sonner";

export function NotificationDrawer() {
  const isOpen = useUIStore((state) => state.isNotificationDrawerOpen);
  const setOpen = useUIStore((state) => state.setNotificationDrawerOpen);

  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchNotifications();
    }
  }, [isOpen]);

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      setError(false);
      const res = await apiClient.get("/api/v1/notifications", { params: { page: 1, page_size: 20 } });
      setNotifications(res.data?.data || []);
    } catch (err) {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await apiClient.post("/api/v1/notifications/read-all");
      setNotifications(notifications.map(n => ({ ...n, isRead: true })));
      toast.success("All marked as read");
    } catch (err) {
      toast.error("Failed to mark all as read");
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 50,
              background: "rgba(8,12,20,0.8)",
              backdropFilter: "blur(4px)"
            }}
            onClick={() => setOpen(false)}
          />
          
          {/* Drawer */}
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            style={{
              position: "fixed",
              top: 0,
              bottom: 0,
              right: 0,
              zIndex: 50,
              width: "100%",
              maxWidth: 384,
              borderLeft: "1px solid hsl(var(--border))",
              background: "hsl(var(--background))",
              boxShadow: "-10px 0 30px rgba(0,0,0,0.5)",
              display: "flex",
              flexDirection: "column"
            }}
          >
            {/* Header */}
            <div style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              borderBottom: "1px solid bg-white/5",
              padding: "16px 24px"
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <Bell style={{ height: 20, width: 20, color: "hsl(var(--foreground))" }} />
                <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: "hsl(var(--foreground))", letterSpacing: "-0.01em" }}>Notifications</h2>
              </div>
              <button 
                onClick={() => setOpen(false)}
                style={{
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  color: "#6b7280",
                  padding: 4,
                  borderRadius: "50%",
                  transition: "background 0.2s"
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = "bg-white/5"}
                onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
              >
                <X style={{ height: 20, width: 20 }} />
              </button>
            </div>
            
            {/* Content Area */}
            <div style={{ flex: 1, overflowY: "auto", padding: 16, display: "flex", flexDirection: "column", gap: 16 }}>
              {loading ? (
                <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100%" }}>
                  <Loader2 className="animate-spin" style={{ height: 32, width: 32, color: "#a78bfa" }} />
                </div>
              ) : error ? (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: 16, color: "#ef4444" }}>
                  <AlertCircle style={{ height: 40, width: 40 }} />
                  <p style={{ margin: 0, fontSize: 14, fontWeight: 500 }}>Failed to load notifications</p>
                </div>
              ) : notifications.length > 0 ? (
                notifications.map((notif: any) => (
                  <div key={notif.id} style={{
                    borderRadius: 12,
                    border: "1px solid bg-white/5",
                    background: "hsl(var(--border))",
                    padding: 16,
                    cursor: "pointer",
                    transition: "all 0.2s"
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = "bg-white/5"}
                  onMouseLeave={(e) => e.currentTarget.style.background = "hsl(var(--border))"}
                  >
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                      {notif.type === "success" ? (
                        <CheckCircle2 style={{ height: 20, width: 20, color: "#10b981", marginTop: 2, flexShrink: 0 }} />
                      ) : notif.type === "alert" ? (
                        <AlertCircle style={{ height: 20, width: 20, color: "#f59e0b", marginTop: 2, flexShrink: 0 }} />
                      ) : (
                        <div style={{ height: 8, width: 8, borderRadius: "50%", background: "#a78bfa", marginTop: 8, flexShrink: 0 }} />
                      )}
                      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                        <span style={{ fontSize: 14, fontWeight: 700, color: "hsl(var(--foreground))" }}>{notif.title}</span>
                        <span style={{ fontSize: 13, color: "hsl(var(--muted-foreground))", lineHeight: 1.5 }}>{notif.message}</span>
                        <span style={{ fontSize: 10, color: "#6b7280", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", marginTop: 4 }}>{notif.time || notif.createdAt}</span>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: 16, color: "#6b7280" }}>
                  <Bell style={{ height: 40, width: 40, opacity: 0.2 }} />
                  <p style={{ margin: 0, fontSize: 14, fontWeight: 500 }}>You're all caught up!</p>
                </div>
              )}
            </div>
            
            {/* Footer */}
            <div style={{
              borderTop: "1px solid bg-white/5",
              padding: 16,
              background: "hsl(var(--border))"
            }}>
              <button 
                onClick={handleMarkAllRead}
                disabled={loading || notifications.length === 0}
                style={{
                  width: "100%",
                  background: "transparent",
                  border: "1px solid hsl(var(--border))",
                  color: "#e5e7eb",
                  padding: "10px 16px",
                  borderRadius: 8,
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: (loading || notifications.length === 0) ? "not-allowed" : "pointer",
                  opacity: (loading || notifications.length === 0) ? 0.5 : 1,
                  transition: "background 0.2s"
                }}
                onMouseEnter={(e) => !loading && notifications.length > 0 && (e.currentTarget.style.background = "bg-white/5")}
                onMouseLeave={(e) => !loading && notifications.length > 0 && (e.currentTarget.style.background = "transparent")}
              >
                Mark all as read
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
