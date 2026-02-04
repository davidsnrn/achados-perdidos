/**
 * Script de Migração em Massa para Supabase Auth
 * 
 * IMPORTANTE: O Supabase Auth NÃO aceita senhas já hasheadas (SHA-256).
 * Ele precisa da senha em texto plano para criar seu próprio hash bcrypt.
 * 
 * OPÇÕES DE MIGRAÇÃO:
 * 1. Usar senha padrão (ifrn123) - Todos migrados imediatamente
 * 2. Manter migração lazy (no primeiro login) - RECOMENDADO
 * 
 * USO:
 * node migrateUsersToAuth.js [opção]
 * 
 * Opções:
 * --default-password : Usa senha padrão "ifrn123" para todos
 * --matricula-password : Usa matricula como senha temporária
 * --check : Apenas verifica quantos usuários faltam migrar
 */

import { createClient } from '@supabase/supabase-js';

// Configuração do Supabase
const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('❌ Erro: Variáveis de ambiente não configuradas');
    console.error('Configure VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Modo de operação
const args = process.argv.slice(2);
const mode = args[0] || '--check';

async function checkMigrationStatus() {
    console.log('\n🔍 Verificando status da migração...\n');

    // 1. Total de usuários na tabela users
    const { data: allUsers, error: usersError } = await supabase
        .from('users')
        .select('id, matricula, name');

    if (usersError) {
        console.error('❌ Erro ao buscar usuários:', usersError);
        return;
    }

    console.log(`📊 Total de usuários no sistema: ${allUsers.length}`);

    // 2. Usuários já no Auth (email @sistema.local)
    const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers();

    if (authError) {
        console.error('⚠️  Não foi possível verificar usuários no Auth (requer service_role key)');
        console.log('Para verificação completa, use a service_role key do Supabase.');
        return;
    }

    const authEmails = new Set(authUsers.users.map(u => u.email));
    const migratedCount = allUsers.filter(u =>
        authEmails.has(`${u.matricula}@sistema.local`)
    ).length;

    console.log(`✅ Usuários já migrados: ${migratedCount}`);
    console.log(`⏳ Usuários pendentes: ${allUsers.length - migratedCount}`);

    if (migratedCount === allUsers.length) {
        console.log('\n🎉 Todos os usuários já foram migrados!');
    } else {
        console.log(`\n📋 ${allUsers.length - migratedCount} usuários ainda precisam fazer login para migração automática.`);
    }
}

async function migrateWithDefaultPassword() {
    console.log('\n⚠️  ATENÇÃO: Migrando usuários com senha padrão "ifrn123"\n');
    console.log('Os usuários deverão alterar a senha no primeiro login.\n');

    const { data: allUsers, error } = await supabase
        .from('users')
        .select('id, matricula, name');

    if (error) {
        console.error('❌ Erro ao buscar usuários:', error);
        return;
    }

    let successCount = 0;
    let existsCount = 0;
    let errorCount = 0;

    console.log(`📦 Iniciando migração de ${allUsers.length} usuários...\n`);

    for (const user of allUsers) {
        const email = `${user.matricula}@sistema.local`;
        const defaultPassword = 'ifrn123';

        try {
            const { data, error: signUpError } = await supabase.auth.signUp({
                email,
                password: defaultPassword,
                options: {
                    data: {
                        matricula: user.matricula,
                        name: user.name
                    }
                }
            });

            if (signUpError) {
                if (signUpError.message.includes('already registered')) {
                    console.log(`⏭️  ${user.matricula} - Já existe no Auth`);
                    existsCount++;
                } else {
                    console.error(`❌ ${user.matricula} - Erro: ${signUpError.message}`);
                    errorCount++;
                }
            } else {
                console.log(`✅ ${user.matricula} - Migrado com sucesso`);
                successCount++;
            }

            // Delay para evitar rate limit
            await new Promise(resolve => setTimeout(resolve, 100));

        } catch (err) {
            console.error(`❌ ${user.matricula} - Exceção:`, err);
            errorCount++;
        }
    }

    console.log('\n📊 Resumo da Migração:');
    console.log(`✅ Migrados: ${successCount}`);
    console.log(`⏭️  Já existiam: ${existsCount}`);
    console.log(`❌ Erros: ${errorCount}`);
    console.log(`📦 Total processado: ${allUsers.length}`);
}

async function migrateWithMatriculaPassword() {
    console.log('\n⚠️  ATENÇÃO: Migrando usuários com MATRÍCULA como senha\n');
    console.log('A senha de cada usuário será sua própria matrícula.\n');

    const { data: allUsers, error } = await supabase
        .from('users')
        .select('id, matricula, name');

    if (error) {
        console.error('❌ Erro ao buscar usuários:', error);
        return;
    }

    let successCount = 0;
    let existsCount = 0;
    let errorCount = 0;

    console.log(`📦 Iniciando migração de ${allUsers.length} usuários...\n`);

    for (const user of allUsers) {
        const email = `${user.matricula}@sistema.local`;
        const matriculaPassword = user.matricula; // Usa matricula como senha

        try {
            const { data, error: signUpError } = await supabase.auth.signUp({
                email,
                password: matriculaPassword,
                options: {
                    data: {
                        matricula: user.matricula,
                        name: user.name
                    }
                }
            });

            if (signUpError) {
                if (signUpError.message.includes('already registered')) {
                    console.log(`⏭️  ${user.matricula} - Já existe no Auth`);
                    existsCount++;
                } else {
                    console.error(`❌ ${user.matricula} - Erro: ${signUpError.message}`);
                    errorCount++;
                }
            } else {
                console.log(`✅ ${user.matricula} - Migrado (senha: matrícula)`);
                successCount++;
            }

            // Delay para evitar rate limit
            await new Promise(resolve => setTimeout(resolve, 100));

        } catch (err) {
            console.error(`❌ ${user.matricula} - Exceção:`, err);
            errorCount++;
        }
    }

    console.log('\n📊 Resumo da Migração:');
    console.log(`✅ Migrados: ${successCount}`);
    console.log(`⏭️  Já existiam: ${existsCount}`);
    console.log(`❌ Erros: ${errorCount}`);
    console.log(`📦 Total processado: ${allUsers.length}`);
}

// Execução principal
(async () => {
    console.log('🔐 Script de Migração para Supabase Auth');
    console.log('==========================================\n');

    switch (mode) {
        case '--check':
            await checkMigrationStatus();
            break;

        case '--default-password':
            console.log('⚠️  Você está prestes a migrar TODOS os usuários com senha padrão "ifrn123"');
            console.log('Os usuários precisarão alterar a senha no primeiro login.\n');
            console.log('Continue? Pressione Ctrl+C para cancelar ou Enter para continuar...');

            // Aguarda confirmação (se executando em terminal interativo)
            if (process.stdin.isTTY) {
                await new Promise(resolve => {
                    process.stdin.once('data', resolve);
                });
            }

            await migrateWithDefaultPassword();
            break;

        case '--matricula-password':
            console.log('⚠️  Você está prestes a migrar TODOS os usuários usando MATRÍCULA como senha');
            console.log('Cada usuário poderá fazer login com sua matrícula como senha.\n');
            console.log('Continue? Pressione Ctrl+C para cancelar ou Enter para continuar...');

            if (process.stdin.isTTY) {
                await new Promise(resolve => {
                    process.stdin.once('data', resolve);
                });
            }

            await migrateWithMatriculaPassword();
            break;

        default:
            console.log('❌ Modo inválido!');
            console.log('\nModos disponíveis:');
            console.log('  --check              : Verifica status da migração');
            console.log('  --default-password   : Migra com senha padrão "ifrn123"');
            console.log('  --matricula-password : Migra usando matrícula como senha');
            console.log('\nExemplo: node migrateUsersToAuth.js --check');
            process.exit(1);
    }

    console.log('\n✅ Operação concluída!\n');
    process.exit(0);
})();
