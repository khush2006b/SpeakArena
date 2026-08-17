"use client";

import * as React from "react";
import { Card } from "@/components/ui/card";
import { MOCK_INSIGHTS } from "../../constants/analytics.mock";
import { Sparkles, TrendingUp, Info } from "lucide-react";
import { motion } from "framer-motion";

export function PersonalInsights() {
  const getIcon = (type: string) => {
    switch (type) {
      case "positive": return <TrendingUp style={{ height: '16px', width: '16px', color: '#10b981' }} />;
      case "neutral": return <Info style={{ height: '16px', width: '16px', color: '#60a5fa' }} />;
      default: return <Sparkles style={{ height: '16px', width: '16px', color: '#4f46e5' }} />;
    }
  };

  const container = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.1 } }
  };

  const item = {
    hidden: { opacity: 0, x: -20 },
    show: { opacity: 1, x: 0, transition: { type: "spring", stiffness: 300, damping: 24 } }
  };

  return (
    <Card style={{ padding: '24px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '18px', display: 'flex', flexDirection: 'column', height: '100%', boxSizing: 'border-box' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '24px' }}>
        <Sparkles style={{ height: '16px', width: '16px', color: '#4f46e5' }} />
        <h3 style={{ fontSize: '11px', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.08em', margin: 0 }}>AI Insights</h3>
      </div>
      
      <motion.div 
        variants={container}
        initial="hidden"
        animate="show"
        style={{ display: 'flex', flexDirection: 'column', gap: '12px', flex: 1, justifyContent: 'center' }}
      >
        {MOCK_INSIGHTS.map((insight) => (
          <motion.div key={insight.id} variants={item}>
            <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)', borderRadius: '12px', padding: '16px', display: 'flex', alignItems: 'flex-start', gap: '12px', transition: 'border-color 0.2s ease' }}>
              <div style={{ marginTop: '2px', flexShrink: 0 }}>
                {getIcon(insight.type)}
              </div>
              <p style={{ fontSize: '14px', color: '#9ca3af', margin: 0, lineHeight: 1.6 }}>
                {insight.text}
              </p>
            </div>
          </motion.div>
        ))}
      </motion.div>
    </Card>
  );
}
