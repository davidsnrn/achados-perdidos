-- ============================================================
-- Adicionar printer_id em copy_records para realocação
-- Execute este script no SQL Editor do Supabase
-- ============================================================

-- 1. Adicionar coluna printer_id (opcional) na tabela copy_records
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'copy_records'
      AND column_name  = 'printer_id'
  ) THEN
    ALTER TABLE public.copy_records
      ADD COLUMN printer_id UUID REFERENCES public.printer_registry(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 2. Índice para consultas por printer_id
CREATE INDEX IF NOT EXISTS idx_copy_records_printer_id
  ON public.copy_records (printer_id);

-- 3. Comentário explicativo
COMMENT ON COLUMN public.copy_records.printer_id
  IS 'Referência à impressora física vinculada. NULL = Controle de Cópias genérico.';
