-- SQL para criar a função RPC de alteração de senha (usuário logado)
-- Cole e execute este código no SQL Editor do painel do Supabase.
-- Esta função bypassa o RLS usando SECURITY DEFINER.

CREATE OR REPLACE FUNCTION public.change_user_password(
  p_user_id uuid,
  p_hashed_password text,
  p_log_message text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER -- Permite rodar com privilégios de admin (bypassa RLS)
AS $$
DECLARE
  v_current_logs text[];
  v_updated boolean := false;
BEGIN
  -- Busca os logs atuais
  SELECT COALESCE(logs, '{}') INTO v_current_logs
  FROM public.users
  WHERE id = p_user_id;

  -- Atualiza a senha e adiciona ao log
  UPDATE public.users
  SET
    password = p_hashed_password,
    logs = array_append(v_current_logs, p_log_message)
  WHERE id = p_user_id;

  IF FOUND THEN
    v_updated := true;
  END IF;

  RETURN v_updated;
END;
$$;

-- Garante que a função só pode ser executada por usuários autenticados ou anon
-- (o SECURITY DEFINER cuida do acesso à tabela)
GRANT EXECUTE ON FUNCTION public.change_user_password(uuid, text, text) TO anon;
GRANT EXECUTE ON FUNCTION public.change_user_password(uuid, text, text) TO authenticated;
