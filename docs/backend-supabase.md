# Backend compartilhado — Supabase + hospedagem

Objetivo: sair do localStorage (cada um vê só a si) para um **ranking real entre
os 23**, com todos abrindo a mesma URL.

## Visão geral da arquitetura

- **Hospedagem:** o site estático vai pra uma URL pública (todos abrem a mesma).
- **Supabase:** banco Postgres com API REST automática. O site lê/grava via `fetch`
  (sem biblioteca externa — mantém o projeto leve).
- **Identidade (sem login pesado):** no 1º acesso, cada um informa **nome + um
  código pessoal** (PIN). O código permite reabrir e editar os próprios palpites
  de qualquer aparelho. Fica salvo no navegador por conveniência.
- **Resultados:** continuam em `data/results.js`, controlados por você (organizador).
- **Ranking:** calculado no navegador — busca os palpites de todos no Supabase,
  pontua com `scoring.js` + `results.js` e ordena com o desempate.
- **Trava por horário:** continua no cliente (pelo kickoff), como hoje.

> Modelo de confiança: é um bolão entre amigos. As regras abaixo deixam a chave
> pública (anon) ler e gravar — risco baixo para 23 conhecidos. Dá para endurecer
> depois (gravação só via função que confere o código). Começamos simples.

## Passo 1 — Criar o projeto Supabase (você)

1. Crie conta em https://supabase.com (gratuito).
2. **New project** → escolha um nome (ex: `bolao-cdm`) e uma senha de banco.
3. Região: escolha a mais próxima (ex: São Paulo).

## Passo 2 — Criar as tabelas (você)

No painel do Supabase: **SQL Editor → New query**, cole e rode:

```sql
-- Participantes
create table participants (
  id uuid primary key default gen_random_uuid(),
  name text unique not null,
  code text not null,                 -- código pessoal (PIN) para editar
  created_at timestamptz default now()
);

-- Palpites de placar
create table predictions (
  participant_id uuid references participants(id) on delete cascade,
  match_id int not null,
  home int,
  away int,
  advances text,                      -- 'home' | 'away' | null
  updated_at timestamptz default now(),
  primary key (participant_id, match_id)
);

-- Palpites bônus
create table bonus (
  participant_id uuid primary key references participants(id) on delete cascade,
  champion text,
  top_scorer text,
  updated_at timestamptz default now()
);

-- RLS (modelo simples para pool entre amigos): leitura e escrita pela chave anon
alter table participants enable row level security;
alter table predictions enable row level security;
alter table bonus enable row level security;
create policy "anon all" on participants for all using (true) with check (true);
create policy "anon all" on predictions  for all using (true) with check (true);
create policy "anon all" on bonus        for all using (true) with check (true);
```

## Passo 3 — Pegar as credenciais (você → me envia)

Jeito fácil: botão verde **"Connect"** no topo do painel → mostra URL e chave.
Ou: ⚙️ **Project Settings → API Keys** (pode aparecer como "API" / "Data API").

Me mande:

- **Project URL** (ex: `https://xxxx.supabase.co`). Dica: é `https://` + o `ref`
  que aparece na URL do navegador (`.../project/REF`) + `.supabase.co`.
- **Chave pública do cliente**:
  - se existir `anon` / `public` (começa com `eyJ...`) → use essa; **ou**
  - em projetos novos, a **Publishable key** `sb_publishable_...` → é o equivalente.

⚠️ **Segurança:** a chave pública (anon / publishable) é feita para ficar no site —
pode compartilhar. **NUNCA** me mande nem coloque no site a chave
**`service_role`** ou **`sb_secret_...`** (acesso total ao banco).

## Passo 4 — Hospedar o site (você, ou faço junto)

Opção mais simples, sem Git: **Netlify Drop** (https://app.netlify.com/drop) —
arraste a pasta do projeto e ele gera uma URL. Para atualizar, arraste de novo.
(Alternativa: GitHub Pages, se preferir versionar.)

## O que eu faço depois (com a URL + anon key)

1. `assets/js/config.js` com a URL e a chave anon.
2. Adaptar `storage.js` para falar com o Supabase (mantendo a mesma interface).
3. Cadastro com **nome + código** no 1º acesso (substitui o atual).
4. **ranking.html** — classificação ao vivo com o critério de desempate.
5. Testar junto, ponta a ponta.

## Resultados automáticos (Etapas A e B)

### Etapa A — tabelas de resultados (rode este SQL no Supabase)

```sql
create table results (
  match_id int primary key,
  home int not null,
  away int not null,
  advances text,                 -- 'home' | 'away' (só mata-mata)
  updated_at timestamptz default now()
);
create table tournament_result (
  id int primary key default 1,
  champion text,
  top_scorer text,
  updated_at timestamptz default now()
);
alter table results enable row level security;
alter table tournament_result enable row level security;
create policy "anon all results" on results for all using (true) with check (true);
create policy "anon all tr" on tournament_result for all using (true) with check (true);
```

Depois disso, o site passa a ler os resultados do banco (já implementado, com
fallback para `data/results.js` se a tabela estiver vazia). O ranking atualiza
sem re-deploy.

### Etapa B — busca automática (Supabase Edge Function + cron)

Fonte: **API pública da ESPN** (sem chave; CORS liberado). A função
`supabase/functions/sync-results` lê o `scoreboard` e, no mata-mata, o `summary`
(placar do tempo regulamentar, 90'); casa os jogos da ESPN com os nossos por
horário e grava em `results`.

**1. Publicar a função**
- Painel Supabase → **Edge Functions** → *Create a new function* → nome
  `sync-results` → cole o conteúdo de `supabase/functions/sync-results/index.ts`
  → **Deploy**. Marque **"Verify JWT" = OFF** (a função só dispara um sync).
- (Alternativa via CLI: `supabase functions deploy sync-results --no-verify-jwt`.)

**2. Secret da API**
- Edge Functions → **Secrets** → adicione `FOOTBALL_DATA_TOKEN` = seu token.
- (`SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` o Supabase injeta sozinho.)

**3. Habilitar extensões**
- Database → **Extensions** → habilite `pg_cron` e `pg_net`.

**4. Agendar (SQL Editor)** — troque `<REF>` pelo ref do projeto:
```sql
select cron.schedule(
  'sync-wc-results',
  '0 */4 * * *',                       -- a cada 4 horas (UTC)
  $$ select net.http_post(
       url := 'https://<REF>.supabase.co/functions/v1/sync-results',
       headers := '{"Content-Type":"application/json"}'::jsonb
     ); $$
);
```

**5. Testar agora** (deve voltar `{"updated":0}` antes da Copa começar):
```
curl -X POST https://<REF>.supabase.co/functions/v1/sync-results
```
Durante a Copa, ele preenche a tabela `results` sozinho.

**6. Endurecer a escrita de resultados (recomendado)** — só a função (service
role) escreve; participantes só leem:
```sql
drop policy "anon all results" on results;
create policy "anon read results" on results for select using (true);
drop policy "anon all tr" on tournament_result;
create policy "anon read tr" on tournament_result for select using (true);
```

**Rede de segurança:** você pode editar a tabela `results` à mão no Table Editor
do Supabase a qualquer momento (corrigir um placar, etc.).

> Se você mudar horários em `data/matches.js`, regenere os mapas embutidos na
> função (KO_MAP/GROUP_MAP) — me peça que eu gero de novo.
```
