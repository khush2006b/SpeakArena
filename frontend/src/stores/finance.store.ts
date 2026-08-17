import { create } from "zustand";

export type PaymentStatus = "Success" | "Pending" | "Failed" | "Refunded" | "Cancelled" | "Processing";

export interface Transaction {
  id: string;
  studentName: string;
  studentAvatar: string;
  studentEmail: string;
  courseName: string;
  amount: number;
  currency: string;
  paymentMethod: "Card" | "PayPal" | "Bank Transfer";
  status: PaymentStatus;
  date: string;
  invoiceId?: string;
  last4?: string;
}

export interface FinanceState {
  dateRange: "today" | "week" | "month" | "year" | "all";
  currency: "USD" | "EUR" | "GBP";
  activeTransaction: Transaction | null;
  
  setDateRange: (range: "today" | "week" | "month" | "year" | "all") => void;
  setCurrency: (currency: "USD" | "EUR" | "GBP") => void;
  setActiveTransaction: (tx: Transaction | null) => void;
}

export const useFinanceStore = create<FinanceState>((set) => ({
  dateRange: "month",
  currency: "USD",
  activeTransaction: null,

  setDateRange: (range) => set({ dateRange: range }),
  setCurrency: (currency) => set({ currency }),
  setActiveTransaction: (tx) => set({ activeTransaction: tx }),
}));
