import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { suap_token, matricula } = await req.json();

    if (!suap_token || !matricula) {
      return new Response(
        JSON.stringify({ error: "Campos obrigatórios: suap_token, matricula" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 1. Validar o token no SUAP (garante que o token é legítimo e pertence a esta matrícula)
    const suapValidation = await fetch("https://suap.ifrn.edu.br/api/rh/meus-dados/", {
      headers: { "Authorization": `Bearer ${suap_token}` }
    });

    if (!suapValidation.ok) {
      return new Response(
        JSON.stringify({ error: "Token SUAP inválido ou expirado." }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const suapUser = await suapValidation.json();
    const suapMatricula = String(suapUser.matricula || matricula);

    // Verificar que a matrícula do token bate com a enviada
    if (suapMatricula !== String(matricula)) {
      return new Response(
        JSON.stringify({ error: "Matrícula não corresponde ao token SUAP." }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Usar a service role key para criar/atualizar o usuário no Supabase Auth
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    const email = `${matricula}@sistema.local`;
    const deterministicPass = `SUAP_${matricula}_auth2025`;

    // Buscar o usuário existente pelo e-mail
    const { data: listData } = await adminClient.auth.admin.listUsers({ perPage: 1000 });
    const existingAuthUser = listData?.users?.find((u: any) => u.email === email);

    if (existingAuthUser) {
      // Atualizar a senha para a determinística
      await adminClient.auth.admin.updateUserById(existingAuthUser.id, {
        password: deterministicPass,
        email_confirm: true
      });
    } else {
      // Criar novo usuário no Auth com e-mail confirmado
      const { error: createErr } = await adminClient.auth.admin.createUser({
        email,
        password: deterministicPass,
        email_confirm: true,
        user_metadata: { matricula, name: suapUser.nome_usual || matricula }
      });

      if (createErr) {
        return new Response(
          JSON.stringify({ error: "Erro ao criar usuário no Auth: " + createErr.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // 3. Fazer login com o cliente anônimo usando as credenciais atualizadas
    const anonClient = createClient(supabaseUrl, anonKey);
    const { data: sessionData, error: signInErr } = await anonClient.auth.signInWithPassword({
      email,
      password: deterministicPass
    });

    if (signInErr || !sessionData.session) {
      return new Response(
        JSON.stringify({ error: "Erro ao iniciar sessão: " + (signInErr?.message ?? "sem sessão") }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        access_token: sessionData.session.access_token,
        refresh_token: sessionData.session.refresh_token,
        expires_at: sessionData.session.expires_at,
        suap_profile: {
          nome: suapUser.nome_usual || suapUser.nome,
          email: suapUser.email,
          matricula: suapMatricula
        }
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[suap-auth] Erro:", error);
    return new Response(
      JSON.stringify({ error: "Erro interno", detail: String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
