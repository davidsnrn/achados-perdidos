-- ============================================
-- Script: renomear-setor-geral-para-coadesc.sql
-- Descricao: Renomeia todos os setores "Geral"
-- para "COADESC" em cada campus
-- ============================================

-- 1. Renomear setores "Geral" para "COADESC"
UPDATE public.setores
SET name = 'COADESC', slug = 'coadesc'
WHERE name = 'Geral' OR slug = 'geral';

-- 2. Confirmar
SELECT id, campus_id, name, slug FROM public.setores ORDER BY campus_id, name;
