-- Add department_id to profiles so super_admin can scope admins to a department
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS department_id UUID REFERENCES departments(id) ON DELETE SET NULL;

-- Allow admins to read their own profile department_id
-- (existing RLS already allows this via auth.uid() check)
