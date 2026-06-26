-- ============================================================
-- Migração: Adicionar colunas faltantes em copy_records
-- Execute este script no SQL Editor do Supabase
-- ============================================================

-- 1. Adicionar coluna format (A4/A3)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'copy_records'
      AND column_name  = 'format'
  ) THEN
    ALTER TABLE public.copy_records
      ADD COLUMN format TEXT NOT NULL DEFAULT 'A4'
      CHECK (format IN ('A4', 'A3'));
  END IF;
END $$;

-- 2. Adicionar coluna color_mode (MONO/POLI)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'copy_records'
      AND column_name  = 'color_mode'
  ) THEN
    ALTER TABLE public.copy_records
      ADD COLUMN color_mode TEXT NOT NULL DEFAULT 'MONO'
      CHECK (color_mode IN ('MONO', 'POLI'));
  END IF;
END $$;

-- 3. Adicionar coluna printer_id (opcional, vinculação com impressora física)
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

-- 4. Índice para consultas por printer_id
CREATE INDEX IF NOT EXISTS idx_copy_records_printer_id
  ON public.copy_records (printer_id);

-- 5. Comentários
COMMENT ON COLUMN public.copy_records.format IS 'Formato do papel: A4 ou A3';
COMMENT ON COLUMN public.copy_records.color_mode IS 'Modo de cor: MONO (Preto e Branco) ou POLI (Colorido)';
COMMENT ON COLUMN public.copy_records.printer_id IS 'Referência à impressora física vinculada. NULL = Controle de Cópias genérico.';
