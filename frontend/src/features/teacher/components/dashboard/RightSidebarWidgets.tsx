import * as React from "react";
import { Server, HardDrive, CheckCircle2 } from "lucide-react";

export function RightSidebarWidgets() {
  return (
    <div className="flex flex-col gap-6">
      {/* Pending Tasks */}
      <div className="card-glass hover-lift rounded-2xl bg-card border border-border overflow-hidden">
        <div className="p-4 sm:p-6 border-b border-border bg-muted/30">
          <h3 className="m-0 text-lg font-extrabold text-foreground flex items-center gap-2 tracking-tight">
            <CheckCircle2 className="h-4 w-4 text-[hsl(270,80%,60%)] drop-shadow-[0_0_8px_hsla(270,80%,60%,0.5)]" />
            Pending Tasks
          </h3>
        </div>
        <div className="p-4 sm:p-6">
          <div className="flex flex-col gap-3">
            {[
              { title: "Review 5 Assignments", course: "React Masterclass" },
              { title: "Upload Module 4 Video", course: "System Design" },
              { title: "Reply to Q&A thread", course: "Node.js Basics" },
            ].map((task, i) => (
              <div key={i} className="flex items-start gap-3 p-3 -mx-3 rounded-xl border border-transparent hover:border-border hover:bg-muted/20 transition-all cursor-pointer group">
                <input 
                  type="checkbox" 
                  className="mt-1 h-4 w-4 rounded border-border bg-border cursor-pointer accent-[hsl(270,80%,60%)] focus:ring-[hsl(270,80%,60%)]/50" 
                />
                <div className="flex flex-col gap-1">
                  <span className="text-sm font-semibold text-foreground tracking-tight group-hover:text-[hsl(270,80%,60%)] transition-colors">{task.title}</span>
                  <span className="text-xs text-muted-foreground font-medium">{task.course}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Storage & Server Status */}
      <div className="card-glass hover-lift rounded-2xl bg-card border border-border overflow-hidden">
        <div className="p-4 sm:p-6 border-b border-border bg-muted/30">
          <h3 className="m-0 text-lg font-extrabold text-foreground tracking-tight">
            System Status
          </h3>
        </div>
        <div className="p-4 sm:p-6 flex flex-col gap-6">
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2 text-foreground font-bold tracking-tight">
                <div className="p-1.5 rounded-lg bg-[hsla(217,91%,60%,0.15)] border border-[hsla(217,91%,60%,0.3)]">
                  <HardDrive className="h-3 w-3 text-blue-400" />
                </div>
                Storage
              </div>
              <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">45GB / 100GB</span>
            </div>
            <div className="h-1.5 w-full bg-border rounded-full overflow-hidden">
              <div className="h-full bg-blue-400 shadow-[0_0_10px_rgba(59,130,246,0.8)] rounded-full w-[45%]" />
            </div>
          </div>

          <div className="flex flex-col gap-3 pt-2">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2 text-foreground font-bold tracking-tight">
                <div className="p-1.5 rounded-lg bg-[hsla(160,84%,39%,0.15)] border border-[hsla(160,84%,39%,0.3)]">
                  <Server className="h-3 w-3 text-[#34d399]" />
                </div>
                Database
              </div>
              <span className="text-[#34d399] text-xs font-bold flex items-center gap-1.5 drop-shadow-[0_0_5px_rgba(52,211,153,0.5)]">
                <span className="h-1.5 w-1.5 rounded-full bg-[#10b981] shadow-[0_0_8px_rgba(16,185,129,0.8)] animate-pulse" />
                Healthy
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
