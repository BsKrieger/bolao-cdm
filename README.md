<div align="center">
  <img src="assets/img/logo-cdm.png" alt="Bolão CDM" width="120" />

  # Bolão CDM — Copa 2026

  **Plataforma web de bolão para a Copa do Mundo de 2026.**
  Palpites em todos os 104 jogos, motor de pontuação com multiplicadores por
  fase, palpites bônus e ranking compartilhado em tempo real.

  ![HTML5](https://img.shields.io/badge/HTML5-E34F26?logo=html5&logoColor=white)
  ![CSS3](https://img.shields.io/badge/CSS3-1572B6?logo=css3&logoColor=white)
  ![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?logo=javascript&logoColor=black)
  ![Supabase](https://img.shields.io/badge/Supabase-3FCF8E?logo=supabase&logoColor=white)
  ![Netlify](https://img.shields.io/badge/Netlify-00C7B7?logo=netlify&logoColor=white)
</div>

---

## Sobre o projeto

Site para um grupo de amigos disputar palpites durante a Copa de 2026. Cada
participante cadastra um nome e um código pessoal, palpita os placares e os
bônus (seleção campeã e artilheiro), e acompanha sua pontuação e a classificação
geral. Os resultados reais são buscados **automaticamente** de uma API
esportiva, sem ninguém precisar digitar placar.

O desafio técnico interessante foi entregar um app com ranking compartilhado e
automação **sem servidor próprio e sem build** — só front-end estático mais um
backend gerenciado (Supabase) e uma função serverless agendada.

## Demonstração

> _Adicione aqui prints das telas (sugestão: salve em `docs/screenshots/`)._

| Home | Jogos & palpites | Ranking |
| --- | --- | --- |
| _`docs/screenshots/home.png`_ | _`docs/screenshots/jogos.png`_ | _`docs/screenshots/ranking.png`_ |

## Funcionalidades

- **104 jogos** organizados por fase e grupo, com horários sempre em **Brasília**.
- **Motor de pontuação** em camadas: placar exato (10), resultado certo (5),
  saldo de gols (+3), classificação no mata-mata (+2), tudo multiplicado pelo
  peso da fase (grupos 1× → final 3×).
- **Palpites bônus**: seleção campeã (20 pts) e artilheiro (15 pts), com lista de
  todos os ~1.249 convocados agrupados por país.
- **Trava automática** quando a bola rola: contador regressivo por jogo e
  fechamento ao vivo, sem depender de recarregar a página.
- **Ranking compartilhado** com critério de desempate (placares exatos →
  resultados certos).
- **Busca automática de resultados** via função serverless agendada.
- **Tema claro/escuro** e layout **responsivo** (mobile-first).
- Funciona **offline / com duplo-clique** (dados em arquivos `.js`, sem build).

## Stack

| Camada | Tecnologia |
| --- | --- |
| Front-end | HTML, CSS e JavaScript puro (sem framework, sem bundler) |
| Persistência local | `localStorage` |
| Backend | Supabase (PostgreSQL + PostgREST), consumido via `fetch` |
| Automação | Supabase Edge Function (Deno) + cron |
| Dados esportivos | football-data.org |
| Hospedagem | Netlify |

## Arquitetura

O projeto é organizado em **camadas com dependência unidirecional** — a interface
nunca fala direto com `localStorage` ou com o banco; passa por uma camada de
persistência (`storage.js`) e um adaptador de backend (`db.js`). A regra de
negócio vive isolada em um motor de funções puras (`scoring.js`), reaproveitado
no dashboard, no ranking e nos testes.

> **A explicação completa — com fluxogramas, diagrama de dados e detalhamento do
> código módulo a módulo — está em [`DOCUMENTACAO.md`](DOCUMENTACAO.md).**

```
index · jogos · ranking · participante · regras   (páginas)
        └─ UI por página ─ scoring.js (regras) ─ storage.js ─ db.js ─ Supabase
                         └─ data/*.js (jogos, seleções, convocados, resultados)
```

## Como rodar localmente

```bash
# Opção 1 — testar sozinho: abrir index.html com duplo-clique.

# Opção 2 — servidor local (recomendado para testar o backend):
python -m http.server 5577
# acessar http://localhost:5577
```

Os testes do motor de pontuação ficam em `tests/scoring.test.html` (basta abrir
no navegador).

## Estrutura do repositório

```
├── index.html, jogos.html, ranking.html, participante.html, regras.html
├── assets/
│   ├── css/      estilos (global + um por página)
│   ├── js/       lógica (scoring, storage, db, app, jogos, ranking...)
│   └── img/      logo
├── data/         matches.js, teams.js, scorers.js, results.js
├── supabase/     Edge Function de busca automática de resultados
├── docs/         guia de configuração do backend
├── tests/        testes do motor de pontuação
└── DOCUMENTACAO.md   documentação técnica completa
```

## Decisões técnicas (destaques)

- **Sem framework/build de propósito** — o escopo não justifica a complexidade
  (KISS/YAGNI); o site roda direto do arquivo.
- **Dados em `.js` e não `.json`** — permite carregar via `<script>` mesmo em
  `file://`, sem servidor.
- **`localStorage` + Supabase** — resposta instantânea local e ranking
  compartilhado, com sincronização em segundo plano que não trava a interface.
- **Motor de pontuação como funções puras** — testável e reutilizável.

## Autor

Feito por **Bruno Krieger**.
Sinta-se à vontade para abrir issues ou usar como referência.
