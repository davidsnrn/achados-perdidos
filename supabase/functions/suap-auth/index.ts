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
    const body = await req.json();
    const { matricula, password, suap_token } = body;

    // --- MODO 1: Login com credenciais (username + password) ---
    if (matricula && password) {
      // 1. Obter token JWT do SUAP usando credenciais
      const tokenRes = await fetch("https://suap.ifrn.edu.br/api/v2/autenticacao/token/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: String(matricula), password: String(password) }),
      });

      if (!tokenRes.ok) {
        const errText = await tokenRes.text().catch(() => "");
        return new Response(
          JSON.stringify({ error: "Credenciais inválidas no SUAP. Verifique sua matrícula e senha.", detail: errText }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const tokenData = await tokenRes.json();
      const suapJwt = tokenData.access || tokenData.token;

      if (!suapJwt) {
        return new Response(
          JSON.stringify({ error: "Não foi possível obter token de acesso do SUAP." }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // 2. Buscar dados reais do usuário no SUAP
      const meRes = await fetch("https://suap.ifrn.edu.br/api/rh/meus-dados/", {
        headers: { "Authorization": `Bearer ${suapJwt}` },
      });

      // Tentar endpoint alternativo se o primeiro falhar
      let suapUser: any = null;
      if (meRes.ok) {
        suapUser = await meRes.json();
      } else {
        // Endpoint alternativo (alunos/servidores)
        const altRes = await fetch("https://suap.ifrn.edu.br/api/v2/minhas-informacoes/meus-dados/", {
          headers: { "Authorization": `Bearer ${suapJwt}` },
        });
        if (altRes.ok) {
          suapUser = await altRes.json();
        }
      }

      if (!suapUser) {
        return new Response(
          JSON.stringify({ error: "Não foi possível carregar os dados do usuário no SUAP." }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const suapMatricula = String(suapUser.matricula || matricula);
      const suapNome = suapUser.nome_usual || suapUser.nome || suapUser.name || String(matricula);
      const suapEmail = suapUser.email || suapUser.email_secundario || `${suapMatricula}@sistema.local`;

      return new Response(
        JSON.stringify({
          success: true,
          matricula: suapMatricula,
          nome: suapNome,
          email: suapEmail,
          suap_profile: {
            nome: suapNome,
            email: suapEmail,
            matricula: suapMatricula,
            vinculo: suapUser.vinculo || null,
            foto: suapUser.foto || null,
          }
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // --- MODO 2: Validar token SUAP já existente ---
    if (suap_token) {
      const meRes = await fetch("https://suap.ifrn.edu.br/api/rh/meus-dados/", {
        headers: { "Authorization": `Bearer ${suap_token}` },
      });

      if (!meRes.ok) {
        return new Response(
          JSON.stringify({ error: "Token SUAP inválido ou expirado." }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const suapUser = await meRes.json();
      const suapMatricula = String(suapUser.matricula || matricula || "");

      if (matricula && suapMatricula !== String(matricula)) {
        return new Response(
          JSON.stringify({ error: "Matrícula não corresponde ao token SUAP." }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({
          success: true,
          matricula: suapMatricula,
          nome: suapUser.nome_usual || suapUser.nome,
          email: suapUser.email,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Informe (matricula + password) ou suap_token." }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[suap-auth] Erro:", error);
    return new Response(
      JSON.stringify({ error: "Erro interno no servidor", detail: String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
