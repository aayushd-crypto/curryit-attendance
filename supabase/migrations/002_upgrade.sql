-- ============================================================
-- CURRYiT v2 UPGRADE — Run this ENTIRE file in Supabase SQL Editor
-- Adds: check-out/overtime, WFH approvals, paid leave, balances,
-- anti-cheat triggers, auto profile↔employee linking, holidays
-- ============================================================

-- ── 1. Attendance: check-out + overtime ──────────────────────
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS check_out_time TIME;
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS overtime_minutes INT NOT NULL DEFAULT 0;
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS worked_minutes INT NOT NULL DEFAULT 0;

-- ── 2. Leave types: add paid / unpaid ─────────────────────────
ALTER TABLE leave_requests DROP CONSTRAINT IF EXISTS leave_requests_leave_type_check;
ALTER TABLE leave_requests ADD CONSTRAINT leave_requests_leave_type_check
  CHECK (leave_type IN ('casual','sick','emergency','paid','unpaid'));

-- ── 3. Leave balances: add paid leave ─────────────────────────
ALTER TABLE leave_balances ADD COLUMN IF NOT EXISTS paid_total INT NOT NULL DEFAULT 15;
ALTER TABLE leave_balances ADD COLUMN IF NOT EXISTS paid_used  INT NOT NULL DEFAULT 0;

-- ── 4. WFH requests table ─────────────────────────────────────
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
ALTER TABLE wfh_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Employees read own wfh" ON wfh_requests;
CREATE POLICY "Employees read own wfh" ON wfh_requests FOR SELECT
  USING (employee_id = (SELECT employee_id FROM profiles WHERE id = auth.uid()));
DROP POLICY IF EXISTS "Admins read all wfh" ON wfh_requests;
CREATE POLICY "Admins read all wfh" ON wfh_requests FOR SELECT
  USING (get_my_role() IN ('super_admin','admin'));
DROP POLICY IF EXISTS "Employees request wfh" ON wfh_requests;
CREATE POLICY "Employees request wfh" ON wfh_requests FOR INSERT
  WITH CHECK (employee_id = (SELECT employee_id FROM profiles WHERE id = auth.uid()));
DROP POLICY IF EXISTS "Admins manage wfh" ON wfh_requests;
CREATE POLICY "Admins manage wfh" ON wfh_requests FOR UPDATE
  USING (get_my_role() IN ('super_admin','admin'));

-- ── 5. Allow employees to UPDATE own attendance (check-out only,
--       trigger below locks everything else) ────────────────────
DROP POLICY IF EXISTS "Employees checkout own attendance" ON attendance;
CREATE POLICY "Employees checkout own attendance" ON attendance FOR UPDATE
  USING (employee_id = (SELECT employee_id FROM profiles WHERE id = auth.uid()));

-- ── 6. ANTI-CHEAT TRIGGER ─────────────────────────────────────
-- Server stamps all times in IST. Employees cannot:
--   • backdate or forward-date attendance
--   • fake check-in/check-out times (server clock wins)
--   • check out twice or modify any field after the fact
--   • mark Remote without an APPROVED WFH request for that day
CREATE OR REPLACE FUNCTION enforce_attendance_integrity()
RETURNS TRIGGER AS $$
DECLARE
  ist_date DATE := (now() AT TIME ZONE 'Asia/Kolkata')::date;
  ist_time TIME := (now() AT TIME ZONE 'Asia/Kolkata')::time;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.source = 'self_marked' THEN
      NEW.date := ist_date;                -- server date, not client
      NEW.check_in_time := ist_time;       -- server time, not client
      NEW.check_out_time := NULL;
      NEW.overtime_minutes := 0;
      NEW.worked_minutes := 0;
      IF NEW.work_mode = 'remote' AND NOT EXISTS (
        SELECT 1 FROM wfh_requests w
        WHERE w.employee_id = NEW.employee_id
          AND w.status = 'approved'
          AND ist_date BETWEEN w.start_date AND w.end_date
      ) THEN
        RAISE EXCEPTION 'WFH_NOT_APPROVED';
      END IF;
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND get_my_role() = 'employee' THEN
    IF OLD.check_out_time IS NOT NULL THEN
      RAISE EXCEPTION 'ALREADY_CHECKED_OUT';
    END IF;
    -- lock every field; only server-stamped checkout allowed
    NEW.employee_id    := OLD.employee_id;
    NEW.date           := OLD.date;
    NEW.check_in_time  := OLD.check_in_time;
    NEW.location       := OLD.location;
    NEW.work_mode      := OLD.work_mode;
    NEW.status         := OLD.status;
    NEW.source         := OLD.source;
    NEW.marked_by      := OLD.marked_by;
    NEW.check_out_time := ist_time;
    NEW.worked_minutes := GREATEST(0, (EXTRACT(EPOCH FROM (ist_time - OLD.check_in_time)) / 60)::int);
    NEW.overtime_minutes := GREATEST(0, NEW.worked_minutes - 480);  -- 8h standard day
    RETURN NEW;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS attendance_integrity ON attendance;
CREATE TRIGGER attendance_integrity
  BEFORE INSERT OR UPDATE ON attendance
  FOR EACH ROW EXECUTE FUNCTION enforce_attendance_integrity();

-- ── 7. AUTO-LINK profiles ↔ employees (no more manual SQL!) ───
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role, employee_id)
  VALUES (
    NEW.id, NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email,'@',1)),
    COALESCE(NEW.raw_user_meta_data->>'role', 'employee'),
    (SELECT id FROM public.employees WHERE email = NEW.email LIMIT 1)
  ) ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION link_employee_to_profile()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.profiles SET employee_id = NEW.id
  WHERE email = NEW.email AND employee_id IS NULL;
  -- auto-create leave balance for current year
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

-- Backfill: link existing rows + create balances
UPDATE profiles p SET employee_id = e.id
FROM employees e WHERE p.email = e.email AND p.employee_id IS NULL;

INSERT INTO leave_balances (employee_id, year)
SELECT id, EXTRACT(YEAR FROM CURRENT_DATE) FROM employees
ON CONFLICT (employee_id, year) DO NOTHING;

-- ── 8. Auto-deduct balance when leave approved ────────────────
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

-- Admins can manage balances; employees read own (policies exist, ensure update)
DROP POLICY IF EXISTS "Admins update balances" ON leave_balances;
CREATE POLICY "Admins update balances" ON leave_balances FOR UPDATE
  USING (get_my_role() IN ('super_admin','admin'));

-- ── 9. Indian holidays 2026 ───────────────────────────────────
INSERT INTO holidays (holiday_date, name, location) VALUES
  ('2026-01-26', 'Republic Day',     'all'),
  ('2026-03-04', 'Holi',             'all'),
  ('2026-08-15', 'Independence Day', 'all'),
  ('2026-09-14', 'Ganesh Chaturthi', 'all'),
  ('2026-10-02', 'Gandhi Jayanti',   'all'),
  ('2026-10-20', 'Dussehra',         'all'),
  ('2026-11-08', 'Diwali',           'all'),
  ('2026-11-09', 'Govardhan Puja',   'all'),
  ('2026-12-25', 'Christmas',        'all')
ON CONFLICT DO NOTHING;
