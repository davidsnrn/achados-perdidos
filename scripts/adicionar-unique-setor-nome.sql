-- ============================================
-- Script: adicionar-unique-setor-nome.sql
-- Descricao: Adiciona constraint UNIQUE em
-- (campus_id, name) na tabela setores
-- ============================================

-- 1. Remover duplicatas antes de criar a constraint (caso existam)
DELETE FROM public.setores s1
USING public.setores s2
WHERE s1.id > s2.id
  AND s1.campus_id = s2.campus_id
  AND LOWER(s1.name) = LOWER(s2.name);

-- 2. Adicionar unique constraint
ALTER TABLE public.setores
ADD CONSTRAINT unique_setor_nome_campus UNIQUE (campus_id, name);
