"use client";

import * as React from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MessageSquare, AlertCircle, FileText, ArrowRight } from "lucide-react";

export function BillingSupport() {
  return (
    <div style={{ marginTop: '48px' }}>
      <h3 style={{ fontSize: '1.125rem', fontWeight: 800, color: '#fff', marginBottom: '24px', margin: '0 0 24px 0' }}>Support & Help</h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '24px' }}>
        
        <Card style={{ padding: '20px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 18, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', cursor: 'pointer', transition: 'background 0.2s' }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
              onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}>
          <div style={{ height: '40px', width: '40px', borderRadius: '50%', background: 'rgba(79,70,229,0.15)', color: '#818cf8', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '16px' }}>
            <MessageSquare size={20} />
          </div>
          <h4 style={{ fontSize: '0.875rem', fontWeight: 800, color: '#fff', marginBottom: '4px', margin: '0 0 4px 0' }}>Contact Support</h4>
          <p style={{ fontSize: '0.75rem', color: '#9ca3af', marginBottom: '16px', margin: '0 0 16px 0' }}>Chat with our billing team for payment inquiries.</p>
          <Button variant="link" style={{ padding: 0, height: 'auto', color: '#818cf8', marginTop: 'auto', display: 'flex', alignItems: 'center', fontWeight: 700 }}>
            Start Chat <ArrowRight size={12} style={{ marginLeft: '4px' }} />
          </Button>
        </Card>

        <Card style={{ padding: '20px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 18, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', cursor: 'pointer', transition: 'background 0.2s' }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
              onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}>
          <div style={{ height: '40px', width: '40px', borderRadius: '50%', background: 'rgba(239,68,68,0.15)', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '16px' }}>
            <AlertCircle size={20} />
          </div>
          <h4 style={{ fontSize: '0.875rem', fontWeight: 800, color: '#fff', marginBottom: '4px', margin: '0 0 4px 0' }}>Report an Issue</h4>
          <p style={{ fontSize: '0.75rem', color: '#9ca3af', marginBottom: '16px', margin: '0 0 16px 0' }}>Report failed payments or missing course access.</p>
          <Button variant="link" style={{ padding: 0, height: 'auto', color: '#ef4444', marginTop: 'auto', display: 'flex', alignItems: 'center', fontWeight: 700 }}>
            Open Ticket <ArrowRight size={12} style={{ marginLeft: '4px' }} />
          </Button>
        </Card>

        <Card style={{ padding: '20px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 18, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', cursor: 'pointer', transition: 'background 0.2s' }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
              onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}>
          <div style={{ height: '40px', width: '40px', borderRadius: '50%', background: 'rgba(96,165,250,0.15)', color: '#60a5fa', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '16px' }}>
            <FileText size={20} />
          </div>
          <h4 style={{ fontSize: '0.875rem', fontWeight: 800, color: '#fff', marginBottom: '4px', margin: '0 0 4px 0' }}>Refund Policy</h4>
          <p style={{ fontSize: '0.75rem', color: '#9ca3af', marginBottom: '16px', margin: '0 0 16px 0' }}>Read our 30-day money-back guarantee terms.</p>
          <Button variant="link" style={{ padding: 0, height: 'auto', color: '#60a5fa', marginTop: 'auto', display: 'flex', alignItems: 'center', fontWeight: 700 }}>
            Read Policy <ArrowRight size={12} style={{ marginLeft: '4px' }} />
          </Button>
        </Card>

      </div>
    </div>
  );
}
