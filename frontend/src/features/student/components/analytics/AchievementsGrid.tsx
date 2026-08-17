"use client";

import * as React from "react";
import { Card } from "@/components/ui/card";
import { Award, Flame, BookOpen, Moon, CalendarCheck, Lock, Loader2, Trophy } from "lucide-react";
import { motion } from "framer-motion";
import { apiClient } from "@/services/api/client";

export function AchievementsGrid() {
  const [achievements, setAchievements] = React.useState<any[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    const fetchAchievements = async () => {
      try {
        const res = await apiClient.get("/api/v1/profile/achievements");
        const data = res.data?.data || res.data || [];
        setAchievements(Array.isArray(data) ? data : []);
      } catch (error) {
      } finally {
        setIsLoading(false);
      }
    };
    fetchAchievements();
  }, []);

  const getIcon = (name: string, isUnlocked: boolean) => {
    const color = isUnlocked ? "#4f46e5" : "#6b7280";
    const props = { style: { height: '24px', width: '24px', color } };
    switch (name) {
      case "flame": return <Flame {...props} />;
      case "award": return <Award {...props} />;
      case "book-open": return <BookOpen {...props} />;
      case "moon": return <Moon {...props} />;
      case "calendar-check": return <CalendarCheck {...props} />;
      default: return <Award {...props} />;
    }
  };

  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.1 }
    }
  };

  const item = {
    hidden: { opacity: 0, scale: 0.9 },
    show: { opacity: 1, scale: 1, transition: { type: "spring", stiffness: 300, damping: 24 } }
  };

  return (
    <Card style={{ padding: '24px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '18px', boxSizing: 'border-box' }}>
      <h3 style={{ fontSize: '11px', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '24px', margin: 0 }}>Achievements</h3>
      
      {isLoading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : achievements.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-center space-y-3">
          <Trophy className="h-12 w-12 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">Complete courses to unlock achievements!</p>
        </div>
      ) : (
        <motion.div 
          variants={container}
          initial="hidden"
          animate="show"
          style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '16px' }}
        >
          {achievements.map((ach: any) => {
            const isUnlocked = ach.unlockedAt !== null && ach.unlockedAt !== undefined;
            
            return (
              <motion.div key={ach.id} variants={item}>
                <div style={{ 
                  position: 'relative', 
                  display: 'flex', 
                  flexDirection: 'column', 
                  alignItems: 'center', 
                  textAlign: 'center', 
                  padding: '16px', 
                  borderRadius: '12px', 
                  border: isUnlocked ? '1px solid rgba(79,70,229,0.2)' : '1px solid rgba(255,255,255,0.04)',
                  background: isUnlocked ? 'rgba(255,255,255,0.02)' : 'transparent',
                  opacity: isUnlocked ? 1 : 0.6,
                  filter: isUnlocked ? 'none' : 'grayscale(100%)',
                  boxSizing: 'border-box'
                }}>
                  
                  {/* Badge Icon */}
                  <div style={{ 
                    height: '48px', 
                    width: '48px', 
                    borderRadius: '50%', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center', 
                    marginBottom: '12px',
                    background: isUnlocked ? 'rgba(79,70,229,0.12)' : 'rgba(255,255,255,0.05)'
                  }}>
                    {getIcon(ach.icon, isUnlocked)}
                  </div>

                  <h4 style={{ fontSize: '14px', fontWeight: 700, color: '#fff', marginBottom: '4px', margin: 0 }}>{ach.title}</h4>
                  <p style={{ fontSize: '12px', color: '#9ca3af', margin: 0, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{ach.description}</p>
                  
                  {!isUnlocked && (
                    <div style={{ position: 'absolute', top: '8px', right: '8px' }}>
                      <Lock style={{ height: '12px', width: '12px', color: 'rgba(107,114,128,0.5)' }} />
                    </div>
                  )}

                </div>
              </motion.div>
            );
          })}
        </motion.div>
      )}
    </Card>
  );
}
