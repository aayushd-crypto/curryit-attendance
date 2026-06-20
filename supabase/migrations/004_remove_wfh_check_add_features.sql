-- ── Migration 004: Remove WFH approval requirement from attendance trigger ────

-- Drop the existing trigger and function, then recreate without WFH check

-- For migration 002's trigger (most recent):
CREATE OR REPLACE FUNCTION handle_attendance_v2()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  ist_date DATE := (now() AT TIME ZONE 'Asia/Kolkata')::date;
  ist_time TIME := (now() AT TIME ZONE 'Asia/Kolkata')::time;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.source = 'self_marked' THEN
      NEW.date             := ist_date;
      NEW.check_in_time    := ist_time;
      NEW.check_out_time   := NULL;
      NEW.overtime_minutes := 0;
      NEW.worked_minutes   := 0;
      -- WFH approval check REMOVED — employees can mark remote freely
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
    NEW.source         := OLD.source;
    NEW.marked_by      := OLD.marked_by;
    NEW.status         := OLD.status;
    NEW.check_out_time := ist_time;
    NEW.worked_minutes := GREATEST(0,
      EXTRACT(EPOCH FROM (ist_time - OLD.check_in_time::time)) / 60
    )::int;
    NEW.overtime_minutes := GREATEST(0, NEW.worked_minutes - 480);
    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$;

-- Re-attach the trigger (drop old one first to avoid conflicts)
DROP TRIGGER IF EXISTS trg_attendance_v2 ON attendance;
CREATE TRIGGER trg_attendance_v2
  BEFORE INSERT OR UPDATE ON attendance
  FOR EACH ROW EXECUTE FUNCTION handle_attendance_v2();

-- Also patch the original trigger function if it exists
CREATE OR REPLACE FUNCTION handle_attendance()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  ist_date DATE := (now() AT TIME ZONE 'Asia/Kolkata')::date;
  ist_time TIME := (now() AT TIME ZONE 'Asia/Kolkata')::time;
BEGIN
  IF TG_OP = 'INSERT' AND NEW.source = 'self_marked' THEN
    NEW.date             := ist_date;
    NEW.check_in_time    := ist_time;
    NEW.check_out_time   := NULL;
    NEW.worked_minutes   := 0;
    NEW.overtime_minutes := 0;
    -- WFH approval check REMOVED
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND get_my_role() = 'employee' THEN
    IF OLD.check_out_time IS NOT NULL THEN
      RAISE EXCEPTION 'ALREADY_CHECKED_OUT';
    END IF;
    NEW.check_out_time   := ist_time;
    NEW.worked_minutes   := GREATEST(0,
      EXTRACT(EPOCH FROM (ist_time - OLD.check_in_time::time)) / 60
    )::int;
    NEW.overtime_minutes := GREATEST(0, NEW.worked_minutes - 480);
    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$;
