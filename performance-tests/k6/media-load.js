import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend } from 'k6/metrics';

const mediaResolutionLatency = new Trend('media_resolution_latency');

export const options = {
  stages: [
    { duration: '30s', target: 50 },
    { duration: '1m', target: 200 },
    { duration: '30s', target: 0 },
  ],
  thresholds: {
    // Cloudflare R2 Presigned URLs should be generated extremely fast
    'media_resolution_latency': ['p(95)<100'], 
  },
};

const BASE_URL = __ENV.API_BASE_URL || 'http://localhost:8000/api/v1';

export default function () {
  // Simulate fetching a video or PDF access URL
  // This tests the backend's ability to communicate with AWS S3 / Cloudflare R2 SDK under load
  
  const token = 'mock-jwt-token'; // Replace with dynamic token generation if needed
  
  const payload = JSON.stringify({
    file_name: 'lecture.mp4',
    content_type: 'video/mp4'
  });

  const params = {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  };

  const res = http.post(`${BASE_URL}/chat/test-course/attachments/presign`, payload, params);
  
  mediaResolutionLatency.add(res.timings.duration);
  
  check(res, {
    'presigned URL generated': (r) => r.status === 200 && r.json('data.upload_url') !== undefined,
  });

  sleep(1);
}
