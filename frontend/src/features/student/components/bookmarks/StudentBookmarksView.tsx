"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Bookmark, Play, FileText, Trash2, ExternalLink } from "lucide-react";

export function StudentBookmarksView() {
  const [bookmarks, setBookmarks] = useState([
    {
      id: "bm-1",
      type: "VIDEO",
      title: "Stage Presence & Non-Verbal Communication",
      course: "Mastering Public Speaking & Rhetoric",
      timestamp: "14:20",
      savedAt: "Aug 5, 2026",
      link: "/student/courses/course-1",
    },
    {
      id: "bm-2",
      type: "PDF",
      title: "Speech Structure Cheatsheet & Outline Template.pdf",
      course: "Advanced Debate & Argumentation",
      timestamp: "Page 4",
      savedAt: "Aug 2, 2026",
      link: "/student/resources",
    },
    {
      id: "bm-3",
      type: "VIDEO",
      title: "Vowel Sounds & Phonetic Chart Walkthrough",
      course: "English Fluency & Pronunciation",
      timestamp: "08:15",
      savedAt: "Jul 28, 2026",
      link: "/student/courses/course-2",
    },
  ]);

  const handleRemove = (id: string) => {
    setBookmarks((prev) => prev.filter((b) => b.id !== id));
  };

  return (
    <div style={{ width: '100%', maxWidth: '1280px', margin: '0 auto', padding: '32px 16px', display: 'flex', flexDirection: 'column', gap: '32px', boxSizing: 'border-box' }}>
      {/* Header */}
      <div style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '24px' }}>
        <h1 style={{ fontSize: '28px', fontWeight: 800, color: '#fff', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
          <Bookmark style={{ height: '28px', width: '28px', color: '#4f46e5', fill: 'rgba(79,70,229,0.2)' }} /> Saved Bookmarks
        </h1>
        <p style={{ fontSize: '14px', color: '#9ca3af', marginTop: '4px', margin: 0 }}>
          Quickly access your saved video moments, key lesson notes, and PDF resources.
        </p>
      </div>

      {/* Bookmarks List */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
        {bookmarks.map((item) => (
          <div
            key={item.id}
            style={{ borderRadius: '18px', border: '1px solid rgba(255,255,255,0.07)', background: 'rgba(255,255,255,0.03)', padding: '20px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '16px', transition: 'border-color 0.2s', cursor: 'pointer' }}
            onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(79,70,229,0.4)'}
            onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)'}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: '4px', borderRadius: '9999px', padding: '2px 10px', fontSize: '12px', fontWeight: 700,
                    background: item.type === "VIDEO" ? 'rgba(59,130,246,0.1)' : 'rgba(168,85,247,0.1)',
                    color: item.type === "VIDEO" ? '#3b82f6' : '#a855f7',
                    border: item.type === "VIDEO" ? '1px solid rgba(59,130,246,0.2)' : '1px solid rgba(168,85,247,0.2)'
                  }}
                >
                  {item.type === "VIDEO" ? (
                    <Play style={{ height: '12px', width: '12px', fill: 'currentColor' }} />
                  ) : (
                    <FileText style={{ height: '12px', width: '12px' }} />
                  )}
                  {item.type}
                </span>

                <button
                  onClick={() => handleRemove(item.id)}
                  style={{ background: 'transparent', border: 'none', color: '#9ca3af', cursor: 'pointer', padding: '4px' }}
                  title="Remove bookmark"
                  onMouseEnter={e => e.currentTarget.style.color = '#ef4444'}
                  onMouseLeave={e => e.currentTarget.style.color = '#9ca3af'}
                >
                  <Trash2 style={{ height: '16px', width: '16px' }} />
                </button>
              </div>

              <h3 style={{ fontWeight: 700, color: '#fff', fontSize: '16px', margin: 0, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                {item.title}
              </h3>

              <p style={{ fontSize: '12px', color: '#9ca3af', margin: 0 }}>
                Course: <span style={{ color: '#fff', fontWeight: 600 }}>{item.course}</span> • {item.timestamp}
              </p>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '16px', borderTop: '1px solid rgba(255,255,255,0.06)', fontSize: '12px', color: '#6b7280' }}>
              <span>Saved on {item.savedAt}</span>
              <Link
                href={item.link}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontWeight: 700, color: '#4f46e5', textDecoration: 'none' }}
              >
                Open <ExternalLink style={{ height: '14px', width: '14px' }} />
              </Link>
            </div>
          </div>
        ))}

        {bookmarks.length === 0 && (
          <div style={{ gridColumn: '1 / -1', padding: '64px 0', textAlign: 'center', color: '#9ca3af', fontSize: '14px', border: '1px dashed rgba(255,255,255,0.1)', borderRadius: '18px' }}>
            You haven't saved any bookmarks yet.
          </div>
        )}
      </div>
    </div>
  );
}
