-- ============================================
-- Script: corrigir-setor-id-notificacoes.sql
-- Descricao: Corrige notificacoes e usuarios com
-- setor_id NULL, atribuindo ao setor COADESC
-- do respectivo campus
-- ============================================

-- 1. Ver quantos registros serao afetados
SELECT 'student_notifications' AS tabela, COUNT(*) AS total FROM public.student_notifications WHERE setor_id IS NULL
UNION ALL
SELECT 'notification_types', COUNT(*) FROM public.notification_types WHERE setor_id IS NULL
UNION ALL
SELECT 'users', COUNT(*) FROM public.users WHERE setor_id IS NULL
UNION ALL
SELECT 'teacher_schedules', COUNT(*) FROM public.teacher_schedules WHERE setor_id IS NULL
UNION ALL
SELECT 'teacher_attendance', COUNT(*) FROM public.teacher_attendance WHERE setor_id IS NULL
UNION ALL
SELECT 'teacher_classes', COUNT(*) FROM public.teacher_classes WHERE setor_id IS NULL
UNION ALL
SELECT 'teacher_planned_absences', COUNT(*) FROM public.teacher_planned_absences WHERE setor_id IS NULL
UNION ALL
SELECT 'teacher_reposicoes', COUNT(*) FROM public.teacher_reposicoes WHERE setor_id IS NULL
UNION ALL
SELECT 'copy_configs', COUNT(*) FROM public.copy_configs WHERE setor_id IS NULL
UNION ALL
SELECT 'supply_restock_history', COUNT(*) FROM public.supply_restock_history WHERE setor_id IS NULL
UNION ALL
SELECT 'charge_history', COUNT(*) FROM public.charge_history WHERE setor_id IS NULL
ORDER BY tabela;

-- 2. Corrigir student_notifications
UPDATE public.student_notifications sn SET setor_id = s.id
FROM public.setores s
WHERE sn.campus_id::text = s.campus_id AND s.slug = 'coadesc' AND sn.setor_id IS NULL;

-- 3. Corrigir notification_types
UPDATE public.notification_types nt SET setor_id = s.id
FROM public.setores s
WHERE nt.campus_id::text = s.campus_id AND s.slug = 'coadesc' AND nt.setor_id IS NULL;

-- 4. Corrigir users
UPDATE public.users u SET setor_id = s.id
FROM public.setores s
WHERE u.campus_id::text = s.campus_id AND s.slug = 'coadesc' AND u.setor_id IS NULL;

-- 5. Corrigir copy_configs
UPDATE public.copy_configs cc SET setor_id = s.id
FROM public.setores s
WHERE cc.campus_id::text = s.campus_id AND s.slug = 'coadesc' AND cc.setor_id IS NULL;

-- 6. Corrigir teacher_schedules
UPDATE public.teacher_schedules ts SET setor_id = s.id
FROM public.setores s
WHERE ts.campus_id::text = s.campus_id AND s.slug = 'coadesc' AND ts.setor_id IS NULL;

-- 7. Corrigir teacher_attendance
UPDATE public.teacher_attendance ta SET setor_id = s.id
FROM public.setores s
WHERE ta.campus_id::text = s.campus_id AND s.slug = 'coadesc' AND ta.setor_id IS NULL;

-- 8. Corrigir teacher_classes
UPDATE public.teacher_classes tc SET setor_id = s.id
FROM public.setores s
WHERE tc.campus_id::text = s.campus_id AND s.slug = 'coadesc' AND tc.setor_id IS NULL;

-- 9. Corrigir teacher_planned_absences
UPDATE public.teacher_planned_absences tpa SET setor_id = s.id
FROM public.setores s
WHERE tpa.campus_id::text = s.campus_id AND s.slug = 'coadesc' AND tpa.setor_id IS NULL;

-- 10. Corrigir teacher_reposicoes
UPDATE public.teacher_reposicoes tr SET setor_id = s.id
FROM public.setores s
WHERE tr.campus_id::text = s.campus_id AND s.slug = 'coadesc' AND tr.setor_id IS NULL;

-- 11. Corrigir supply_restock_history
UPDATE public.supply_restock_history srh SET setor_id = s.id
FROM public.setores s
WHERE srh.campus_id::text = s.campus_id AND s.slug = 'coadesc' AND srh.setor_id IS NULL;

-- 12. Corrigir charge_history
UPDATE public.charge_history ch SET setor_id = s.id
FROM public.setores s
WHERE ch.campus_id::text = s.campus_id AND s.slug = 'coadesc' AND ch.setor_id IS NULL;

-- 13. Confirmar que nao restaram registros com setor nulo
SELECT 'student_notifications' AS tabela, COUNT(*) AS total FROM public.student_notifications WHERE setor_id IS NULL
UNION ALL
SELECT 'notification_types', COUNT(*) FROM public.notification_types WHERE setor_id IS NULL
UNION ALL
SELECT 'users', COUNT(*) FROM public.users WHERE setor_id IS NULL
UNION ALL
SELECT 'copy_configs', COUNT(*) FROM public.copy_configs WHERE setor_id IS NULL
UNION ALL
SELECT 'teacher_schedules', COUNT(*) FROM public.teacher_schedules WHERE setor_id IS NULL
UNION ALL
SELECT 'teacher_attendance', COUNT(*) FROM public.teacher_attendance WHERE setor_id IS NULL
UNION ALL
SELECT 'teacher_classes', COUNT(*) FROM public.teacher_classes WHERE setor_id IS NULL
UNION ALL
SELECT 'teacher_planned_absences', COUNT(*) FROM public.teacher_planned_absences WHERE setor_id IS NULL
UNION ALL
SELECT 'teacher_reposicoes', COUNT(*) FROM public.teacher_reposicoes WHERE setor_id IS NULL
UNION ALL
SELECT 'supply_restock_history', COUNT(*) FROM public.supply_restock_history WHERE setor_id IS NULL
UNION ALL
SELECT 'charge_history', COUNT(*) FROM public.charge_history WHERE setor_id IS NULL
ORDER BY tabela;
