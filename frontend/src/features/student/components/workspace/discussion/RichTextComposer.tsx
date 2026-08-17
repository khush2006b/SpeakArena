"use client";

import * as React from "react";
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { Bold, Italic, List, ListOrdered, Code, Quote, Send } from "lucide-react";
import { Button } from "@/components/ui/button";

interface RichTextComposerProps {
  onSubmit: (html: string) => void;
  placeholder?: string;
  isSubmitting?: boolean;
}

export function RichTextComposer({ onSubmit, placeholder = "Write a reply...", isSubmitting = false }: RichTextComposerProps) {
  
  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({
        placeholder,
        emptyEditorClass: 'is-editor-empty',
      }),
    ],
    content: '',
    editorProps: {
      attributes: {
        class: 'prose prose-sm dark:prose-invert max-w-none focus:outline-none min-h-[100px] px-4 py-3',
      },
    },
  });

  if (!editor) {
    return <div className="h-[150px] w-full bg-secondary/20 rounded-lg animate-pulse" />;
  }

  const handleSubmit = () => {
    if (editor.isEmpty) return;
    onSubmit(editor.getHTML());
    editor.commands.clearContent();
  };

  return (
    <div className="flex flex-col border border-border/50 rounded-lg bg-background overflow-hidden focus-within:border-primary/50 focus-within:ring-1 focus-within:ring-primary/50 transition-all shadow-sm">
      
      {/* Editor Surface */}
      <div className="flex-1 max-h-[300px] overflow-y-auto custom-scrollbar bg-background">
        <EditorContent editor={editor} />
      </div>

      {/* Toolbar & Actions */}
      <div className="flex items-center justify-between p-2 bg-secondary/30 border-t border-border/50">
        
        <div className="flex items-center gap-1">
          <Button
            variant="ghost" size="icon" className={`h-8 w-8 rounded ${editor.isActive('bold') ? 'bg-secondary text-foreground' : 'text-muted-foreground'}`}
            onClick={() => editor.chain().focus().toggleBold().run()}
          >
            <Bold className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost" size="icon" className={`h-8 w-8 rounded ${editor.isActive('italic') ? 'bg-secondary text-foreground' : 'text-muted-foreground'}`}
            onClick={() => editor.chain().focus().toggleItalic().run()}
          >
            <Italic className="h-4 w-4" />
          </Button>
          <div className="h-4 w-[1px] bg-border mx-1" />
          <Button
            variant="ghost" size="icon" className={`h-8 w-8 rounded ${editor.isActive('bulletList') ? 'bg-secondary text-foreground' : 'text-muted-foreground'}`}
            onClick={() => editor.chain().focus().toggleBulletList().run()}
          >
            <List className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost" size="icon" className={`h-8 w-8 rounded ${editor.isActive('orderedList') ? 'bg-secondary text-foreground' : 'text-muted-foreground'}`}
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
          >
            <ListOrdered className="h-4 w-4" />
          </Button>
          <div className="h-4 w-[1px] bg-border mx-1" />
          <Button
            variant="ghost" size="icon" className={`h-8 w-8 rounded ${editor.isActive('codeBlock') ? 'bg-secondary text-foreground' : 'text-muted-foreground'}`}
            onClick={() => editor.chain().focus().toggleCodeBlock().run()}
          >
            <Code className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost" size="icon" className={`h-8 w-8 rounded ${editor.isActive('blockquote') ? 'bg-secondary text-foreground' : 'text-muted-foreground'}`}
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
          >
            <Quote className="h-4 w-4" />
          </Button>
        </div>

        <Button 
          size="sm" 
          onClick={handleSubmit} 
          disabled={isSubmitting || editor.isEmpty}
          className="h-8 text-xs font-semibold"
        >
          {isSubmitting ? "Posting..." : (
            <>
              Reply <Send className="h-3 w-3 ml-1.5" />
            </>
          )}
        </Button>
      </div>

    </div>
  );
}
