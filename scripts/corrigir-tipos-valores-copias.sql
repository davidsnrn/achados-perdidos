-- ============================================================
-- CORREÇÃO: Tipos das colunas de preço em printer_billing_configs
-- As colunas de preço (*_price_*) devem ser NUMERIC, não INTEGER
-- Execute no SQL Editor do Supabase
-- ============================================================

-- 1. Verificar e corrigir colunas de preço (devem ser NUMERIC, não INTEGER)
DO $$
DECLARE
  col text;
  col_type text;
  cols text[] := ARRAY[
    'a4_mono_price_franchise', 'a4_mono_price_excess',
    'a4_poli_price_franchise', 'a4_poli_price_excess',
    'a3_mono_price_franchise', 'a3_mono_price_excess',
    'a3_poli_price_franchise', 'a3_poli_price_excess'
  ];
BEGIN
  FOREACH col IN ARRAY cols
  LOOP
    SELECT data_type INTO col_type
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'printer_billing_configs'
      AND column_name = col;

    IF col_type IS NULL THEN
      RAISE NOTICE 'Coluna % não encontrada', col;
    ELSIF col_type = 'integer' THEN
      RAISE NOTICE 'Corrigindo coluna % de integer para numeric(10,4)', col;
      EXECUTE format('
        ALTER TABLE public.printer_billing_configs
        ALTER COLUMN %I TYPE numeric(10,4)
        USING %I::numeric(10,4)
      ', col, col);
    ELSE
      RAISE NOTICE 'Coluna % já é % — OK', col, col_type;
    END IF;
  END LOOP;
END $$;

-- 2. Verificar colunas de franquia (devem ser INTEGER)
DO $$
DECLARE
  col text;
  col_type text;
  cols text[] := ARRAY[
    'a4_mono_franchise', 'a4_mono_excess_franchise',
    'a4_poli_franchise', 'a4_poli_excess_franchise',
    'a3_mono_franchise', 'a3_mono_excess_franchise',
    'a3_poli_franchise', 'a3_poli_excess_franchise'
  ];
BEGIN
  FOREACH col IN ARRAY cols
  LOOP
    SELECT data_type INTO col_type
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'printer_billing_configs'
      AND column_name = col;

    IF col_type IS NULL THEN
      RAISE NOTICE 'Coluna % não encontrada', col;
    ELSIF col_type <> 'integer' THEN
      RAISE NOTICE 'Corrigindo coluna % de % para integer', col, col_type;
      EXECUTE format('
        ALTER TABLE public.printer_billing_configs
        ALTER COLUMN %I TYPE integer
        USING %I::integer
      ', col, col);
    ELSE
      RAISE NOTICE 'Coluna % já é integer — OK', col;
    END IF;
  END LOOP;
END $$;
