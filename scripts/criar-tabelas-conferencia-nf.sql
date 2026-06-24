-- ============================================================
-- CONFERÊNCIA DE NF DE IMPRESSÃO - Criação das Tabelas
-- Execute este script no SQL Editor do Supabase
-- ============================================================

-- 1. Tabela de Cadastro Geral de Impressoras por Nome Local
CREATE TABLE IF NOT EXISTS public.printer_registry (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campus_id         TEXT NOT NULL,
  local_name        TEXT NOT NULL,             -- e.g. CMIMPADM15
  serial_number     TEXT,
  ip_address        TEXT,
  model             TEXT,
  supports_a4_mono  BOOLEAN NOT NULL DEFAULT true,
  supports_a4_poli  BOOLEAN NOT NULL DEFAULT false,
  supports_a3_mono  BOOLEAN NOT NULL DEFAULT false,
  supports_a3_poli  BOOLEAN NOT NULL DEFAULT false,
  active            BOOLEAN NOT NULL DEFAULT true,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_printer_registry_campus ON public.printer_registry(campus_id);

-- 2. Tabela de Registros de Contadores de Impressoras
CREATE TABLE IF NOT EXISTS public.printer_counter_records (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campus_id       TEXT NOT NULL,
  period          TEXT NOT NULL,             -- Formato: 'YYYY-MM' (ex: '2026-05')
  printer_id      UUID REFERENCES public.printer_registry(id) ON DELETE SET NULL,
  local_name      TEXT NOT NULL,             -- Armazena o Nome Local desnormalizado para histórico
  serial_number   TEXT,
  ip_address      TEXT,
  model           TEXT,
  format          TEXT NOT NULL CHECK (format IN ('A4', 'A3')),
  color_mode      TEXT NOT NULL CHECK (color_mode IN ('MONO', 'POLI')),
  counter_prev    BIGINT NOT NULL DEFAULT 0, -- Contador mês anterior
  counter_curr    BIGINT NOT NULL DEFAULT 0, -- Contador mês atual
  operator_id     TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_printer_counter_campus_period
  ON public.printer_counter_records (campus_id, period);

-- 2b. Migração segura para quem já tem a tabela antiga de contadores
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'printer_counter_records'
      AND column_name  = 'printer_id'
  ) THEN
    ALTER TABLE public.printer_counter_records ADD COLUMN printer_id UUID REFERENCES public.printer_registry(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'printer_counter_records'
      AND column_name  = 'local_name'
  ) THEN
    -- Se local_name não existe, adiciona permitindo NULL provisoriamente ou preenchendo com serial_number
    ALTER TABLE public.printer_counter_records ADD COLUMN local_name TEXT;
    UPDATE public.printer_counter_records SET local_name = serial_number WHERE local_name IS NULL;
    ALTER TABLE public.printer_counter_records ALTER COLUMN local_name SET NOT NULL;
  END IF;

  -- Tornar serial_number opcional em printer_counter_records já que agora pode vir do cadastro
  ALTER TABLE public.printer_counter_records ALTER COLUMN serial_number DROP NOT NULL;
END $$;

-- 3. Tabela de Configuração de Faturamento (Franquias e Valores)
CREATE TABLE IF NOT EXISTS public.printer_billing_configs (
  id                           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campus_id                    TEXT NOT NULL UNIQUE,
  -- A4 Monocromático
  a4_mono_franchise            INTEGER DEFAULT 16000,  -- páginas incluídas no contrato
  a4_mono_excess_franchise     INTEGER DEFAULT 5000,   -- teto de excedente (após isso: bloqueado)
  a4_mono_price_franchise      NUMERIC(10,4) DEFAULT 0.052,
  a4_mono_price_excess         NUMERIC(10,4) DEFAULT 0.042,
  -- A4 Policromático
  a4_poli_franchise            INTEGER DEFAULT 500,
  a4_poli_excess_franchise     INTEGER DEFAULT 200,
  a4_poli_price_franchise      NUMERIC(10,4) DEFAULT 0.306,
  a4_poli_price_excess         NUMERIC(10,4) DEFAULT 0.200,
  -- A3 Monocromático
  a3_mono_franchise            INTEGER DEFAULT 100,
  a3_mono_excess_franchise     INTEGER DEFAULT 50,
  a3_mono_price_franchise      NUMERIC(10,4) DEFAULT 0.198,
  a3_mono_price_excess         NUMERIC(10,4) DEFAULT 0.084,
  -- A3 Policromático
  a3_poli_franchise            INTEGER DEFAULT 100,
  a3_poli_excess_franchise     INTEGER DEFAULT 50,
  a3_poli_price_franchise      NUMERIC(10,4) DEFAULT 0.306,
  a3_poli_price_excess         NUMERIC(10,4) DEFAULT 0.200,
  created_at                   TIMESTAMPTZ DEFAULT NOW(),
  updated_at                   TIMESTAMPTZ DEFAULT NOW()
);

-- RLS: Acesso total via chave anon
ALTER TABLE public.printer_registry ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.printer_counter_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.printer_billing_configs  ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Acesso Total Printer Registry" ON public.printer_registry;
DROP POLICY IF EXISTS "Acesso Total Printer Counter" ON public.printer_counter_records;
DROP POLICY IF EXISTS "Acesso Total Printer Billing" ON public.printer_billing_configs;

CREATE POLICY "Acesso Total Printer Registry"
  ON public.printer_registry FOR ALL TO anon, authenticated
  USING (true) WITH CHECK (true);

CREATE POLICY "Acesso Total Printer Counter"
  ON public.printer_counter_records FOR ALL TO anon, authenticated
  USING (true) WITH CHECK (true);

CREATE POLICY "Acesso Total Printer Billing"
  ON public.printer_billing_configs FOR ALL TO anon, authenticated
  USING (true) WITH CHECK (true);

-- Habilitar Realtime
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public' AND tablename = 'printer_registry'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.printer_registry;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public' AND tablename = 'printer_counter_records'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.printer_counter_records;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public' AND tablename = 'printer_billing_configs'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.printer_billing_configs;
  END IF;
END $$;
