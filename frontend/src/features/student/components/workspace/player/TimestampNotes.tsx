"use client";

import * as React from "react";
import { Plus, Edit2, Trash2, Clock, Check, X } from "lucide-react";
import { usePlayerStore } from "@/stores/player.store";
import { formatTime } from "@/lib/format-time";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export function TimestampNotes() {
  const { notes, addNote, deleteNote, updateNote, currentTime, setIsPlaying } = usePlayerStore();
  const [isComposing, setIsComposing] = React.useState(false);
  const [draftContent, setDraftContent] = React.useState("");
  const [editingId, setEditingId] = React.useState<string | null>(null);

  // Pause video when user starts typing a new note
  const handleStartComposing = () => {
    setIsComposing(true);
    setIsPlaying(false);
  };

  const handleSaveDraft = () => {
    if (draftContent.trim()) {
      addNote({ timestamp: currentTime, content: draftContent });
    }
    setIsComposing(false);
    setDraftContent("");
  };

  const handleSaveEdit = (id: string, content: string) => {
    updateNote(id, content);
    setEditingId(null);
  };

  return (
    <div className="flex flex-col h-full space-y-4">
      
      {!isComposing ? (
        <Button 
          onClick={handleStartComposing}
          className="w-full text-xs h-9 bg-primary/10 text-primary hover:bg-primary/20 border border-primary/20 shadow-none transition-all"
        >
          <Plus className="mr-1 h-3.5 w-3.5" />
          Take Note at {formatTime(currentTime)}
        </Button>
      ) : (
        <div className="bg-card border border-primary/40 rounded-lg p-3 space-y-3 animate-in fade-in zoom-in-95 duration-200">
          <div className="flex items-center gap-1.5 text-xs font-bold text-primary bg-primary/10 px-2 py-0.5 rounded w-fit">
            <Clock className="h-3 w-3" />
            {formatTime(currentTime)}
          </div>
          <Textarea 
            autoFocus
            value={draftContent}
            onChange={(e) => setDraftContent(e.target.value)}
            placeholder="Type your note here..."
            className="min-h-[80px] text-sm resize-none border-none focus-visible:ring-0 px-0 bg-transparent"
          />
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/50">
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setIsComposing(false)}>Cancel</Button>
            <Button size="sm" className="h-7 text-xs" onClick={handleSaveDraft}>Save Note</Button>
          </div>
        </div>
      )}

      <div className="space-y-3 flex-1 overflow-y-auto custom-scrollbar pb-10">
        {notes.length === 0 && !isComposing && (
          <div className="flex flex-col items-center justify-center py-10 text-center opacity-60">
            <Clock className="h-8 w-8 text-muted-foreground mb-2" />
            <p className="text-xs text-muted-foreground">No notes yet.<br/>Click above to add one.</p>
          </div>
        )}

        {notes.map((note) => (
          <div key={note.id} className="bg-card border border-border/50 rounded-lg p-3 group hover:border-primary/30 transition-colors">
            
            <div className="flex items-center justify-between mb-2">
              <button 
                onClick={() => {
                  // The actual video seek is handled by a listener or exposing a seek method.
                  // For now we mock it by logging or dispatching an event.
                  const event = new CustomEvent('seekTo', { detail: note.timestamp });
                  window.dispatchEvent(event);
                }}
                className="inline-flex items-center justify-center bg-primary/10 text-primary text-[10px] font-bold px-1.5 py-0.5 rounded hover:bg-primary/20 transition-colors"
              >
                {formatTime(note.timestamp)}
              </button>
              
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-primary" onClick={() => setEditingId(note.id)}>
                  <Edit2 className="h-3 w-3" />
                </Button>
                <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-destructive" onClick={() => deleteNote(note.id)}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </div>

            {editingId === note.id ? (
              <div className="space-y-2 mt-2">
                <Textarea 
                  autoFocus
                  defaultValue={note.content}
                  id={`edit-${note.id}`}
                  className="min-h-[60px] text-sm resize-none bg-background/50"
                />
                <div className="flex justify-end gap-2">
                  <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-destructive" onClick={() => setEditingId(null)}>
                    <X className="h-3 w-3" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-6 w-6 text-emerald-500 hover:text-emerald-400 hover:bg-emerald-500/10" onClick={() => {
                    const el = document.getElementById(`edit-${note.id}`) as HTMLTextAreaElement;
                    handleSaveEdit(note.id, el.value);
                  }}>
                    <Check className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ) : (
              <p className="text-sm text-foreground/90 leading-snug break-words">
                {note.content}
              </p>
            )}
            
          </div>
        ))}
      </div>
    </div>
  );
}
