# economizei-cdn: mapa

Base: https://cdn.jsdelivr.net/gh/contatoeconomizeirioclaro-ai/economizei-cdn@main/

| Onde é usado | Arquivos | Fica inline |
|---|---|---|
| 18 páginas de grupo | grupos/grupo.css, grupos/grupo.js | HTML e `window.GRUPO_CONFIG` |
| 3 painéis de módulo (Loja, Pedidos, Transporte) | painel/painel.css | CSS específico de cada módulo; os scripts continuam no repo antigo (economizei-assets) |
| Tema | servicos/auth.js (Auth, DB, login, handlers do app), tema/hero.js, tema/menu-lateral.js, rico/rico-treino.js, rico/rico-config.js, rico/rico.js | Lojista, CSS da home/skin, scripts pequenos |
| Tema (cópias idênticas do repo antigo) | tema/css/*, tema/js/*, anuncios/*, offline/economizei-offline.js | |

## Ordem de carga
Tema (scripts bloqueantes, na mesma posição de antes) → página (link do CSS, HTML, config) → grupo.js (defer).
`rico-treino` → `rico-config` → `rico` (nessa ordem).

## Contratos preservados
window.abrirQRCode, ?cat=, ?qr=, Economizei.Auth, Economizei.DB, Economizei.Cards, onLoginSuccess/onLoginError, Android.iniciarLoginGoogle.

## Fora desta entrega (decidir/fazer depois)
- Parte comum de Festas, Trilhas, Vitrine, Vagas e Ônibus (modais, toast, lightbox, helpers).
- Migração do login de Festas, Trilhas e Vitrine para Economizei.Auth.
- Scripts dos painéis (painel/*.js, comum/*.js): ficam no repo antigo até você enviar as versões atuais.
- Frontend dos módulos: depois de atualizado por você.
- Hub, Entrega, Categorias, institucionais e Planos: mantidos inline.

## Purge
Lista completa em docs/purge.txt (rodar após cada commit enquanto estiver em @main).
