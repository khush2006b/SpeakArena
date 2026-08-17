"use client";

import * as React from "react";
import { format, parseISO } from "date-fns";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { useBillingStore } from "@/stores/billing.store";
import { Download, Receipt, Clock, CheckCircle2, AlertCircle, RefreshCcw } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useCourseDetail } from "@/hooks/queries/useCourseQueries";

export function TransactionDrawer() {
  const { selectedTransaction: t, setSelectedTransaction } = useBillingStore();

  const { data: course } = useCourseDetail(t?.courseId || "");

  if (!t) return null;

  const StatusIcon = ({ status }: { status: string }) => {
    switch (status.toLowerCase()) {
      case "success": return <CheckCircle2 size={40} style={{ color: '#10b981', marginBottom: '16px' }} />;
      case "failed": return <AlertCircle size={40} style={{ color: '#ef4444', marginBottom: '16px' }} />;
      case "refunded": return <RefreshCcw size={40} style={{ color: '#9ca3af', marginBottom: '16px' }} />;
      default: return <Clock size={40} style={{ color: '#f59e0b', marginBottom: '16px' }} />;
    }
  };

  const amountDisplay = (t.amount / 100).toFixed(2);
  const statusLower = t.status.toLowerCase();

  return (
    <Sheet open={!!t} onOpenChange={(open) => !open && setSelectedTransaction(null)}>
      <SheetContent side="right" style={{ width: '100%', maxWidth: '448px', background: '#080c14', borderLeft: '1px solid rgba(255,255,255,0.07)', display: 'flex', flexDirection: 'column', padding: 0 }}>
        
        {/* Header Section */}
        <div style={{ padding: '24px', borderBottom: '1px solid rgba(255,255,255,0.04)', background: 'rgba(255,255,255,0.02)', flexShrink: 0, textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <StatusIcon status={statusLower} />
          <SheetHeader style={{ textAlign: 'center', width: '100%' }}>
            <SheetTitle style={{ fontSize: '1.875rem', fontWeight: 800, color: '#fff', margin: 0, fontFamily: 'monospace' }}>${amountDisplay}</SheetTitle>
            <SheetDescription style={{ fontSize: '0.875rem', fontWeight: 500, marginTop: '4px', textTransform: 'capitalize', color: '#9ca3af', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
              Payment {statusLower} &bull; {format(parseISO(t.createdAt), "MMM d, yyyy")}
            </SheetDescription>
          </SheetHeader>
        </div>

        <ScrollArea style={{ flex: 1 }}>
          <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '32px' }}>
            
            {/* Breakdowns */}
            <div>
              <h4 style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '16px', margin: '0 0 16px 0' }}>Transaction Details</h4>
              <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 18, padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem' }}>
                  <span style={{ color: '#9ca3af' }}>Course</span>
                  <span style={{ fontWeight: 500, color: '#fff', textAlign: 'right', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{course ? course.title : t.courseId}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem' }}>
                  <span style={{ color: '#9ca3af' }}>Subtotal</span>
                  <span style={{ fontWeight: 500, color: '#fff' }}>${amountDisplay}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem' }}>
                  <span style={{ color: '#9ca3af' }}>Tax</span>
                  <span style={{ fontWeight: 500, color: '#fff' }}>$0.00</span>
                </div>
                <div style={{ height: '1px', background: 'rgba(255,255,255,0.06)', width: '100%', margin: '8px 0' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: '1rem', color: '#fff' }}>
                  <span>Total</span>
                  <span>${amountDisplay} {t.currency.toUpperCase()}</span>
                </div>
              </div>
            </div>

            {/* Meta */}
            <div>
              <h4 style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '16px', margin: '0 0 16px 0' }}>Metadata</h4>
              <div style={{ fontSize: '0.75rem', fontFamily: 'monospace', color: '#9ca3af', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <p style={{ margin: 0 }}>Transaction ID: {t.id}</p>
                {t.razorpayOrderId && <p style={{ margin: 0 }}>Razorpay Order: {t.razorpayOrderId}</p>}
                {t.razorpayPaymentId && <p style={{ margin: 0 }}>Razorpay Payment: {t.razorpayPaymentId}</p>}
                <p style={{ margin: 0 }}>Method: {t.paymentMethod ? (t.paymentMethod.type.toUpperCase() + (t.paymentMethod.last4 ? ` **** ${t.paymentMethod.last4}` : "")) : "RAZORPAY"}</p>
              </div>
            </div>

          </div>
        </ScrollArea>

        {/* Footer Actions */}
        <div style={{ padding: '24px', borderTop: '1px solid rgba(255,255,255,0.04)', background: '#080c14', flexShrink: 0, display: 'flex', gap: '12px' }}>
          <Button 
            style={{ flex: 1, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', borderRadius: 10, fontWeight: 700, opacity: statusLower === "failed" ? 0.5 : 1 }} 
            variant="outline" 
            disabled={statusLower === "failed"}
          >
            <Receipt size={16} style={{ marginRight: '8px' }} /> View Receipt
          </Button>
          <Button 
            style={{ flex: 1, background: '#4f46e5', color: '#fff', borderRadius: 10, fontWeight: 700, border: 'none', opacity: statusLower === "failed" ? 0.5 : 1 }} 
            disabled={statusLower === "failed"}
          >
            <Download size={16} style={{ marginRight: '8px' }} /> Download Invoice
          </Button>
        </div>

      </SheetContent>
    </Sheet>
  );
}
