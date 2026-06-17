-- ============================================
-- MIGRAÇÃO: Adicionar email e migrar users para Supabase Auth
-- Execute este script uma única vez no SQL Editor do Supabase
-- ============================================

-- 1. Adicionar email {matricula}@sistema.local para todos os users sem email
UPDATE public.users
SET email = matricula || '@sistema.local'
WHERE email IS NULL OR email = '';

-- 2. Atualizar a função complete_password_reset (já corrige auth.users)
CREATE OR REPLACE FUNCTION public.complete_password_reset(p_token text, p_new_password text, p_hashed_password text) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER AS $$ DECLARE v_matricula text; v_updated boolean := false; BEGIN UPDATE public.users SET password = p_hashed_password, reset_token = NULL, reset_token_expires = NULL WHERE reset_token = p_token AND reset_token_expires > NOW() RETURNING matricula INTO v_matricula; IF v_matricula IS NOT NULL THEN BEGIN UPDATE auth.users SET encrypted_password = auth.crypt(p_new_password, auth.gen_salt('bf')) WHERE email = v_matricula || '@sistema.local'; EXCEPTION WHEN OTHERS THEN RAISE WARNING 'Erro ao atualizar auth.users: %', SQLERRM; END; v_updated := true; END IF; RETURN COALESCE(v_updated, false); END; $$;

-- 3. Atualizar a função change_user_password para tambem atualizar auth.users
CREATE OR REPLACE FUNCTION public.change_user_password(
  p_user_id text,
  p_hashed_password text,
  p_log_message text,
  p_new_password text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_logs text[];
  v_matricula text;
  v_updated boolean := false;
BEGIN
  SELECT COALESCE(logs, '{}'), matricula INTO v_current_logs, v_matricula
  FROM public.users
  WHERE id = p_user_id;

  UPDATE public.users
  SET password = p_hashed_password,
      logs = array_append(v_current_logs, p_log_message)
  WHERE id = p_user_id;

  IF FOUND THEN
    v_updated := true;
    IF p_new_password IS NOT NULL THEN
      BEGIN
        UPDATE auth.users
        SET encrypted_password = auth.crypt(p_new_password, auth.gen_salt('bf'))
        WHERE email = v_matricula || '@sistema.local';
      EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'Erro ao atualizar auth.users: %', SQLERRM;
      END;
    END IF;
  END IF;

  RETURN v_updated;
END;
$$;
