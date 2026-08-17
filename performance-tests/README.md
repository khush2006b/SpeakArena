# SpeakArena Performance Testing Suite

This directory contains the production-ready performance testing suite for SpeakArena, encompassing backend load testing, frontend core web vitals auditing, and real-world network emulation.

## 1. Load Testing (k6)

We use [k6](https://k6.io/) to simulate high-concurrency traffic against the backend APIs and WebSocket servers.

- **`api-load.js`**: Tests standard REST API endpoints (Auth, Dashboard, Course fetching). Asserts that latency remains under 200ms at the 95th percentile under 500 concurrent users.
- **`chat-stress.js`**: Tests Socket.IO realtime infrastructure by opening hundreds of concurrent WebSockets and blasting messages.
- **`media-load.js`**: Tests the latency of Cloudflare R2 presigned URL generation for video and PDF streaming.

**Running locally:**
```bash
# Install k6 (macOS: brew install k6)
k6 run k6/api-load.js
k6 run k6/chat-stress.js
```

## 2. Core Web Vitals (Lighthouse CI)

We use Lighthouse CI (`@lhci/cli`) to assert on Frontend Core Web Vitals (LCP, CLS, FID/INP).

- **`lighthouserc.json`**: Defines the target URLs and the strict performance budgets (e.g., LCP < 2.5s, CLS < 0.1).
- **`lighthouse-runner.js`**: A Node script that triggers the Lighthouse CI run against the local Next.js build.

**Running locally:**
```bash
cd lighthouse
npm install @lhci/cli
node lighthouse-runner.js
```

## 3. Network Emulation (WebPageTest)

We use WebPageTest API to run tests on physical devices globally over simulated 3G/4G networks to guarantee video and PDF loading performance for all users.

- **`wpt-config.json`**: Configuration specifying the location (Dulles), browser (Chrome), and network profile (3G), along with strict performance budgets (e.g., Speed Index < 2000).
- **`wpt-runner.js`**: A script that dispatches the test via the WebPageTest API and polls for the result.

**Running locally:**
```bash
cd webpagetest
npm install webpagetest
export WPT_API_KEY=your_api_key
export STAGING_URL=https://speakarena-staging.com
node wpt-runner.js
```
