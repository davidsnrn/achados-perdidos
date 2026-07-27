-- ============================================
-- Script: adicionar-kiosk-code-setores.sql
-- Descricao: Adiciona coluna kiosk_code na tabela setores
-- para o terminal de autoatendimento
-- ============================================

ALTER TABLE public.setores ADD COLUMN IF NOT EXISTS kiosk_code text;

-- Adicionar setores na publicacao de realtime (opcional, para sincronizar em tempo real)
ALTER PUBLICATION supabase_realtime ADD TABLE public.setores;
