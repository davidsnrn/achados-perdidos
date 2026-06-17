-- ============================================
-- EXECUTE ESTE SCRIPT NO SQL EDITOR DO SUPABASE
-- Copie todo o conteudo abaixo e cole no SQL Editor
-- ============================================

-- 1. Adicionar colunas na tabela users
ALTER TABLE IF EXISTS public.users 
ADD COLUMN IF NOT EXISTS email TEXT,
ADD COLUMN IF NOT EXISTS reset_token TEXT,
ADD COLUMN IF NOT EXISTS reset_token_expires TIMESTAMPTZ;

-- 2. Funcao para solicitar redefinicao
CREATE OR REPLACE FUNCTION public.request_password_reset(
  p_matricula text,
  p_token text,
  p_expires timestamptz
)
RETURNS TABLE (email text, name text)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  UPDATE public.users
  SET reset_token = p_token,
      reset_token_expires = p_expires
  WHERE matricula = p_matricula
  RETURNING users.email, users.name;
END;
$$;

-- 3. Funcao para concluir a redefinicao
CREATE OR REPLACE FUNCTION public.complete_password_reset(
  p_token text,
  p_new_password text,
  p_hashed_password text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_matricula text;
  v_updated boolean := false;
BEGIN
  UPDATE public.users
  SET password = p_hashed_password,
      reset_token = NULL,
      reset_token_expires = NULL
  WHERE reset_token = p_token
    AND reset_token_expires > NOW()
  RETURNING matricula INTO v_matricula;
  
  IF v_matricula IS NOT NULL THEN
    BEGIN
      UPDATE auth.users
      SET encrypted_password = auth.crypt(p_new_password, auth.gen_salt('bf'))
      WHERE email = v_matricula || '@sistema.local';
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Erro ao atualizar auth.users: %', SQLERRM;
    END;
    v_updated := true;
  END IF;
  
  RETURN COALESCE(v_updated, false);
END;
$$;

-- 4. Funcao para validar o token
CREATE OR REPLACE FUNCTION public.validate_reset_token(
  p_token text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_is_valid boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE reset_token = p_token
      AND reset_token_expires > NOW()
  ) INTO v_is_valid;
  
  RETURN COALESCE(v_is_valid, false);
END;
$$;
