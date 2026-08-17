"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { Check, X } from "lucide-react";


interface PasswordStrengthIndicatorProps {
  password?: string;
  showChecklist?: boolean;
}

export function PasswordStrengthIndicator({ password = "", showChecklist = true }: PasswordStrengthIndicatorProps) {
  // Criteria calculations
  const hasLength = password.length >= 8;
  const hasLower = /[a-z]/.test(password);
  const hasUpper = /[A-Z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSpecial = /[^A-Za-z0-9]/.test(password);

  const passedCriteria = [hasLength, hasLower, hasUpper, hasNumber, hasSpecial].filter(Boolean).length;
  
  // Score mapping (0 to 4 bars)
  let score = 0;
  if (password.length > 0) {
    if (passedCriteria <= 2) score = 1;
    else if (passedCriteria === 3) score = 2;
    else if (passedCriteria === 4) score = 3;
    else if (passedCriteria === 5) score = 4;
  }

  const getBarColor = (index: number) => {
    if (score === 0) return "rgba(255,255,255,0.1)";
    if (score === 1) return index < 1 ? "#ef4444" : "rgba(255,255,255,0.1)"; // red
    if (score === 2) return index < 2 ? "#f59e0b" : "rgba(255,255,255,0.1)"; // orange
    if (score === 3) return index < 3 ? "#eab308" : "rgba(255,255,255,0.1)"; // yellow
    return "#10b981"; // green
  };

  const getLabel = () => {
    if (!password) return "Enter a password";
    if (score === 1) return "Weak";
    if (score === 2) return "Fair";
    if (score === 3) return "Strong";
    return "Excellent";
  };

  const getLabelColor = () => {
    if (!password) return "#6b7280";
    if (score === 1) return "#ef4444";
    if (score === 2) return "#f59e0b";
    if (score === 3) return "#eab308";
    return "#10b981";
  };

  return (
    <div className="w-full space-y-3 mt-2" style={{ background: "transparent" }}>
      {/* Strength Bars */}
      <div className="flex items-center gap-2">
        {[0, 1, 2, 3].map((i) => (
          <motion.div
            key={i}
            className="h-1.5 flex-1 rounded-full"
            initial={false}
            animate={{ backgroundColor: getBarColor(i) }}
            transition={{ duration: 0.3 }}
          />
        ))}
        <span 
          className="text-xs font-semibold w-16 text-right transition-colors duration-300"
          style={{ color: getLabelColor() }}
        >
          {getLabel()}
        </span>
      </div>

      {/* Checklist */}
      {showChecklist && (
        <div className="grid grid-cols-2 gap-2 mt-2">
          <Criterion label="8+ characters" met={hasLength} />
          <Criterion label="Lowercase" met={hasLower} />
          <Criterion label="Uppercase" met={hasUpper} />
          <Criterion label="Number" met={hasNumber} />
          <Criterion label="Special character" met={hasSpecial} />
        </div>
      )}
    </div>
  );
}

function Criterion({ label, met }: { label: string; met: boolean }) {
  return (
    <div 
      className="flex items-center gap-1.5 text-xs transition-colors duration-300"
      style={{ color: met ? "#10b981" : "#6b7280" }}
    >
      {met ? (
        <Check className="h-3.5 w-3.5 flex-shrink-0" />
      ) : (
        <X className="h-3.5 w-3.5 flex-shrink-0 opacity-50" />
      )}
      <span>{label}</span>
    </div>
  );
}
