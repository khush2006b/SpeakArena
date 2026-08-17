"use client";

import React from "react";
import { CalendarCheck, CheckCircle2, Clock, XCircle, Video } from "lucide-react";

export function StudentAttendanceView() {
  const attendanceRecords = [
    {
      id: "att-1",
      sessionTitle: "Mastering Body Language & Voice Tone",
      courseTitle: "Advanced Public Speaking & Debate",
      date: "Aug 6, 2026",
      status: "PRESENT",
      duration: "45 mins",
    },
    {
      id: "att-2",
      sessionTitle: "Vowel Sounds & Stress Patterns",
      courseTitle: "English Fluency & Pronunciation",
      date: "Aug 3, 2026",
      status: "PRESENT",
      duration: "60 mins",
    },
    {
      id: "att-3",
      sessionTitle: "Structure of a 5-Minute Investor Pitch",
      courseTitle: "Executive Pitching & Storytelling",
      date: "Jul 29, 2026",
      status: "LATE",
      duration: "35 mins",
    },
    {
      id: "att-4",
      sessionTitle: "Impromptu Speech Drills & Live Feedback",
      courseTitle: "Advanced Public Speaking & Debate",
      date: "Jul 22, 2026",
      status: "PRESENT",
      duration: "50 mins",
    },
  ];

  return (
    <div style={{ margin: '0 auto', width: '100%', maxWidth: '1280px', padding: '32px 16px', display: 'flex', flexDirection: 'column', gap: '32px' }}>
      {/* Header */}
      <div style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '24px' }}>
        <h1 style={{ fontSize: '1.875rem', fontWeight: 800, color: '#fff', margin: 0, letterSpacing: '-0.025em' }}>
          Attendance History
        </h1>
        <p style={{ fontSize: '0.875rem', color: '#9ca3af', marginTop: '4px' }}>
          Review your attendance and participation records across all live class sessions.
        </p>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
        <div style={{ borderRadius: 18, border: '1px solid rgba(255,255,255,0.07)', background: 'rgba(255,255,255,0.03)', padding: '20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Attendance Rate
            </span>
            <div style={{ padding: '8px', borderRadius: 10, background: 'rgba(16,185,129,0.15)', color: '#10b981' }}>
              <CalendarCheck size={16} />
            </div>
          </div>
          <p style={{ fontSize: '1.5rem', fontWeight: 800, color: '#10b981', margin: 0, fontFamily: 'monospace' }}>
            95.0%
          </p>
          <p style={{ fontSize: '0.75rem', color: '#9ca3af', margin: 0 }}>High attendance tier</p>
        </div>

        <div style={{ borderRadius: 18, border: '1px solid rgba(255,255,255,0.07)', background: 'rgba(255,255,255,0.03)', padding: '20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Classes Attended
            </span>
            <div style={{ padding: '8px', borderRadius: 10, background: 'rgba(79,70,229,0.15)', color: '#818cf8' }}>
              <CheckCircle2 size={16} />
            </div>
          </div>
          <p style={{ fontSize: '1.5rem', fontWeight: 800, color: '#fff', margin: 0, fontFamily: 'monospace' }}>
            19 / 20
          </p>
          <p style={{ fontSize: '0.75rem', color: '#9ca3af', margin: 0 }}>Live sessions completed</p>
        </div>

        <div style={{ borderRadius: 18, border: '1px solid rgba(255,255,255,0.07)', background: 'rgba(255,255,255,0.03)', padding: '20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Late Arrivals
            </span>
            <div style={{ padding: '8px', borderRadius: 10, background: 'rgba(245,158,11,0.15)', color: '#f59e0b' }}>
              <Clock size={16} />
            </div>
          </div>
          <p style={{ fontSize: '1.5rem', fontWeight: 800, color: '#f59e0b', margin: 0, fontFamily: 'monospace' }}>
            1 Session
          </p>
          <p style={{ fontSize: '0.75rem', color: '#9ca3af', margin: 0 }}>Joined &gt; 10m late</p>
        </div>

        <div style={{ borderRadius: 18, border: '1px solid rgba(255,255,255,0.07)', background: 'rgba(255,255,255,0.03)', padding: '20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Missed Sessions
            </span>
            <div style={{ padding: '8px', borderRadius: 10, background: 'rgba(239,68,68,0.15)', color: '#ef4444' }}>
              <XCircle size={16} />
            </div>
          </div>
          <p style={{ fontSize: '1.5rem', fontWeight: 800, color: '#fff', margin: 0, fontFamily: 'monospace' }}>
            1 Session
          </p>
          <p style={{ fontSize: '0.75rem', color: '#9ca3af', margin: 0 }}>Recording available</p>
        </div>
      </div>

      {/* Table */}
      <div style={{ borderRadius: 18, border: '1px solid rgba(255,255,255,0.07)', background: 'rgba(255,255,255,0.03)', overflow: 'hidden' }}>
        <div style={{ padding: '16px', borderBottom: '1px solid rgba(255,255,255,0.04)', background: 'rgba(255,255,255,0.02)' }}>
          <h3 style={{ fontSize: '0.875rem', fontWeight: 800, color: '#fff', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Video size={16} style={{ color: '#4f46e5' }} /> Session Attendance Log
          </h3>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', textAlign: 'left', fontSize: '0.875rem', borderCollapse: 'collapse' }}>
            <thead style={{ background: 'rgba(255,255,255,0.01)', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
              <tr>
                <th style={{ padding: '16px 24px', fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Live Session</th>
                <th style={{ padding: '16px 24px', fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Course</th>
                <th style={{ padding: '16px 24px', fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Date</th>
                <th style={{ padding: '16px 24px', fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Duration</th>
                <th style={{ padding: '16px 24px', fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.08em', textAlign: 'right' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {attendanceRecords.map((item, i) => (
                <tr key={item.id} style={{ borderBottom: i === attendanceRecords.length - 1 ? 'none' : '1px solid rgba(255,255,255,0.04)', background: 'rgba(255,255,255,0.02)', transition: 'background 0.2s' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.04)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'}>
                  <td style={{ padding: '16px 24px', fontWeight: 700, color: '#fff' }}>
                    {item.sessionTitle}
                  </td>
                  <td style={{ padding: '16px 24px', color: '#9ca3af' }}>
                    {item.courseTitle}
                  </td>
                  <td style={{ padding: '16px 24px', color: '#9ca3af' }}>
                    {item.date}
                  </td>
                  <td style={{ padding: '16px 24px', color: '#fff', fontWeight: 500 }}>
                    {item.duration}
                  </td>
                  <td style={{ padding: '16px 24px', textAlign: 'right' }}>
                    <span
                      style={{ 
                        display: 'inline-flex', alignItems: 'center', gap: '4px', borderRadius: 9999, padding: '4px 10px', fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
                        background: item.status === "PRESENT" ? 'rgba(16,185,129,0.15)' : 'rgba(245,158,11,0.15)',
                        color: item.status === "PRESENT" ? '#10b981' : '#f59e0b',
                        border: item.status === "PRESENT" ? '1px solid rgba(16,185,129,0.25)' : '1px solid rgba(245,158,11,0.25)'
                       }}
                    >
                      {item.status === "PRESENT" ? (
                        <CheckCircle2 size={12} />
                      ) : (
                        <Clock size={12} />
                      )}
                      {item.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
