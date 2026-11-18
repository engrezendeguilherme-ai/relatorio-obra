# Relatórios salvos online (só você, com login)

## O que muda para você
- Tela de entrada com e-mail/senha ou Google.
- Relatório em edição, relatórios salvos, correções, fotos e plantas ficam guardados online na sua conta.
- Em qualquer celular ou computador, ao entrar, você vê e edita os mesmos dados.
- Na primeira entrada, o que já está neste navegador é enviado para a sua conta (nada é apagado do aparelho).

## Etapas
1. Ativar o Lovable Cloud (banco de dados, login e armazenamento de arquivos).
2. Tela de login e botão "Sair" no cabeçalho.
3. Guardar o relatório atual, relatórios salvos e correções na conta, com fotos e plantas em armazenamento de arquivos.
4. Migração automática dos dados locais existentes.
5. Ajustes de celular, conforme sua resposta sobre o telefone.

## Detalhes técnicos
- Tabelas `reports` (rascunho atual + snapshots salvos, jsonb) e `corrections`, com RLS por `auth.uid()` e GRANTs.
- Imagens em bucket privado por usuário; o JSON guarda só o caminho.
- Hooks `use-report` / `use-archive` trocam idb-keyval por Cloud, mantendo a mesma interface; idb fica como cache/migração.
- Rotas do app passam para `_authenticated/`; `/auth` pública.

## Custo
Mudança grande; seus 2,60 créditos provavelmente não bastam. Recomendo aprovar quando os créditos diários renovarem (20h Cuiabá) ou após recarga, para não ficar pela metade.
