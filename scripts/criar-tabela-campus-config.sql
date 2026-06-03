-- Cria tabela de configurações por campus (notificações por e-mail, etc)
CREATE TABLE IF NOT EXISTS public.campus_config (
    campus_id text PRIMARY KEY,
    material_email_notification boolean NOT NULL DEFAULT false,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Habilita RLS
ALTER TABLE public.campus_config ENABLE ROW LEVEL SECURITY;

-- Permite tudo (modo compatibilidade)
DROP POLICY IF EXISTS "Acesso Total Campus Config" ON public.campus_config;
CREATE POLICY "Acesso Total Campus Config" ON public.campus_config
    FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
