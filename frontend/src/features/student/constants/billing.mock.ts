import { subDays, subMonths } from "date-fns";

export type TransactionStatus = "success" | "pending" | "failed" | "refunded" | "processing";

export interface Transaction {
  id: string;
  courseTitle: string;
  amount: number;
  currency: string;
  status: TransactionStatus;
  date: string; // ISO string
  paymentMethod: {
    type: "card" | "paypal" | "upi";
    last4?: string;
    brand?: "visa" | "mastercard" | "amex";
    email?: string; // for paypal
  };
  invoiceUrl: string;
  receiptUrl: string;
  details: {
    subtotal: number;
    tax: number;
    discount?: number;
    couponCode?: string;
    timeline: {
      status: TransactionStatus;
      date: string;
      description: string;
    }[];
  };
}

const now = new Date();

export const MOCK_TRANSACTIONS: Transaction[] = [
  {
    id: "txn_123456789",
    courseTitle: "React Architecture: Enterprise Scale",
    amount: 149.00,
    currency: "USD",
    status: "success",
    date: subDays(now, 2).toISOString(),
    paymentMethod: {
      type: "card",
      last4: "4242",
      brand: "visa"
    },
    invoiceUrl: "/invoices/inv_123456789.pdf",
    receiptUrl: "/receipts/rec_123456789.pdf",
    details: {
      subtotal: 149.00,
      tax: 0.00,
      discount: 50.00,
      couponCode: "REACT2024",
      timeline: [
        { status: "processing", date: subDays(now, 2).toISOString(), description: "Payment initiated" },
        { status: "success", date: subDays(now, 2).toISOString(), description: "Payment successful" }
      ]
    }
  },
  {
    id: "txn_987654321",
    courseTitle: "Advanced Data Structures in TypeScript",
    amount: 89.99,
    currency: "USD",
    status: "success",
    date: subMonths(now, 1).toISOString(),
    paymentMethod: {
      type: "card",
      last4: "5555",
      brand: "mastercard"
    },
    invoiceUrl: "/invoices/inv_987654321.pdf",
    receiptUrl: "/receipts/rec_987654321.pdf",
    details: {
      subtotal: 80.00,
      tax: 9.99,
      timeline: [
        { status: "success", date: subMonths(now, 1).toISOString(), description: "Payment successful" }
      ]
    }
  },
  {
    id: "txn_555555555",
    courseTitle: "System Design for Interviews",
    amount: 199.00,
    currency: "USD",
    status: "refunded",
    date: subMonths(now, 2).toISOString(),
    paymentMethod: {
      type: "paypal",
      email: "user@example.com"
    },
    invoiceUrl: "/invoices/inv_555555555.pdf",
    receiptUrl: "/receipts/rec_555555555.pdf",
    details: {
      subtotal: 199.00,
      tax: 0.00,
      timeline: [
        { status: "success", date: subMonths(now, 2).toISOString(), description: "Payment successful" },
        { status: "refunded", date: subDays(subMonths(now, 2), -3).toISOString(), description: "Refund issued to original payment method" }
      ]
    }
  },
  {
    id: "txn_777777777",
    courseTitle: "Next.js App Router Mastery",
    amount: 129.00,
    currency: "USD",
    status: "failed",
    date: subDays(now, 10).toISOString(),
    paymentMethod: {
      type: "card",
      last4: "0000",
      brand: "visa"
    },
    invoiceUrl: "#",
    receiptUrl: "#",
    details: {
      subtotal: 129.00,
      tax: 0.00,
      timeline: [
        { status: "processing", date: subDays(now, 10).toISOString(), description: "Payment initiated" },
        { status: "failed", date: subDays(now, 10).toISOString(), description: "Card declined by issuer" }
      ]
    }
  }
];

export const MOCK_BILLING_SUMMARY = {
  totalSpent: 238.99,
  activeCourses: 2,
  lifetimeValue: "High",
  recentPurchaseDate: subDays(now, 2).toISOString(),
};
