-- ============================================
-- Script: corrigir-setor-id-nulo.sql
-- Descricao: Corrige itens e relatos com setor_id
-- NULL, atribuindo ao setor COADESC do seu campus
-- ============================================

-- 1. Ver quantos itens serao afetados
SELECT COUNT(*) AS itens_sem_setor FROM public.items WHERE setor_id IS NULL;

-- 2. Ver quantos relatos serao afetados
SELECT COUNT(*) AS relatos_sem_setor FROM public.reports WHERE setor_id IS NULL;

-- 3. Corrigir itens (achados)
UPDATE public.items i SET setor_id = s.id
FROM public.setores s
WHERE i.campus_id::text = s.campus_id AND s.slug = 'coadesc' AND i.setor_id IS NULL;

-- 4. Corrigir relatos (pedidos)
UPDATE public.reports r SET setor_id = s.id
FROM public.setores s
WHERE r.campus_id::text = s.campus_id AND s.slug = 'coadesc' AND r.setor_id IS NULL;

-- 5. Confirmar que nao restaram registros com setor nulo
SELECT COUNT(*) AS itens_ainda_sem_setor FROM public.items WHERE setor_id IS NULL;
SELECT COUNT(*) AS relatos_ainda_sem_setor FROM public.reports WHERE setor_id IS NULL;
