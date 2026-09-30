/*
 * Surf nos Trilhos · Desenvolvido por Alequizao <alequizao.dev@gmail.com>
 * https://github.com/alequizao · © 2026 Alequizao. Todos os direitos reservados.
 */
// Surf nos Trilhos — ícones próprios (sprite SVG inline no index.html, grade 24x24, cor = currentColor).
//
// Uso:  import { ic } from './icones.js';
//       el.innerHTML = ic('ima');            // <svg class="ic" ...><use href="#i-ima"/></svg>
//       el.innerHTML = ic('moeda', 'grande'); // classe extra
// Atenção: o resultado é HTML, então use innerHTML (não textContent).
//
// Nomes disponíveis (symbol id = "i-" + nome):
//   Interface ... pausa, play, casa, reiniciar, fechar, sacola (loja), alvo (missões),
//                 som, som-off, musica, musica-off, ajuda, trofeu, estrela, check, cadeado, alerta,
//                 presente (prêmio do dia), ajustes (opções), vibra, contraste, movimento
//   Poderes ..... ima, foguete (jato), tenis (tênis com mola), dobro (2x), prancha (hoverboard), raio
//   Jogo ........ moeda, impacto (batida/prancha quebrou), susto (tropeço), bandeira (distância)
//   Gestos ...... seta-cima, seta-baixo, seta-esq, seta-dir, toque-duplo
//   Obstáculos .. trem, barreira, placa (ABAIXE!), tapume (OBRA)
//
// A moeda "de verdade" (dourada, serrilhada) continua sendo o <span class="moeda-ic"></span> em CSS;
// ic('moeda') é a versão monocromática para usar dentro de textos/botões coloridos.

export const ic = (nome, cls = '') => `<svg class="ic ${cls}" aria-hidden="true"><use href="#i-${nome}"/></svg>`;

export const ICONES = ['pausa', 'play', 'casa', 'reiniciar', 'fechar', 'sacola', 'alvo', 'som', 'som-off', 'musica', 'musica-off',
  'ajuda', 'trofeu', 'estrela', 'check', 'cadeado', 'alerta', 'ima', 'foguete', 'tenis', 'dobro', 'prancha', 'raio', 'moeda',
  'impacto', 'susto', 'bandeira', 'presente', 'ajustes', 'vibra', 'contraste', 'movimento', 'seta-cima', 'seta-baixo', 'seta-esq', 'seta-dir', 'toque-duplo', 'trem', 'barreira', 'placa', 'tapume'];
