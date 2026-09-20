/**
 * Payment Service — Integration Layer
 *
 * Handles the full Razorpay payment lifecycle:
 *   1. initiate() — creates a Razorpay Order on the backend
 *   2. verify()   — sends payment signature to backend for HMAC validation
 *
 * The Razorpay SDK is loaded dynamically (useRazorpay hook) to avoid
 * SSR issues and bloating the initial bundle.
 *
 * IMPORTANT: Never trust the client for payment verification.
 * The backend ALWAYS re-validates the Razorpay signature.
 */

import { apiClient } from "@/services/api/client";
import { ENDPOINTS } from "@/services/api/endpoints";
import type { Payment, PaginatedResponse, APIResponse, PaginationConfig } from "@/types";

export interface InitiatePaymentPayload {
  courseId: string;
}

export interface InitiatePaymentResponse {
  orderId: string;       // Razorpay Order ID
  amount: number;        // In paise (multiply by 100)
  currency: string;
  keyId: string;         // Razorpay public key
  courseName: string;
  studentEmail: string;
  studentName: string;
}

export interface VerifyPaymentPayload {
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
}

export interface VerifyPaymentResponse {
  paymentId?: string;
  courseId?: string;
  status?: string;
  message?: string;
}

// ---------------------------------------------------------------------------
// Service functions
// ---------------------------------------------------------------------------

export const paymentService = {
  /** GET /payments — payment history (paginated) */
  list: async (pagination?: PaginationConfig): Promise<PaginatedResponse<Payment>> => {
    const { data } = await apiClient.get<APIResponse<PaginatedResponse<Payment>>>(
      ENDPOINTS.PAYMENTS.BASE,
      { params: pagination },
    );
    return data.data;
  },

  /** GET /payments/:id — single payment detail */
  detail: async (id: string): Promise<Payment> => {
    const { data } = await apiClient.get<APIResponse<Payment>>(
      ENDPOINTS.PAYMENTS.DETAIL(id),
    );
    return data.data;
  },

  /**
   * POST /payments/create-order
   * Initiates a payment by creating a Razorpay order on the backend.
   * Returns order metadata needed by useRazorpay to open the checkout modal.
   */
  initiate: async (payload: InitiatePaymentPayload): Promise<InitiatePaymentResponse> => {
    const { data } = await apiClient.post<APIResponse<any>>(
      ENDPOINTS.PAYMENTS.CREATE_ORDER,
      { course_id: payload.courseId },
    );
    const raw = data.data;
    return {
      orderId: raw.razorpay_order_id ?? raw.order_id ?? raw.orderId,
      keyId: raw.razorpay_key_id ?? raw.key_id ?? raw.keyId,
      amount: raw.amount_paise ?? raw.amount,
      currency: raw.currency ?? "INR",
      courseName: raw.course_title ?? "",
      studentName: raw.student_name ?? "",
      studentEmail: raw.student_email ?? "",
    };
  },

  /**
   * POST /payments/verify
   * Sends the Razorpay payment signature to the backend for HMAC validation.
   * Only after successful verification is enrollment created.
   */
  verify: async (payload: VerifyPaymentPayload): Promise<VerifyPaymentResponse> => {
    const { data } = await apiClient.post<APIResponse<any>>(
      ENDPOINTS.PAYMENTS.VERIFY,
      {
        razorpay_order_id: payload.razorpayOrderId,
        razorpay_payment_id: payload.razorpayPaymentId,
        razorpay_signature: payload.razorpaySignature,
      },
    );
    const raw = data.data ?? {};
    return {
      paymentId: raw.payment_id ?? raw.paymentId ?? "",
      courseId: raw.course_id ?? raw.courseId ?? "",
      status: raw.status ?? "",
      message: raw.message ?? "",
    };
  },
};
