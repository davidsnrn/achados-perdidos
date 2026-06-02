-- Criar politica para permitir verificacao publica de documentos
-- Execute este SQL no SQL Editor do Supabase

CREATE POLICY "Permitir verificacao publica"
  ON public.student_notifications
  FOR SELECT
  TO anon
  USING (true);
