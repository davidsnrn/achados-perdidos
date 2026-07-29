-- Adiciona coluna kiosk_code na tabela campuses (se não existir)
ALTER TABLE public.campuses ADD COLUMN IF NOT EXISTS kiosk_code text;

-- Habilita realtime para campuses
ALTER PUBLICATION supabase_realtime ADD TABLE IF NOT EXISTS public.campuses;

-- Consulta: Campuses com mais de 1 setor cadastrado
SELECT 
  c.id,
  c.name,
  c.slug,
  COUNT(s.id)::int AS total_setores
FROM public.campuses c
LEFT JOIN public.setores s ON s.campus_id = c.id::text
GROUP BY c.id, c.name, c.slug
HAVING COUNT(s.id) > 1
ORDER BY COUNT(s.id) DESC;
