"""Payment module for SpeakArena.

Implements the complete Razorpay payment lifecycle:

    1. Order Creation     : Student initiates checkout → Razorpay order created.
    2. Client Payment     : Frontend renders Razorpay checkout modal.
    3. Webhook Capture    : Razorpay POSTs payment.captured to our webhook endpoint.
    4. Signature Verify   : HMAC-SHA256 verification against RAZORPAY_WEBHOOK_SECRET.
    5. Enrollment Grant   : CourseEnrollment created; all content unlocked.
    6. Notification       : Student and teacher receive in-app notifications.
    7. Audit Log          : Immutable audit record written.

Architecture::

    router.py  →  service.py  →  repository.py  →  SQLAlchemy
                      │
                  RazorpayService  (Razorpay Python SDK)
                  WebhookService   (HMAC-SHA256 verification, idempotency)
                  EnrollmentService (CourseEnrollment creation)
                  RefundService    (Razorpay refund API)
                  InvoiceService   (invoice number generation)
                  AnalyticsService (revenue aggregation)

Security::

    - Webhook signature verified before ANY state mutation.
    - Idempotency: duplicate webhook events are detected by razorpay_order_id index.
    - Amount verified: captured amount must equal course.price × 100 (paise).
    - Order ownership: student_id on Payment must match JWT subject.
    - webhook_verified flag must be True before EnrollmentService runs.
    - Replay attack prevention: processed event IDs cached in Redis for 24 h.
"""
