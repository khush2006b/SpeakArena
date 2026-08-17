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
  courseId: string;
}

export interface VerifyPaymentResponse {
  payment: Payment;
  enrolled: boolean;
}

// ---------------------------------------------------------------------------
// Service functions
// ---------------------------------------------------------------------------

export const paymentService = {
  /** GET /payments — payment history (paginated) */
  list: async (pagination?: PaginationConfig): Promise<PaginatedResponse<Payment>> => {
    const { data } = await apiClient.get<PaginatedResponse<Payment>>(
      ENDPOINTS.PAYMENTS.LIST,
      { params: pagination },
    );
    return data;
  },

  /** GET /payments/:id */
  detail: async (id: string): Promise<Payment> => {
    const { data } = await apiClient.get<APIResponse<Payment>>(
      ENDPOINTS.PAYMENTS.DETAIL(id),
    );
    return data.data;
  },

  /**
   * POST /payments/initiate
   * Creates a Razorpay order server-side and returns the order metadata
   * needed to open the Razorpay checkout modal on the client.
   */
  initiate: async (payload: InitiatePaymentPayload): Promise<InitiatePaymentResponse> => {
    const { data } = await apiClient.post<APIResponse<InitiatePaymentResponse>>(
      ENDPOINTS.PAYMENTS.INITIATE,
      payload,
    );
    return data.data;
  },

  /**
   * POST /payments/verify
   * Sends the Razorpay payment signature to the backend for HMAC validation.
   * Only after successful verification is enrollment created.
   */
  verify: async (payload: VerifyPaymentPayload): Promise<VerifyPaymentResponse> => {
    const { data } = await apiClient.post<APIResponse<VerifyPaymentResponse>>(
      ENDPOINTS.PAYMENTS.VERIFY,
      payload,
    );
    return data.data;
  },
};
