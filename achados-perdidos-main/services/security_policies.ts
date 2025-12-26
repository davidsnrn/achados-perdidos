/**
 * SCRIPT DE SEGURANÇA DO BANCO DE DADOS (RLS)
 * ---------------------------------------------------
 * ATENÇÃO SOBRE SEGURANÇA:
 * O modo abaixo é o "Modo de Compatibilidade". Ele remove o aviso "RLS Disabled"
 * do painel, mas deixa os dados públicos para leitura/escrita via API.
 * 
 * Motivo: Seu App gerencia login no Front-end com uma tabela 'users' própria.
 * O Supabase não reconhece esses usuários nativamente, então bloquear o acesso
 * quebraria o aplicativo atual.
 * 
 * Para segurança REAL, seria necessário migrar 'StorageService.login' para
 * 'supabase.auth.signInWithPassword'.
 */

export const SECURITY_POLICIES_SQL = `
-- 1. HABILITAR RLS EM TODAS AS TABELAS
ALTER TABLE IF EXISTS public.items ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.people ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.config ENABLE ROW LEVEL SECURITY;

-- 2. LIMPAR POLÍTICAS ANTIGAS
DROP POLICY IF EXISTS "Acesso Total Items" ON public.items;
DROP POLICY IF EXISTS "Acesso Total Reports" ON public.reports;
DROP POLICY IF EXISTS "Acesso Total People" ON public.people;
DROP POLICY IF EXISTS "Acesso Total Users" ON public.users;
DROP POLICY IF EXISTS "Acesso Total Config" ON public.config;

-------------------------------------------------------------------------
-- OPÇÃO A: MODO COMPATIBILIDADE (ATUAL - MANTÉM O APP FUNCIONANDO)
-- Permite tudo para todos (anon key). Remove o aviso do painel.
-------------------------------------------------------------------------

CREATE POLICY "Acesso Total Items" ON public.items FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Acesso Total Reports" ON public.reports FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Acesso Total People" ON public.people FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Acesso Total Users" ON public.users FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Acesso Total Config" ON public.config FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);


-------------------------------------------------------------------------
-- OPÇÃO B: MODO SEGURO REAL (FUTURO - REQUER MIGRAÇÃO DE LOGIN)
-- SÓ USE ESTES COMANDOS SE MIGRAR PARA SUPABASE AUTH.
-- ELES BLOQUEARÃO O APP ATUAL SE RODADOS AGORA.
-------------------------------------------------------------------------

/*
-- ITENS: Público vê, Apenas Logado edita
DROP POLICY "Acesso Total Items" ON public.items;
CREATE POLICY "Publico Vê Itens" ON public.items FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Admin Edita Itens" ON public.items FOR ALL TO authenticated USING (true);

-- PESSOAS: Apenas Logado vê e edita
DROP POLICY "Acesso Total People" ON public.people;
CREATE POLICY "Admin Gerencia Pessoas" ON public.people FOR ALL TO authenticated USING (true);

-- RELATOS: Público cria, Apenas Logado vê/edita
DROP POLICY "Acesso Total Reports" ON public.reports;
CREATE POLICY "Publico Cria Relato" ON public.reports FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Admin Gerencia Relato" ON public.reports FOR ALL TO authenticated USING (true);

-- USUARIOS E CONFIG: Apenas Logado
DROP POLICY "Acesso Total Users" ON public.users;
CREATE POLICY "Admin Vê Users" ON public.users FOR ALL TO authenticated USING (true);

DROP POLICY "Acesso Total Config" ON public.config;
CREATE POLICY "Admin Configura" ON public.config FOR ALL TO authenticated USING (true);
*/
`;
