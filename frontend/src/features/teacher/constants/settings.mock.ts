export const MOCK_SETTINGS = {
  general: {
    language: "en-US",
    timezone: "America/Los_Angeles",
    dateFormat: "MM/DD/YYYY",
    timeFormat: "12h",
    currencyDisplay: "USD",
    defaultLandingPage: "dashboard",
  },
  appearance: {
    theme: "system", // 'light', 'dark', 'system'
    mode: "comfortable", // 'compact', 'comfortable'
    animations: true,
  },
  notifications: {
    email: {
      studentEnrollment: true,
      payments: true,
      refunds: true,
      announcements: false,
      chat: true,
      uploads: true,
    },
    push: {
      studentEnrollment: false,
      payments: true,
      refunds: true,
      announcements: true,
      chat: true,
      meetingReminders: true,
    }
  },
  security: {
    twoFactorEnabled: false,
    activeSessions: [
      {
        id: "sess-1",
        device: "MacBook Pro M2",
        browser: "Chrome 120",
        location: "San Francisco, CA",
        ipAddress: "192.168.1.100",
        lastActive: "Active Now",
        isCurrent: true,
      },
      {
        id: "sess-2",
        device: "iPhone 15 Pro",
        browser: "Safari iOS",
        location: "San Francisco, CA",
        ipAddress: "192.168.1.102",
        lastActive: "2 hours ago",
        isCurrent: false,
      },
      {
        id: "sess-3",
        device: "Windows Desktop",
        browser: "Edge",
        location: "New York, NY",
        ipAddress: "10.0.0.45",
        lastActive: "3 days ago",
        isCurrent: false,
      }
    ]
  },
  integrations: [
    {
      id: "int-google-meet",
      name: "Google Meet",
      description: "Automatically generate meeting links for live classes.",
      icon: "Video",
      status: "connected",
      connectedAt: "2025-01-15T10:00:00Z"
    },
    {
      id: "int-cloudflare-r2",
      name: "Cloudflare R2",
      description: "Store and serve video assets with zero egress fees.",
      icon: "Cloud",
      status: "connected",
      connectedAt: "2025-02-01T14:30:00Z"
    },
    {
      id: "int-razorpay",
      name: "Razorpay",
      description: "Accept payments globally with automatic invoicing.",
      icon: "CreditCard",
      status: "disconnected"
    }
  ]
};
