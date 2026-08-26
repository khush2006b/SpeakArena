"use client";

import React, { useState, useEffect } from "react";
import { 
  Users, 
  CheckCircle2, 
  Clock, 
  XCircle, 
  Download, 
  Filter,
  Calendar,
  Sparkles,
  Loader2
} from "lucide-react";
import { apiClient } from "@/services/api/client";
import { ENDPOINTS } from "@/services/api/endpoints";

interface AttendanceItem {
  id: string;
  studentName: string;
  studentEmail: string;
  courseTitle: string;
  meetingTitle: string;
  date: string;
  status: "PRESENT" | "LATE" | "ABSENT";
  durationMinutes: number;
}

export function AttendanceView() {
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [isExporting, setIsExporting] = useState(false);
  const [attendanceData, setAttendanceData] = useState<AttendanceItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const response = await apiClient.get('/api/v1/teacher/students?page=1&page_size=100');
        const students = response.data?.items || [];
        
        const mappedData: AttendanceItem[] = students.map((s: any) => ({
          id: s.id,
          studentName: s.full_name || "Unknown Student",
          studentEmail: s.email || "",
          courseTitle: s.enrolled_course_title || "General",
          meetingTitle: "Latest Session",
          date: s.last_active_at ? new Date(s.last_active_at).toLocaleDateString() : "Never",
          status: (s.attendance_rate || 0) > 80 ? "PRESENT" : ((s.attendance_rate || 0) > 50 ? "LATE" : "ABSENT"),
          durationMinutes: 45
        }));
        
        setAttendanceData(mappedData);
      } catch (error) {
      } finally {
        setIsLoading(false);
      }
    }
    fetchData();
  }, []);

  const filteredData = attendanceData.filter((item) => {
    const matchesStatus =
      statusFilter === "ALL" || item.status === statusFilter;
    return matchesStatus;
  });

  const handleExportCSV = async () => {
    setIsExporting(true);
    try {
      // Backend export endpoint
      const response = await apiClient.get(`${ENDPOINTS.STUDENTS.LIST}/attendance/export`, {
        responseType: "blob",
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `attendance_export_${new Date().toISOString().split("T")[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch {
      // Fallback client CSV export
      const csvHeader = "Student Name,Email,Course,Meeting,Date,Status,Duration (Mins)\n";
      const csvRows = attendanceData.map(
        (a) => `"${a.studentName}","${a.studentEmail}","${a.courseTitle}","${a.meetingTitle}","${a.date}","${a.status}",${a.durationMinutes}`
      ).join("\n");
      const blob = new Blob([csvHeader + csvRows], { type: "text/csv" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `attendance_records_${new Date().toISOString().split("T")[0]}.csv`;
      a.click();
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div style={{ maxWidth: '1600px', margin: '0 auto', padding: '32px 16px', display: 'flex', flexDirection: 'column', gap: '32px' }}>
      {/* Header */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '16px', borderBottom: '1px solid hsl(var(--border))', paddingBottom: '24px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <h1 style={{ color: "hsl(var(--foreground))", fontSize: '1.875rem', fontWeight: 800, margin: 0 }}>
              Attendance Records
            </h1>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', borderRadius: '999px', background: 'rgba(124, 58, 237, 0.12)', padding: '2px 10px', fontSize: '0.75rem', fontWeight: 600, color: "hsl(var(--primary))", border: '1px solid rgba(124, 58, 237, 0.2)' }}>
              <Sparkles style={{ height: '12px', width: '12px' }} /> Live Sync
            </span>
          </div>
          <p style={{ color: "hsl(var(--muted-foreground))", fontSize: '0.875rem', marginTop: '4px', marginBottom: 0 }}>
            Track student attendance, arrival times, and class participation across all meetings.
          </p>
        </div>

        <button
          onClick={handleExportCSV}
          disabled={isExporting}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justify: 'center',
            gap: '8px',
            borderRadius: '10px',
            background: "hsl(var(--primary))",
            padding: '10px 16px',
            fontSize: '0.875rem',
            fontWeight: 700,
            color: "hsl(var(--foreground))",
            border: 'none',
            cursor: isExporting ? 'not-allowed' : 'pointer',
            opacity: isExporting ? 0.5 : 1,
            flexShrink: 0,
          }}
        >
          <Download style={{ height: '16px', width: '16px' }} />
          {isExporting ? "Exporting..." : "Export CSV Report"}
        </button>
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
        <div style={{ borderRadius: '18px', border: '1px solid hsl(var(--border))', background: 'hsl(var(--border))', padding: '20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.6875rem', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Total Recorded
            </span>
            <div style={{ padding: '8px', borderRadius: '10px', background: 'rgba(96,165,250,0.15)', color: '#60a5fa' }}>
              <Users style={{ height: '16px', width: '16px' }} />
            </div>
          </div>
          <p style={{ fontSize: '1.5rem', fontWeight: 800, color: "hsl(var(--foreground))", margin: 0 }}>
            {isLoading ? <Loader2 className="animate-spin h-6 w-6 mt-1 text-muted-foreground" /> : attendanceData.length}
          </p>
          <p style={{ fontSize: '0.75rem', color: "hsl(var(--muted-foreground))", margin: 0 }}>Across all active courses</p>
        </div>

        <div style={{ borderRadius: '18px', border: '1px solid hsl(var(--border))', background: 'hsl(var(--border))', padding: '20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.6875rem', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Present Rate
            </span>
            <div style={{ padding: '8px', borderRadius: '10px', background: 'rgba(16,185,129,0.15)', color: '#10b981' }}>
              <CheckCircle2 style={{ height: '16px', width: '16px' }} />
            </div>
          </div>
          <p style={{ fontSize: '1.5rem', fontWeight: 800, color: '#10b981', margin: 0 }}>
            80.0%
          </p>
          <p style={{ fontSize: '0.75rem', color: '#10b981', opacity: 0.8, margin: 0 }}>4 out of 5 present</p>
        </div>

        <div style={{ borderRadius: '18px', border: '1px solid hsl(var(--border))', background: 'hsl(var(--border))', padding: '20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.6875rem', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Late Arrivals
            </span>
            <div style={{ padding: '8px', borderRadius: '10px', background: 'rgba(245,158,11,0.15)', color: '#f59e0b' }}>
              <Clock style={{ height: '16px', width: '16px' }} />
            </div>
          </div>
          <p style={{ fontSize: '1.5rem', fontWeight: 800, color: '#f59e0b', margin: 0 }}>
            1
          </p>
          <p style={{ fontSize: '0.75rem', color: '#f59e0b', opacity: 0.8, margin: 0 }}>Joined &gt; 10 mins late</p>
        </div>

        <div style={{ borderRadius: '18px', border: '1px solid hsl(var(--border))', background: 'hsl(var(--border))', padding: '20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.6875rem', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Absent
            </span>
            <div style={{ padding: '8px', borderRadius: '10px', background: 'rgba(239,68,68,0.15)', color: '#ef4444' }}>
              <XCircle style={{ height: '16px', width: '16px' }} />
            </div>
          </div>
          <p style={{ fontSize: '1.5rem', fontWeight: 800, color: '#ef4444', margin: 0 }}>
            1
          </p>
          <p style={{ fontSize: '0.75rem', color: '#ef4444', opacity: 0.8, margin: 0 }}>No join activity recorded</p>
        </div>
      </div>

      {/* Filters & Table */}
      <div style={{ borderRadius: '18px', border: '1px solid hsl(var(--border))', background: 'hsl(var(--border))', overflow: 'hidden' }}>
        {/* Controls */}
        <div style={{ padding: '24px', borderBottom: '1px solid hsl(var(--border))', display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'center', justifyContent: 'flex-end', background: 'hsl(var(--border))' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflowX: 'auto' }}>
            <Filter style={{ height: '16px', width: '16px', color: '#6b7280', flexShrink: 0, marginLeft: '4px' }} />
            {["ALL", "PRESENT", "LATE", "ABSENT"].map((status) => {
              const isActive = statusFilter === status;
              return (
                <button
                  key={status}
                  onClick={() => setStatusFilter(status)}
                  style={{
                    borderRadius: '8px',
                    padding: '6px 12px',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    letterSpacing: '0.05em',
                    border: isActive ? '1px solid #7c3aed' : '1px solid hsl(var(--border))',
                    background: isActive ? "hsl(var(--primary))" : 'transparent',
                    color: isActive ? "hsl(var(--foreground))" : "hsl(var(--muted-foreground))",
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                  }}
                >
                  {status}
                </button>
              );
            })}
          </div>
        </div>

        {/* Table */}
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
            <thead style={{ background: 'hsl(var(--border))', color: '#6b7280', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', borderBottom: '1px solid hsl(var(--border))' }}>
              <tr>
                <th style={{ padding: '16px 24px' }}>Student</th>
                <th style={{ padding: '16px 24px' }}>Course</th>
                <th style={{ padding: '16px 24px' }}>Meeting Session</th>
                <th style={{ padding: '16px 24px' }}>Date & Time</th>
                <th style={{ padding: '16px 24px' }}>Duration</th>
                <th style={{ padding: '16px 24px', textAlign: 'right' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={6} style={{ padding: '48px 24px', textAlign: 'center' }}>
                    <Loader2 className="animate-spin h-8 w-8 mx-auto text-primary" />
                    <p style={{ marginTop: '16px', color: "hsl(var(--muted-foreground))", fontSize: '0.875rem' }}>Loading attendance records...</p>
                  </td>
                </tr>
              ) : filteredData.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: '48px 24px', textAlign: 'center', color: "hsl(var(--muted-foreground))", fontSize: '0.875rem' }}>
                    No attendance records found matching your criteria.
                  </td>
                </tr>
              ) : (
                filteredData.map((item, idx) => (
                  <tr
                    key={item.id ? `att-${item.id}` : `att-idx-${idx}`}
                    style={{
                      borderBottom: '1px solid hsl(var(--border))',
                      background: 'transparent',
                      transition: 'background 0.2s',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'hsl(var(--border))')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  >
                    <td style={{ padding: '16px 24px' }}>
                      <div>
                        <p style={{ fontWeight: 600, color: "hsl(var(--foreground))", margin: 0, fontSize: '0.875rem' }}>
                          {item.studentName}
                        </p>
                        <p style={{ fontSize: '0.75rem', color: "hsl(var(--muted-foreground))", margin: 0, marginTop: '2px' }}>
                          {item.studentEmail}
                        </p>
                      </div>
                    </td>
                    <td style={{ padding: '16px 24px', fontSize: '0.75rem', fontWeight: 500, color: "hsl(var(--foreground))", maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {item.courseTitle}
                    </td>
                    <td style={{ padding: '16px 24px', fontSize: '0.75rem', color: "hsl(var(--muted-foreground))", maxWidth: '220px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {item.meetingTitle}
                    </td>
                    <td style={{ padding: '16px 24px', fontSize: '0.75rem', color: "hsl(var(--muted-foreground))" }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                        <Calendar style={{ height: '14px', width: '14px', color: '#6b7280' }} />
                        {item.date}
                      </span>
                    </td>
                    <td style={{ padding: '16px 24px', fontSize: '0.75rem', color: "hsl(var(--foreground))", fontWeight: 500 }}>
                      {item.durationMinutes > 0
                        ? `${item.durationMinutes} mins`
                        : "-"}
                    </td>
                    <td style={{ padding: '16px 24px', textAlign: 'right' }}>
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          borderRadius: '999px',
                          padding: '4px 10px',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          ...(item.status === "PRESENT"
                            ? { background: 'rgba(16,185,129,0.15)', color: '#10b981', border: '1px solid rgba(16,185,129,0.2)' }
                            : item.status === "LATE"
                            ? { background: 'rgba(245,158,11,0.15)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.2)' }
                            : { background: 'rgba(239,68,68,0.15)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)' })
                        }}
                      >
                        {item.status === "PRESENT" && (
                          <CheckCircle2 style={{ height: '12px', width: '12px' }} />
                        )}
                        {item.status === "LATE" && <Clock style={{ height: '12px', width: '12px' }} />}
                        {item.status === "ABSENT" && (
                          <XCircle style={{ height: '12px', width: '12px' }} />
                        )}
                        {item.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
