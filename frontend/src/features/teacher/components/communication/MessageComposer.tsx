"use client";

import * as React from "react";
import { Smile, Paperclip, Send, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCommunicationStore } from "@/stores/communication.store";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export function MessageComposer() {
  const { replyingToId, setReplyingToId, sendMessage, isSending, messages } =
    useCommunicationStore();
  const [content, setContent] = React.useState("");
  const [isFocused, setIsFocused] = React.useState(false);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  // Find the message being replied to from real messages list
  const replyingToMessage = replyingToId
    ? messages.find((m) => m.id === replyingToId)
    : null;

  const handleSend = async () => {
    const trimmed = content.trim();
    if (!trimmed || isSending) return;
    setContent("");
    try {
      await sendMessage(trimmed, replyingToId);
    } catch {
      toast.error("Failed to send message. Please try again.");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Auto-resize textarea
  React.useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [content]);

  return (
    <div className="p-4 bg-background">
      <div
        className={cn(
          "relative rounded-xl bg-white/[0.02] transition-all flex flex-col",
          isFocused
            ? "border border-primary/50 shadow-[0_0_0_1px_rgba(var(--primary-rgb),0.3)]"
            : "border border-white/5 shadow-sm"
        )}
      >
        {/* Reply Context Bar */}
        {replyingToMessage && (
          <div className="flex items-center justify-between py-2 px-4 bg-white/[0.03] border-b border-white/5 rounded-t-xl text-sm">
            <div className="flex items-center gap-2 text-muted-foreground overflow-hidden">
              <span className="font-semibold text-foreground whitespace-nowrap">
                Replying to {replyingToMessage.user?.name ?? "System"}
              </span>
              <span className="overflow-hidden text-ellipsis whitespace-nowrap max-w-[300px]">
                {replyingToMessage.content}
              </span>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 rounded-full bg-transparent text-muted-foreground hover:text-foreground hover:bg-white/10 border-none transition-colors press-scale"
              onClick={() => setReplyingToId(null)}
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        )}

        {/* Input Area */}
        <textarea
          ref={textareaRef}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder="Send a message..."
          className="w-full min-h-[60px] max-h-[200px] resize-none bg-transparent p-4 text-[15px] text-foreground border-none outline-none placeholder:text-muted-foreground custom-scrollbar"
          rows={1}
          disabled={isSending}
        />

        {/* Toolbar */}
        <div className="flex items-center justify-between p-2">
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground shrink-0 rounded-full bg-transparent border-none hover:text-foreground hover:bg-white/5 transition-colors press-scale"
              onClick={() => toast.info("Attachments coming soon")}
            >
              <Paperclip className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground shrink-0 rounded-full bg-transparent border-none hover:text-foreground hover:bg-white/5 transition-colors press-scale"
              onClick={() => toast.info("Emoji picker coming soon")}
            >
              <Smile className="h-4 w-4" />
            </Button>
            <span className="text-[10px] text-muted-foreground ml-2 hidden sm:inline-block">
              <strong>*bold*</strong> <em>_italic_</em> `code`
            </span>
          </div>

          <Button
            size="sm"
            disabled={content.trim().length === 0 || isSending}
            onClick={handleSend}
            className="h-8 shadow-sm transition-all bg-primary text-primary-foreground font-semibold px-4 rounded-xl border-none press-scale disabled:opacity-50 hover:bg-primary/90"
          >
            {isSending ? (
              <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Send className="mr-2 h-3.5 w-3.5" />
            )}
            Send
          </Button>
        </div>
      </div>
      <div className="text-center mt-2">
        <span className="text-[10px] text-muted-foreground">
          <strong>ProTip:</strong> Press Enter to send, Shift+Enter for new line.
        </span>
      </div>
    </div>
  );
}
