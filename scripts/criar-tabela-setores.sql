-- ============================================
-- Script: criar-tabela-setores.sql
-- Descricao: Cria tabela de setores e adiciona
-- coluna setor_id nas tabelas de recursos
-- ============================================

-- 1. Criar tabela setores
CREATE TABLE IF NOT EXISTS public.setores (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    campus_id text NOT NULL REFERENCES public.campuses(id),
    name text NOT NULL,
    slug text NOT NULL,
    created_at timestamptz DEFAULT now()
);

-- 2. Adicionar coluna setor_id nas tabelas de recursos
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS setor_id uuid REFERENCES public.setores(id);
ALTER TABLE public.people ADD COLUMN IF NOT EXISTS setor_id uuid REFERENCES public.setores(id);
ALTER TABLE public.lockers ADD COLUMN IF NOT EXISTS setor_id uuid REFERENCES public.setores(id);
ALTER TABLE public.locker_schedules ADD COLUMN IF NOT EXISTS setor_id uuid REFERENCES public.setores(id);
ALTER TABLE public.materials ADD COLUMN IF NOT EXISTS setor_id uuid REFERENCES public.setores(id);
ALTER TABLE public.material_loans ADD COLUMN IF NOT EXISTS setor_id uuid REFERENCES public.setores(id);
ALTER TABLE public.charge_history ADD COLUMN IF NOT EXISTS setor_id uuid REFERENCES public.setores(id);
ALTER TABLE public.books ADD COLUMN IF NOT EXISTS setor_id uuid REFERENCES public.setores(id);
ALTER TABLE public.book_loans ADD COLUMN IF NOT EXISTS setor_id uuid REFERENCES public.setores(id);
ALTER TABLE public.items ADD COLUMN IF NOT EXISTS setor_id uuid REFERENCES public.setores(id);
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS setor_id uuid REFERENCES public.setores(id);
ALTER TABLE public.copy_configs ADD COLUMN IF NOT EXISTS setor_id uuid REFERENCES public.setores(id);
ALTER TABLE public.copy_records ADD COLUMN IF NOT EXISTS setor_id uuid REFERENCES public.setores(id);
ALTER TABLE public.supplies ADD COLUMN IF NOT EXISTS setor_id uuid REFERENCES public.setores(id);
ALTER TABLE public.supply_records ADD COLUMN IF NOT EXISTS setor_id uuid REFERENCES public.setores(id);
ALTER TABLE public.supply_restock_history ADD COLUMN IF NOT EXISTS setor_id uuid REFERENCES public.setores(id);
ALTER TABLE public.student_notifications ADD COLUMN IF NOT EXISTS setor_id uuid REFERENCES public.setores(id);
ALTER TABLE public.notification_types ADD COLUMN IF NOT EXISTS setor_id uuid REFERENCES public.setores(id);
ALTER TABLE public.teacher_schedules ADD COLUMN IF NOT EXISTS setor_id uuid REFERENCES public.setores(id);
ALTER TABLE public.teacher_attendance ADD COLUMN IF NOT EXISTS setor_id uuid REFERENCES public.setores(id);
ALTER TABLE public.teacher_classes ADD COLUMN IF NOT EXISTS setor_id uuid REFERENCES public.setores(id);
ALTER TABLE public.teacher_planned_absences ADD COLUMN IF NOT EXISTS setor_id uuid REFERENCES public.setores(id);
ALTER TABLE public.teacher_reposicoes ADD COLUMN IF NOT EXISTS setor_id uuid REFERENCES public.setores(id);

-- 3. Criar setor "Geral" para cada campus existente
INSERT INTO public.setores (campus_id, name, slug)
SELECT DISTINCT campus_id, 'Geral', 'geral'
FROM public.users
WHERE campus_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.setores s
    WHERE s.campus_id = public.users.campus_id AND s.slug = 'geral'
  );

-- 4. Migrar registros existentes para o setor Geral do seu campus
UPDATE public.users u SET setor_id = s.id
FROM public.setores s
WHERE u.campus_id = s.campus_id AND s.slug = 'geral'
  AND u.setor_id IS NULL;

UPDATE public.lockers l SET setor_id = s.id
FROM public.setores s
WHERE l.campus_id = s.campus_id AND s.slug = 'geral'
  AND l.setor_id IS NULL;

UPDATE public.locker_schedules ls SET setor_id = s.id
FROM public.setores s
WHERE ls.campus_id = s.campus_id AND s.slug = 'geral'
  AND ls.setor_id IS NULL;

UPDATE public.materials m SET setor_id = s.id
FROM public.setores s
WHERE m.campus_id = s.campus_id AND s.slug = 'geral'
  AND m.setor_id IS NULL;

UPDATE public.material_loans ml SET setor_id = s.id
FROM public.setores s
WHERE ml.campus_id = s.campus_id AND s.slug = 'geral'
  AND ml.setor_id IS NULL;

UPDATE public.charge_history ch SET setor_id = s.id
FROM public.setores s
WHERE ch.campus_id = s.campus_id AND s.slug = 'geral'
  AND ch.setor_id IS NULL;

UPDATE public.books b SET setor_id = s.id
FROM public.setores s
WHERE b.campus_id = s.campus_id AND s.slug = 'geral'
  AND b.setor_id IS NULL;

UPDATE public.book_loans bl SET setor_id = s.id
FROM public.setores s
WHERE bl.campus_id = s.campus_id AND s.slug = 'geral'
  AND bl.setor_id IS NULL;

UPDATE public.items i SET setor_id = s.id
FROM public.setores s
WHERE i.campus_id = s.campus_id AND s.slug = 'geral'
  AND i.setor_id IS NULL;

UPDATE public.reports r SET setor_id = s.id
FROM public.setores s
WHERE r.campus_id = s.campus_id AND s.slug = 'geral'
  AND r.setor_id IS NULL;

UPDATE public.copy_configs cc SET setor_id = s.id
FROM public.setores s
WHERE cc.campus_id = s.campus_id AND s.slug = 'geral'
  AND cc.setor_id IS NULL;

UPDATE public.copy_records cr SET setor_id = s.id
FROM public.setores s
WHERE cr.campus_id = s.campus_id AND s.slug = 'geral'
  AND cr.setor_id IS NULL;

UPDATE public.supplies sp SET setor_id = s.id
FROM public.setores s
WHERE sp.campus_id = s.campus_id AND s.slug = 'geral'
  AND sp.setor_id IS NULL;

UPDATE public.supply_records sr SET setor_id = s.id
FROM public.setores s
WHERE sr.campus_id = s.campus_id AND s.slug = 'geral'
  AND sr.setor_id IS NULL;

UPDATE public.supply_restock_history srh SET setor_id = s.id
FROM public.setores s
WHERE srh.campus_id = s.campus_id AND s.slug = 'geral'
  AND srh.setor_id IS NULL;

UPDATE public.student_notifications sn SET setor_id = s.id
FROM public.setores s
WHERE sn.campus_id = s.campus_id AND s.slug = 'geral'
  AND sn.setor_id IS NULL;

UPDATE public.notification_types nt SET setor_id = s.id
FROM public.setores s
WHERE nt.campus_id = s.campus_id AND s.slug = 'geral'
  AND nt.setor_id IS NULL;

UPDATE public.teacher_schedules ts SET setor_id = s.id
FROM public.setores s
WHERE ts.campus_id = s.campus_id AND s.slug = 'geral'
  AND ts.setor_id IS NULL;

UPDATE public.teacher_attendance ta SET setor_id = s.id
FROM public.setores s
WHERE ta.campus_id = s.campus_id AND s.slug = 'geral'
  AND ta.setor_id IS NULL;

UPDATE public.teacher_classes tc SET setor_id = s.id
FROM public.setores s
WHERE tc.campus_id = s.campus_id AND s.slug = 'geral'
  AND tc.setor_id IS NULL;

UPDATE public.teacher_planned_absences tpa SET setor_id = s.id
FROM public.setores s
WHERE tpa.campus_id = s.campus_id AND s.slug = 'geral'
  AND tpa.setor_id IS NULL;

UPDATE public.teacher_reposicoes tr SET setor_id = s.id
FROM public.setores s
WHERE tr.campus_id = s.campus_id AND s.slug = 'geral'
  AND tr.setor_id IS NULL;

UPDATE public.people p SET setor_id = s.id
FROM public.setores s
WHERE p.campus_id = s.campus_id AND s.slug = 'geral'
  AND p.setor_id IS NULL;
