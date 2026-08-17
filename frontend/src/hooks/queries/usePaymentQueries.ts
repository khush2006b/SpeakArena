/**
 * Payment Query Hooks — Razorpay Integration
 *
 * The useInitiatePayment + useVerifyPayment hooks orchestrate the full
 * Razorpay checkout lifecycle. Components only call these hooks —
 * they never interact with the Razorpay SDK directly.
 *
 * Flow:
 *   1. useInitiatePayment().mutate({ courseId })
 *      → Backend creates Razorpay Order, returns orderId + metadata
 *   2. Component opens Razorpay checkout modal with returned metadata
 *   3. On modal success, component calls useVerifyPayment().mutate(...)
 *      → Backend validates HMAC signature and creates Enrollment
 */

"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  paymentService,
  type InitiatePaymentPayload,
  type VerifyPaymentPayload,
} from "@/services/payment.service";
import { queryKeys } from "@/lib/queryKeys";
import type { PaginationConfig } from "@/types";

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export function usePaymentList(pagination?: PaginationConfig) {
  return useQuery({
    queryKey: queryKeys.payments.list(pagination as unknown as Record<string, unknown>),
    queryFn: () => paymentService.list(pagination),
  });
}

export function usePaymentDetail(id: string) {
  return useQuery({
    queryKey: queryKeys.payments.detail(id),
    queryFn: () => paymentService.detail(id),
    enabled: !!id,
  });
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

/**
 * Step 1: Create Razorpay Order server-side.
 * Returns the orderId and metadata needed to open the checkout modal.
 */
export function useInitiatePayment() {
  return useMutation({
    mutationFn: (payload: InitiatePaymentPayload) =>
      paymentService.initiate(payload),
  });
}

/**
 * Step 2: Verify Razorpay payment signature server-side.
 * On success, the student is now enrolled in the course.
 * Invalidates payment history and course enrollment caches.
 */
export function useVerifyPayment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: VerifyPaymentPayload) =>
      paymentService.verify(payload),
    onSuccess: (data) => {
      // Invalidate payments list and course progress caches
      queryClient.invalidateQueries({ queryKey: queryKeys.payments.all() });
      queryClient.invalidateQueries({
        queryKey: queryKeys.courses.progress(data.payment.courseId),
      });
      // Refresh the enrolled courses list
      queryClient.invalidateQueries({ queryKey: queryKeys.courses.all() });
    },
  });
}
