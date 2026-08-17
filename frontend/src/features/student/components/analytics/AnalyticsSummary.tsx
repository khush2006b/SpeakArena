"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { Clock, BookOpen, Flame, Award } from "lucide-react";
import { MOCK_SUMMARY } from "../../constants/analytics.mock";
import { Card } from "@/components/ui/card";

export function AnalyticsSummary() {
  const cards = [
    { title: "Hours Studied", value: MOCK_SUMMARY.hoursStudied, icon: <Clock style={{ height: '20px', width: '20px', color: '#4f46e5' }} />, suffix: "h" },
    { title: "Current Streak", value: MOCK_SUMMARY.currentStreak, icon: <Flame style={{ height: '20px', width: '20px', color: '#4f46e5' }} />, suffix: " days" },
    { title: "Lessons Completed", value: MOCK_SUMMARY.lessonsCompleted, icon: <BookOpen style={{ height: '20px', width: '20px', color: '#4f46e5' }} /> },
    { title: "Longest Streak", value: MOCK_SUMMARY.longestStreak, icon: <Award style={{ height: '20px', width: '20px', color: '#4f46e5' }} />, suffix: " days" },
  ];

  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.1 }
    }
  };

  const item = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } }
  };

  return (
    <motion.div 
      variants={container}
      initial="hidden"
      animate="show"
      style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}
    >
      {cards.map((card, i) => (
        <motion.div key={i} variants={item}>
          <Card style={{ padding: '16px', display: 'flex', flexDirection: 'column', height: '100%', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '18px', boxSizing: 'border-box' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#6b7280', marginBottom: '12px' }}>
              <div style={{ borderRadius: '10px', padding: '8px', background: 'rgba(79,70,229,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {card.icon}
              </div>
              <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{card.title}</span>
            </div>
            <div style={{ marginTop: 'auto' }}>
              <span style={{ fontSize: '28px', fontWeight: 800, color: '#fff' }}>
                {card.value}
              </span>
              {card.suffix && (
                <span style={{ fontSize: '14px', fontWeight: 500, color: '#9ca3af', marginLeft: '4px' }}>{card.suffix}</span>
              )}
            </div>
          </Card>
        </motion.div>
      ))}
    </motion.div>
  );
}
