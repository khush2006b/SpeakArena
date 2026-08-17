"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Play, Video, FileText, Bookmark, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useStudentLayoutStore } from "@/stores/student-layout.store";

export function QuickActionBar() {
  const { isQuickActionBarVisible, setQuickActionBarVisible } = useStudentLayoutStore();

  return (
    <AnimatePresence>
      {isQuickActionBarVisible && (
        <motion.div
          initial={{ y: 100, opacity: 0, x: "-50%" }}
          animate={{ y: 0, opacity: 1, x: "-50%" }}
          exit={{ y: 100, opacity: 0, x: "-50%" }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          className="fixed bottom-6 left-1/2 z-50 flex items-center gap-2 rounded-full backdrop-blur-xl shadow-2xl p-2"
          style={{ background: "rgba(8,12,20,0.9)", border: "1px solid rgba(255,255,255,0.07)" }}
        >
          {/* Main Action */}
          <Button className="rounded-full rounded-r-none px-6 h-10 shadow-sm active:scale-95 transition-all"
                  style={{ background: "#4f46e5", color: "#fff", fontWeight: 700 }}>
            <Play className="mr-2 h-4 w-4 fill-current" />
            Resume 
          </Button>
          
          <div className="w-px h-6 mx-1" style={{ background: "rgba(255,255,255,0.1)" }} />
          
          {/* Secondary Actions */}
          <Button variant="ghost" size="icon" className="rounded-full h-10 w-10 hover:bg-white/5 transition-colors" style={{ color: "#9ca3af" }}>
            <Video className="h-5 w-5" />
          </Button>
          
          <Button variant="ghost" size="icon" className="rounded-full h-10 w-10 hover:bg-white/5 transition-colors" style={{ color: "#9ca3af" }}>
            <FileText className="h-5 w-5" />
          </Button>

          <Button variant="ghost" size="icon" className="rounded-full h-10 w-10 hover:bg-white/5 transition-colors" style={{ color: "#9ca3af" }}>
            <Bookmark className="h-5 w-5" />
          </Button>

          <div className="w-px h-6 mx-1" style={{ background: "rgba(255,255,255,0.1)" }} />

          {/* Dismiss */}
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => setQuickActionBarVisible(false)}
            className="rounded-full h-10 w-10 hover:bg-red-500/10 transition-colors shrink-0"
            style={{ color: "#6b7280" }}
          >
            <X className="h-4 w-4" />
          </Button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
