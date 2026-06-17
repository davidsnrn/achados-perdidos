-- SQL para criar a função RPC de alteração de senha (usuário logado)
-- Cole e execute este código no SQL Editor do painel do Supabase.
-- Esta função bypassa o RLS usando SECURITY DEFINER.

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
  v_current_logs jsonb;
  v_matricula text;
  v_updated boolean := false;
BEGIN
  SELECT COALESCE(logs, '[]'::jsonb), matricula INTO v_current_logs, v_matricula
  FROM public.users
  WHERE id = p_user_id;

  UPDATE public.users
  SET password = p_hashed_password,
      logs = v_current_logs || jsonb_build_array(p_log_message)
  WHERE id = p_user_id;

  IF FOUND THEN
    v_updated := true;
    IF p_new_password IS NOT NULL THEN
      BEGIN
        UPDATE auth.users
        SET encrypted_password = crypt(p_new_password, gen_salt('bf'))
        WHERE email = v_matricula || '@sistema.local';
      EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'Erro ao atualizar auth.users: %', SQLERRM;
      END;
    END IF;
  END IF;

  RETURN v_updated;
END;
$$;

GRANT EXECUTE ON FUNCTION public.change_user_password(text, text, text, text) TO anon;
GRANT EXECUTE ON FUNCTION public.change_user_password(text, text, text, text) TO authenticated;
