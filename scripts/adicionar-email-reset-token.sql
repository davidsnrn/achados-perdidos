-- Adiciona colunas de email e reset de senha na tabela users
ALTER TABLE IF EXISTS public.users 
ADD COLUMN IF NOT EXISTS email TEXT,
ADD COLUMN IF NOT EXISTS reset_token TEXT,
ADD COLUMN IF NOT EXISTS reset_token_expires TIMESTAMPTZ;
