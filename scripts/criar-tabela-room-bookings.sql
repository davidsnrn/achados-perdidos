-- ============================================
-- Script: criar-tabela-room-bookings.sql
-- Descrição: Cria tabela para agendamentos de salas
-- ============================================

CREATE TABLE IF NOT EXISTS public.room_bookings (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    campus_id text NOT NULL,
    setor_id uuid REFERENCES public.setores(id),
    room_name text NOT NULL,
    teacher_name text,
    event_title text NOT NULL,
    booking_type text DEFAULT 'EVENTO' CHECK (booking_type IN ('AULA', 'EVENTO')),
    start_date date NOT NULL,
    end_date date NOT NULL,
    recurrence_type text DEFAULT 'ALL_DAYS' CHECK (recurrence_type IN ('ALL_DAYS', 'WEEKLY', 'SPECIFIC_DAYS')),
    recurrence_days integer[],
    periods integer[] NOT NULL,
    observation text,
    operator_id text REFERENCES public.users(id),
    created_at timestamptz DEFAULT now()
);

-- Habilitar RLS se não estiver
ALTER TABLE public.room_bookings ENABLE ROW LEVEL SECURITY;

-- Remover política anterior se existir para evitar erro de duplicação
DROP POLICY IF EXISTS "Acesso público total room_bookings" ON public.room_bookings;

-- Criar política de acesso público total para consistência com o restante do app
CREATE POLICY "Acesso público total room_bookings" ON public.room_bookings
    FOR ALL USING (true) WITH CHECK (true);

-- Habilitar replicação em tempo real para a nova tabela
ALTER TABLE public.room_bookings REPLICA IDENTITY FULL;
alter publication supabase_realtime add table public.room_bookings;
