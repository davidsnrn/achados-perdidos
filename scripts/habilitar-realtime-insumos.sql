-- Habilitar o Realtime para as tabelas de insumos no Supabase de forma segura
-- Copie e execute este script no painel SQL Editor do seu Supabase.

DO $$
BEGIN
  -- Habilitar para a tabela public.supplies
  IF NOT EXISTS (
    SELECT 1 
    FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
      AND schemaname = 'public' 
      AND tablename = 'supplies'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.supplies;
  END IF;

  -- Habilitar para a tabela public.supply_records
  IF NOT EXISTS (
    SELECT 1 
    FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
      AND schemaname = 'public' 
      AND tablename = 'supply_records'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.supply_records;
  END IF;

  -- Habilitar para a tabela public.supply_restock_history
  IF NOT EXISTS (
    SELECT 1 
    FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
      AND schemaname = 'public' 
      AND tablename = 'supply_restock_history'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.supply_restock_history;
  END IF;
END $$;
