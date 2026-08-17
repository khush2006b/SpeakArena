"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { FileText, Highlighter, Plus, Trash2, Clock } from "lucide-react";
import { usePdfStore } from "@/stores/pdf.store";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export function PdfRightPanel() {
  const { 
    isRightPanelOpen, activeRightTab, setActiveRightTab, 
    notes, addNote, deleteNote, currentPage, setCurrentPage 
  } = usePdfStore();

  const [isComposing, setIsComposing] = React.useState(false);
  const [draftContent, setDraftContent] = React.useState("");
  const [draftColor, setDraftColor] = React.useState<"yellow" | "green" | "blue" | "pink">("yellow");

  if (!isRightPanelOpen) return null;

  const handleSaveDraft = () => {
    if (draftContent.trim()) {
      addNote({ pageNumber: currentPage, content: draftContent, color: draftColor });
    }
    setIsComposing(false);
    setDraftContent("");
  };

  const colors = [
    { value: "yellow", class: "bg-yellow-500/20 text-yellow-500 border-yellow-500/50" },
    { value: "green", class: "bg-emerald-500/20 text-emerald-500 border-emerald-500/50" },
    { value: "blue", class: "bg-blue-500/20 text-blue-500 border-blue-500/50" },
    { value: "pink", class: "bg-pink-500/20 text-pink-500 border-pink-500/50" },
  ];

  return (
    <motion.aside
      initial={{ width: 0, opacity: 0 }}
      animate={{ width: 340, opacity: 1 }}
      exit={{ width: 0, opacity: 0 }}
      transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
      className="h-full shrink-0 border-l border-border/40 bg-background/80 backdrop-blur-xl flex flex-col relative overflow-hidden z-10"
    >
      
      {/* Tabs */}
      <div className="flex items-center gap-1 p-2 border-b border-border/40 shrink-0">
        <Button 
          variant={activeRightTab === "notes" ? "secondary" : "ghost"} 
          size="sm" 
          className="flex-1 h-8 text-xs font-medium"
          onClick={() => setActiveRightTab("notes")}
        >
          <FileText className="h-3.5 w-3.5 mr-1.5" /> Notes
        </Button>
        <Button 
          variant={activeRightTab === "highlights" ? "secondary" : "ghost"} 
          size="sm" 
          className="flex-1 h-8 text-xs font-medium"
          onClick={() => setActiveRightTab("highlights")}
        >
          <Highlighter className="h-3.5 w-3.5 mr-1.5" /> Highlights
        </Button>
      </div>

      <ScrollArea className="flex-1 custom-scrollbar">
        <div className="p-3 space-y-4">
          
          {activeRightTab === "notes" && (
            <>
              {!isComposing ? (
                <Button 
                  onClick={() => setIsComposing(true)}
                  className="w-full text-xs h-9 bg-primary/10 text-primary hover:bg-primary/20 border border-primary/20 shadow-none transition-all"
                >
                  <Plus className="mr-1 h-3.5 w-3.5" />
                  Add Note to Page {currentPage}
                </Button>
              ) : (
                <div className="bg-card border border-primary/40 rounded-lg p-3 space-y-3 animate-in fade-in zoom-in-95 duration-200 shadow-lg">
                  <div className="flex items-center justify-between">
                    <div className="text-[10px] font-mono text-muted-foreground bg-background px-1.5 py-0.5 rounded border border-border/50">
                      Pg {currentPage}
                    </div>
                    {/* Color Picker */}
                    <div className="flex gap-1">
                      {colors.map(c => (
                        <button 
                          key={c.value} 
                          onClick={() => setDraftColor(c.value as any)}
                          className={`h-4 w-4 rounded-full border-2 transition-transform ${c.class.split(' ')[0]} ${draftColor === c.value ? 'scale-110 border-foreground/50' : 'border-transparent'}`} 
                        />
                      ))}
                    </div>
                  </div>
                  <Textarea 
                    autoFocus
                    value={draftContent}
                    onChange={(e) => setDraftContent(e.target.value)}
                    placeholder="Type your study note..."
                    className="min-h-[100px] text-sm resize-none border-none focus-visible:ring-0 px-0 bg-transparent"
                  />
                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/50">
                    <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setIsComposing(false)}>Cancel</Button>
                    <Button size="sm" className="h-7 text-xs" onClick={handleSaveDraft}>Save Note</Button>
                  </div>
                </div>
              )}

              {notes.length === 0 && !isComposing && (
                <div className="flex flex-col items-center justify-center py-10 text-center opacity-60">
                  <FileText className="h-8 w-8 text-muted-foreground mb-2" />
                  <p className="text-xs text-muted-foreground">Your study notebook is empty.<br/>Jot down ideas linked to pages.</p>
                </div>
              )}

              {notes.map((note) => {
                const colorObj = colors.find(c => c.value === note.color) || colors[0];
                return (
                  <div key={note.id} className={`bg-card border rounded-lg p-3 group transition-colors ${colorObj.class.replace('bg-', 'hover:bg-').replace('text-', '')}`}>
                    
                    <div className="flex items-center justify-between mb-2">
                      <button 
                        onClick={() => setCurrentPage(note.pageNumber)}
                        className={`inline-flex items-center justify-center text-[10px] font-mono font-bold px-1.5 py-0.5 rounded border ${colorObj.class}`}
                      >
                        Pg {note.pageNumber}
                      </button>
                      
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-destructive" onClick={() => deleteNote(note.id)}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>

                    <p className="text-sm text-foreground/90 leading-snug whitespace-pre-wrap">
                      {note.content}
                    </p>
                    
                    <div className="mt-2 text-[9px] text-muted-foreground flex items-center gap-1">
                      <Clock className="h-2.5 w-2.5" /> 
                      {new Date(note.timestamp).toLocaleDateString()}
                    </div>
                  </div>
                );
              })}
            </>
          )}

          {activeRightTab === "highlights" && (
            <div className="flex flex-col items-center justify-center py-10 text-center opacity-60 space-y-3">
              <Highlighter className="h-8 w-8 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">Select text in the PDF to create a highlight.</p>
              <span className="text-[10px] bg-secondary px-2 py-1 rounded">Feature arriving soon</span>
            </div>
          )}

        </div>
      </ScrollArea>
    </motion.aside>
  );
}
