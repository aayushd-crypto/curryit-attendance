export type UserRole = 'super_admin' | 'admin' | 'cmk_coordinator' | 'employee'
export type AttendanceStatus = 'present' | 'absent' | 'leave' | 'holiday'
export type WorkMode = 'office' | 'remote'
export type AttendanceSource = 'self_marked' | 'coordinator_marked' | 'admin_marked'
export type LeaveStatus = 'pending' | 'approved' | 'rejected'
export type LeaveType = 'casual' | 'sick' | 'emergency'
export type EmployeeStatus = 'active' | 'inactive'
export type Location = 'office' | 'cmk'

export interface Department {
  id: string
  name: string
  location: Location
  status: 'active' | 'inactive'
  created_at: string
}

export interface Employee {
  id: string
  employee_code: string
  name: string
  mobile: string
  email: string
  department_id: string
  designation: string
  location: Location
  joining_date: string
  status: EmployeeStatus
  photo_url: string | null
  created_at: string
  departments?: Department
}

export interface AttendanceRecord {
  id: string
  employee_id: string
  date: string
  check_in_time: string | null
  location: Location
  work_mode: WorkMode | null
  status: AttendanceStatus
  source: AttendanceSource
  marked_by: string | null
  created_at: string
  employees?: Employee
}

export interface LeaveRequest {
  id: string
  employee_id: string
  leave_type: LeaveType
  start_date: string
  end_date: string
  total_days: number
  reason: string
  status: LeaveStatus
  remarks: string | null
  approved_by: string | null
  created_at: string
  employees?: Employee
}

export interface LeaveBalance {
  id: string
  employee_id: string
  year: number
  casual_total: number
  casual_used: number
  sick_total: number
  sick_used: number
  emergency_total: number
  emergency_used: number
}

export interface Holiday {
  id: string
  holiday_date: string
  name: string
  location: Location | 'all'
}

export interface AuditLog {
  id: string
  user_id: string
  user_name: string
  user_role: UserRole
  action: string
  affected_employee_id: string | null
  ip_address: string | null
  created_at: string
}

export interface Notification {
  id: string
  user_id: string
  title: string
  message: string
  is_read: boolean
  created_at: string
}

export interface UserProfile {
  id: string
  email: string
  role: UserRole
  employee_id: string | null
  full_name: string
  created_at: string
}

// Database type for Supabase client
export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: UserProfile
        Insert: Omit<UserProfile, 'created_at'>
        Update: Partial<UserProfile>
      }
      employees: {
        Row: Employee
        Insert: Omit<Employee, 'id' | 'created_at'>
        Update: Partial<Employee>
      }
      departments: {
        Row: Department
        Insert: Omit<Department, 'id' | 'created_at'>
        Update: Partial<Department>
      }
      attendance: {
        Row: AttendanceRecord
        Insert: Omit<AttendanceRecord, 'id' | 'created_at'>
        Update: Partial<AttendanceRecord>
      }
      leave_requests: {
        Row: LeaveRequest
        Insert: Omit<LeaveRequest, 'id' | 'created_at'>
        Update: Partial<LeaveRequest>
      }
      leave_balances: {
        Row: LeaveBalance
        Insert: Omit<LeaveBalance, 'id'>
        Update: Partial<LeaveBalance>
      }
      holidays: {
        Row: Holiday
        Insert: Omit<Holiday, 'id'>
        Update: Partial<Holiday>
      }
      audit_logs: {
        Row: AuditLog
        Insert: Omit<AuditLog, 'id' | 'created_at'>
        Update: never
      }
      notifications: {
        Row: Notification
        Insert: Omit<Notification, 'id' | 'created_at'>
        Update: Partial<Notification>
      }
    }
  }
}
