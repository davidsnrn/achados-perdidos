-- Execute este SQL no SQL Editor do Supabase
-- Acesse: https://supabase.com/dashboard/project/vfcnptykhuljtoykpbmv/sql/new

-- 1. Adicionar coluna phone na tabela people (se ainda não existir)
ALTER TABLE people ADD COLUMN IF NOT EXISTS phone TEXT;

-- 2. Atualizar a função search_people_global para retornar o campo phone
CREATE OR REPLACE FUNCTION search_people_global(p_query text, p_limit int DEFAULT 20)
RETURNS TABLE(
  matricula text,
  name text,
  campus_id uuid,
  type text,
  email text,
  phone text
) 
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    p.matricula, 
    p.name, 
    p.campus_id, 
    p.type::text, 
    p.email,
    p.phone
  FROM people p
  WHERE 
    unaccent(lower(p.name)) LIKE '%' || unaccent(lower(p_query)) || '%'
    OR lower(p.matricula) LIKE '%' || lower(p_query) || '%'
  ORDER BY p.name
  LIMIT p_limit;
$$;

-- Verificar o resultado
SELECT * FROM search_people_global('ana', 1);
