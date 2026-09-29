import { create } from "zustand";

export type PaymentStatus = "SUCCESS" | "PENDING" | "FAILED" | "REFUNDED" | "Success" | "Pending" | "Failed" | "Refunded" | "Cancelled" | "Processing";

export interface Transaction {
  id: string;
  studentName: string;
  studentAvatar?: string | null;
  studentEmail: string;
  courseName: string;
  amount: number;
  currency: string;
  paymentMethod?: string;
  status: string;
  date: string;
  createdAt?: string;
  invoiceId?: string | null;
  last4?: string | null;
  razorpay_order_id?: string;
  razorpay_payment_id?: string;
}

export interface FinanceState {
  dateRange: "today" | "week" | "month" | "year" | "all";
  currency: "INR" | "USD" | "EUR" | "GBP" | "ALL";
  searchQuery: string;
  statusFilter: string;
  activeTransaction: Transaction | null;

  setDateRange: (range: "today" | "week" | "month" | "year" | "all") => void;
  setCurrency: (currency: "INR" | "USD" | "EUR" | "GBP" | "ALL") => void;
  setSearchQuery: (query: string) => void;
  setStatusFilter: (status: string) => void;
  setActiveTransaction: (tx: Transaction | null) => void;
}

export const useFinanceStore = create<FinanceState>((set) => ({
  dateRange: "month",
  currency: "INR",
  searchQuery: "",
  statusFilter: "all",
  activeTransaction: null,

  setDateRange: (range) => set({ dateRange: range }),
  setCurrency: (currency) => set({ currency }),
  setSearchQuery: (query) => set({ searchQuery: query }),
  setStatusFilter: (status) => set({ statusFilter: status }),
  setActiveTransaction: (tx) => set({ activeTransaction: tx }),
}));
