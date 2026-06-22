-- ============================================
-- Script: corrigir-setor-id-nulo.sql
-- Descricao: Corrige registros com setor_id NULL
-- em todas as tabelas, atribuindo ao setor COADESC
-- do respectivo campus
-- ============================================

-- 1. Ver quantos registros serao afetados
SELECT 'items' AS tabela, COUNT(*) AS total FROM public.items WHERE setor_id IS NULL
UNION ALL
SELECT 'reports', COUNT(*) FROM public.reports WHERE setor_id IS NULL
UNION ALL
SELECT 'copy_records', COUNT(*) FROM public.copy_records WHERE setor_id IS NULL
UNION ALL
SELECT 'copy_configs', COUNT(*) FROM public.copy_configs WHERE setor_id IS NULL
ORDER BY tabela;

-- 2. Corrigir itens (achados)
UPDATE public.items i SET setor_id = s.id
FROM public.setores s
WHERE i.campus_id::text = s.campus_id AND s.slug = 'coadesc' AND i.setor_id IS NULL;

-- 3. Corrigir relatos (pedidos)
UPDATE public.reports r SET setor_id = s.id
FROM public.setores s
WHERE r.campus_id::text = s.campus_id AND s.slug = 'coadesc' AND r.setor_id IS NULL;

-- 4. Corrigir registros de copias
UPDATE public.copy_records cr SET setor_id = s.id
FROM public.setores s
WHERE cr.campus_id::text = s.campus_id AND s.slug = 'coadesc' AND cr.setor_id IS NULL;

-- 5. Corrigir configuracoes de copias
UPDATE public.copy_configs cc SET setor_id = s.id
FROM public.setores s
WHERE cc.campus_id::text = s.campus_id AND s.slug = 'coadesc' AND cc.setor_id IS NULL;

-- 6. Confirmar que nao restaram registros com setor nulo
SELECT 'items' AS tabela, COUNT(*) AS total FROM public.items WHERE setor_id IS NULL
UNION ALL
SELECT 'reports', COUNT(*) FROM public.reports WHERE setor_id IS NULL
UNION ALL
SELECT 'copy_records', COUNT(*) FROM public.copy_records WHERE setor_id IS NULL
UNION ALL
SELECT 'copy_configs', COUNT(*) FROM public.copy_configs WHERE setor_id IS NULL
ORDER BY tabela;
