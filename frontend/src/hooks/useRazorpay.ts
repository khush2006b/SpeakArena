/**
 * useRazorpay — Razorpay Checkout Integration Hook
 *
 * Dynamically loads the Razorpay SDK script and provides an
 * openCheckout() function that:
 *   1. Accepts the order metadata from useInitiatePayment
 *   2. Opens the native Razorpay checkout modal
 *   3. Returns a promise that resolves with payment data on success
 *      or rejects on failure/dismissal
 *
 * SDK is loaded lazily (only when openCheckout is called) to avoid
 * adding the Razorpay script to the initial bundle unconditionally.
 */

"use client";

import { useCallback } from "react";
import type { InitiatePaymentResponse } from "@/services/payment.service";

// Razorpay global type declaration
declare global {
  interface Window {
    Razorpay: new (options: RazorpayOptions) => RazorpayInstance;
  }
}

interface RazorpayOptions {
  key: string;
  amount: number;
  currency: string;
  order_id: string;
  name: string;
  description?: string;
  prefill?: { name?: string; email?: string };
  theme?: { color?: string };
  handler: (response: RazorpaySuccessResponse) => void;
  modal?: { ondismiss?: () => void };
}

interface RazorpayInstance {
  open: () => void;
  close: () => void;
}

export interface RazorpaySuccessResponse {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

function loadRazorpayScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.getElementById("razorpay-sdk")) {
      resolve();
      return;
    }
    const script = document.createElement("script");
    script.id = "razorpay-sdk";
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Razorpay SDK."));
    document.body.appendChild(script);
  });
}

export function useRazorpay() {
  const openCheckout = useCallback(
    (orderData: InitiatePaymentResponse): Promise<RazorpaySuccessResponse> => {
      return new Promise(async (resolve, reject) => {
        await loadRazorpayScript();

        const rzp = new window.Razorpay({
          key: orderData.keyId,
          amount: orderData.amount,
          currency: orderData.currency,
          order_id: orderData.orderId,
          name: "Speak Arena",
          description: orderData.courseName,
          prefill: {
            name: orderData.studentName,
            email: orderData.studentEmail,
          },
          theme: { color: "#6366f1" },
          handler: (response) => {
            resolve(response);
          },
          modal: {
            ondismiss: () => {
              reject(new Error("Payment cancelled by user."));
            },
          },
        });

        rzp.open();
      });
    },
    [],
  );

  return { openCheckout };
}
