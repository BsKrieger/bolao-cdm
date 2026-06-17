/**
 * @file Backend configuration / Configuração do backend.
 *
 * EN: PUBLIC Supabase credentials (safe to live in the static site):
 *  - SUPABASE_URL: the Project URL.
 *  - SUPABASE_KEY: the public (anon / publishable) key.
 *  NEVER put the service_role / sb_secret_ key here (full DB access).
 *  To turn the backend off (go fully local), leave both empty.
 *
 * PT-BR: Credenciais PÚBLICAS do Supabase (seguras para ficar no site):
 *  - SUPABASE_URL: a Project URL.
 *  - SUPABASE_KEY: a chave pública (anon / publishable).
 *  NUNCA coloque aqui a chave service_role / sb_secret_ (acesso total ao banco).
 *  Para desligar o backend (voltar ao modo 100% local), deixe os dois vazios.
 *
 * @author Bruno Krieger
 */
const CONFIG = {
  SUPABASE_URL: "https://nmdvmyryiqcviogaprzh.supabase.co",
  SUPABASE_KEY: "sb_publishable_ZvhVfWjV-dyNrDWf7Tw_KQ_znyTgjo-",
};
