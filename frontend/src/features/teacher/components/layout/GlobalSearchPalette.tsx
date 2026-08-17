"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, MonitorPlay, User, X, Loader2 } from "lucide-react";
import { useUIStore } from "@/stores/ui.store";
import { apiClient } from "@/services/api/client";
import { useRouter } from "next/navigation";

export function GlobalSearchPalette() {
  const isOpen = useUIStore((state) => state.isSearchOpen);
  const setSearchOpen = useUIStore((state) => state.setSearchOpen);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  // Keyboard shortcut listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen(!isOpen);
      }
      if (e.key === "Escape" && isOpen) {
        setSearchOpen(false);
      }
    };
    
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, setSearchOpen]);

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      if (query.trim()) {
        fetchResults();
      } else {
        setResults([]);
      }
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [query]);

  const fetchResults = async () => {
    try {
      setLoading(true);
      const [coursesRes, studentsRes] = await Promise.all([
        apiClient.get("/api/v1/teacher/courses", { params: { search: query, page_size: 5 } }),
        apiClient.get("/api/v1/teacher/students", { params: { search: query, page_size: 5 } })
      ]);
      
      const courses = (coursesRes.data?.data || []).map((c: any) => ({ ...c, type: 'course', icon: MonitorPlay }));
      const students = (studentsRes.data?.data || []).map((s: any) => ({ ...s, type: 'student', icon: User }));
      
      setResults([...courses, ...students]);
    } catch (err) {
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = (result: any) => {
    setSearchOpen(false);
    if (result.type === "course") {
      router.push(`/teacher/courses/${result.id}`);
    } else if (result.type === "student") {
      router.push(`/teacher/students/${result.id}`);
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
            onClick={() => setSearchOpen(false)}
          />
          
          {/* Search Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -20 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            style={{
              position: "fixed",
              left: "50%",
              top: "15%",
              zIndex: 50,
              width: "100%",
              maxWidth: 672,
              transform: "translateX(-50%)",
              overflow: "hidden",
              borderRadius: 18,
              border: "1px solid hsl(var(--border))",
              background: "hsl(var(--card))",
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)"
            }}
          >
            <div style={{ display: "flex", alignItems: "center", borderBottom: "1px solid bg-white/5", padding: "12px 16px" }}>
              <Search style={{ height: 20, width: 20, color: "#6b7280", marginRight: 12 }} />
              <input
                autoFocus
                style={{
                  flex: 1,
                  background: "transparent",
                  border: "none",
                  outline: "none",
                  color: "hsl(var(--foreground))",
                  fontSize: 18,
                }}
                placeholder="Search courses, students..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              {loading && <Loader2 className="animate-spin mr-3" style={{ height: 20, width: 20, color: "#a78bfa" }} />}
              <button 
                onClick={() => setSearchOpen(false)} 
                style={{ background: "transparent", border: "none", cursor: "pointer", color: "#6b7280" }}
              >
                <X style={{ height: 20, width: 20 }} />
              </button>
            </div>
            
            <div style={{ maxHeight: "60vh", overflowY: "auto", padding: 8 }}>
              {!query ? (
                <div style={{ padding: "56px 0", textAlign: "center", fontSize: 14, color: "#6b7280" }}>
                  Start typing to search...
                </div>
              ) : results.length > 0 ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <div style={{ padding: "6px 8px", fontSize: 12, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    Search Results
                  </div>
                  {results.map((result) => (
                    <button
                      key={`${result.type}-${result.id}`}
                      onClick={() => handleSelect(result)}
                      style={{
                        width: "100%",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 12,
                        borderRadius: 8,
                        padding: 12,
                        fontSize: 14,
                        color: "#e5e7eb",
                        background: "transparent",
                        border: "none",
                        textAlign: "left",
                        cursor: "pointer",
                        transition: "background 0.2s"
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = "rgba(124,58,237,0.12)"}
                      onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <result.icon style={{ height: 16, width: 16, color: "#a78bfa" }} />
                        <span>{result.title || result.name}</span>
                      </div>
                      <span style={{ fontSize: 12, color: "#6b7280", textTransform: "capitalize" }}>{result.type}</span>
                    </button>
                  ))}
                </div>
              ) : !loading ? (
                <div style={{ padding: "56px 0", textAlign: "center", fontSize: 14, color: "#6b7280" }}>
                  No results found for "{query}".
                </div>
              ) : null}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
