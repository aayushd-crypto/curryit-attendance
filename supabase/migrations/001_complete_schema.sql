-- ============================================================
-- CURRYiT Attendance Management System — Complete Database Schema
-- Run this entire file in Supabase SQL Editor
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── 1. PROFILES ──────────────────────────────────────────────
-- One profile per Supabase Auth user
CREATE TABLE IF NOT EXISTS profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email       TEXT NOT NULL UNIQUE,
  full_name   TEXT NOT NULL,
  role        TEXT NOT NULL CHECK (role IN ('super_admin','admin','cmk_coordinator','employee')),
  employee_id UUID,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ── 2. DEPARTMENTS ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS departments (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name       TEXT NOT NULL,
  location   TEXT NOT NULL CHECK (location IN ('office','cmk')),
  status     TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── 3. EMPLOYEES ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS employees (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_code   TEXT NOT NULL UNIQUE,
  name            TEXT NOT NULL,
  mobile          TEXT NOT NULL,
  email           TEXT NOT NULL UNIQUE,
  department_id   UUID REFERENCES departments(id),
  designation     TEXT NOT NULL,
  location        TEXT NOT NULL CHECK (location IN ('office','cmk')),
  joining_date    DATE NOT NULL,
  status          TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive')),
  photo_url       TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Link profiles to employees
ALTER TABLE profiles ADD CONSTRAINT fk_profiles_employee
  FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE SET NULL;

-- ── 4. ATTENDANCE ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS attendance (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id     UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  date            DATE NOT NULL,
  check_in_time   TIME,
  location        TEXT NOT NULL CHECK (location IN ('office','cmk')),
  work_mode       TEXT CHECK (work_mode IN ('office','remote')),
  status          TEXT NOT NULL CHECK (status IN ('present','absent','leave','holiday')),
  source          TEXT NOT NULL CHECK (source IN ('self_marked','coordinator_marked','admin_marked')),
  marked_by       UUID REFERENCES profiles(id),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  -- One attendance per employee per day
  UNIQUE (employee_id, date)
);

-- Index for fast date-range queries
CREATE INDEX IF NOT EXISTS idx_attendance_date         ON attendance(date);
CREATE INDEX IF NOT EXISTS idx_attendance_employee_id  ON attendance(employee_id);
CREATE INDEX IF NOT EXISTS idx_attendance_location     ON attendance(location);

-- ── 5. LEAVE REQUESTS ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS leave_requests (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  leave_type  TEXT NOT NULL CHECK (leave_type IN ('casual','sick','emergency')),
  start_date  DATE NOT NULL,
  end_date    DATE NOT NULL,
  total_days  INT NOT NULL,
  reason      TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  remarks     TEXT,
  approved_by UUID REFERENCES profiles(id),
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  CHECK (end_date >= start_date)
);

CREATE INDEX IF NOT EXISTS idx_leave_employee_id ON leave_requests(employee_id);
CREATE INDEX IF NOT EXISTS idx_leave_status      ON leave_requests(status);

-- ── 6. LEAVE BALANCES ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS leave_balances (
  id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id        UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  year               INT NOT NULL,
  casual_total       INT NOT NULL DEFAULT 12,
  casual_used        INT NOT NULL DEFAULT 0,
  sick_total         INT NOT NULL DEFAULT 12,
  sick_used          INT NOT NULL DEFAULT 0,
  emergency_total    INT NOT NULL DEFAULT 6,
  emergency_used     INT NOT NULL DEFAULT 0,
  UNIQUE (employee_id, year)
);

-- ── 7. HOLIDAYS ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS holidays (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  holiday_date  DATE NOT NULL,
  name          TEXT NOT NULL,
  location      TEXT NOT NULL DEFAULT 'all' CHECK (location IN ('office','cmk','all'))
);

-- ── 8. AUDIT LOGS ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS audit_logs (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id              UUID NOT NULL REFERENCES profiles(id),
  user_name            TEXT NOT NULL,
  user_role            TEXT NOT NULL,
  action               TEXT NOT NULL,
  affected_employee_id UUID REFERENCES employees(id) ON DELETE SET NULL,
  ip_address           TEXT,
  created_at           TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_created_at ON audit_logs(created_at DESC);

-- ── 9. NOTIFICATIONS ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notifications (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title      TEXT NOT NULL,
  message    TEXT NOT NULL,
  is_read    BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================

ALTER TABLE profiles       ENABLE ROW LEVEL SECURITY;
ALTER TABLE employees      ENABLE ROW LEVEL SECURITY;
ALTER TABLE departments    ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance     ENABLE ROW LEVEL SECURITY;
ALTER TABLE leave_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE leave_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE holidays       ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs     ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications  ENABLE ROW LEVEL SECURITY;

-- Helper function to get current user's role
CREATE OR REPLACE FUNCTION get_my_role()
RETURNS TEXT AS $$
  SELECT role FROM profiles WHERE id = auth.uid()
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- Helper function to get current user's employee location
CREATE OR REPLACE FUNCTION get_my_location()
RETURNS TEXT AS $$
  SELECT e.location FROM profiles p
  JOIN employees e ON e.id = p.employee_id
  WHERE p.id = auth.uid()
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- ── PROFILES policies ─────────────────────────────────────────
CREATE POLICY "Users can read own profile" ON profiles
  FOR SELECT USING (id = auth.uid());

CREATE POLICY "Admins can read all profiles" ON profiles
  FOR SELECT USING (get_my_role() IN ('super_admin','admin'));

CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (id = auth.uid());

CREATE POLICY "Super admin can manage profiles" ON profiles
  FOR ALL USING (get_my_role() = 'super_admin');

-- ── EMPLOYEES policies ────────────────────────────────────────
CREATE POLICY "Employees can read their own record" ON employees
  FOR SELECT USING (
    email = (SELECT email FROM profiles WHERE id = auth.uid())
  );

CREATE POLICY "Admins can read all employees" ON employees
  FOR SELECT USING (get_my_role() IN ('super_admin','admin'));

CREATE POLICY "CMK coordinator can read CMK employees" ON employees
  FOR SELECT USING (
    get_my_role() = 'cmk_coordinator' AND location = 'cmk'
  );

CREATE POLICY "Admins can manage employees" ON employees
  FOR ALL USING (get_my_role() IN ('super_admin','admin'));

-- ── DEPARTMENTS policies ──────────────────────────────────────
CREATE POLICY "Anyone authenticated can read departments" ON departments
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Super admin can manage departments" ON departments
  FOR ALL USING (get_my_role() = 'super_admin');

-- ── ATTENDANCE policies ───────────────────────────────────────
CREATE POLICY "Employees can read own attendance" ON attendance
  FOR SELECT USING (
    employee_id = (SELECT employee_id FROM profiles WHERE id = auth.uid())
  );

CREATE POLICY "Admins can read all attendance" ON attendance
  FOR SELECT USING (get_my_role() IN ('super_admin','admin'));

CREATE POLICY "CMK coordinator can read CMK attendance" ON attendance
  FOR SELECT USING (
    get_my_role() = 'cmk_coordinator' AND location = 'cmk'
  );

CREATE POLICY "Employees can insert own attendance" ON attendance
  FOR INSERT WITH CHECK (
    employee_id = (SELECT employee_id FROM profiles WHERE id = auth.uid())
    AND get_my_role() = 'employee'
  );

CREATE POLICY "CMK coordinator can insert CMK attendance" ON attendance
  FOR INSERT WITH CHECK (
    get_my_role() = 'cmk_coordinator'
    AND location = 'cmk'
  );

CREATE POLICY "Admins can manage all attendance" ON attendance
  FOR ALL USING (get_my_role() IN ('super_admin','admin'));

-- ── LEAVE REQUESTS policies ───────────────────────────────────
CREATE POLICY "Employees can read own leave" ON leave_requests
  FOR SELECT USING (
    employee_id = (SELECT employee_id FROM profiles WHERE id = auth.uid())
  );

CREATE POLICY "Admins can read all leaves" ON leave_requests
  FOR SELECT USING (get_my_role() IN ('super_admin','admin'));

CREATE POLICY "Employees can apply leave" ON leave_requests
  FOR INSERT WITH CHECK (
    employee_id = (SELECT employee_id FROM profiles WHERE id = auth.uid())
  );

CREATE POLICY "Admins can approve/reject leaves" ON leave_requests
  FOR UPDATE USING (get_my_role() IN ('super_admin','admin'));

-- ── LEAVE BALANCES policies ───────────────────────────────────
CREATE POLICY "Employees can read own balance" ON leave_balances
  FOR SELECT USING (
    employee_id = (SELECT employee_id FROM profiles WHERE id = auth.uid())
  );

CREATE POLICY "Admins can manage balances" ON leave_balances
  FOR ALL USING (get_my_role() IN ('super_admin','admin'));

-- ── HOLIDAYS policies ─────────────────────────────────────────
CREATE POLICY "Everyone can read holidays" ON holidays
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Super admin can manage holidays" ON holidays
  FOR ALL USING (get_my_role() = 'super_admin');

-- ── AUDIT LOG policies ────────────────────────────────────────
CREATE POLICY "Admins can read audit logs" ON audit_logs
  FOR SELECT USING (get_my_role() IN ('super_admin','admin'));

CREATE POLICY "Anyone can insert audit logs" ON audit_logs
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- ── NOTIFICATIONS policies ────────────────────────────────────
CREATE POLICY "Users can read own notifications" ON notifications
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can update own notifications" ON notifications
  FOR UPDATE USING (user_id = auth.uid());

-- ============================================================
-- TRIGGER: Auto-create profile on user signup
-- ============================================================
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'role', 'employee')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================================
-- SEED DATA — Starter departments
-- ============================================================
INSERT INTO departments (name, location) VALUES
  ('Operations',  'office'),
  ('Marketing',   'office'),
  ('Finance',     'office'),
  ('Technology',  'office'),
  ('HR',          'office'),
  ('Production',  'cmk'),
  ('Packaging',   'cmk'),
  ('Quality',     'cmk'),
  ('Logistics',   'cmk')
ON CONFLICT DO NOTHING;

-- ============================================================
-- SEED DATA — Holidays 2025
-- ============================================================
INSERT INTO holidays (holiday_date, name, location) VALUES
  ('2025-01-26', 'Republic Day',             'all'),
  ('2025-08-15', 'Independence Day',         'all'),
  ('2025-10-02', 'Gandhi Jayanti',           'all'),
  ('2025-10-23', 'Dussehra',                 'all'),
  ('2025-11-01', 'Diwali',                   'all'),
  ('2025-12-25', 'Christmas',                'all')
ON CONFLICT DO NOTHING;
