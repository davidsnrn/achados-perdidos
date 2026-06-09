ALTER TABLE student_notifications
ADD COLUMN IF NOT EXISTS operator_name text,
ADD COLUMN IF NOT EXISTS operator_matricula text,
ADD COLUMN IF NOT EXISTS updated_by text,
ADD COLUMN IF NOT EXISTS updated_by_name text,
ADD COLUMN IF NOT EXISTS updated_by_matricula text,
ADD COLUMN IF NOT EXISTS updated_at timestamptz,
ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
ADD COLUMN IF NOT EXISTS deleted_by text,
ADD COLUMN IF NOT EXISTS deleted_by_name text,
ADD COLUMN IF NOT EXISTS deleted_by_matricula text,
ADD COLUMN IF NOT EXISTS deleted_justification text;
