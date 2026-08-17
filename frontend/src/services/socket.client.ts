/**
 * Native WebSocket Client — Real-time Integration
 *
 * A singleton WebSocket client instance used for:
 *   - Real-time chat (meeting rooms)
 *   - Live notification delivery
 *   - Typing indicators
 *   - User presence
 *
 * Architecture decisions:
 *   - Auth: Access token is passed in the FIRST message payload ("auth" frame).
 *   - Reconnection: Automatic with exponential backoff.
 *   - Namespaces: We use native WebSockets. /ws/chat/{roomId} for chat, and 
 *     /ws/notifications for notifications.
 *   - Memory safety: All event listeners are returned as cleanup
 *     functions from hooks.
 */

import { getAccessToken } from "@/services/api/interceptors";

function getWsUrlBase(): string {
  const socketUrl = process.env["NEXT_PUBLIC_SOCKET_URL"];
  if (socketUrl && socketUrl.trim()) {
    return socketUrl.replace(/^http/, "ws");
  }

  const apiUrl = process.env["NEXT_PUBLIC_API_URL"];
  if (apiUrl && apiUrl.trim()) {
    return apiUrl.replace(/^http/, "ws");
  }

  if (typeof window !== "undefined") {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const host =
      window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
        ? `${window.location.hostname}:8000`
        : window.location.host;
    return `${protocol}//${host}`;
  }

  return "ws://127.0.0.1:8000";
}

// ---------------------------------------------------------------------------
// Native WebSocket Wrapper
// ---------------------------------------------------------------------------

type EventHandler = (data: any) => void;

class ReconnectingWebSocket {
  private url: string;
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private reconnectDelay = 1000;
  private maxReconnectDelay = 10000;
  private isIntentionalDisconnect = false;
  private pingIntervalId: NodeJS.Timeout | undefined;
  
  private listeners: Map<string, Set<EventHandler>> = new Map();

  constructor(url: string) {
    this.url = url;
  }

  public connect() {
    this.isIntentionalDisconnect = false;
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    try {
      this.ws = new WebSocket(this.url);
    } catch (err) {
      console.warn("Failed to create WebSocket instance:", err);
      this.attemptReconnect();
      return;
    }

    this.ws.onopen = () => {
      this.reconnectAttempts = 0;
      
      // 1. Send auth frame
      this.sendRaw({
        type: "auth",
        payload: { token: getAccessToken() },
      });

      // 2. Start ping interval (every 30s)
      this.pingIntervalId = setInterval(() => {
        this.sendRaw({ type: "ping", payload: {} });
      }, 30000);
    };

    this.ws.onmessage = (event) => {
      try {
        const frame = JSON.parse(event.data);
        const { type, payload } = frame;
        if (type) {
          this.emit(type, payload);
        }
      } catch (err) {
        console.warn("Failed to parse WS message", err);
      }
    };

    this.ws.onclose = () => {
      this.cleanup();
      if (!this.isIntentionalDisconnect) {
        this.attemptReconnect();
      }
    };

    this.ws.onerror = (err) => {
      console.warn("WebSocket connection status:", err);
    };
  }

  public disconnect() {
    this.isIntentionalDisconnect = true;
    this.cleanup();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  private cleanup() {
    if (this.pingIntervalId) {
      clearInterval(this.pingIntervalId);
      this.pingIntervalId = undefined;
    }
  }

  private attemptReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      const delay = Math.min(
        this.reconnectDelay * Math.pow(1.5, this.reconnectAttempts),
        this.maxReconnectDelay
      );
      this.reconnectAttempts++;
      setTimeout(() => this.connect(), delay);
    }
  }

  public send(type: string, payload: any = {}) {
    this.sendRaw({ type, payload });
  }

  private sendRaw(data: any) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }

  public on(type: string, handler: EventHandler) {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set());
    }
    this.listeners.get(type)!.add(handler);
  }

  public off(type: string, handler: EventHandler) {
    if (this.listeners.has(type)) {
      this.listeners.get(type)!.delete(handler);
    }
  }

  private emit(type: string, payload: any) {
    if (this.listeners.has(type)) {
      this.listeners.get(type)!.forEach((handler) => handler(payload));
    }
  }

  public get isConnected() {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }
}

// ---------------------------------------------------------------------------
// Namespace: /chat — meeting room real-time messaging
// ---------------------------------------------------------------------------

let chatSocket: ReconnectingWebSocket | null = null;
let currentChatRoomId: string | null = null;

export function getChatSocket(roomId: string): ReconnectingWebSocket {
  if (!chatSocket || currentChatRoomId !== roomId) {
    if (chatSocket) {
      chatSocket.disconnect();
    }
    chatSocket = new ReconnectingWebSocket(`${getWsUrlBase()}/api/v1/ws/chat/${roomId}`);
    currentChatRoomId = roomId;
  }
  return chatSocket;
}

export function connectChatSocket(roomId: string): void {
  const socket = getChatSocket(roomId);
  socket.connect();
}

export function disconnectChatSocket(roomId: string): void {
  if (chatSocket && currentChatRoomId === roomId) {
    chatSocket.disconnect();
    chatSocket = null;
    currentChatRoomId = null;
  }
}

// ---------------------------------------------------------------------------
// Namespace: /notifications — user-scoped live notification delivery
// ---------------------------------------------------------------------------

let notificationSocket: ReconnectingWebSocket | null = null;

export function getNotificationSocket(): ReconnectingWebSocket {
  if (!notificationSocket) {
    notificationSocket = new ReconnectingWebSocket(
      `${getWsUrlBase()}/api/v1/ws/notifications`
    );
  }
  return notificationSocket;
}

export function connectNotificationSocket(): void {
  getNotificationSocket().connect();
}

export function disconnectNotificationSocket(): void {
  if (notificationSocket) {
    notificationSocket.disconnect();
    notificationSocket = null;
  }
}

// ---------------------------------------------------------------------------
// Chat event helpers — emit actions from service layer, not from components
// ---------------------------------------------------------------------------

export const socketEvents = {
  chat: {
    SEND_MESSAGE: "message.send",
    MESSAGE_RECEIVED: "message.new",
    TYPING_START: "typing.start",
    TYPING_STOP: "typing.stop",
    USER_TYPING: "typing.update",
    USER_JOINED: "presence.update", // We'll infer joined/left from status
    MESSAGE_PINNED: "message.pinned",
  },
};

export function sendChatMessage(payload: {
  roomId: string;
  content: string;
  replyToId?: string;
  recipientId?: string;
}): void {
  const socket = getChatSocket(payload.roomId);
  socket.send(socketEvents.chat.SEND_MESSAGE, {
    content: payload.content,
    reply_to_id: payload.replyToId,
    ...(payload.recipientId ? { recipient_id: payload.recipientId } : {}),
  });
}

export function sendTypingStart(roomId: string): void {
  getChatSocket(roomId).send(socketEvents.chat.TYPING_START);
}

export function sendTypingStop(roomId: string): void {
  getChatSocket(roomId).send(socketEvents.chat.TYPING_STOP);
}
