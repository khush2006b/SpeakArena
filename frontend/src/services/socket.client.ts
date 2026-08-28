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

import { getAccessToken, getValidAccessToken, setAccessToken, apiClient } from "@/services/api/interceptors";

function getWsUrlBase(): string {
  const socketUrl = process.env["NEXT_PUBLIC_SOCKET_URL"]?.trim();
  if (socketUrl && socketUrl.length > 0) {
    return socketUrl.replace(/^http/, "ws");
  }

  const apiUrl = process.env["NEXT_PUBLIC_API_URL"]?.trim();
  if (apiUrl && apiUrl.length > 0 && !apiUrl.includes("vercel.app")) {
    return apiUrl.replace(/^http/, "ws");
  }

  if (typeof window !== "undefined") {
    if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") {
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      return `${protocol}//${window.location.hostname}:8000`;
    }
  }

  return "wss://speakarena.onrender.com";
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

  public async connect() {
    this.isIntentionalDisconnect = false;
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    const token = await getValidAccessToken();
    if (token && this.url) {
      try {
        const urlObj = new URL(this.url);
        urlObj.searchParams.set("token", token);
        this.url = urlObj.toString();
      } catch {
        this.url = this.url.replace(/([?&]token=)[^&]*/, `$1${encodeURIComponent(token)}`);
      }
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

    this.ws.onclose = (event: CloseEvent) => {
      this.cleanup();

      // If closed due to token authentication failure (4001 / 1008)
      if (event?.code === 4001 || event?.code === 1008) {
        if (this.reconnectAttempts === 0) {
          this.reconnectAttempts = 1;
          apiClient.post("/api/v1/auth/refresh")
            .then((res) => {
              const newToken =
                res.data?.tokens?.accessToken ??
                res.data?.data?.access_token ??
                res.data?.access_token;
              if (newToken) {
                setAccessToken(newToken);
                this.reconnectAttempts = 0;
                this.connect();
              }
            })
            .catch(() => {
              console.warn("Session expired. WebSocket disconnected.");
            });
        }
        return;
      }

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
// Namespace: /chat — per-room WebSocket registry
//
// Each room gets its own independent WebSocket connection so that:
//   - Multiple rooms can be active simultaneously (e.g. Teacher Announcements
//     tab listens to ALL course announcement rooms at once).
//   - Switching channels does NOT disconnect the existing socket mid-flight.
//   - Each socket reconnects independently without disturbing others.
// ---------------------------------------------------------------------------

const chatSockets: Map<string, ReconnectingWebSocket> = new Map();

export function getChatSocket(roomId: string): ReconnectingWebSocket {
  if (!chatSockets.has(roomId)) {
    const token = getAccessToken();
    const tokenParam = token ? `?token=${encodeURIComponent(token)}` : "";
    const ws = new ReconnectingWebSocket(
      `${getWsUrlBase()}/api/v1/ws/chat/${roomId}${tokenParam}`
    );
    chatSockets.set(roomId, ws);
  }
  return chatSockets.get(roomId)!;
}

export function connectChatSocket(roomId: string): void {
  getChatSocket(roomId).connect();
}

export function disconnectChatSocket(roomId: string): void {
  const socket = chatSockets.get(roomId);
  if (socket) {
    socket.disconnect();
    chatSockets.delete(roomId);
  }
}

export function disconnectAllChatSockets(): void {
  chatSockets.forEach((socket) => socket.disconnect());
  chatSockets.clear();
}


// ---------------------------------------------------------------------------
// Namespace: /notifications — user-scoped live notification delivery
// ---------------------------------------------------------------------------

let notificationSocket: ReconnectingWebSocket | null = null;

export function getNotificationSocket(): ReconnectingWebSocket {
  if (!notificationSocket) {
    const token = getAccessToken();
    const tokenParam = token ? `?token=${encodeURIComponent(token)}` : "";
    notificationSocket = new ReconnectingWebSocket(
      `${getWsUrlBase()}/api/v1/ws/notifications${tokenParam}`
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
