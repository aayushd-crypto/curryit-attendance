-- Change standard work day from 8h (480 min) to 9h (540 min)
-- Re-create the checkout trigger with updated overtime threshold

CREATE OR REPLACE FUNCTION handle_checkout()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  ist_time TIMESTAMPTZ;
BEGIN
  IF NEW.check_out_time IS NOT NULL AND OLD.check_out_time IS NULL THEN
    ist_time := NEW.check_out_time AT TIME ZONE 'Asia/Kolkata';
    NEW.worked_minutes   := GREATEST(0, (EXTRACT(EPOCH FROM (ist_time - OLD.check_in_time)) / 60)::int);
    NEW.overtime_minutes := GREATEST(0, NEW.worked_minutes - 540); -- 9h standard day
  END IF;
  RETURN NEW;
END;
$$;
