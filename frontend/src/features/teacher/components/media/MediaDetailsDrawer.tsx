"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  X, 
  FileText, 
  Video, 
  Image as ImageIcon,
  Calendar,
  HardDrive,
  Clock,
  Link as LinkIcon,
  RefreshCw,
  Trash2,
  FolderOpen
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useMediaStore } from "@/stores/media.store";
import { cn } from "@/lib/utils";

function formatBytes(bytes: number, decimals = 2) {
  if (!+bytes) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

export function MediaDetailsDrawer() {
  const { activeFile, setActiveFile } = useMediaStore();

  return (
    <AnimatePresence>
      {activeFile && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-background/80 backdrop-blur-xl z-50"
            onClick={() => setActiveFile(null)}
          />

          {/* Drawer */}
          <motion.div
            initial={{ x: "100%", boxShadow: "none" }}
            animate={{ x: 0, boxShadow: "-20px 0 40px rgba(0,0,0,0.5)" }}
            exit={{ x: "100%", boxShadow: "none" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="fixed inset-y-0 right-0 w-full sm:w-[450px] bg-background/95 backdrop-blur-3xl border-l border-white/10 z-50 flex flex-col overflow-hidden shadow-2xl elevation-2"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-white/10 bg-white/[0.02]">
              <h2 className="text-sm font-bold tracking-widest uppercase text-foreground">File Details</h2>
              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full hover:bg-white/10 transition-colors press-scale" onClick={() => setActiveFile(null)}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-8 hide-scrollbar">
              {/* Preview Area */}
              <div className="relative aspect-video w-full rounded-2xl overflow-hidden bg-white/5 flex items-center justify-center shadow-[inset_0_1px_1px_hsl(var(--border))] border border-white/10 group">
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-10 pointer-events-none" />
                {activeFile.thumbnail ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={activeFile.thumbnail} alt={activeFile.filename} className="object-cover w-full h-full transition-transform duration-700 group-hover:scale-105" />
                ) : (
                  <div className="flex flex-col items-center justify-center text-muted-foreground/50 transition-transform duration-500 group-hover:scale-110">
                    {activeFile.type === "video" && <Video className="h-12 w-12 mb-3 drop-shadow-[0_0_8px_rgba(96,165,250,0.3)] text-blue-400" />}
                    {activeFile.type === "pdf" && <FileText className="h-12 w-12 mb-3 drop-shadow-[0_0_8px_rgba(251,146,60,0.3)] text-orange-400" />}
                    {activeFile.type === "image" && <ImageIcon className="h-12 w-12 mb-3 drop-shadow-[0_0_8px_rgba(52,211,153,0.3)] text-emerald-400" />}
                  </div>
                )}
                <Badge className="absolute top-3 left-3 bg-background/80 backdrop-blur-md text-foreground border-white/20 uppercase tracking-widest text-[10px] font-bold shadow-md z-20">
                  {activeFile.type}
                </Badge>
              </div>

              {/* Title & Status */}
              <div>
                <h3 className="text-2xl font-extrabold text-foreground break-words leading-tight tracking-tight">{activeFile.filename}</h3>
                <div className="flex items-center gap-3 mt-4">
                  <Badge
                    variant="outline"
                    className={cn(
                      "font-bold tracking-widest text-[10px] uppercase px-3 py-1",
                      activeFile.status === "Ready" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30 shadow-[0_0_15px_rgba(52,211,153,0.15)]" :
                      activeFile.status === "Processing" ? "bg-blue-500/10 text-blue-400 border-blue-500/30 shadow-[0_0_15px_rgba(96,165,250,0.15)]" :
                      "bg-red-500/10 text-red-400 border-red-500/30 shadow-[0_0_15px_rgba(248,113,113,0.3)] animate-pulse"
                    )}
                  >
                    {activeFile.status}
                  </Badge>
                  <Badge variant="outline" className="bg-white/5 border-white/10 text-muted-foreground font-bold tracking-widest text-[10px] uppercase px-3 py-1">
                    {activeFile.visibility}
                  </Badge>
                </div>
              </div>

              {/* Metadata Grid */}
              <div className="space-y-5">
                <h4 className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest border-b border-white/10 pb-3 flex items-center gap-2">
                  <HardDrive className="h-3.5 w-3.5" />
                  Properties
                </h4>
                
                <div className="grid grid-cols-2 gap-x-6 gap-y-5">
                  <div className="space-y-1.5 p-3 rounded-xl bg-white/[0.02] border border-white/5 transition-colors hover:bg-white/[0.04]">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <HardDrive className="h-4 w-4 text-primary" />
                      <span className="text-xs font-bold tracking-wide uppercase opacity-70">Size</span>
                    </div>
                    <p className="text-sm font-bold text-foreground pl-6">{formatBytes(activeFile.size)}</p>
                  </div>
                  
                  <div className="space-y-1.5 p-3 rounded-xl bg-white/[0.02] border border-white/5 transition-colors hover:bg-white/[0.04]">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Calendar className="h-4 w-4 text-primary" />
                      <span className="text-xs font-bold tracking-wide uppercase opacity-70">Uploaded</span>
                    </div>
                    <p className="text-sm font-bold text-foreground pl-6">{activeFile.createdAt}</p>
                  </div>

                  {activeFile.duration && (
                    <div className="space-y-1.5 p-3 rounded-xl bg-white/[0.02] border border-white/5 transition-colors hover:bg-white/[0.04]">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Clock className="h-4 w-4 text-primary" />
                        <span className="text-xs font-bold tracking-wide uppercase opacity-70">Duration</span>
                      </div>
                      <p className="text-sm font-bold text-foreground pl-6">{activeFile.duration}</p>
                    </div>
                  )}

                  {activeFile.pages && (
                    <div className="space-y-1.5 p-3 rounded-xl bg-white/[0.02] border border-white/5 transition-colors hover:bg-white/[0.04]">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <FileText className="h-4 w-4 text-primary" />
                        <span className="text-xs font-bold tracking-wide uppercase opacity-70">Pages</span>
                      </div>
                      <p className="text-sm font-bold text-foreground pl-6">{activeFile.pages}</p>
                    </div>
                  )}
                  
                  {activeFile.resolution && (
                    <div className="space-y-1.5 p-3 rounded-xl bg-white/[0.02] border border-white/5 transition-colors hover:bg-white/[0.04]">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Video className="h-4 w-4 text-primary" />
                        <span className="text-xs font-bold tracking-wide uppercase opacity-70">Resolution</span>
                      </div>
                      <p className="text-sm font-bold text-foreground pl-6">{activeFile.resolution}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Course Usage */}
              <div className="space-y-5">
                <h4 className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest border-b border-white/10 pb-3 flex items-center gap-2">
                  <LinkIcon className="h-3.5 w-3.5" />
                  Course Associations
                </h4>
                
                {activeFile.usageCount > 0 ? (
                  <div className="space-y-3">
                    <div className="p-4 rounded-xl border border-white/10 bg-primary/5 flex items-center justify-between transition-colors hover:bg-primary/10 group">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-lg bg-primary/20 flex items-center justify-center shadow-[inset_0_1px_1px_hsl(var(--border))] group-hover:scale-105 transition-transform">
                          <LinkIcon className="h-4 w-4 text-primary drop-shadow-[0_0_8px_rgba(var(--primary-rgb),0.5)]" />
                        </div>
                        <span className="text-sm font-bold text-foreground">System Design Masterclass</span>
                      </div>
                      <Button variant="link" className="text-xs font-bold text-primary px-0 h-auto opacity-0 group-hover:opacity-100 transition-opacity press-scale">View</Button>
                    </div>
                    <Button variant="outline" className="w-full h-11 text-xs font-bold tracking-wide border-dashed border-white/20 bg-transparent hover:bg-white/5 hover:border-white/30 transition-all rounded-xl press-scale">
                      <FolderOpen className="h-4 w-4 mr-2" />
                      Assign to another course
                    </Button>
                  </div>
                ) : (
                  <div className="p-6 rounded-xl border border-white/5 bg-white/[0.02] flex flex-col items-center justify-center text-center">
                    <span className="text-sm font-bold text-muted-foreground mb-3">Not used in any courses</span>
                    <Button variant="outline" className="text-xs font-bold px-4 h-9 rounded-lg border-white/10 bg-white/5 hover:bg-white/10 press-scale">Assign to Course</Button>
                  </div>
                )}
              </div>
            </div>

            <div className="p-5 border-t border-white/10 bg-white/[0.02] flex items-center gap-3">
              <Button variant="outline" className="flex-1 rounded-xl h-12 font-bold tracking-wide border-white/10 bg-white/5 hover:bg-white/10 shadow-sm transition-all press-scale">
                <RefreshCw className="mr-2 h-4 w-4" />
                Replace File
              </Button>
              <Button variant="outline" className="flex-1 rounded-xl h-12 font-bold tracking-wide text-red-400 hover:bg-red-500/10 hover:text-red-400 border-red-500/20 shadow-[0_0_15px_rgba(248,113,113,0.1)] transition-all press-scale">
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </Button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
