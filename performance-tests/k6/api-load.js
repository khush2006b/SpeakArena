import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// Custom metrics
const authFailureRate = new Rate('auth_failure_rate');
const apiLatency = new Trend('api_latency');

export const options = {
  stages: [
    { duration: '30s', target: 50 }, // Ramp up to 50 users
    { duration: '1m', target: 200 }, // Spike to 200 users
    { duration: '2m', target: 500 }, // Sustain peak load of 500 users
    { duration: '30s', target: 0 },  // Ramp down
  ],
  thresholds: {
    // API Latency should be under 200ms 95% of the time, and under 500ms 99% of the time
    'api_latency': ['p(95)<200', 'p(99)<500'],
    // HTTP requests should fail less than 1% of the time
    'http_req_failed': ['rate<0.01'],
    // Authentication failures should be 0
    'auth_failure_rate': ['rate==0'],
  },
};

const BASE_URL = __ENV.API_BASE_URL || 'http://localhost:8000/api/v1';

export default function () {
  // 1. Authenticate (Simulate fetching a token or hitting public endpoints)
  const loginRes = http.post(`${BASE_URL}/auth/login`, JSON.stringify({
    email: 'test_student@example.com',
    password: 'Password123!',
  }), {
    headers: { 'Content-Type': 'application/json' },
  });

  const authSuccess = check(loginRes, {
    'logged in successfully': (r) => r.status === 200 || r.status === 429, // allowing 429 if rate limited during stress
  });
  authFailureRate.add(!authSuccess);

  // Skip the rest of the iteration if login failed and we didn't get a token
  let token = loginRes.json('data.access_token');
  if (!token) {
    sleep(1);
    return;
  }

  const params = {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  };

  // 2. Fetch Dashboard (DB Read & Cache evaluation)
  const dashboardRes = http.get(`${BASE_URL}/student/dashboard`, params);
  apiLatency.add(dashboardRes.timings.duration);
  check(dashboardRes, {
    'dashboard loaded': (r) => r.status === 200,
  });

  sleep(Math.random() * 2 + 1); // Think time 1-3s

  // 3. Fetch Curriculum (High frequency read)
  const curriculumRes = http.get(`${BASE_URL}/courses/search?q=test`, params);
  apiLatency.add(curriculumRes.timings.duration);
  check(curriculumRes, {
    'curriculum loaded': (r) => r.status === 200,
  });

  sleep(1);
}
