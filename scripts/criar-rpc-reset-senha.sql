-- SQL para criar as funções RPC de redefinição de senha no Supabase
-- Cole e execute este código no SQL Editor do painel do Supabase.

-- 1. Função para solicitar redefinição (Salva o token de forma segura contornando as restrições do RLS)
CREATE OR REPLACE FUNCTION public.request_password_reset(
  p_matricula text,
  p_token text,
  p_expires timestamptz
)
RETURNS TABLE (email text, name text)
LANGUAGE plpgsql
SECURITY DEFINER -- Permite rodar com privilégios de administrador (bypassa RLS)
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

-- 2. Função para concluir a redefinição de senha
CREATE OR REPLACE FUNCTION public.complete_password_reset(
  p_token text,
  p_hashed_password text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_updated boolean := false;
BEGIN
  UPDATE public.users
  SET password = p_hashed_password,
      reset_token = NULL,
      reset_token_expires = NULL
  WHERE reset_token = p_token
    AND reset_token_expires > NOW()
  RETURNING true INTO v_updated;
  
  RETURN COALESCE(v_updated, false);
END;
$$;
