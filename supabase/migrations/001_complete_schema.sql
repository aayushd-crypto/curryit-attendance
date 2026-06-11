-- ============================================================
-- CURRYiT Attendance System — COMPLETE DATABASE SCHEMA v2
-- Run this ENTIRE file in Supabase SQL Editor (New Query → Paste → Run)
-- Safe to run multiple times — uses IF NOT EXISTS throughout
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── DEPARTMENTS ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS departments (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name       TEXT NOT NULL,
  location   TEXT NOT NULL CHECK (location IN ('office','cmk')),
  status     TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── EMPLOYEES ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS employees (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_code   TEXT NOT NULL UNIQUE,
  name            TEXT NOT NULL,
  mobile          TEXT NOT NULL DEFAULT '',
  email           TEXT NOT NULL UNIQUE,
  department_id   UUID REFERENCES departments(id),
  designation     TEXT NOT NULL DEFAULT 'Employee',
  location        TEXT NOT NULL DEFAULT 'office' CHECK (location IN ('office','cmk')),
  joining_date    DATE NOT NULL DEFAULT CURRENT_DATE,
  status          TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive')),
  photo_url       TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── PROFILES (one per auth user) ──────────────────────────────
CREATE TABLE IF NOT EXISTS profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email       TEXT NOT NULL UNIQUE,
  full_name   TEXT NOT NULL DEFAULT '',
  role        TEXT NOT NULL DEFAULT 'employee' CHECK (role IN ('super_admin','admin','cmk_coordinator','employee')),
  employee_id UUID REFERENCES employees(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ── ATTENDANCE ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS attendance (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id      UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  date             DATE NOT NULL,
  check_in_time    TIME,
  check_out_time   TIME,
  worked_minutes   INT NOT NULL DEFAULT 0,
  overtime_minutes INT NOT NULL DEFAULT 0,
  location         TEXT NOT NULL CHECK (location IN ('office','cmk')),
  work_mode        TEXT CHECK (work_mode IN ('office','remote')),
  status           TEXT NOT NULL CHECK (status IN ('present','absent','leave','holiday')),
  source           TEXT NOT NULL CHECK (source IN ('self_marked','coordinator_marked','admin_marked')),
  marked_by        UUID REFERENCES profiles(id),
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (employee_id, date)
);

CREATE INDEX IF NOT EXISTS idx_att_date     ON attendance(date);
CREATE INDEX IF NOT EXISTS idx_att_emp      ON attendance(employee_id);
CREATE INDEX IF NOT EXISTS idx_att_location ON attendance(location);

-- ── WFH REQUESTS ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS wfh_requests (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  start_date  DATE NOT NULL,
  end_date    DATE NOT NULL,
  reason      TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  remarks     TEXT,
  approved_by UUID REFERENCES profiles(id),
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  CHECK (end_date >= start_date)
);

-- ── LEAVE REQUESTS ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS leave_requests (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  leave_type  TEXT NOT NULL CHECK (leave_type IN ('casual','sick','emergency','paid','unpaid')),
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

-- ── LEAVE BALANCES ────────────────────────────────────────────
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
  paid_total         INT NOT NULL DEFAULT 15,
  paid_used          INT NOT NULL DEFAULT 0,
  UNIQUE (employee_id, year)
);

-- ── HOLIDAYS ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS holidays (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  holiday_date  DATE NOT NULL,
  name          TEXT NOT NULL,
  location      TEXT NOT NULL DEFAULT 'all' CHECK (location IN ('office','cmk','all'))
);

-- ── AUDIT LOGS ────────────────────────────────────────────────
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

CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at DESC);

-- ── NOTIFICATIONS ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notifications (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title      TEXT NOT NULL,
  message    TEXT NOT NULL,
  is_read    BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE profiles       ENABLE ROW LEVEL SECURITY;
ALTER TABLE employees      ENABLE ROW LEVEL SECURITY;
ALTER TABLE departments    ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance     ENABLE ROW LEVEL SECURITY;
ALTER TABLE wfh_requests   ENABLE ROW LEVEL SECURITY;
ALTER TABLE leave_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE leave_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE holidays       ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs     ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications  ENABLE ROW LEVEL SECURITY;

-- Helper: get current user's role
CREATE OR REPLACE FUNCTION get_my_role()
RETURNS TEXT AS $$
  SELECT role FROM profiles WHERE id = auth.uid()
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- ── Profiles policies ─────────────────────────────────────────
DROP POLICY IF EXISTS "profiles_read_own"   ON profiles;
DROP POLICY IF EXISTS "profiles_read_admin" ON profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON profiles;
CREATE POLICY "profiles_read_own"   ON profiles FOR SELECT USING (id = auth.uid());
CREATE POLICY "profiles_read_admin" ON profiles FOR SELECT USING (get_my_role() IN ('super_admin','admin'));
CREATE POLICY "profiles_update_own" ON profiles FOR UPDATE USING (id = auth.uid());
CREATE POLICY "profiles_all_super"  ON profiles FOR ALL    USING (get_my_role() = 'super_admin');

-- ── Employees policies ────────────────────────────────────────
DROP POLICY IF EXISTS "emp_read_own"   ON employees;
DROP POLICY IF EXISTS "emp_read_admin" ON employees;
DROP POLICY IF EXISTS "emp_read_cmk"   ON employees;
DROP POLICY IF EXISTS "emp_manage"     ON employees;
CREATE POLICY "emp_read_own"   ON employees FOR SELECT USING (email = (SELECT email FROM profiles WHERE id = auth.uid()));
CREATE POLICY "emp_read_admin" ON employees FOR SELECT USING (get_my_role() IN ('super_admin','admin'));
CREATE POLICY "emp_read_cmk"   ON employees FOR SELECT USING (get_my_role() = 'cmk_coordinator' AND location = 'cmk');
CREATE POLICY "emp_manage"     ON employees FOR ALL    USING (get_my_role() IN ('super_admin','admin'));

-- ── Departments policies ──────────────────────────────────────
DROP POLICY IF EXISTS "dept_read_all"   ON departments;
DROP POLICY IF EXISTS "dept_manage"     ON departments;
CREATE POLICY "dept_read_all" ON departments FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "dept_manage"   ON departments FOR ALL    USING (get_my_role() = 'super_admin');

-- ── Attendance policies ───────────────────────────────────────
DROP POLICY IF EXISTS "att_read_own"      ON attendance;
DROP POLICY IF EXISTS "att_read_admin"    ON attendance;
DROP POLICY IF EXISTS "att_read_cmk"      ON attendance;
DROP POLICY IF EXISTS "att_insert_self"   ON attendance;
DROP POLICY IF EXISTS "att_insert_coord"  ON attendance;
DROP POLICY IF EXISTS "att_checkout"      ON attendance;
DROP POLICY IF EXISTS "att_manage_admin"  ON attendance;
CREATE POLICY "att_read_own"     ON attendance FOR SELECT USING (employee_id = (SELECT employee_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY "att_read_admin"   ON attendance FOR SELECT USING (get_my_role() IN ('super_admin','admin'));
CREATE POLICY "att_read_cmk"     ON attendance FOR SELECT USING (get_my_role() = 'cmk_coordinator' AND location = 'cmk');
CREATE POLICY "att_insert_self"  ON attendance FOR INSERT WITH CHECK (employee_id = (SELECT employee_id FROM profiles WHERE id = auth.uid()) AND get_my_role() = 'employee');
CREATE POLICY "att_insert_coord" ON attendance FOR INSERT WITH CHECK (get_my_role() = 'cmk_coordinator' AND location = 'cmk');
CREATE POLICY "att_checkout"     ON attendance FOR UPDATE USING (employee_id = (SELECT employee_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY "att_manage_admin" ON attendance FOR ALL    USING (get_my_role() IN ('super_admin','admin'));

-- ── WFH policies ──────────────────────────────────────────────
DROP POLICY IF EXISTS "wfh_read_own"  ON wfh_requests;
DROP POLICY IF EXISTS "wfh_read_admin" ON wfh_requests;
DROP POLICY IF EXISTS "wfh_insert"    ON wfh_requests;
DROP POLICY IF EXISTS "wfh_admin"     ON wfh_requests;
CREATE POLICY "wfh_read_own"   ON wfh_requests FOR SELECT USING (employee_id = (SELECT employee_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY "wfh_read_admin" ON wfh_requests FOR SELECT USING (get_my_role() IN ('super_admin','admin'));
CREATE POLICY "wfh_insert"     ON wfh_requests FOR INSERT WITH CHECK (employee_id = (SELECT employee_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY "wfh_admin"      ON wfh_requests FOR ALL    USING (get_my_role() IN ('super_admin','admin'));

-- ── Leave policies ────────────────────────────────────────────
DROP POLICY IF EXISTS "leave_read_own"   ON leave_requests;
DROP POLICY IF EXISTS "leave_read_admin" ON leave_requests;
DROP POLICY IF EXISTS "leave_insert"     ON leave_requests;
DROP POLICY IF EXISTS "leave_admin"      ON leave_requests;
CREATE POLICY "leave_read_own"   ON leave_requests FOR SELECT USING (employee_id = (SELECT employee_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY "leave_read_admin" ON leave_requests FOR SELECT USING (get_my_role() IN ('super_admin','admin'));
CREATE POLICY "leave_insert"     ON leave_requests FOR INSERT WITH CHECK (employee_id = (SELECT employee_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY "leave_admin"      ON leave_requests FOR ALL    USING (get_my_role() IN ('super_admin','admin'));

-- ── Balance policies ──────────────────────────────────────────
DROP POLICY IF EXISTS "bal_read_own"  ON leave_balances;
DROP POLICY IF EXISTS "bal_admin"     ON leave_balances;
CREATE POLICY "bal_read_own" ON leave_balances FOR SELECT USING (employee_id = (SELECT employee_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY "bal_admin"    ON leave_balances FOR ALL    USING (get_my_role() IN ('super_admin','admin'));

-- ── Holiday / Audit / Notif policies ─────────────────────────
DROP POLICY IF EXISTS "hol_read"    ON holidays;
DROP POLICY IF EXISTS "hol_admin"   ON holidays;
DROP POLICY IF EXISTS "audit_admin" ON audit_logs;
DROP POLICY IF EXISTS "audit_insert" ON audit_logs;
DROP POLICY IF EXISTS "notif_own"   ON notifications;
CREATE POLICY "hol_read"     ON holidays     FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "hol_admin"    ON holidays     FOR ALL    USING (get_my_role() = 'super_admin');
CREATE POLICY "audit_admin"  ON audit_logs   FOR SELECT USING (get_my_role() IN ('super_admin','admin'));
CREATE POLICY "audit_insert" ON audit_logs   FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "notif_own"    ON notifications FOR ALL   USING (user_id = auth.uid());

-- ============================================================
-- TRIGGERS
-- ============================================================

-- 1. Auto-create profile on signup + auto-link to employee
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role, employee_id)
  VALUES (
    NEW.id, NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email,'@',1)),
    COALESCE(NEW.raw_user_meta_data->>'role', 'employee'),
    (SELECT id FROM public.employees WHERE LOWER(email) = LOWER(NEW.email) LIMIT 1)
  ) ON CONFLICT (id) DO UPDATE SET
    employee_id = COALESCE(profiles.employee_id, (SELECT id FROM public.employees WHERE LOWER(email) = LOWER(NEW.email) LIMIT 1));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- 2. Auto-link when employee record is created
CREATE OR REPLACE FUNCTION link_employee_to_profile()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.profiles
  SET employee_id = NEW.id
  WHERE LOWER(email) = LOWER(NEW.email) AND employee_id IS NULL;

  INSERT INTO public.leave_balances (employee_id, year)
  VALUES (NEW.id, EXTRACT(YEAR FROM CURRENT_DATE))
  ON CONFLICT (employee_id, year) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS employee_autolink ON employees;
CREATE TRIGGER employee_autolink
  AFTER INSERT ON employees
  FOR EACH ROW EXECUTE FUNCTION link_employee_to_profile();

-- 3. Anti-cheat: server stamps all times, blocks WFH without approval
CREATE OR REPLACE FUNCTION enforce_attendance_integrity()
RETURNS TRIGGER AS $$
DECLARE
  ist_date DATE := (now() AT TIME ZONE 'Asia/Kolkata')::date;
  ist_time TIME := (now() AT TIME ZONE 'Asia/Kolkata')::time;
BEGIN
  IF TG_OP = 'INSERT' AND NEW.source = 'self_marked' THEN
    NEW.date           := ist_date;
    NEW.check_in_time  := ist_time;
    NEW.check_out_time := NULL;
    NEW.worked_minutes := 0;
    NEW.overtime_minutes := 0;
    IF NEW.work_mode = 'remote' AND NOT EXISTS (
      SELECT 1 FROM wfh_requests
      WHERE employee_id = NEW.employee_id
        AND status = 'approved'
        AND ist_date BETWEEN start_date AND end_date
    ) THEN
      RAISE EXCEPTION 'WFH_NOT_APPROVED';
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND get_my_role() = 'employee' THEN
    IF OLD.check_out_time IS NOT NULL THEN
      RAISE EXCEPTION 'ALREADY_CHECKED_OUT';
    END IF;
    NEW.employee_id    := OLD.employee_id;
    NEW.date           := OLD.date;
    NEW.check_in_time  := OLD.check_in_time;
    NEW.location       := OLD.location;
    NEW.work_mode      := OLD.work_mode;
    NEW.status         := OLD.status;
    NEW.source         := OLD.source;
    NEW.marked_by      := OLD.marked_by;
    NEW.check_out_time := ist_time;
    NEW.worked_minutes := GREATEST(0, (EXTRACT(EPOCH FROM (ist_time - OLD.check_in_time))/60)::int);
    NEW.overtime_minutes := GREATEST(0, NEW.worked_minutes - 480);
    RETURN NEW;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS attendance_integrity ON attendance;
CREATE TRIGGER attendance_integrity
  BEFORE INSERT OR UPDATE ON attendance
  FOR EACH ROW EXECUTE FUNCTION enforce_attendance_integrity();

-- 4. Auto-deduct leave balance on approval
CREATE OR REPLACE FUNCTION apply_leave_balance()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'approved' AND OLD.status = 'pending' THEN
    UPDATE leave_balances SET
      casual_used    = casual_used    + CASE WHEN NEW.leave_type='casual'    THEN NEW.total_days ELSE 0 END,
      sick_used      = sick_used      + CASE WHEN NEW.leave_type='sick'      THEN NEW.total_days ELSE 0 END,
      emergency_used = emergency_used + CASE WHEN NEW.leave_type='emergency' THEN NEW.total_days ELSE 0 END,
      paid_used      = paid_used      + CASE WHEN NEW.leave_type='paid'      THEN NEW.total_days ELSE 0 END
    WHERE employee_id = NEW.employee_id
      AND year = EXTRACT(YEAR FROM NEW.start_date);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS leave_balance_deduct ON leave_requests;
CREATE TRIGGER leave_balance_deduct
  AFTER UPDATE ON leave_requests
  FOR EACH ROW EXECUTE FUNCTION apply_leave_balance();

-- ============================================================
-- BACKFILL: fix any existing unlinked profiles
-- ============================================================
UPDATE profiles p
SET employee_id = e.id
FROM employees e
WHERE LOWER(p.email) = LOWER(e.email) AND p.employee_id IS NULL;

INSERT INTO leave_balances (employee_id, year)
SELECT id, EXTRACT(YEAR FROM CURRENT_DATE) FROM employees
ON CONFLICT (employee_id, year) DO NOTHING;

-- ============================================================
-- SEED DATA
-- ============================================================
INSERT INTO departments (name, location) VALUES
  ('Operations','office'),('Marketing','office'),('Finance','office'),
  ('Technology','office'),('HR','office'),('Production','cmk'),
  ('Packaging','cmk'),('Quality','cmk'),('Logistics','cmk')
ON CONFLICT DO NOTHING;

INSERT INTO holidays (holiday_date, name, location) VALUES
  ('2026-01-26','Republic Day','all'),
  ('2026-03-04','Holi','all'),
  ('2026-08-15','Independence Day','all'),
  ('2026-09-14','Ganesh Chaturthi','all'),
  ('2026-10-02','Gandhi Jayanti','all'),
  ('2026-10-20','Dussehra','all'),
  ('2026-11-08','Diwali','all'),
  ('2026-11-09','Govardhan Puja','all'),
  ('2026-12-25','Christmas','all')
ON CONFLICT DO NOTHING;
