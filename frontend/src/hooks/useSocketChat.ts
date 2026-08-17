/**
 * useSocket — Real-time Chat Integration Hook
 *
 * Manages the full lifecycle of a Socket.IO chat room connection:
 *   - Connects to /chat namespace on mount
 *   - Joins the given roomId
 *   - Subscribes to message, typing, and presence events
 *   - Writes incoming messages directly into the TanStack Query cache
 *     (optimistic — no re-fetch needed for real-time messages)
 *   - Cleans up all listeners and disconnects on unmount
 *
 * IMPORTANT: This hook should be mounted ONCE per room — typically
 * inside the ChatContainer component of the Learning Workspace.
 */

"use client";

import { useEffect, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  connectChatSocket,
  disconnectChatSocket,
  getChatSocket,
  sendChatMessage,
  sendTypingStart,
  sendTypingStop,
  socketEvents,
} from "@/services/socket.client";
import { queryKeys } from "@/lib/queryKeys";
import type { ChatMessage, TypingUser } from "@/types";

interface UseSocketChatOptions {
  roomId: string;
  onTypingUpdate?: (users: TypingUser[]) => void;
  onUserJoined?: (userId: string) => void;
  onUserLeft?: (userId: string) => void;
}

export function useSocketChat({
  roomId,
  onTypingUpdate,
  onUserJoined,
  onUserLeft,
}: UseSocketChatOptions) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!roomId) return;

    connectChatSocket(roomId);
    const socket = getChatSocket(roomId);

    // New message — inject directly into TanStack Query cache
    const handleMessage = (data: { message: ChatMessage }) => {
      queryClient.setQueryData<ChatMessage[]>(
        queryKeys.chat.messages(roomId),
        (prev) => (prev ? [...prev, data.message] : [data.message]),
      );
    };

    const handleTyping = (data: { room_id: string, typing: string[] }) => {
      // Map user IDs to TypingUser objects (mocking username for now or fetching from query cache)
      const users: TypingUser[] = data.typing.map(id => ({ userId: id, userName: "Someone", roomId }));
      onTypingUpdate?.(users);
    };

    const handlePresence = (data: { user_id: string, status: string }) => {
      if (data.status === "online") {
        onUserJoined?.(data.user_id);
      } else {
        onUserLeft?.(data.user_id);
      }
    };

    socket.on(socketEvents.chat.MESSAGE_RECEIVED, handleMessage);
    socket.on(socketEvents.chat.USER_TYPING, handleTyping);
    socket.on(socketEvents.chat.USER_JOINED, handlePresence);

    return () => {
      socket.off(socketEvents.chat.MESSAGE_RECEIVED, handleMessage);
      socket.off(socketEvents.chat.USER_TYPING, handleTyping);
      socket.off(socketEvents.chat.USER_JOINED, handlePresence);
      disconnectChatSocket(roomId);
    };
  }, [roomId, queryClient, onTypingUpdate, onUserJoined, onUserLeft]);

  const send = useCallback(
    (content: string, replyToId?: string) => {
      sendChatMessage({ roomId, content, ...(replyToId ? { replyToId } : {}) });
    },
    [roomId],
  );

  const startTyping = useCallback(() => sendTypingStart(roomId), [roomId]);
  const stopTyping = useCallback(() => sendTypingStop(roomId), [roomId]);

  return { send, startTyping, stopTyping };
}
