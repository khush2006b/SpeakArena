"use client";

import * as React from "react";
import { MessageSquare, AlertCircle, FileText, ArrowRight } from "lucide-react";

export function BillingSupport() {
  return (
    <div className="mt-12">
      <h3 className="text-lg font-extrabold text-foreground mb-6">Support &amp; Help</h3>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        
        <div className="card-glass p-6 rounded-2xl border border-border/50 bg-card/80 backdrop-blur-xl hover-lift cursor-pointer flex flex-col items-start group">
          <div className="h-10 w-10 rounded-xl bg-indigo-500/15 border border-indigo-500/25 text-indigo-400 flex items-center justify-center mb-4 shrink-0">
            <MessageSquare size={20} />
          </div>
          <h4 className="text-sm font-extrabold text-foreground mb-1">Contact Support</h4>
          <p className="text-xs text-muted-foreground mb-4 leading-relaxed">Chat with our billing team for payment inquiries.</p>
          <div className="mt-auto flex items-center gap-1.5 text-xs font-bold text-indigo-400 group-hover:translate-x-0.5 transition-transform">
            Start Chat <ArrowRight size={13} />
          </div>
        </div>

        <div className="card-glass p-6 rounded-2xl border border-border/50 bg-card/80 backdrop-blur-xl hover-lift cursor-pointer flex flex-col items-start group">
          <div className="h-10 w-10 rounded-xl bg-rose-500/15 border border-rose-500/25 text-rose-400 flex items-center justify-center mb-4 shrink-0">
            <AlertCircle size={20} />
          </div>
          <h4 className="text-sm font-extrabold text-foreground mb-1">Report an Issue</h4>
          <p className="text-xs text-muted-foreground mb-4 leading-relaxed">Report failed payments or missing course access.</p>
          <div className="mt-auto flex items-center gap-1.5 text-xs font-bold text-rose-400 group-hover:translate-x-0.5 transition-transform">
            Open Ticket <ArrowRight size={13} />
          </div>
        </div>

        <div className="card-glass p-6 rounded-2xl border border-border/50 bg-card/80 backdrop-blur-xl hover-lift cursor-pointer flex flex-col items-start group">
          <div className="h-10 w-10 rounded-xl bg-blue-500/15 border border-blue-500/25 text-blue-400 flex items-center justify-center mb-4 shrink-0">
            <FileText size={20} />
          </div>
          <h4 className="text-sm font-extrabold text-foreground mb-1">Refund Policy</h4>
          <p className="text-xs text-muted-foreground mb-4 leading-relaxed">Read our 30-day money-back guarantee terms.</p>
          <div className="mt-auto flex items-center gap-1.5 text-xs font-bold text-blue-400 group-hover:translate-x-0.5 transition-transform">
            Read Policy <ArrowRight size={13} />
          </div>
        </div>

      </div>
    </div>
  );
}
