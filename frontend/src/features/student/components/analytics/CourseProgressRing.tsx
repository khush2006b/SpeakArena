"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { Card } from "@/components/ui/card";

interface RingProps {
  progress: number; // 0 to 100
  size: number;
  strokeWidth: number;
  color: string;
}

function ProgressRing({ progress, size, strokeWidth, color }: RingProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (progress / 100) * circumference;

  return (
    <div style={{ width: size, height: size, position: 'relative' }}>
      {/* Background Ring */}
      <svg style={{ position: 'absolute', inset: 0, transform: 'rotate(-90deg)' }} width={size} height={size}>
        <circle
          style={{ color: 'rgba(255,255,255,0.1)' }}
          strokeWidth={strokeWidth}
          stroke="currentColor"
          fill="transparent"
          r={radius}
          cx={size / 2}
          cy={size / 2}
        />
      </svg>
      {/* Progress Ring */}
      <svg style={{ position: 'absolute', inset: 0, transform: 'rotate(-90deg)', filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.3))' }} width={size} height={size}>
        <motion.circle
          style={{ color }}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={circumference}
          strokeLinecap="round"
          stroke="currentColor"
          fill="transparent"
          r={radius}
          cx={size / 2}
          cy={size / 2}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.5, ease: "easeOut", delay: 0.2 }}
        />
      </svg>
    </div>
  );
}

export function CourseProgressRing() {
  return (
    <Card style={{ padding: '24px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '18px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden', height: '100%', boxSizing: 'border-box' }}>
      <h3 style={{ fontSize: '11px', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '24px', width: '100%', textAlign: 'center', margin: 0, paddingBottom: '24px' }}>Course Progress</h3>
      
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {/* Outer Ring - Total Progress */}
        <ProgressRing progress={68} size={200} strokeWidth={16} color="#4f46e5" />
        
        {/* Inner Ring - Current Module */}
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <ProgressRing progress={45} size={150} strokeWidth={14} color="#10b981" />
        </div>
        
        {/* Center Text */}
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ fontSize: '30px', fontWeight: 800, color: '#fff' }}>68%</span>
          <span style={{ fontSize: '10px', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.1em', marginTop: '4px' }}>Complete</span>
        </div>
      </div>

      <div style={{ marginTop: '32px', display: 'flex', alignItems: 'center', gap: '24px', width: '100%', justifyContent: 'center' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
            <div style={{ height: '8px', width: '8px', borderRadius: '50%', backgroundColor: '#4f46e5' }} />
            <span style={{ fontSize: '11px', color: '#6b7280', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Course</span>
          </div>
          <span style={{ fontSize: '14px', fontWeight: 700, color: '#fff' }}>68%</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
            <div style={{ height: '8px', width: '8px', borderRadius: '50%', backgroundColor: '#10b981' }} />
            <span style={{ fontSize: '11px', color: '#6b7280', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Module 2</span>
          </div>
          <span style={{ fontSize: '14px', fontWeight: 700, color: '#fff' }}>45%</span>
        </div>
      </div>
    </Card>
  );
}
