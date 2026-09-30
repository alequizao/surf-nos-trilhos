/* Surf nos Trilhos · Desenvolvido por Alequizao <alequizao.dev@gmail.com>
 * https://github.com/alequizao · © 2026 Alequizao. Todos os direitos reservados. */
// Ranking online (módulo independente). Fala com ./ranking.php (mesma pasta deste arquivo).
//
// Uso no jogo.js:
//   import { iniciaRanking, rankingFim } from './ranking.js?v=...';
//   iniciaRanking({ mostra, audio });                 // liga o botão #bt-ranking do menu (mostra = troca de tela do jogo)
//   rankingInicio();                                  // quando a corrida começa: pede o código da corrida ao servidor
//   rankingFim({ pontos, moedas, dist, revives });    // no fim de jogo: prepara o campo "Seu nome ou @"
// HTML necessário: #bt-ranking (menu), #tela-ranking (#rk-lista, #rk-voce, abas .rk-aba[data-periodo]) e, na #tela-fim, #rk-form (#rk-nome, #rk-salvar, #rk-msg).

const API = new URL('ranking.php', import.meta.url).href;
const CHAVE_NOME = 'alequizao-ranking-nome';   // compartilhado entre os jogos do site (mesma origem)
const CHAVE_DONO = 'alequizao-ranking-dono';   // segredo do aparelho: quem salvou um nome primeiro é o dono dele
const $ = s => document.querySelector(s);
const fmt = n => Math.floor(n).toLocaleString('pt-BR');
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ic = n => `<svg class="ic" aria-hidden="true"><use href="#i-${n}"/></svg>`;

let corrida = null, salvo = false, enviando = false, codigo = null, periodo = 'semana';

const lembra = () => { try { return localStorage.getItem(CHAVE_NOME) || ''; } catch { return ''; } };
const guarda = n => { try { localStorage.setItem(CHAVE_NOME, n); } catch { /* sem storage: tudo bem */ } };
function dono() {
  try {
    let d = localStorage.getItem(CHAVE_DONO);
    if (!/^[0-9a-f]{32,64}$/.test(d || '')) { d = [...crypto.getRandomValues(new Uint8Array(16))].map(b => b.toString(16).padStart(2, '0')).join(''); localStorage.setItem(CHAVE_DONO, d); }
    return d;
  } catch { return undefined; }
}

async function chama(opcoes = {}, busca = '') {
  if (navigator.onLine === false) throw Object.assign(new Error('offline'), { offline: true });
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 9000);
  try {
    const r = await fetch(API + busca, { cache: 'no-store', signal: ctl.signal, ...opcoes });
    let j = null; try { j = await r.json(); } catch { /* resposta não-JSON */ }
    if (!j) throw new Error('Ranking indisponível no momento.');
    if (!r.ok || !j.ok) throw new Error(j.erro || 'Ranking indisponível no momento.');
    return j;
  } catch (e) {
    if (e.name === 'AbortError' || e instanceof TypeError) throw Object.assign(new Error('offline'), { offline: true });
    throw e;
  } finally { clearTimeout(t); }
}

// "@usuario" vira link para o Instagram; nome comum vira texto
function nomeHtml(nome) {
  if (/^@[A-Za-z0-9._]{1,30}$/.test(nome)) {
    return `<a href="https://instagram.com/${encodeURIComponent(nome.slice(1))}" target="_blank" rel="noopener nofollow">${esc(nome)}</a>`;
  }
  return esc(nome);
}

function estado(html, cls = '') { $('#rk-lista').innerHTML = `<div class="rk-estado ${cls}">${html}</div>`; }

async function carregaLista() {
  const voce = $('#rk-voce'); voce.classList.add('oculto');
  estado('<span class="rk-giro" aria-hidden="true"></span>Carregando ranking…');
  const meu = lembra();
  try {
    const j = await chama({}, '?periodo=' + periodo + (meu ? '&nome=' + encodeURIComponent(meu) : ''));
    if (!j.top.length) {
      estado(ic('trofeu') + (periodo === 'semana' ? '<b>Ninguém pontuou nesta semana.</b><span>O ranking da semana zera toda segunda. Jogue e fique em 1º!</span>' : '<b>Ninguém no ranking ainda.</b><span>Jogue e seja o primeiro!</span>'), 'rk-vazio');
      return;
    }
    const chaveMeu = j.voce ? j.voce.nome.toLowerCase() : null;
    $('#rk-lista').innerHTML = j.top.map(r => `<div class="rk-item${r.pos <= 3 ? ' rk-top' + r.pos : ''}${chaveMeu && r.nome.toLowerCase() === chaveMeu ? ' rk-eu' : ''}">
      <span class="rk-pos">${r.pos}</span>
      <div class="rk-info"><b class="rk-nome">${nomeHtml(r.nome)}</b><small>${fmt(r.dist)} m · ${fmt(r.moedas)} moedas${r.revives == null ? '' : ` · <span class="rk-rev${r.revives ? '' : ' rk-rev0'}" title="Vezes que usou continuar correndo">${ic('reiniciar')}${r.revives ? r.revives + '× reviver' : 'sem reviver'}</span>`}</small></div>
      <b class="rk-pts">${fmt(r.pontos)}</b></div>`).join('');
    if (j.voce) { voce.innerHTML = `${ic('estrela')} Você (${esc(j.voce.nome)}) está em <b>${j.voce.pos}º</b>${periodo === 'semana' ? ' nesta semana' : ''} com ${fmt(j.voce.pontos)} pontos.`; voce.classList.remove('oculto'); }
  } catch (e) {
    if (e.offline) estado(ic('alerta') + '<b>Sem internet.</b><span>O ranking aparece quando você estiver online. O jogo continua funcionando.</span>', 'rk-erro');
    else estado(ic('alerta') + `<b>Não deu pra carregar.</b><span>${esc(e.message)}</span><button class="bt bt-azul rk-tentar" type="button">${ic('reiniciar')} Tentar de novo</button>`, 'rk-erro');
  }
}

function msg(texto, tipo = '') { const m = $('#rk-msg'); m.className = 'rk-msg ' + tipo; m.innerHTML = texto; }

async function salvar(e) {
  e.preventDefault();
  if (!corrida || salvo || enviando) return;
  const campo = $('#rk-nome'), bt = $('#rk-salvar');
  let nome = campo.value.trim().replace(/\s+/g, ' ');
  if (nome.startsWith('@')) nome = '@' + nome.slice(1).trim();
  if (nome.startsWith('@') ? !/^@[A-Za-z0-9._]{1,30}$/.test(nome) : (nome.length < 2 || nome.length > 24)) {
    msg(nome.startsWith('@') ? 'Esse @ não parece um usuário do Instagram.' : 'Digite um nome de 2 a 24 letras.', 'rk-ruim'); campo.focus(); return;
  }
  enviando = true; bt.disabled = true; msg('Salvando…');
  try {
    const j = await chama({ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nome, ...corrida, corrida: codigo || undefined, dono: dono() }) });
    salvo = true; guarda(j.nome); campo.value = j.nome;
    const sem = j.semana ? ` · <b>${j.semana.pos}º</b> da semana` : '';
    msg(j.melhorou ? `${ic('trofeu')} Você é o <b>${j.pos}º</b> do ranking${sem}!`
      : `Seu recorde continua ${fmt(j.pontos)}: <b>${j.pos}º</b> no geral${sem}.`, 'rk-bom');
    bt.innerHTML = `${ic('check')} Salvo`;
  } catch (err) {
    bt.disabled = false;
    msg(err.offline ? 'Sem internet: não deu pra salvar agora.' : esc(err.message), 'rk-ruim');
  } finally { enviando = false; }
}

async function pedeCodigo() {
  try { codigo = (await chama({ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ acao: 'corrida' }) })).corrida; }
  catch { codigo = null; }
}
// nova corrida (não chamar ao "continuar correndo": a corrida é a mesma)
export function rankingInicio() { codigo = null; pedeCodigo(); }

export function rankingFim({ pontos, moedas, dist, revives = 0 }) {
  const form = $('#rk-form'); if (!form) return;
  corrida = { pontos: Math.floor(pontos), moedas: Math.floor(moedas), dist: Math.floor(dist), revives: Math.floor(revives) };
  salvo = false;
  form.classList.toggle('oculto', corrida.pontos < 1 || corrida.dist < 1);
  const campo = $('#rk-nome'), bt = $('#rk-salvar');
  if (!campo.value) campo.value = lembra();
  bt.disabled = false; bt.innerHTML = `${ic('trofeu')} Salvar no ranking`;
  msg(navigator.onLine === false ? 'Sem internet: o ranking fica para a próxima.' : '');
}

export function iniciaRanking({ mostra, audio } = {}) {
  const bt = $('#bt-ranking'); if (!bt) return;
  const abas = document.querySelectorAll('.rk-aba');
  const marcaAba = () => abas.forEach(a => { const on = a.dataset.periodo === periodo; a.classList.toggle('ativa', on); a.setAttribute('aria-selected', on); });
  abas.forEach(a => a.addEventListener('click', () => { periodo = a.dataset.periodo; marcaAba(); carregaLista(); }));
  marcaAba();
  bt.addEventListener('click', () => { audio && audio(); mostra('#tela-ranking'); carregaLista(); });
  $('#rk-lista').addEventListener('click', e => { if (e.target.closest('.rk-tentar')) carregaLista(); });
  $('#rk-form')?.addEventListener('submit', salvar);
  // teclas digitadas no campo não viram comandos do jogo
  $('#rk-nome')?.addEventListener('keydown', e => e.stopPropagation());
}
