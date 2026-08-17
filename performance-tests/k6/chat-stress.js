import ws from 'k6/ws';
import { check, sleep } from 'k6';
import { Trend, Counter } from 'k6/metrics';

const wsLatency = new Trend('ws_latency');
const messagesSent = new Counter('messages_sent');

export const options = {
  scenarios: {
    chat_stress: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 200 }, // Connect 200 users fast
        { duration: '2m', target: 500 },  // Push to 500 concurrent WebSocket connections
        { duration: '30s', target: 0 },   // Disconnect
      ],
      gracefulRampDown: '10s',
    },
  },
};

const WS_URL = __ENV.WS_BASE_URL || 'ws://localhost:8000/api/v1/ws/chat';

export default function () {
  const courseId = 'test-course-id'; // In a real scenario, fetch this dynamically
  const token = 'mock-jwt-token'; // Pre-generated or passed via env for simplicity

  const res = ws.connect(`${WS_URL}/${courseId}?token=${token}`, {}, function (socket) {
    socket.on('open', () => {
      // Send a message every 2-5 seconds
      socket.setInterval(() => {
        const start = Date.now();
        socket.send(JSON.stringify({
          action: 'send_message',
          content: 'Hello from k6 load tester!',
        }));
        wsLatency.add(Date.now() - start);
        messagesSent.add(1);
      }, Math.random() * 3000 + 2000);
    });

    socket.on('message', (msg) => {
      // Verify we receive echoes or broadcasts
      check(msg, { 'received message': (m) => m.includes('content') });
    });

    socket.on('error', (e) => {
      if (e.error() != 'websocket: close sent') {
        console.error('An unexpected error occurred: ', e.error());
      }
    });

    socket.setTimeout(function () {
      socket.close();
    }, 60000); // Stay connected for 60 seconds
  });

  check(res, { 'status is 101': (r) => r && r.status === 101 });
}
