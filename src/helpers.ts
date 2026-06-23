import { format, parseISO, differenceInCalendarDays, addDays, isWeekend } from 'date-fns'
import * as XLSX from 'xlsx'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { supabase } from './supabase'
import type { UserRole } from './database'

// ── Date helpers ───────────────────────────────────────────────────────────────
export const today = () => format(new Date(), 'yyyy-MM-dd')
export const formatDate = (d: string) => format(parseISO(d), 'dd MMM yyyy')
export const formatTime = (t: string) => {
  if (!t) return '—'
  const [h, m] = t.split(':')
  const hour = parseInt(h)
  return `${hour > 12 ? hour - 12 : hour || 12}:${m} ${hour >= 12 ? 'PM' : 'AM'}`
}
export const formatDateTime = (d: string) => format(parseISO(d), 'dd MMM yyyy, hh:mm a')

  return count
}

export function getLeaveDays(start: string, end: string): number {
  return differenceInCalendarDays(parseISO(end), parseISO(start)) + 1
}

// ── Status label helpers ───────────────────────────────────────────────────────
export const statusLabel = (s: string) => {
  const map: Record<string, string> = {
    present: 'Present', absent: 'Absent', leave: 'On Leave',
    holiday: 'Holiday', remote: 'Remote',
    pending: 'Pending', approved: 'Approved', rejected: 'Rejected',
    office: 'Office', cmk: 'CMK',
    casual: 'Casual Leave', special: 'Special Leave', sick: 'Sick Leave', emergency: 'Emergency Leave',
    self_marked: 'Self Marked', coordinator_marked: 'Coordinator', admin_marked: 'Admin',
    active: 'Active', inactive: 'Inactive',
  }
  return map[s] ?? s
}

// ── Excel export ───────────────────────────────────────────────────────────────
export function exportToExcel(data: Record<string, unknown>[], filename: string) {
  const ws = XLSX.utils.json_to_sheet(data)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Report')

  // Auto column width
  const colWidths = Object.keys(data[0] ?? {}).map(key => ({
    wch: Math.max(key.length, ...data.map(r => String(r[key] ?? '').length)) + 2
  }))
  ws['!cols'] = colWidths

  XLSX.writeFile(wb, `${filename}.xlsx`)
}

// ── CSV export ─────────────────────────────────────────────────────────────────
export function exportToCSV(data: Record<string, unknown>[], filename: string) {
  if (!data.length) return
  const headers = Object.keys(data[0])
  const rows = data.map(r => headers.map(h => `"${String(r[h] ?? '').replace(/"/g, '""')}"`).join(','))
  const csv = [headers.join(','), ...rows].join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = `${filename}.csv`
  link.click()
}

// ── PDF export ─────────────────────────────────────────────────────────────────
export function exportToPDF(
  title: string,
  headers: string[],
  rows: (string | number)[][],
  filename: string
) {
  const doc = new jsPDF({ orientation: 'landscape' })

  // Header bar
  doc.setFillColor(232, 83, 29) // brand-500
  doc.rect(0, 0, 297, 20, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.text('CURRYiT — Attendance Management', 14, 13)

  // Report title
  doc.setTextColor(30, 30, 30)
  doc.setFontSize(14)
  doc.text(title, 14, 32)
  doc.setFontSize(9)
  doc.setTextColor(120, 120, 120)
  doc.text(`Generated: ${format(new Date(), 'dd MMM yyyy, hh:mm a')}`, 14, 39)

  autoTable(doc, {
    head: [headers],
    body: rows,
    startY: 44,
    styles: { fontSize: 8, cellPadding: 3 },
    headStyles: { fillColor: [232, 83, 29], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [255, 248, 245] },
    margin: { left: 14, right: 14 },
  })

  doc.save(`${filename}.pdf`)
}

// ── Audit logger ───────────────────────────────────────────────────────────────
export async function logAudit(params: {
  userId: string
  userName: string
  userRole: UserRole
  action: string
  affectedEmployeeId?: string | null
}) {
  await supabase.from('audit_logs').insert({
    user_id: params.userId,
    user_name: params.userName,
    user_role: params.userRole,
    action: params.action,
    affected_employee_id: params.affectedEmployeeId ?? null,
    ip_address: null,
  })
}

// ── Attendance percentage ──────────────────────────────────────────────────────
