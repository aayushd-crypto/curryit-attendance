-- Add employee_type column
ALTER TABLE employees
  ADD COLUMN IF NOT EXISTS employee_type text NOT NULL DEFAULT 'staff'
  CHECK (employee_type IN ('staff','labor'));

-- CMK coordinator can add/delete labor workers
CREATE POLICY "emp_insert_cmk_labor" ON employees FOR INSERT
  WITH CHECK (get_my_role() = 'cmk_coordinator' AND employee_type = 'labor' AND location = 'cmk');

CREATE POLICY "emp_delete_cmk_labor" ON employees FOR DELETE
  USING (get_my_role() = 'cmk_coordinator' AND employee_type = 'labor' AND location = 'cmk');

-- CMK coordinator can update (re-mark) labor attendance
CREATE POLICY "att_update_coord_labor" ON attendance FOR UPDATE
  USING (
    get_my_role() = 'cmk_coordinator' AND location = 'cmk' AND
    EXISTS (SELECT 1 FROM employees e WHERE e.id = employee_id AND e.employee_type = 'labor')
  );
