/*
 * Surf nos Trilhos · Desenvolvido por Alequizao <alequizao.dev@gmail.com>
 * https://github.com/alequizao · © 2026 Alequizao. Todos os direitos reservados.
 */
// Surf nos Trilhos — corrida infinita nos trilhos (Alequizão)
import * as THREE from 'three';
import { ic } from './icones.js?v=1.2.0';
import { criaCorredor as modeloCorredor, criaVigia as modeloVigia } from './personagens.js?v=1.2.0';
import { criaVisualTrem, criaVisualRampa, criaVisualBarreira, animaObjetos } from './objetos.js?v=1.2.0';
import { GEO_MOEDA, MATS_MOEDA, criaVisualPoder, animaItens } from './itens.js?v=1.2.0';
import { iniciaRanking, rankingInicio, rankingFim } from './ranking.js?v=1.2.0';
import { criaBiomas } from './biomas.js?v=1.2.0';

const VERSAO = '1.2.0';
const LANE = 2.6;          // distância entre trilhos
const GRAV = 38;
const PULO = 14.5;
const PULO_TENIS = 18.5;
const TOPO_TREM = 3.4;
const CARRO = 12;          // comprimento de um vagão
const TRECHO = 40;         // comprimento de um pedaço de cenário
const N_TRECHOS = 8;
const CHAVE = 'surf-alequizao-v1';
const $ = s => document.querySelector(s);
const rnd = (a, b) => a + Math.random() * (b - a);
const escolhe = a => a[Math.floor(Math.random() * a.length)];
const embaralha = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const fmt = n => Math.floor(n).toLocaleString('pt-BR');

// ================= SAVE =================
const padrao = () => ({ recorde: 0, moedas: 0, pranchas: 2, nivel: { ima: 0, jato: 0, tenis: 0, dobro: 0 },
  skin: 0, skins: [0], multNivel: 0, missoes: null, som: true, musica: true, corridas: 0,
  diario: { ultimo: '', seq: 0 }, conq: {}, tot: { moedas: 0, trens: 0, jatos: 0 }, melhorDist: 0,
  vibra: true, movimento: null, contraste: false, letras: false }); // movimento: null = segue o sistema (prefers-reduced-motion)
let S = carregar();
function carregar() {
  try {
    const j = JSON.parse(localStorage.getItem(CHAVE));
    if (j) {
      const p = padrao();
      return Object.assign(p, j, { nivel: Object.assign(p.nivel, j.nivel || {}), tot: Object.assign(p.tot, j.tot || {}),
        diario: Object.assign(p.diario, j.diario || {}), conq: j.conq || {} });
    }
  } catch (e) {}
  return padrao();
}
function salvar() { try { localStorage.setItem(CHAVE, JSON.stringify(S)); } catch (e) {} }

// ================= PODERES / LOJA =================
const PODERES = {
  ima:   { nome: 'Ímã',        desc: 'Puxa todas as moedas por perto.',          cor: '#e8364f', ic: ic('ima') },
  jato:  { nome: 'Jato',       desc: 'Voa por cima dos trens pegando moedas.',   cor: '#2f6bff', ic: ic('foguete') },
  tenis: { nome: 'Tênis Mola', desc: 'Pulos altíssimos, dá pra subir nos trens.', cor: '#1fc46b', ic: ic('tenis') },
  dobro: { nome: 'Pontos 2x',  desc: 'Dobra os pontos enquanto durar.',          cor: '#e2a300', ic: ic('dobro') },
};
const CUSTO_NIVEL = [300, 700, 1500, 3000, 6000];
const duracao = k => 10 + 2.5 * S.nivel[k];
const PRECO_PRANCHA = 250;
const SKINS = [
  { nome: 'Alex',      preco: 0,    casaco: 0xff7a1a, calca: 0x2c3e75, bone: 0x2f6bff, tenis: 0xffffff, pele: 0xe0a47a, cabelo: 0x3a2412, mochila: 0x1fc46b },
  { nome: 'Duda',      preco: 1500, casaco: 0x8a4dff, calca: 0x1b1b2e, bone: 0xff3d7f, tenis: 0xffd23f, pele: 0xf1c29a, cabelo: 0x8a3b12, mochila: 0xffd23f },
  { nome: 'Bento',     preco: 3000, casaco: 0x1fc46b, calca: 0x5a3a1e, bone: 0xffd23f, tenis: 0xe8364f, pele: 0x8d5a3b, cabelo: 0x111111, mochila: 0x2f6bff },
  { nome: 'Nina Neon', preco: 6000, casaco: 0x15151f, calca: 0x15151f, bone: 0x19f0e0, tenis: 0x19f0e0, pele: 0xc98e6a, cabelo: 0xff3d7f, mochila: 0xff3d7f, neon: true },
];

// ================= MISSÕES =================
const MODELOS = [
  { t: 'moedas',    a: [100, 250, 500, 800, 1200], txt: n => `Pegue ${n} moedas numa corrida`, corrida: true },
  { t: 'pulos',     a: [15, 30, 50, 80],            txt: n => `Pule ${n} vezes` },
  { t: 'rolagens',  a: [10, 25, 40, 60],            txt: n => `Role ${n} vezes` },
  { t: 'distancia', a: [500, 1000, 2000, 3500, 5000], txt: n => `Corra ${n} m numa corrida`, corrida: true },
  { t: 'poderes',   a: [2, 4, 6, 10],               txt: n => `Pegue ${n} poderes` },
  { t: 'pontos',    a: [3000, 8000, 20000, 50000, 100000], txt: n => `Faça ${fmt(n)} pontos numa corrida`, corrida: true },
  { t: 'trens',     a: [3, 6, 10, 15],              txt: n => `Corra em cima de ${n} trens` },
  { t: 'pranchas',  a: [1, 2, 3],                   txt: n => `Use ${n} prancha${n > 1 ? 's' : ''}` },
  { t: 'desvios',   a: [50, 100, 200],              txt: n => `Troque de trilho ${n} vezes` },
];
function novasMissoes() {
  const idx = embaralha(MODELOS.map((_, i) => i)).slice(0, 3);
  S.missoes = idx.map(i => {
    const m = MODELOS[i]; const nv = Math.min(m.a.length - 1, Math.floor(S.multNivel / 2));
    return { i, alvo: m.a[nv], prog: 0, feita: false };
  });
  salvar();
}
if (!S.missoes) novasMissoes();
const mult = () => 1 + S.multNivel;
let corridaStats = {};
function evento(tipo, qtd = 1) {
  if (tipo in corridaStats) corridaStats[tipo] += qtd; else corridaStats[tipo] = qtd;
  for (const ms of S.missoes) {
    const m = MODELOS[ms.i];
    if (ms.feita || m.t !== tipo) continue;
    ms.prog = m.corrida ? Math.max(ms.prog, corridaStats[tipo]) : ms.prog + qtd;
    if (ms.prog >= ms.alvo) { ms.prog = ms.alvo; ms.feita = true; SFX.missao(); toast(ic('alvo') + '<span>Missão concluída: ' + m.txt(ms.alvo) + '</span>'); checaMissoes(); }
  }
}
function checaMissoes() {
  if (S.missoes.every(m => m.feita)) {
    S.multNivel = Math.min(29, S.multNivel + 1);
    const premio = 150 + 50 * S.multNivel; S.moedas += premio;
    setTimeout(() => toast(ic('estrela') + `<span>Multiplicador x${mult()}! +${premio} moedas</span>`), 1800);
    setTimeout(checaConquistas, 4200);
    novasMissoes();
  }
  salvar();
}

// ================= CONQUISTAS =================
// ok() roda com a corrida (R) ou fora dela (R = null); cada uma paga uma vez só
const CONQ = [
  { id: 'km1',     nome: 'Primeiro quilômetro', desc: 'Corra 1.000 m numa corrida',                  premio: 200,  ok: () => R && R.dist >= 1000 },
  { id: 'km5',     nome: 'Maratonista',         desc: 'Corra 5.000 m numa corrida',                  premio: 800,  ok: () => R && R.dist >= 5000 },
  { id: 'km10',    nome: 'Imparável',           desc: 'Corra 10.000 m numa corrida',                 premio: 2000, ok: () => R && R.dist >= 10000 },
  { id: 'limpo1',  nome: 'Sem um arranhão',     desc: 'Corra 1.000 m sem tropeçar nem bater',        premio: 400,  ok: () => R && R.dist - R.limpoDesde >= 1000 },
  { id: 'limpo3',  nome: 'Liso',                desc: 'Corra 3.000 m sem tropeçar nem bater',        premio: 1200, ok: () => R && R.dist - R.limpoDesde >= 3000 },
  { id: 'raiz',    nome: 'Raiz',                desc: 'Corra 3.000 m sem usar "continuar correndo"', premio: 800,  ok: () => R && R.dist >= 3000 && !R.continuou },
  { id: 'recorde', nome: 'Superação',           desc: 'Passe a placa da sua maior distância',        premio: 300,  ok: () => R && R.passouRecorde },
  { id: 'pts100k', nome: 'Cem mil',             desc: 'Faça 100.000 pontos numa corrida',            premio: 1500, ok: () => R && R.pontos >= 100000 },
  { id: 'pulos',   nome: 'Canguru',             desc: 'Pule 100 vezes numa corrida',                 premio: 400,  ok: () => R && (corridaStats.pulos || 0) >= 100 },
  { id: 'trens',   nome: 'Rei dos vagões',      desc: 'Corra em cima de 50 trens (no total)',        premio: 500,  ok: () => S.tot.trens >= 50 },
  { id: 'moeda1k', nome: 'Cofrinho',            desc: 'Junte 1.000 moedas (no total)',               premio: 300,  ok: () => S.tot.moedas >= 1000 },
  { id: 'moeda10k',nome: 'Tio Patinhas',        desc: 'Junte 10.000 moedas (no total)',              premio: 1500, ok: () => S.tot.moedas >= 10000 },
  { id: 'jatos',   nome: 'Astronauta',          desc: 'Pegue o jato 10 vezes (no total)',            premio: 400,  ok: () => S.tot.jatos >= 10 },
  { id: 'mult10',  nome: 'Multiplicador x10',   desc: 'Chegue ao multiplicador x10 nas missões',     premio: 1000, ok: () => mult() >= 10 },
  { id: 'fiel',    nome: 'Fiel',                desc: 'Pegue o prêmio do dia 7 dias seguidos',       premio: 700,  ok: () => S.diario.seq >= 7 },
  { id: 'estilo',  nome: 'Estiloso',            desc: 'Libere um personagem novo na loja',           premio: 300,  ok: () => S.skins.length > 1 },
];
function checaConquistas() {
  const novas = CONQ.filter(c => !S.conq[c.id] && c.ok());
  if (!novas.length) return;
  novas.forEach((c, i) => {
    S.conq[c.id] = hojeStr(); S.moedas += c.premio;
    setTimeout(() => { SFX.missao(); vibra([30, 40, 30]); toast(ic('trofeu') + `<span>Conquista: <b>${c.nome}</b> · +${fmt(c.premio)} moedas</span>`); }, i * 2400);
  });
  salvar();
}

// ================= PRÊMIO DO DIA =================
const PREMIO_DIA = [100, 150, 200, 300, 400, 500, 800]; // 7º dia: +1 prancha
const hojeStr = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const ontemStr = () => { const d = new Date(); d.setDate(d.getDate() - 1); return hojeStr(d); };
const diarioPendente = () => S.diario.ultimo !== hojeStr();
const proximoDia = () => (S.diario.ultimo === ontemStr() ? S.diario.seq % 7 + 1 : 1);

// ================= VIBRAÇÃO (Android; o iPhone ignora) =================
function vibra(padraoV) { if (!S.vibra || !navigator.vibrate) return; try { navigator.vibrate(padraoV); } catch (e) { /* sem suporte */ } }
const menosMov = () => S.movimento ?? matchMedia('(prefers-reduced-motion: reduce)').matches;

// ================= ÁUDIO =================
let AC = null, master = null, bufRuido = null;
function audio() {
  if (!AC) {
    try {
      AC = new (window.AudioContext || window.webkitAudioContext)();
      master = AC.createGain(); master.gain.value = 0.45; master.connect(AC.destination);
      bufRuido = AC.createBuffer(1, AC.sampleRate * 0.5, AC.sampleRate);
      const d = bufRuido.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    } catch (e) { AC = null; }
  }
  if (AC && AC.state === 'suspended') AC.resume();
}
function tom(freq, dur, tipo = 'square', vol = 0.2, slide = 0, t0 = 0, musica = false) {
  if (!AC || (musica ? !S.musica : !S.som)) return;
  const t = t0 || AC.currentTime;
  const o = AC.createOscillator(), g = AC.createGain();
  o.type = tipo; o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.02);
}
function ruido(dur, vol = 0.3, freq = 1200, t0 = 0, musica = false) {
  if (!AC || (musica ? !S.musica : !S.som)) return;
  const t = t0 || AC.currentTime;
  const s = AC.createBufferSource(); s.buffer = bufRuido;
  const f = AC.createBiquadFilter(); f.type = musica ? 'highpass' : 'lowpass'; f.frequency.value = freq;
  const g = AC.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  s.connect(f); f.connect(g); g.connect(master); s.start(t); s.stop(t + dur);
}
const SFX = {
  moeda()   { tom(1318, .07, 'square', .06); tom(1975, .1, 'square', .06, 0, AC && AC.currentTime + .05); },
  pulo()    { tom(280, .2, 'triangle', .22, 520); },
  rolar()   { ruido(.25, .18, 700); },
  lado()    { tom(420, .07, 'sine', .1, 260); },
  batida()  { ruido(.5, .6, 500); tom(140, .45, 'sawtooth', .28, -90); },
  tropeco() { tom(220, .22, 'sawtooth', .18, -130); ruido(.15, .25, 900); },
  poder()   { if (!AC) return; [523, 659, 784, 1046].forEach((f, i) => tom(f, .13, 'square', .09, 0, AC.currentTime + i * .07)); },
  missao()  { if (!AC) return; [784, 988, 1175, 1568].forEach((f, i) => tom(f, .16, 'triangle', .16, 0, AC.currentTime + i * .09)); },
  prancha() { tom(200, .3, 'sawtooth', .12, 600); },
  quebra()  { ruido(.35, .45, 1800); tom(600, .25, 'square', .12, -400); },
  jato()    { ruido(.8, .25, 400); },
  compra()  { if (!AC) return; [880, 1320].forEach((f, i) => tom(f, .12, 'square', .1, 0, AC.currentTime + i * .08)); },
};
// trilha própria em loop (baixo + chimbal + melodia)
const BAIXO = [45, 45, 57, 45, 43, 43, 55, 43, 41, 41, 53, 41, 43, 43, 55, 47];
const MELODIA = [69, 0, 72, 0, 76, 74, 72, 0, 67, 0, 71, 0, 74, 72, 71, 0, 65, 0, 69, 0, 72, 71, 69, 0, 67, 0, 71, 74, 76, 0, 79, 0];
const midi = n => 440 * Math.pow(2, (n - 69) / 12);
let musPasso = 0, musProx = 0, musTimer = null;
function musicaLiga() {
  if (!AC || musTimer) return;
  musProx = AC.currentTime + 0.1;
  musTimer = setInterval(() => {
    const passo = 60 / 150 / 2;
    while (musProx < AC.currentTime + 0.25) {
      const i = musPasso;
      if (i % 2 === 0) tom(midi(BAIXO[(i >> 1) % 16]), passo * 1.7, 'triangle', .2, 0, musProx, true);
      ruido(.04, i % 4 === 2 ? .09 : .04, 7000, musProx, true);
      if (i % 8 === 4) ruido(.12, .14, 1500, musProx, true);
      const l = MELODIA[i % 32];
      if (l && Math.floor(i / 32) % 2 === 1) tom(midi(l), passo * .9, 'square', .045, 0, musProx, true);
      musProx += passo; musPasso++;
    }
  }, 60);
}
function musicaDesliga() { clearInterval(musTimer); musTimer = null; }

// ================= THREE =================
const canvas = $('#cena');
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: window.devicePixelRatio < 2, powerPreference: 'high-performance' });
} catch (e) {
  const c = $('#carregando'); c.classList.add('erro'); c.textContent = 'Seu navegador não conseguiu abrir o 3D (WebGL). Tente atualizar o navegador ou usar o Chrome.';
  throw e;
}
const CELULAR = (window.matchMedia && matchMedia('(pointer: coarse)').matches) || Math.min(screen.width, screen.height) < 700;
let pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
renderer.setPixelRatio(pixelRatio);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
let sombrasLigadas = true;
const ANISO = Math.min(8, renderer.capabilities.getMaxAnisotropy());
const FONTE = '"Lilita One", Impact, "Arial Black", sans-serif';
// espera a fonte (no máx. 1,5 s) para os grafites/placas saírem com a letra certa
try { await Promise.race([(async () => { await document.fonts.ready; await document.fonts.load('60px "Lilita One"'); })(), new Promise(r => setTimeout(r, 1500))]); } catch (e) {}

// aleatório com semente (texturas iguais em todas as passadas cor/rugosidade/emissão)
let _semente = 1;
const semear = s => { _semente = (s * 7919 + 13) % 2147483647; if (_semente <= 0) _semente += 2147483646; };
const srnd = (a = 0, b = 1) => { _semente = _semente * 16807 % 2147483647; return a + (_semente - 1) / 2147483646 * (b - a); };
const spick = a => a[Math.floor(srnd() * a.length) % a.length];

// ---------- cena, luzes e céu ----------
const scene = new THREE.Scene();
const NEVOA = '#dcdcd2';                 // cor do horizonte = cor da névoa
scene.background = new THREE.Color(NEVOA);
scene.fog = new THREE.Fog(NEVOA, 70, 235);
const camera = new THREE.PerspectiveCamera(62, 1, 0.1, 400);
const hemi = new THREE.HemisphereLight(0xd6e6ff, 0x8a7864, 0.75); scene.add(hemi);
// sol: vem da esquerda, alto e um pouco de trás da câmera (sombras caem pra direita/à frente)
const DIR_SOL = new THREE.Vector3(-0.62, 1, 0.3).normalize();
const sol = new THREE.DirectionalLight(0xfff0d6, 2.7);
const SH_MAPA = CELULAR ? 1024 : 2048, SH_L = 38, SH_A = 17;
sol.castShadow = true;
sol.shadow.mapSize.set(SH_MAPA, SH_MAPA);
Object.assign(sol.shadow.camera, { left: -SH_L, right: SH_L, top: SH_A, bottom: -SH_A, near: 1, far: 150 });
sol.shadow.camera.updateProjectionMatrix();
sol.shadow.bias = -0.0005; sol.shadow.normalBias = 0.035;
scene.add(sol, sol.target);
// eixos do espaço da luz (pra "grudar" a câmera de sombra na grade de texels e evitar tremido)
const _lx = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), DIR_SOL).normalize();
const _ly = new THREE.Vector3().crossVectors(DIR_SOL, _lx);
const _alvoSol = new THREE.Vector3();
function atualizaSol() {
  const z = R ? -R.dist - 26 : 8;
  _alvoSol.set(0, 0, z);
  const tx = 2 * SH_L / SH_MAPA, ty = 2 * SH_A / SH_MAPA;
  const a = Math.round(_alvoSol.dot(_lx) / tx) * tx, b = Math.round(_alvoSol.dot(_ly) / ty) * ty, c = _alvoSol.dot(DIR_SOL);
  _alvoSol.copy(_lx).multiplyScalar(a).addScaledVector(_ly, b).addScaledVector(DIR_SOL, c);
  sol.target.position.copy(_alvoSol);
  sol.position.copy(_alvoSol).addScaledVector(DIR_SOL, 70);
}
function redimensiona() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h, false); camera.aspect = w / h;
  camera.userData.fovBase = w / h < 0.8 ? 72 : 60;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', redimensiona); redimensiona();

// ---------- utilidades de textura ----------
function mkCanvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
function texC(c, cor = true, rep) {
  const t = new THREE.CanvasTexture(c); if (cor) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = ANISO;
  if (rep) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep[0], rep[1]); }
  return t;
}
function tex(w, h, desenha, rep, cor = true) { const c = mkCanvas(w, h); desenha(c.getContext('2d'), w, h); return texC(c, cor, rep); }
const uvPx = (x0, y0, x1, y1, W, H, i = 0) => [(x0 + i) / W, 1 - (y1 - i) / H, (x1 - i) / W, 1 - (y0 + i) / H];
function pontilha(g, x, y, w, h, n, a, claro = .5, tam = 2) { // pontinhos claros/escuros
  for (let i = 0; i < n; i++) {
    const v = srnd() < claro ? 255 : 0;
    g.fillStyle = `rgba(${v},${v},${v},${srnd(0, a)})`;
    g.fillRect(x + srnd(0, w), y + srnd(0, h), srnd(1, tam), srnd(1, tam));
  }
}
function rgba(hex, a) { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16},${n >> 8 & 255},${n & 255},${a})`; }

// ---------- céu (domo com névoa quente, nuvens e brilho do sol) ----------
const texCeu = tex(1024, 512, (g, w, h) => {
  const hz = h / 2;
  const gr = g.createLinearGradient(0, 0, 0, hz);
  gr.addColorStop(0, '#2c69c0'); gr.addColorStop(0.45, '#4d8fdc'); gr.addColorStop(0.75, '#8dbde8'); gr.addColorStop(0.92, '#c6d8df'); gr.addColorStop(1, NEVOA);
  g.fillStyle = gr; g.fillRect(0, 0, w, hz);
  g.fillStyle = NEVOA; g.fillRect(0, hz, w, h - hz);
  g.save(); g.beginPath(); g.rect(0, 0, w, hz); g.clip();
  const b = g.createLinearGradient(0, hz - 80, 0, hz);
  b.addColorStop(0, 'rgba(255,226,190,0)'); b.addColorStop(0.75, 'rgba(252,226,196,.4)'); b.addColorStop(1, 'rgba(220,220,210,0)');
  g.fillStyle = b; g.fillRect(0, hz - 80, w, 80);
  const sx = w * 0.875, sy = hz - 64;
  for (const dx of [-w, 0, w]) {
    const r = g.createRadialGradient(sx + dx, sy, 3, sx + dx, sy, 240);
    r.addColorStop(0, 'rgba(255,253,244,1)'); r.addColorStop(0.05, 'rgba(255,246,222,.9)'); r.addColorStop(0.3, 'rgba(255,232,196,.3)'); r.addColorStop(1, 'rgba(255,226,190,0)');
    g.fillStyle = r; g.fillRect(sx + dx - 240, sy - 240, 480, 480);
  }
  semear(7);
  for (let i = 0; i < 30; i++) {
    const cx = srnd(0, w), cy = srnd(hz - 175, hz - 30), esc = srnd(0.5, 1.25) * (0.45 + 0.55 * (hz - cy) / 175);
    const n = 6 + (srnd() * 9 | 0), blobs = [];
    for (let k = 0; k < n; k++) blobs.push([srnd(-70, 70) * esc, srnd(-12, 8) * esc, srnd(16, 40) * esc]);
    for (const dx of [-w, 0, w]) {
      for (const [bx, by, r] of blobs) { // base acinzentada
        const q = g.createRadialGradient(cx + dx + bx, cy + by + r * .35, 0, cx + dx + bx, cy + by + r * .35, r);
        q.addColorStop(0, 'rgba(176,190,208,.35)'); q.addColorStop(1, 'rgba(176,190,208,0)');
        g.fillStyle = q; g.fillRect(cx + dx + bx - r, cy + by + r * .35 - r, 2 * r, 2 * r);
      }
      for (const [bx, by, r] of blobs) {
        const q = g.createRadialGradient(cx + dx + bx, cy + by, 0, cx + dx + bx, cy + by, r);
        q.addColorStop(0, 'rgba(255,255,255,.85)'); q.addColorStop(.55, 'rgba(255,255,255,.45)'); q.addColorStop(1, 'rgba(255,255,255,0)');
        g.fillStyle = q; g.fillRect(cx + dx + bx - r, cy + by - r, 2 * r, 2 * r);
      }
    }
  }
  g.restore();
});
const matCeu = new THREE.MeshBasicMaterial({ map: texCeu, side: THREE.BackSide, fog: false, depthWrite: false, toneMapped: false });
const ceu = new THREE.Mesh(new THREE.SphereGeometry(300, 40, 20), matCeu);
ceu.renderOrder = -10; ceu.frustumCulled = false; scene.add(ceu);
{ // ambiente para reflexos de metal/vidro
  const cenaEnv = new THREE.Scene();
  cenaEnv.add(new THREE.Mesh(new THREE.SphereGeometry(50, 32, 16), matCeu));
  const ch = new THREE.Mesh(new THREE.CircleGeometry(48, 24), new THREE.MeshBasicMaterial({ color: 0x6b6358, toneMapped: false }));
  ch.rotation.x = -Math.PI / 2; ch.position.y = -2; cenaEnv.add(ch);
  const pm = new THREE.PMREMGenerator(renderer);
  scene.environment = pm.fromScene(cenaEnv, 0.035).texture; pm.dispose();
  scene.environmentIntensity = 0.6;
}

// ---------- construtor de geometrias (junta tudo num buffer só) ----------
const BRANCO = [1, 1, 1];
const _q = new THREE.Quaternion(), _e = new THREE.Euler();
const mtx = (x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) =>
  new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), _q.setFromEuler(_e.set(rx, ry, rz)), new THREE.Vector3(sx, sy, sz));
class Construtor {
  constructor() { this.p = []; this.n = []; this.uv = []; this.c = []; }
  _v(x, y, z, nx, ny, nz, u, v, c) { this.p.push(x, y, z); this.n.push(nx, ny, nz); this.uv.push(u, v); this.c.push(c[0], c[1], c[2]); }
  // qualquer geometria do three; ret remapeia o uv 0..1 para um retângulo do atlas; faces = um ret por face (null pula a face)
  add(geo, m, ret, cor, faces) {
    const g = geo.index ? geo.toNonIndexed() : geo;
    const P = g.attributes.position, N = g.attributes.normal, U = g.attributes.uv, c = cor || BRANCO;
    const nm = m ? new THREE.Matrix3().getNormalMatrix(m) : null, a = new THREE.Vector3(), b = new THREE.Vector3();
    const porFace = faces ? P.count / faces.length : 0;
    for (let i = 0; i < P.count; i++) {
      const r = faces ? faces[Math.floor(i / porFace)] : ret;
      if (faces && !r) continue;
      a.fromBufferAttribute(P, i); b.fromBufferAttribute(N, i);
      if (m) { a.applyMatrix4(m); b.applyMatrix3(nm).normalize(); }
      let u = U ? U.getX(i) : 0, v = U ? U.getY(i) : 0;
      if (r) { u = r[0] + u * (r[2] - r[0]); v = r[1] + v * (r[3] - r[1]); }
      this._v(a.x, a.y, a.z, b.x, b.y, b.z, u, v, c);
    }
    if (g !== geo) g.dispose();
    return this;
  }
  // caixa: faces na ordem do three [px, nx, py, ny, pz, nz]
  caixa(w, h, d, x, y, z, faces, cor, rx = 0, ry = 0, rz = 0) {
    const f = typeof faces[0] === 'number' ? [faces, faces, faces, faces, faces, faces] : faces;
    return this.add(CAIXA_N, mtx(x, y, z, rx, ry, rz, w, h, d), null, cor, f);
  }
  // quad a,b,c,d anti-horário visto de fora (a = baixo-esquerda)
  quad(a, b, c, d, r = [0, 0, 1, 1], cor, ns) {
    const e1 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], e2 = [d[0] - a[0], d[1] - a[1], d[2] - a[2]];
    let nx = e1[1] * e2[2] - e1[2] * e2[1], ny = e1[2] * e2[0] - e1[0] * e2[2], nz = e1[0] * e2[1] - e1[1] * e2[0];
    const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
    const P = [a, b, c, d], UV = [[r[0], r[1]], [r[2], r[1]], [r[2], r[3]], [r[0], r[3]]];
    const C = cor && Array.isArray(cor[0]) ? cor : [cor || BRANCO, cor || BRANCO, cor || BRANCO, cor || BRANCO];
    for (const i of [0, 1, 2, 0, 2, 3]) { const n = ns ? ns[i] : [nx, ny, nz]; this._v(P[i][0], P[i][1], P[i][2], n[0], n[1], n[2], UV[i][0], UV[i][1], C[i]); }
    return this;
  }
  tri(a, b, c, uv, n) { for (const p of [a, b, c]) this._v(p[0], p[1], p[2], n[0], n[1], n[2], uv[0], uv[1], BRANCO); return this; }
  geometria() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3));
    g.computeBoundingSphere();
    return g;
  }
}
const CAIXA_N = new THREE.BoxGeometry(1, 1, 1).toNonIndexed();
const std = o => new THREE.MeshStandardMaterial(o);

// ================= TEXTURAS DO CENÁRIO =================
// brita: pedrinhas sombreadas + relevo
const [texBrita, texBritaRelevo] = (() => {
  const w = 512, cc = mkCanvas(w, w), cb = mkCanvas(w, w), g = cc.getContext('2d'), gb = cb.getContext('2d');
  g.fillStyle = '#4f4841'; g.fillRect(0, 0, w, w); gb.fillStyle = '#000'; gb.fillRect(0, 0, w, w);
  semear(3);
  const elip = (c, x, y, rx, ry, a) => { c.beginPath(); c.ellipse(x, y, rx, ry, a, 0, 6.3); c.fill(); };
  for (let i = 0; i < 4200; i++) {
    const x = srnd(0, w), y = srnd(0, w), rx = srnd(4.5, 10.5), ry = rx * srnd(.55, .95), a = srnd(0, 3.14);
    const v = srnd(92, 172) | 0, t = srnd(-8, 14) | 0, hb = srnd(120, 230) | 0;
    const xs = [0], ys = [0];
    if (x < 14) xs.push(w); if (x > w - 14) xs.push(-w); if (y < 14) ys.push(w); if (y > w - 14) ys.push(-w);
    for (const dx of xs) for (const dy of ys) {
      g.fillStyle = 'rgba(18,14,10,.55)'; elip(g, x + dx + 1.8, y + dy + 2.4, rx, ry, a);
      g.fillStyle = `rgb(${v + t},${v},${v - t - 6})`; elip(g, x + dx, y + dy, rx, ry, a);
      g.fillStyle = 'rgba(255,250,240,.16)'; elip(g, x + dx - rx * .25, y + dy - ry * .3, rx * .55, ry * .45, a);
      gb.fillStyle = '#000'; elip(gb, x + dx + 1.5, y + dy + 2, rx, ry, a);
      gb.fillStyle = `rgb(${hb * .7 | 0},${hb * .7 | 0},${hb * .7 | 0})`; elip(gb, x + dx, y + dy, rx, ry, a);
      gb.fillStyle = `rgb(${hb},${hb},${hb})`; elip(gb, x + dx - rx * .1, y + dy - ry * .1, rx * .6, ry * .6, a);
    }
  }
  const t1 = texC(cc, true, [1, 1]), t2 = texC(cb, false, [1, 1]);
  return [t1, t2];
})();
// concreto genérico (muro, capa, dormente)
const texConcreto = tex(256, 256, (g, w, h) => {
  semear(11); g.fillStyle = '#a3a098'; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 90; i++) { g.fillStyle = `rgba(${srnd() < .5 ? '60,55,50' : '200,196,188'},${srnd(.03, .09)})`; g.beginPath(); g.ellipse(srnd(0, w), srnd(0, h), srnd(8, 40), srnd(6, 30), srnd(0, 3), 0, 6.3); g.fill(); }
  pontilha(g, 0, 0, w, h, 5000, .18, .5, 2);
  for (let i = 0; i < 120; i++) { g.fillStyle = 'rgba(40,36,32,.45)'; g.beginPath(); g.arc(srnd(0, w), srnd(0, h), srnd(.6, 1.8), 0, 6.3); g.fill(); }
}, [1, 1]);
// calçada (placas de concreto 50 cm, encardidas) — 1 ladrilho = 2 m
const texCalcada = tex(256, 256, (g, w, h) => {
  semear(21); g.fillStyle = '#b3aca0'; g.fillRect(0, 0, w, h);
  for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) { const v = srnd(-14, 10) | 0; g.fillStyle = `rgba(${v < 0 ? '40,36,30' : '255,250,240'},${Math.abs(v) / 100})`; g.fillRect(x * 64, y * 64, 64, 64); }
  pontilha(g, 0, 0, w, h, 4000, .14);
  g.fillStyle = 'rgba(60,54,46,.55)'; for (let i = 0; i <= 4; i++) { g.fillRect(i * 64 - 1, 0, 2, h); g.fillRect(0, i * 64 - 1, w, 2); }
  for (let i = 0; i < 14; i++) { const q = g.createRadialGradient(0, 0, 0, 0, 0, 30); q.addColorStop(0, 'rgba(50,44,36,.22)'); q.addColorStop(1, 'rgba(50,44,36,0)'); g.save(); g.translate(srnd(0, w), srnd(0, h)); g.fillStyle = q; g.fillRect(-30, -30, 60, 60); g.restore(); }
}, [1, 1]);

// grafite com cara de spray: nuvem de fundo, contorno de borda suave, escorridos e respingos
const PALAVRAS = ['SURF', 'VAI!', 'ALQ', 'ZUM', 'CORRE', 'MCZ', 'TRILHO', 'UAU', 'BORA', 'OXE', 'MASSA', 'VISH'];
const CORES_GRAFITE = ['#ff3d7f', '#ffd23f', '#19f0e0', '#1fc46b', '#ff7a1a', '#8a4dff', '#2f6bff', '#e8364f'];
function borrifo(g, x, y, r, cor, a) {
  const q = g.createRadialGradient(x, y, 0, x, y, r); q.addColorStop(0, rgba(cor, a)); q.addColorStop(.6, rgba(cor, a * .6)); q.addColorStop(1, rgba(cor, 0));
  g.fillStyle = q; g.fillRect(x - r, y - r, 2 * r, 2 * r);
}
function grafite(g, cx, cy, tam, texto) {
  const cor = spick(CORES_GRAFITE); let cor2 = spick(CORES_GRAFITE); if (cor2 === cor) cor2 = '#ffffff';
  const contorno = srnd() < .7 ? '#141821' : '#fbfbf5';
  g.save(); g.translate(cx, cy); g.rotate(srnd(-.1, .1));
  g.font = `${tam}px ${FONTE}`; g.textAlign = 'center'; g.textBaseline = 'middle';
  const larg = g.measureText(texto).width;
  for (let k = 0; k < 16; k++) borrifo(g, srnd(-larg * .55, larg * .55), srnd(-tam * .35, tam * .35), tam * srnd(.3, .55), cor2, .5);
  g.fillStyle = 'rgba(12,14,22,.8)'; for (let k = 1; k <= 5; k++) g.fillText(texto, k * tam * .018, k * tam * .022);
  g.lineJoin = 'round'; g.lineWidth = tam * .15; g.strokeStyle = contorno; g.shadowColor = contorno; g.shadowBlur = tam * .08; g.strokeText(texto, 0, 0);
  const q = g.createLinearGradient(0, -tam / 2, 0, tam / 2); q.addColorStop(0, '#ffffff'); q.addColorStop(.18, cor); q.addColorStop(1, cor2 === '#ffffff' ? cor : cor2);
  g.shadowColor = cor; g.shadowBlur = tam * .05; g.fillStyle = q; g.fillText(texto, 0, 0);
  g.shadowBlur = 0;
  // brilhos
  g.fillStyle = 'rgba(255,255,255,.85)';
  for (let k = 0; k < 3; k++) { const x = srnd(-larg / 2, larg / 2), y = srnd(-tam * .3, -tam * .1), s = tam * srnd(.05, .09); g.beginPath(); g.moveTo(x, y - s); g.lineTo(x + s * .25, y); g.lineTo(x, y + s); g.lineTo(x - s * .25, y); g.fill(); g.beginPath(); g.moveTo(x - s, y); g.lineTo(x, y + s * .25); g.lineTo(x + s, y); g.lineTo(x, y - s * .25); g.fill(); }
  // escorridos
  g.fillStyle = cor;
  for (let k = 0; k < larg / 14; k++) { const x = srnd(-larg * .45, larg * .45), l = srnd(4, tam * .75), y = tam * srnd(.2, .32), e = srnd(1.4, 2.6); g.fillRect(x, y, e, l); g.beginPath(); g.arc(x + e / 2, y + l, e * .9, 0, 6.3); g.fill(); }
  // respingos
  for (let k = 0; k < 50; k++) { const a = srnd(0, 6.3), r = srnd(larg * .35, larg * .75); g.fillStyle = rgba(srnd() < .5 ? cor : cor2, srnd(.3, .8)); g.beginPath(); g.arc(Math.cos(a) * r, Math.sin(a) * r * .45, srnd(.5, 2.2), 0, 6.3); g.fill(); }
  g.restore();
}
function pichacao(g, x, y, tam) { // "tag" rabiscada
  g.save(); g.translate(x, y); g.strokeStyle = srnd() < .6 ? 'rgba(20,20,26,.85)' : rgba(spick(CORES_GRAFITE), .85); g.lineWidth = srnd(1.5, 3); g.lineCap = 'round';
  g.beginPath(); let px = 0; g.moveTo(0, 0);
  for (let k = 0; k < 7; k++) { const nx = px + srnd(6, 16) * tam; g.quadraticCurveTo(px + srnd(-4, 10), srnd(-20, 6) * tam, nx, srnd(-6, 6) * tam); px = nx; }
  g.stroke(); g.restore();
}
// muros: concreto em placas com juntas, furos de amarração, escorridos, limo e grafites
const texMuros = Array.from({ length: 4 }, (_, k) => tex(2048, 160, (g, w, h) => {
  semear(100 + k * 37);
  g.fillStyle = ['#a7a29a', '#b0a797', '#9da2a4', '#aaa194'][k]; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 140; i++) { g.fillStyle = `rgba(${srnd() < .5 ? '70,64,58' : '220,214,204'},${srnd(.03, .08)})`; g.beginPath(); g.ellipse(srnd(0, w), srnd(0, h), srnd(20, 90), srnd(8, 40), 0, 0, 6.3); g.fill(); }
  pontilha(g, 0, 0, w, h, 16000, .16);
  const painel = w / 10;
  for (let x = 0; x <= w; x += painel) { g.fillStyle = 'rgba(30,28,26,.45)'; g.fillRect(x - 1.5, 0, 3, h); g.fillStyle = 'rgba(255,255,255,.14)'; g.fillRect(x + 1.5, 0, 1.5, h); }
  g.fillStyle = 'rgba(30,28,26,.3)'; g.fillRect(0, h * .5, w, 2); g.fillStyle = 'rgba(255,255,255,.1)'; g.fillRect(0, h * .5 + 2, w, 1);
  for (let x = 0; x < w; x += painel) for (const fx of [.25, .75]) for (const fy of [.25, .75]) { g.fillStyle = 'rgba(40,36,32,.5)'; g.beginPath(); g.arc(x + painel * fx, h * fy, 2.2, 0, 6.3); g.fill(); }
  // grafites
  const n = 3 + (srnd() * 2 | 0);
  for (let i = 0; i < n; i++) grafite(g, (i + srnd(.2, .8)) * w / n, h * srnd(.42, .56), i === 0 ? srnd(46, 54) : srnd(52, 78), i === 0 ? '@alequizao' : spick(PALAVRAS)); // 1º de cada muro: Instagram
  for (let i = 0; i < 7; i++) pichacao(g, srnd(0, w), srnd(h * .2, h * .6), srnd(.7, 1.2));
  // escorridos de chuva a partir do topo
  for (let i = 0; i < 90; i++) {
    const x = srnd(0, w), l = srnd(10, h * .85), e = srnd(2, 12);
    const q = g.createLinearGradient(0, 0, 0, l); q.addColorStop(0, 'rgba(38,34,30,.32)'); q.addColorStop(1, 'rgba(38,34,30,0)');
    g.fillStyle = q; g.fillRect(x, 0, e, l);
  }
  // sombra da capa no topo
  const s = g.createLinearGradient(0, 0, 0, 14); s.addColorStop(0, 'rgba(0,0,0,.45)'); s.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = s; g.fillRect(0, 0, w, 14);
  // limo e sujeira embaixo
  const lm = g.createLinearGradient(0, h * .55, 0, h); lm.addColorStop(0, 'rgba(52,66,34,0)'); lm.addColorStop(.6, 'rgba(52,66,34,.35)'); lm.addColorStop(1, 'rgba(34,40,24,.8)');
  g.fillStyle = lm; g.fillRect(0, h * .55, w, h * .45);
  for (let i = 0; i < 260; i++) { const x = srnd(0, w), r = srnd(4, 18); const q = g.createRadialGradient(x, h, 0, x, h, r * 2.2); q.addColorStop(0, 'rgba(40,58,26,.55)'); q.addColorStop(1, 'rgba(40,58,26,0)'); g.fillStyle = q; g.fillRect(x - r * 2.2, h - r * 2.2, r * 4.4, r * 2.2); }
  pontilha(g, 0, h * .8, w, h * .2, 3000, .3, .2, 3);
}));

// prédios: atlas 2048x1024 com 4 paletas (fachada 6 vãos x 11 andares + amostras de cor)
const PW = 2048, PH = 1024, CEL = 80, LINHAS = 11;
const PALETAS = [
  { parede: '#e6d8bd', parede2: '#cdbb98', moldura: '#f8f4ea', vidro: ['#2f4a66', '#9dbcd6'], acento: '#a8663c', tipo: 'reboco' },
  { parede: '#c3d0d8', parede2: '#a9bac6', moldura: '#f0f4f6', vidro: ['#26405a', '#a4c8e0'], acento: '#35648f', tipo: 'pastilha' },
  { parede: '#d7967a', parede2: '#bf7c60', moldura: '#f4e8dc', vidro: ['#34465a', '#aec0cd'], acento: '#7a3a28', tipo: 'reboco' },
  { parede: '#eceeec', parede2: '#cfd5d6', moldura: '#8f9ba3', vidro: ['#17496d', '#86bde0'], acento: '#1d4f73', tipo: 'vidro' },
];
const LOJAS = ['FARMÁCIA', 'PADARIA', 'BAR', 'AÇAÍ', 'LOJA', 'CAFÉ', 'ÓTICA', 'PIZZA', 'CELULAR', 'MERCADO'];
const CORES_LOJA = ['#d8232f', '#1f55c9', '#1fa35c', '#ff8a00', '#6a2fb8', '#e2a300', '#0f7c8c'];
function desenhaPredios(g, modo) {
  const cor = modo === 'cor', rug = modo === 'rug';
  const F = (c, r, e = '#000') => cor ? c : rug ? `rgb(${r * 255 | 0},${r * 255 | 0},${r * 255 | 0})` : e;
  g.fillStyle = F('#888', .9); g.fillRect(0, 0, PW, PH);
  PALETAS.forEach((P, pi) => {
    semear(500 + pi * 71);
    const x0 = pi * 512;
    g.fillStyle = F(P.parede, .88); g.fillRect(x0, 0, 512, PH);
    if (cor) {
      pontilha(g, x0, 144, 512, PH - 144, 9000, .1);
      if (P.tipo === 'pastilha') { g.fillStyle = 'rgba(255,255,255,.18)'; for (let y = 144; y < PH; y += 6) g.fillRect(x0, y, 512, 1); for (let x = 0; x < 512; x += 6) g.fillRect(x0 + x, 144, 1, PH - 144); }
    }
    // --- amostras (64x64) nas 2 primeiras faixas ---
    const sw = (s, desenha) => { const x = x0 + (s % 8) * 64, y = Math.floor(s / 8) * 64; g.save(); g.beginPath(); g.rect(x, y, 64, 64); g.clip(); desenha(x, y); g.restore(); };
    sw(0, (x, y) => { g.fillStyle = F('#8d8a84', .92); g.fillRect(x, y, 64, 64); if (cor) { pontilha(g, x, y, 64, 64, 500, .2); g.fillStyle = 'rgba(40,40,30,.25)'; g.fillRect(x + 10, y + 20, 30, 18); } }); // laje do teto
    sw(1, (x, y) => { g.fillStyle = F(P.acento, .7); g.fillRect(x, y, 64, 64); if (cor) pontilha(g, x, y, 64, 64, 200, .12); });            // platibanda
    sw(2, (x, y) => { g.fillStyle = F(P.parede, .88); g.fillRect(x, y, 64, 64); if (cor) pontilha(g, x, y, 64, 64, 300, .1); });           // parede lisa
    sw(3, (x, y) => { g.fillStyle = F('#b9b5ad', .9); g.fillRect(x, y, 64, 64); if (cor) pontilha(g, x, y, 64, 64, 300, .15); });          // laje da sacada
    sw(4, (x, y) => { g.fillStyle = F('#7fa0b8', .1); g.fillRect(x, y, 64, 64); g.fillStyle = F('#2a2f35', .5); g.fillRect(x, y, 64, 6); for (let k = 0; k < 64; k += 8) g.fillRect(x + k, y, 2, 64); g.fillRect(x, y + 58, 64, 6); }); // guarda-corpo
    sw(5, (x, y) => { g.fillStyle = F('#eeeeea', .45); g.fillRect(x, y, 64, 64); g.fillStyle = F('#9a9d9f', .5); for (let k = 8; k < 58; k += 5) g.fillRect(x + 6, y + k, 52, 2); }); // ar-condicionado
    sw(6, (x, y) => { for (let k = 0; k < 8; k++) { g.fillStyle = F(k % 2 ? '#f4f1e8' : P.acento, .75); g.fillRect(x + k * 8, y, 8, 64); } }); // toldo listrado
    sw(7, (x, y) => { g.fillStyle = F('#2f7fd0', .35); g.fillRect(x, y, 64, 64); g.fillStyle = F('rgba(255,255,255,.2)', .3); g.fillRect(x, y + 10, 64, 4); g.fillRect(x, y + 44, 64, 4); }); // caixa d'água azul
    sw(8, (x, y) => { g.fillStyle = F('#1d5aa0', .35); g.fillRect(x, y, 64, 64); });                                                    // tampa
    sw(9, (x, y) => { g.fillStyle = F('#5a5f66', .5); g.fillRect(x, y, 64, 64); });                                                     // metal escuro
    // --- fachada ---
    for (let r = 0; r < LINHAS; r++) for (let b = 0; b < 6; b++) {
      const x = x0 + b * CEL, y = PH - (r + 1) * CEL;
      if (r === 0) { // térreo com loja
        g.fillStyle = F(P.parede2, .85); g.fillRect(x, y, CEL, CEL);
        const tipoLoja = srnd();
        const corLoja = spick(CORES_LOJA);
        g.fillStyle = F(corLoja, .5); g.fillRect(x + 3, y + 6, CEL - 6, 15);
        if (cor) { g.fillStyle = '#fff'; g.font = `9px ${FONTE}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(spick(LOJAS), x + CEL / 2, y + 14); } else spick(LOJAS);
        if (tipoLoja < .45) { // porta de enrolar
          g.fillStyle = F('#8e949a', .45); g.fillRect(x + 6, y + 24, CEL - 12, CEL - 26);
          if (cor) { g.fillStyle = 'rgba(0,0,0,.25)'; for (let k = y + 26; k < y + CEL; k += 3) g.fillRect(x + 6, k, CEL - 12, 1); }
          const aberta = srnd() < .6;
          if (aberta) { g.fillStyle = F('#1c1a18', .7); g.fillRect(x + 6, y + 44, CEL - 12, CEL - 46); if (cor) { for (let k = 0; k < 5; k++) { g.fillStyle = rgba(spick(CORES_LOJA), .6); g.fillRect(x + 10 + k * 12, y + 52 + srnd(0, 8), 8, 12); } } }
        } else { // vitrine
          g.fillStyle = F('#262d35', .06); g.fillRect(x + 6, y + 24, CEL - 12, CEL - 26);
          if (cor) {
            const q = g.createLinearGradient(x, y + 24, x + CEL, y + CEL); q.addColorStop(0, 'rgba(190,215,235,.45)'); q.addColorStop(.5, 'rgba(190,215,235,.05)'); q.addColorStop(1, 'rgba(190,215,235,.25)');
            for (let k = 0; k < 4; k++) { g.fillStyle = rgba(spick(CORES_LOJA), .7); g.fillRect(x + 10 + k * 15, y + 50 + srnd(0, 10), 10, 16); }
            g.fillStyle = q; g.fillRect(x + 6, y + 24, CEL - 12, CEL - 26);
            g.fillStyle = P.moldura; g.fillRect(x + CEL / 2 - 1, y + 24, 2, CEL - 26);
          }
        }
        continue;
      }
      g.fillStyle = F(P.parede2, .85); g.fillRect(x, y + CEL - 4, CEL, 4); // faixa da laje
      if (P.tipo === 'vidro') { // pele de vidro
        const aceso = srnd() < .12;
        if (cor) {
          const q = g.createLinearGradient(x, y, x, y + CEL); q.addColorStop(0, P.vidro[1]); q.addColorStop(1, P.vidro[0]);
          g.fillStyle = aceso ? '#e9cf8e' : q; g.fillRect(x, y + 14, CEL, CEL - 18);
          g.fillStyle = 'rgba(255,255,255,.18)'; g.beginPath(); g.moveTo(x + srnd(0, 40), y + 14); g.lineTo(x + 30 + srnd(0, 40), y + 14); g.lineTo(x + srnd(0, 30), y + CEL - 4); g.lineTo(x - 30 + srnd(0, 20), y + CEL - 4); g.fill();
          g.fillStyle = '#23384b'; g.fillRect(x, y, CEL, 14); // peitoril opaco
          g.fillStyle = P.moldura; g.fillRect(x, y, 3, CEL); g.fillRect(x, y + 13, CEL, 2);
        } else {
          g.fillStyle = F('', .08, aceso ? '#ffd890' : '#000'); g.fillRect(x, y + 14, CEL, CEL - 18);
          if (!rug) { srnd(); srnd(); srnd(); }
        }
        if (cor) { srnd(); srnd(); srnd(); }
        continue;
      }
      const aceso = srnd() < .13, cortina = srnd() < .3, larga = srnd() < .35;
      const jw = larga ? 56 : 42, jx = x + (CEL - jw) / 2, jy = y + 16, jh = 42;
      g.fillStyle = F(P.moldura, .6); g.fillRect(jx - 4, jy - 4, jw + 8, jh + 8);
      if (cor) {
        const q = g.createLinearGradient(jx, jy, jx, jy + jh); q.addColorStop(0, P.vidro[1]); q.addColorStop(.55, P.vidro[0]); q.addColorStop(1, '#1b2735');
        g.fillStyle = aceso ? '#f3d38e' : q; g.fillRect(jx, jy, jw, jh);
        if (aceso) { g.fillStyle = 'rgba(160,110,50,.35)'; g.fillRect(jx, jy + jh * .6, jw, jh * .4); }
        if (cortina) { g.fillStyle = aceso ? 'rgba(230,200,150,.8)' : 'rgba(215,200,175,.85)'; g.fillRect(jx, jy, jw * .38, jh); }
        g.fillStyle = 'rgba(255,255,255,.22)'; g.beginPath(); g.moveTo(jx + jw * .45, jy); g.lineTo(jx + jw * .75, jy); g.lineTo(jx + jw * .35, jy + jh); g.lineTo(jx + jw * .05, jy + jh); g.fill();
        g.fillStyle = P.moldura; g.fillRect(jx + jw / 2 - 1, jy, 2, jh); g.fillRect(jx, jy + 14, jw, 2);
        g.fillStyle = 'rgba(255,255,255,.55)'; g.fillRect(jx - 6, jy + jh + 4, jw + 12, 3); // peitoril
        const s = g.createLinearGradient(0, jy + jh + 7, 0, jy + jh + 30); s.addColorStop(0, 'rgba(50,44,36,.22)'); s.addColorStop(1, 'rgba(50,44,36,0)');
        g.fillStyle = s; g.fillRect(jx - 2, jy + jh + 7, jw + 4, 23);
      } else {
        g.fillStyle = F('', cortina ? .6 : .07, aceso ? '#ffd28a' : '#000'); g.fillRect(jx, jy, jw, jh);
      }
    }
  });
}
const [texPredioCor, texPredioRug, texPredioEmi] = ['cor', 'rug', 'emi'].map(modo => {
  const meio = modo !== 'cor', c = mkCanvas(meio ? PW / 2 : PW, meio ? PH / 2 : PH), g = c.getContext('2d');
  if (meio) g.scale(.5, .5);
  desenhaPredios(g, modo);
  return texC(c, modo !== 'rug');
});
const uvFachada = (pal, b0, b1, r0, r1) => [(pal * 512 + b0 * CEL) / PW, r0 * CEL / PH, (pal * 512 + b1 * CEL) / PW, r1 * CEL / PH];
const uvAmostra = (pal, s) => uvPx(pal * 512 + (s % 8) * 64, Math.floor(s / 8) * 64, pal * 512 + (s % 8) * 64 + 64, Math.floor(s / 8) * 64 + 64, PW, PH, 6);

// palmeira de coqueiro: folha (x 0..192), tronco (192..256 x 0..192), coco (192..256 x 192..256)
const texPalmeira = tex(256, 256, (g, w, h) => {
  semear(31);
  g.clearRect(0, 0, w, h);
  for (let y = h - 4; y > 4; y -= 3.2) {
    const t = 1 - y / h, L = 92 * Math.pow(Math.sin(Math.PI * (0.1 + 0.85 * t)), 0.7);
    for (const s of [-1, 1]) {
      const verde = [`rgb(${60 + srnd(0, 30) | 0},${110 + srnd(0, 40) | 0},${34 + srnd(0, 20) | 0})`, `rgb(${46 + srnd(0, 20) | 0},${90 + srnd(0, 30) | 0},${28 + srnd(0, 12) | 0})`];
      const q = g.createLinearGradient(96, y, 96 + s * L, y - L * .5); q.addColorStop(0, verde[1]); q.addColorStop(.7, verde[0]); q.addColorStop(1, t < .15 ? '#b0a24a' : verde[0]);
      g.fillStyle = q; g.beginPath(); g.moveTo(96, y - 2); g.quadraticCurveTo(96 + s * L * .5, y - L * .18 - 3, 96 + s * L, y - L * .52); g.quadraticCurveTo(96 + s * L * .5, y - L * .12 + 2, 96, y + 2.5); g.fill();
    }
  }
  g.fillStyle = '#9a9a48'; g.fillRect(94, 0, 4, h);
  // tronco
  g.fillStyle = '#8b7659'; g.fillRect(192, 0, 64, 192); pontilha(g, 192, 0, 64, 192, 900, .25);
  for (let x = 192; x < 256; x += srnd(4, 7)) { g.fillStyle = 'rgba(50,38,26,.55)'; g.fillRect(x, 0, 1.5, 192); }
  // coco
  g.fillStyle = '#6d7a2c'; g.fillRect(192, 192, 64, 64);
}, null);
const UV_FOLHA = [0.004, 0.004, 0.746, 0.996], UV_TRONCO = uvPx(194, 2, 254, 190, 256, 256), UV_COCO = uvPx(198, 198, 250, 250, 256, 256);

// trilho: 2 "pixels" (aço polido do topo / lateral enferrujada) — cor e rugosidade/metal
const texTrilhoCor = tex(2, 1, g => { g.fillStyle = '#cfd2d5'; g.fillRect(0, 0, 1, 1); g.fillStyle = '#6a4633'; g.fillRect(1, 0, 1, 1); });
const texTrilhoOrm = tex(2, 1, g => { g.fillStyle = 'rgb(0,55,255)'; g.fillRect(0, 0, 1, 1); g.fillStyle = 'rgb(0,215,70)'; g.fillRect(1, 0, 1, 1); }, null, false);
for (const t of [texTrilhoCor, texTrilhoOrm]) { t.magFilter = t.minFilter = THREE.NearestFilter; t.generateMipmaps = false; }

const texSombra = tex(64, 64, (g) => { const r = g.createRadialGradient(32, 32, 2, 32, 32, 30); r.addColorStop(0, 'rgba(0,0,0,.55)'); r.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = r; g.fillRect(0, 0, 64, 64); });

// ---------- materiais compartilhados ----------
const M = {
  brita: std({ map: texBrita, bumpMap: texBritaRelevo, bumpScale: 2.2, roughness: 0.95, vertexColors: true }),
  dormente: std({ map: texConcreto, color: 0xc8c3b8, roughness: 0.92, vertexColors: true }),
  trilho: std({ map: texTrilhoCor, roughnessMap: texTrilhoOrm, metalnessMap: texTrilhoOrm, roughness: 1, metalness: 1 }),
  muroCorpo: std({ map: texConcreto, color: 0xb9b4aa, roughness: 0.95 }),
  muros: texMuros.map(t => std({ map: t, roughness: 0.93 })),
  calcada: std({ map: texCalcada, roughness: 0.95 }),
  rede: std({ color: 0xaab0b6, metalness: 0.65, roughness: 0.42, vertexColors: true }),
  predio: std({ map: texPredioCor, roughnessMap: texPredioRug, roughness: 1, metalness: 0, emissiveMap: texPredioEmi, emissive: 0xffffff, emissiveIntensity: 0.55 }),
  palmeira: std({ map: texPalmeira, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.8 }),
  sombra: new THREE.MeshBasicMaterial({ map: texSombra, transparent: true, depthWrite: false, opacity: 0.5 }),
};

// ================= GEOMETRIAS DO CENÁRIO (compartilhadas por todos os trechos) =================
const TRILHO_X = 0.7; // meia bitola
const G = {};
// brita/leito: perfil transversal com leito elevado e vértices escurecidos entre os trilhos (graxa/ferrugem)
{
  const b = new Construtor(), xs = [];
  for (let x = -7.2; x <= 7.21; x += 0.3) xs.push(+x.toFixed(2));
  const alt = x => { const a = Math.abs(x); return a < 4.1 ? 0 : a < 4.9 ? -0.2 * (a - 4.1) / 0.8 : -0.2; };
  const tomBrita = x => { let k = 1; for (let l = -1; l <= 1; l++) k -= 0.2 * Math.exp(-Math.pow(x - l * LANE, 2) / 0.35); if (Math.abs(x) > 4.4) k -= 0.1; return [k * 1.02, k, k * 0.97]; };
  for (let i = 0; i < xs.length - 1; i++) {
    const xa = xs[i], xb = xs[i + 1], ya = alt(xa), yb = alt(xb), ca = tomBrita(xa), cb = tomBrita(xb);
    b.quad([xa, ya, 0], [xb, yb, 0], [xb, yb, -TRECHO], [xa, ya, -TRECHO], [xa / 2, 0, xb / 2, TRECHO / 2], [ca, cb, cb, ca]);
  }
  G.brita = b.geometria();
}
// dormente de concreto (bloco + fixações escuras) para InstancedMesh
{
  const b = new Construtor(), esc = [0.28, 0.27, 0.26];
  b.caixa(2.5, 0.16, 0.26, 0, -0.03, 0, [[0, 0, .3, .6], [0, 0, .3, .6], [0, 0, 2.5, .26], null, [0, 0, 2.5, .16], [0, 0, 2.5, .16]]);
  // fixações (grampo + palmilha) numa peça só por trilho, sem faces escondidas
  const U1 = [0, 0, 1, 1];
  for (const s of [-1, 1]) b.caixa(0.3, 0.05, 0.13, s * TRILHO_X, 0.07, 0, [U1, U1, U1, null, U1, U1], esc);
  G.dormente = b.geometria();
}
const MATRIZES_DORM = [];
{
  const n = Math.round(TRECHO / 0.65), passo = TRECHO / n;
  for (let l = -1; l <= 1; l++) for (let i = 0; i < n; i++) MATRIZES_DORM.push(mtx(l * LANE + rnd(-0.015, 0.015), 0, -(i + 0.5) * passo, 0, rnd(-0.012, 0.012), 0));
}
// trilhos com perfil real (patim, alma e boleto): 6 trilhos num buffer só
{
  const s = new THREE.Shape();
  const pts = [[-0.075, 0], [0.075, 0], [0.075, 0.012], [0.02, 0.03], [0.016, 0.092], [0.036, 0.1], [0.036, 0.13], [-0.036, 0.13], [-0.036, 0.1], [-0.016, 0.092], [-0.02, 0.03], [-0.075, 0.012]];
  s.moveTo(pts[0][0], pts[0][1]); for (const p of pts.slice(1)) s.lineTo(p[0], p[1]);
  const ext = new THREE.ExtrudeGeometry(s, { depth: TRECHO, bevelEnabled: false, steps: 1 });
  const b = new Construtor();
  for (let l = -1; l <= 1; l++) for (const sx of [-1, 1]) b.add(ext, mtx(l * LANE + sx * TRILHO_X, 0.05, -TRECHO));
  ext.dispose();
  const g = b.geometria(), N = g.attributes.normal, P = g.attributes.position, U = g.attributes.uv;
  for (let i = 0; i < N.count; i++) U.setXY(i, N.getY(i) > 0.9 && P.getY(i) > 0.17 ? 0.25 : 0.75, 0.5);
  G.trilhos = g;
}
// corpo do muro (concreto) + capa no topo; a face interna é o plano pintado
{
  const b = new Construtor(), s = 2.5;
  for (const lado of [-1, 1]) {
    const inter = lado < 0 ? 0 : 1; // índice da face voltada pro trilho (px no muro esquerdo, nx no direito)
    const f = [[0, 0, TRECHO / s, 3.2 / s], [0, 0, TRECHO / s, 3.2 / s], null, null, null, null]; f[inter] = null;
    b.caixa(0.6, 3.2, TRECHO, lado * 7.5, 1.6, -TRECHO / 2, f);
    b.caixa(0.92, 0.16, TRECHO, lado * 7.5, 3.28, -TRECHO / 2, [[0, 0, TRECHO / s, .1], [0, 0, TRECHO / s, .1], [0, 0, .4, TRECHO / s], [0, 0, .4, TRECHO / s], null, null]);
  }
  G.muroCorpo = b.geometria();
}
G.muroPintado = new THREE.PlaneGeometry(TRECHO, 3.2);
// chão fora dos muros (calçada)
{
  const b = new Construtor();
  for (const lado of [-1, 1]) {
    const x0 = lado < 0 ? -60 : 7.8, x1 = lado < 0 ? -7.8 : 60;
    b.quad([x0, 0, 0], [x1, 0, 0], [x1, 0, -TRECHO], [x0, 0, -TRECHO], [x0 / 2, 0, x1 / 2, TRECHO / 2]);
  }
  G.calcada = b.geometria();
}
// rede aérea: postes em perfil I, pórtico, fio de contato, mensageiro, pendurais e braços
{
  const b = new Construtor(), escuro = [0.32, 0.27, 0.22], isol = [0.62, 0.36, 0.24], conc = [0.85, 0.83, 0.8], U1 = [0, 0, 1, 1];
  const zP = -8, H = 7.7;
  for (const sx of [-1, 1]) {
    const x = sx * 4.6;
    b.caixa(0.24, H, 0.028, x, H / 2, zP - 0.11, U1); b.caixa(0.24, H, 0.028, x, H / 2, zP + 0.11, U1); b.caixa(0.028, H, 0.2, x, H / 2, zP, U1);
    b.caixa(0.6, 0.35, 0.6, x, 0.12, zP, U1, conc);
  }
  b.caixa(9.7, 0.26, 0.022, 0, 7.45, zP, U1); b.caixa(9.7, 0.024, 0.18, 0, 7.33, zP, U1); b.caixa(9.7, 0.024, 0.18, 0, 7.57, zP, U1);
  const fio = new THREE.CylinderGeometry(1, 1, 1, 5, 1, true);
  for (let l = -1; l <= 1; l++) {
    const x = l * LANE;
    b.add(fio, mtx(x, 6.9, -TRECHO / 2, Math.PI / 2, 0, 0, 0.014, TRECHO, 0.014), U1, escuro);
    b.add(fio, mtx(x, 7.28, -TRECHO / 2, Math.PI / 2, 0, 0, 0.011, TRECHO, 0.011), U1, escuro);
    for (let z = -2; z > -TRECHO; z -= 4.5) b.add(fio, mtx(x, 7.09, z, 0, 0, 0, 0.006, 0.38, 0.006), U1, escuro);
    b.caixa(0.035, 0.5, 0.035, x + 0.14, 7.12, zP, U1, BRANCO, 0, 0, 0.5);
    b.add(fio, mtx(x + 0.03, 7.3, zP, 0, 0, 0, 0.045, 0.22, 0.045), U1, isol);
  }
  fio.dispose();
  G.rede = b.geometria();
}
// palmeira de coqueiro (tronco curvo + folhas em "V" + cocos)
function palmeira(b, x0, z0, alt, incl) {
  const curva = new THREE.QuadraticBezierCurve3(new THREE.Vector3(x0, -0.2, z0), new THREE.Vector3(x0 + incl * 0.15, alt * 0.55, z0), new THREE.Vector3(x0 + incl, alt, z0 + srnd(-.4, .4)));
  const tronco = new THREE.TubeGeometry(curva, 10, 0.16, 7, false);
  b.add(tronco, null, UV_TRONCO); tronco.dispose();
  const T = curva.getPoint(1), nF = 12;
  const du = UV_FOLHA[2] - UV_FOLHA[0], dv = UV_FOLHA[3] - UV_FOLHA[1];
  for (let k = 0; k < nF; k++) {
    const az = k / nF * Math.PI * 2 + srnd(-.25, .25), comp = srnd(2.6, 3.5), ergue = srnd(0.5, 1.1), queda = srnd(1.8, 2.8);
    const dx = Math.cos(az), dz = Math.sin(az), px = -dz, pz = dx, S = 7;
    let ant = null;
    for (let s = 0; s <= S; s++) {
      const t = s / S, h = comp * t, w = 0.62 * Math.sin(Math.PI * (0.1 + 0.9 * t));
      const C = [T.x + dx * h, T.y + ergue * t - queda * t * t, T.z + dz * h];
      const E = [C[0] + px * w, C[1] - 0.18 * w, C[2] + pz * w], D = [C[0] - px * w, C[1] - 0.18 * w, C[2] - pz * w];
      const v = UV_FOLHA[1] + dv * t;
      if (ant) {
        const um = UV_FOLHA[0] + du * .5;
        b.quad(ant.C, ant.E, E, C, [um, ant.v, UV_FOLHA[2], v]);
        b.quad(ant.D, ant.C, C, D, [UV_FOLHA[0], ant.v, um, v]);
      }
      ant = { C, E, D, v };
    }
  }
  const coco = new THREE.SphereGeometry(0.13, 7, 5);
  for (let k = 0; k < 4; k++) { const a = k * 1.7; b.add(coco, mtx(T.x + Math.cos(a) * .2, T.y - .22, T.z + Math.sin(a) * .2), UV_COCO); }
  coco.dispose();
}

// ---------- prédios (protótipos prontos, virados para o trilho) ----------
function predioGeo(pal, lado, larg, nf, prof, op) {
  const b = new Construtor(), H = 4 + nf * 3, sx = -lado;
  const SW = s => uvAmostra(pal, s);
  // caixa alinhada à fachada: ao = largura ao longo da fachada, an = profundidade pra fora
  const caixaF = (n, cx, y, cz, ao, h, an, ret) => b.caixa(n[0] ? an : ao, h, n[0] ? ao : an, cx, y, cz, ret);
  const fachada = (n, cx, cz, largura, detalhes) => {
    const r = [n[1], -n[0]]; // direita de quem olha de fora
    const nb = Math.max(2, Math.min(6, Math.round(largura / 2.7))), bw = largura / nb, b0 = Math.floor(srnd() * (7 - nb));
    const P = (s, y) => [cx + r[0] * s, y, cz + r[1] * s];
    b.quad(P(-largura / 2, 0), P(largura / 2, 0), P(largura / 2, 4), P(-largura / 2, 4), uvFachada(pal, b0, b0 + nb, 0, 1));
    b.quad(P(-largura / 2, 4), P(largura / 2, 4), P(largura / 2, H), P(-largura / 2, H), uvFachada(pal, b0, b0 + nb, 1, 1 + nf));
    if (!detalhes) return;
    const fora = (s, o) => [cx + r[0] * s + n[0] * o, cz + r[1] * s + n[1] * o];
    for (let k = 0; k < nb; k++) {
      const s = -largura / 2 + (k + 0.5) * bw;
      if (op.toldos && srnd() < .75) { // toldo da loja
        const w = bw * 0.46, [ax, az] = fora(s - w, 1.15), [bx2, bz2] = fora(s + w, 1.15), [cx2, cz2] = fora(s + w, 0), [dx2, dz2] = fora(s - w, 0);
        b.quad([ax, 3.0, az], [bx2, 3.0, bz2], [cx2, 3.6, cz2], [dx2, 3.6, dz2], SW(6));
        b.quad([ax, 2.72, az], [bx2, 2.72, bz2], [bx2, 3.0, bz2], [ax, 3.0, az], SW(6));
      }
      for (let f = 1; f <= nf; f++) {
        const y0 = 4 + (f - 1) * 3;
        if (op.sacadas && k % 2 === 0) {
          const [x1, z1] = fora(s, 0.45); caixaF(n, x1, y0 + 0.06, z1, bw * 0.86, 0.12, 0.9, SW(3));
          const [x2, z2] = fora(s, 0.88); caixaF(n, x2, y0 + 0.62, z2, bw * 0.86, 1.0, 0.04, SW(4));
          for (const e of [-1, 1]) { const [x3, z3] = fora(s + e * bw * 0.42, 0.45); caixaF(n, x3, y0 + 0.62, z3, 0.04, 1.0, 0.9, SW(4)); }
        } else if (op.ar && srnd() < .3) {
          const [x1, z1] = fora(s + bw * 0.22, 0.2); caixaF(n, x1, y0 + 0.42, z1, 0.78, 0.5, 0.4, SW(5));
        }
      }
    }
  };
  fachada([sx, 0], sx * prof / 2, 0, larg, true);
  fachada([0, 1], 0, larg / 2, prof, true);
  // fundos e lado de fora sem detalhes (a câmera do menu olha pra trás e via as sacadas soltas)
  fachada([0, -1], 0, -larg / 2, prof, false);
  fachada([-sx, 0], -sx * prof / 2, 0, larg, false);
  // platibanda + teto (laje) separado
  const f = [SW(1), SW(1), SW(0), null, SW(1), null]; f[sx > 0 ? 1 : 0] = null;
  b.caixa(prof + 0.3, 0.55, larg + 0.3, 0, H + 0.1, 0, f);
  const topo = H + 0.375;
  if (op.caixa) { // caixas d'água azuis
    const n = 1 + (srnd() < .4 ? 1 : 0), bx = srnd(-prof * .25, prof * .25), bz = srnd(-larg * .2, larg * .2);
    b.caixa(1.6 * n + 0.2, 0.3, 1.6, bx, topo + 0.15, bz, SW(9));
    for (let i = 0; i < n; i++) {
      const x = bx + (i - (n - 1) / 2) * 1.6;
      b.add(CIL_N, mtx(x, topo + 0.8, bz, 0, 0, 0, 0.66, 1.0, 0.66), SW(7));
      b.add(CIL_N, mtx(x, topo + 1.34, bz, 0, 0, 0, 0.7, 0.1, 0.7), SW(8));
    }
  }
  if (srnd() < .7) b.caixa(2.2, 2.3, 2.4, srnd(-prof * .3, prof * .3), topo + 1.15, -larg * .25, [SW(2), SW(2), SW(0), null, SW(2), SW(2)]); // casa de máquinas
  for (let i = 0; i < 3; i++) if (op.ar && srnd() < .6) b.caixa(0.9, 0.6, 0.5, srnd(-prof * .4, prof * .4), topo + 0.3, srnd(-larg * .4, larg * .4), SW(5));
  if (srnd() < .5) b.add(CIL_N, mtx(srnd(-prof * .4, prof * .4), topo + 1.5, srnd(-larg * .4, larg * .4), 0, 0, 0, 0.03, 3, 0.03), SW(9));
  const g = b.geometria();
  return { p: g.attributes.position.array, n: g.attributes.normal.array, uv: g.attributes.uv.array, larg, prof };
}
const CIL_N = new THREE.CylinderGeometry(1, 1, 1, 12).toNonIndexed();
const PROTOS_PREDIO = [[], []];
{
  semear(4242);
  for (let k = 0; k < 16; k++) {
    const pal = k % 4, larg = srnd(6.5, 11.5), nf = 2 + Math.floor(srnd() * 8), prof = srnd(8, 13);
    const op = { sacadas: pal !== 3 && srnd() < .6, ar: pal !== 3 || srnd() < .3, caixa: srnd() < .65, toldos: srnd() < .75 };
    const sem = _semente;
    semear(sem); PROTOS_PREDIO[0].push(predioGeo(pal, -1, larg, nf, prof, op));
    semear(sem); PROTOS_PREDIO[1].push(predioGeo(pal, 1, larg, nf, prof, op));
  }
}
const MAXV_PREDIOS = 6 * Math.max(...PROTOS_PREDIO.flat().map(p => p.p.length / 3));

// ================= CENÁRIO (reciclado) =================
const trechos = [];
// biomas (Túnel do Farol, ponte da Lagoa Mundaú, ciclo dia/noite): só visual, em biomas.js
const BIOMAS = criaBiomas({ scene, sol, hemi, ceu, matCeu, M, G, TRECHO, renderer, camera, fraco: CELULAR, audio: () => ({ AC, master }), somAtivo: () => S.som && estado === 'jogando' });
function criaTrecho(k) {
  const g = new THREE.Group();
  const add = (geo, mat, projeta = false, recebe = true) => { const m = new THREE.Mesh(geo, mat); m.castShadow = projeta; m.receiveShadow = recebe; g.add(m); return m; };
  add(G.brita, M.brita);
  const dorm = new THREE.InstancedMesh(G.dormente, M.dormente, MATRIZES_DORM.length);
  MATRIZES_DORM.forEach((m, i) => dorm.setMatrixAt(i, m)); dorm.receiveShadow = true; g.add(dorm);
  add(G.trilhos, M.trilho);
  add(G.muroCorpo, M.muroCorpo, true);
  const muros = [-1, 1].map(lado => { const m = add(G.muroPintado, M.muros[0]); m.rotation.y = -lado * Math.PI / 2; m.position.set(lado * 7.18, 1.6, -TRECHO / 2); return m; });
  add(G.calcada, M.calcada);
  add(G.rede, M.rede, true, false);
  // prédios: um buffer por trecho, remontado a cada reciclagem
  const geoPred = new THREE.BufferGeometry();
  for (const [nome, tam] of [['position', 3], ['normal', 3], ['uv', 2]]) geoPred.setAttribute(nome, new THREE.BufferAttribute(new Float32Array(MAXV_PREDIOS * tam), tam).setUsage(THREE.DynamicDrawUsage));
  geoPred.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 14, -TRECHO / 2), 52);
  add(geoPred, M.predio);
  // palmeiras entre o muro e os prédios
  semear(300 + k * 17);
  const bp = new Construtor();
  for (const lado of [-1, 1]) {
    const n = 1 + (srnd() < .6 ? 1 : 0);
    for (let i = 0; i < n; i++) palmeira(bp, lado * srnd(8.3, 8.9), -((i + srnd(.15, .85)) * TRECHO / n), srnd(7, 10), -lado * srnd(0.5, 1.6));
  }
  add(bp.geometria(), M.palmeira, true);
  const t = { g, muros, geoPred, d: 0 };
  BIOMAS.montaTrecho(t);
  scene.add(g);
  return t;
}
function posicionaTrecho(t, d) {
  t.d = d; t.g.position.z = -d;
  t.muros.forEach(m => { m.material = escolhe(M.muros); });
  const A = t.geoPred.attributes, P = A.position.array, N = A.normal.array, U = A.uv.array;
  let o = 0;
  [-1, 1].forEach((lado, li) => {
    for (let i = 0; i < 3; i++) {
      const pr = escolhe(PROTOS_PREDIO[li]), n = pr.p.length / 3;
      const x = lado * (10 + pr.prof / 2 + rnd(0, 2)), z = -(i * TRECHO / 3 + pr.larg / 2);
      for (let j = 0; j < n; j++) { const a = (o + j) * 3, s = j * 3; P[a] = pr.p[s] + x; P[a + 1] = pr.p[s + 1]; P[a + 2] = pr.p[s + 2] + z; }
      N.set(pr.n, o * 3); U.set(pr.uv, o * 2); o += n;
    }
  });
  t.geoPred.setDrawRange(0, o);
  A.position.needsUpdate = A.normal.needsUpdate = A.uv.needsUpdate = true;
  BIOMAS.ajustaTrecho(t);
}
for (let i = 0; i < N_TRECHOS; i++) { const t = criaTrecho(i); posicionaTrecho(t, (i - 1) * TRECHO); trechos.push(t); }

// ================= PERSONAGENS (modelos em personagens.js) =================
G.sombra = new THREE.PlaneGeometry(1.4, 1.4);
function projetaSombra(root) { root.traverse(o => { if (o.isMesh) o.castShadow = !(o.material.transparent || o.material.isMeshBasicMaterial); }); }
function criaCorredor(skin) {
  const h = modeloCorredor(SKINS[skin]);
  projetaSombra(h.root);
  // sombra "blob" suave por baixo (a sombra real vem do sol)
  const sombra = new THREE.Mesh(G.sombra, M.sombra); sombra.rotation.x = -Math.PI / 2; sombra.renderOrder = 1; scene.add(sombra);
  h.sombra = sombra;
  return h;
}
function criaVigia() {
  const v = modeloVigia();
  projetaSombra(v.root);
  scene.add(v.root);
  return v;
}

let heroi = criaCorredor(S.skin); scene.add(heroi.root);
const vigia = criaVigia();
function trocaSkin(i) {
  // não dá dispose: geometrias/materiais podem ser compartilhados entre skins
  scene.remove(heroi.root); scene.remove(heroi.sombra);
  heroi = criaCorredor(i); scene.add(heroi.root);
}

// ================= OBJETOS DA PISTA (visual em objetos.js / itens.js) =================
// moedas: um InstancedMesh só (as moedas do jogo continuam sendo Object3D com position/rotation)
const MAX_MOEDAS = 1024;
const imMoedas = new THREE.InstancedMesh(GEO_MOEDA, MATS_MOEDA, MAX_MOEDAS);
imMoedas.count = 0; imMoedas.frustumCulled = false; imMoedas.instanceMatrix.setUsage(THREE.DynamicDrawUsage); scene.add(imMoedas);

let obst = [], moedas = [], itens = [];
const laneX = l => (l - 1) * LANE;
function addObst(o) { o.g.position.set(o.x, 0, -o.d0); scene.add(o.g); obst.push(o); return o; }
function criaTrem(l, d0, carros, movel = false) {
  const g = criaVisualTrem(carros, movel);
  const len = carros * CARRO + (carros - 1) * 0.5;
  return addObst({ tipo: 'trem', l, x: laneX(l), d0, d1: d0 + len, hw: 1.15, top: TOPO_TREM, g, movel, vT: movel ? rnd(8, 12) : 0, id: Math.random() });
}
function criaRampa(l, d0) {
  const g = criaVisualRampa();
  return addObst({ tipo: 'rampa', l, x: laneX(l), d0, d1: d0 + 10, hw: 1.15, top: TOPO_TREM, g });
}
function criaBarreira(l, d, tipo) {
  const g = criaVisualBarreira(tipo); let y0 = 0, y1 = 1.0, esp = 0.4;
  if (tipo === 'alta') { y0 = 1.15; y1 = 3.0; }
  else if (tipo === 'tapume') { y1 = 2.5; esp = 0.6; } // bloqueia, precisa trocar de trilho
  return addObst({ tipo, l, x: laneX(l), d0: d, d1: d + esp, hw: 1.15, y0, y1, g });
}
function criaMoeda(x, y, d) {
  const m = new THREE.Object3D(); m.position.set(x, y, -d); m.rotation.y = d * 0.25;
  moedas.push({ m, x, y, d, puxada: false });
}
function linhaMoedas(l, d, n, y = 0.9, passo = 2.4) { for (let i = 0; i < n; i++) criaMoeda(laneX(l), y, d + i * passo); }
function arcoMoedas(l, dc) { for (let i = -3; i <= 3; i++) { const t = i / 3.4; criaMoeda(laneX(l), 0.9 + 2.0 * (1 - t * t), dc + i * 1.5); } }
function criaItem(l, d, k) {
  const m = criaVisualPoder(k); m.position.set(laneX(l), 1.3, -d); scene.add(m);
  itens.push({ m, l, x: laneX(l), d, k });
}
// visual por quadro: céu segue a câmera, sol/sombra segue o jogador, moedas no InstancedMesh, luzes piscando
function atualizaVisual(t) {
  ceu.position.copy(camera.position);
  BIOMAS.atualiza(R ? R.dist : 0, camera.position.z);
  if (sombrasLigadas) atualizaSol();
  let n = 0;
  for (const c of moedas) { if (n >= MAX_MOEDAS) break; c.m.updateMatrix(); imMoedas.setMatrixAt(n++, c.m.matrix); }
  imMoedas.count = n; imMoedas.instanceMatrix.needsUpdate = true;
  animaObjetos(t / 1000); animaItens(t / 1000);
}
function desligaSombras() {
  sombrasLigadas = false; renderer.shadowMap.enabled = false; sol.castShadow = false; M.sombra.opacity = 0.85;
  scene.traverse(o => { if (o.material) [].concat(o.material).forEach(m => { m.needsUpdate = true; }); });
  for (const m of Object.values(M)) if (m.isMaterial) m.needsUpdate = true;
}
function limpaPista() {
  for (const o of obst) scene.remove(o.g); for (const c of moedas) scene.remove(c.m); for (const it of itens) scene.remove(it.m);
  obst = []; moedas = []; itens = [];
}

// ---------- gerador de padrões ----------
let genD, laneFim, tremFim, bloq;
function resetGerador() { genD = 55; laneFim = [0, 0, 0]; tremFim = [0, 0, 0]; bloq = []; }
// ---------- garantia de saída ----------
// bloq = trechos intransponíveis (trem, tapume) em "metros do jogador": o trem na contramão vem ao
// encontro, então o trecho dele é comprimido/adiantado conforme as velocidades. Antes de pôr um
// bloqueio, simula a pista em células de 1 m: toda célula alcançável precisa ter continuação
// (sem beco sem saída) e trocar de trilho exige os dois trilhos livres por alguns metros.
function trechoJogador(o) {
  if (!o.movel) return [o.d0, o.d1];
  const p0 = R ? R.dist : 0, v = Math.max(14, R ? R.vel : 14), f = v / (v + o.vT);
  return [p0 + (o.d0 - p0) * f - 3, p0 + (o.d1 - p0) * f + 3];
}
function vivosNoInicio(lista) { // quais trilhos, na posição atual, ainda têm caminho até o fim da pista gerada
  const p0 = Math.floor(R ? R.dist : 0);
  let fim = p0 + 40; for (const b of lista) fim = Math.max(fim, Math.ceil(b.b) + 30);
  const N = fim - p0, livre = [0, 1, 2].map(() => new Uint8Array(N + 1).fill(1));
  for (const b of lista) for (let s = Math.max(0, Math.floor(b.a) - 1 - p0); s <= Math.min(N, Math.ceil(b.b) + 1 - p0); s++) livre[b.l][s] = 0;
  const v = Math.max(14, R ? R.vel : 14), LC = Math.ceil(v * 0.3) + 2; // metros gastos na troca de trilho
  const troca = (s, a, b) => { for (let k = 0; k <= LC; k++) if (s + k > N || !livre[a][s + k] || !livre[b][s + k]) return false; return true; };
  const vivo = [0, 1, 2].map(() => new Uint8Array(N + 1));
  for (let l = 0; l < 3; l++) vivo[l][N] = livre[l][N];
  for (let s = N - 1; s >= 0; s--) for (let rep = 0; rep < 2; rep++) for (let l = 0; l < 3; l++) {
    if (!livre[l][s] || vivo[l][s]) continue;
    if (vivo[l][s + 1] || [l - 1, l + 1].some(m => m >= 0 && m < 3 && troca(s, l, m) && vivo[m][Math.min(N, s + LC)])) vivo[l][s] = 1;
  }
  return [0, 1, 2].map(l => vivo[l][0]);
}
// o novo bloqueio não pode tirar a saída de nenhum trilho que tinha saída antes
function pistaTemSaida(extra) {
  const antes = vivosNoInicio(bloq), depois = vivosNoInicio(bloq.concat(extra));
  return depois.some(x => x) && antes.every((x, l) => !x || depois[l]);
}
// cria o bloqueio só se a pista continuar com saída; senão desfaz e devolve null
function tentaBloqueio(o) {
  const [a, b] = trechoJogador(o), item = { l: o.l, a, b };
  if (!pistaTemSaida([item])) { scene.remove(o.g); obst.splice(obst.indexOf(o), 1); return null; }
  bloq.push(item); return o;
}
function sorteiaPoder() { const r = Math.random(); return r < .3 ? 'ima' : r < .5 ? 'jato' : r < .75 ? 'tenis' : 'dobro'; }
function geraLinha() {
  const d = genD, dific = Math.min(1, d / 3500);
  if (R) bloq = bloq.filter(b => b.b > R.dist - 5);
  const livres = [0, 1, 2].filter(l => laneFim[l] < d);
  if (!livres.length) { genD += 5; return; }
  // FOLGA: trilho que acabou de liberar ainda conta como bloqueado (dá tempo de trocar de trilho);
  // tremFim também guarda o tapume, então nunca ficam os 3 trilhos fechados ao mesmo tempo
  const FOLGA = 12;
  const trensAtivos = [0, 1, 2].filter(l => tremFim[l] > d - FOLGA).length;
  const r = Math.random();
  let usados = new Set();
  const candMovel = livres.filter(l => laneFim[l] < d - 45 && tremFim[l] < d - 45);
  const outrosLivres = l => [0, 1, 2].filter(k => k !== l && tremFim[k] < d - 10).length;
  // o trem na contramão anda ~30 m pra trás até chegar no jogador: exige pista sem bloqueio atrás dele
  if (d > 350 && r < 0.1 + 0.12 * dific && candMovel.length && tremFim.every(f => f < d - 35)) {
    // trem vindo na contramão
    const l = escolhe(candMovel.filter(k => outrosLivres(k) >= 1).length ? candMovel.filter(k => outrosLivres(k) >= 1) : candMovel);
    const t = tentaBloqueio(criaTrem(l, d, 1 + (Math.random() < .5 ? 1 : 0), true));
    if (t) { laneFim[l] = t.d1 + 3; tremFim[l] = t.d1; usados.add(l); }
    const livre = livres.filter(k => k !== l);
    if (livre.length) linhaMoedas(escolhe(livre), d - 10, 8);
  } else if (r < 0.52 && trensAtivos < 2) {
    // trens parados (às vezes com rampa)
    const podem = embaralha(livres.slice());
    let n = Math.min(podem.length, 2 - trensAtivos, 1 + (Math.random() < .35 + .3 * dific ? 1 : 0));
    const comRampa = Math.random() < .45;
    if (comRampa && podem.length === 3 && trensAtivos === 0 && Math.random() < .35 * dific) n = 3;
    for (let i = 0; i < n; i++) {
      const l = podem[i], rampa = comRampa && i === 0;
      const carros = 1 + Math.floor(Math.random() * (rampa ? 3 : 2.5));
      let d0 = d;
      if (rampa) { criaRampa(l, d); d0 = d + 10; }
      const t = rampa ? criaTrem(l, d0, carros) : tentaBloqueio(criaTrem(l, d0, carros));
      if (!t) continue;
      laneFim[l] = t.d1 + 2; tremFim[l] = t.d1; usados.add(l);
      if (rampa) { for (let k = 0; k < 4; k++) criaMoeda(laneX(l), 1.0 + TOPO_TREM * (k * 2.5 + 1) / 10, d + 1 + k * 2.5); linhaMoedas(l, d0 + 2, Math.floor((t.d1 - d0 - 2) / 2.4), TOPO_TREM + 0.9); t.temMoedas = true; }
    }
    const resto = livres.filter(l => !usados.has(l));
    if (resto.length) {
      const l = escolhe(resto);
      if (Math.random() < .35 + .35 * dific) { const tipo = escolhe(['baixa', 'alta']); criaBarreira(l, d + 8, tipo); laneFim[l] = d + 9; if (tipo === 'baixa') arcoMoedas(l, d + 8.2); }
      else if (Math.random() < .7) { linhaMoedas(l, d, 8); laneFim[l] = Math.max(laneFim[l], d); }
      else if (Math.random() < .5) criaItem(l, d + 6, sorteiaPoder());
    }
  } else {
    // barreiras
    const qtd = Math.random() < .25 + .3 * dific ? 2 : 1;
    const ordem = embaralha(livres.slice()).slice(0, qtd);
    let tapumes = 0;
    const bloqueadas = [0, 1, 2].filter(l => tremFim[l] > d - FOLGA).length;
    for (const l of ordem) {
      let tipo = Math.random() < .5 ? 'baixa' : 'alta';
      // tapume só com os outros trilhos sem trem por perto (senão prende o jogador do lado de lá)
      if (Math.random() < .15 + .15 * dific && tapumes === 0 && bloqueadas === 0 && ordem.length < 3) { tipo = 'tapume'; tapumes++; }
      if (tipo === 'tapume' && !tentaBloqueio(criaBarreira(l, d, tipo))) tipo = Math.random() < .5 ? 'baixa' : 'alta';
      if (tipo !== 'tapume') criaBarreira(l, d, tipo);
      laneFim[l] = d + 1; usados.add(l);
      if (tipo === 'tapume') tremFim[l] = d + 1;
      if (tipo === 'baixa' && Math.random() < .6) arcoMoedas(l, d + 0.2);
    }
    const resto = livres.filter(l => !usados.has(l));
    if (resto.length) {
      const l = escolhe(resto);
      if (Math.random() < .09) criaItem(l, d + 2, sorteiaPoder());
      else if (Math.random() < .6) linhaMoedas(l, d - 6, 7);
    }
  }
  const velRef = Math.max(14, R ? R.vel : 14);
  genD = d + (15 + Math.random() * 10) * (0.35 + 0.65 * velRef / 14);
}

// ================= ESTADO DA CORRIDA =================
let estado = 'menu';
let R = null;
function novaCorrida() {
  limpaPista(); resetGerador();
  R = { dist: 0, vel: 14, lane: 1, laneAnt: 1, x: 0, xAnt: 0, y: 0, vy: 0, noChao: true, rolando: 0, pedidoPulo: 0,
    pontos: 0, moedas: 0, poder: { ima: 0, jato: 0, tenis: 0, dobro: 0 }, prancha: 0, invul: 0, persegue: 0,
    gapVigia: 3, tempo: 0, trens: new Set(), continuou: false, morteT: 0, fase: 0, shake: 0, jatoPousando: 0,
    revives: 0, limpoDesde: 0, passouRecorde: false, conqT: 0 };
  corridaStats = {};
  criaMarcaRecorde();
  trechos.forEach((t, i) => posicionaTrecho(t, (i - 1) * TRECHO));
  vigia.root.visible = true;
}

// ---------- placa "SEU RECORDE" atravessando a pista na sua maior distância ----------
let marca = null;
function removeMarca() {
  if (!marca) return;
  scene.remove(marca);
  marca.traverse(o => { if (o.isMesh) { o.geometry.dispose(); if (o.material.map) o.material.map.dispose(); o.material.dispose(); } });
  marca = null;
}
function criaMarcaRecorde() {
  removeMarca();
  const d = Math.floor(S.melhorDist || 0);
  if (d < 150) return;
  const cv = document.createElement('canvas'); cv.width = 1024; cv.height = 192;
  const c = cv.getContext('2d');
  const gr = c.createLinearGradient(0, 0, 0, 192); gr.addColorStop(0, '#ffa24a'); gr.addColorStop(1, '#e05500');
  c.fillStyle = '#0f1c3f'; c.beginPath(); c.roundRect(0, 0, 1024, 192, 40); c.fill();
  c.fillStyle = gr; c.beginPath(); c.roundRect(10, 10, 1004, 172, 32); c.fill();
  c.fillStyle = '#fff'; c.textAlign = 'center'; c.textBaseline = 'middle';
  c.font = '400 92px "Lilita One", "Nunito", sans-serif'; c.shadowColor = 'rgba(90,30,0,.55)'; c.shadowOffsetY = 6;
  c.fillText('SEU RECORDE · ' + fmt(d) + ' m', 512, 100);
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  const g = new THREE.Group();
  const faixa = new THREE.Mesh(new THREE.PlaneGeometry(8.6, 1.61), new THREE.MeshBasicMaterial({ map: tex, transparent: true, side: THREE.DoubleSide }));
  faixa.position.y = 6.4; g.add(faixa);
  const matPoste = new THREE.MeshLambertMaterial({ color: 0x0f1c3f });
  for (const x of [-4.45, 4.45]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 7.2, 8), matPoste.clone()); p.position.set(x, 3.6, 0); g.add(p); }
  const chao = new THREE.Mesh(new THREE.PlaneGeometry(8.6, 0.55), new THREE.MeshBasicMaterial({ color: 0xffd23f, transparent: true, opacity: 0.85 }));
  chao.rotation.x = -Math.PI / 2; chao.position.y = 0.06; g.add(chao);
  g.position.z = -d; g.userData.d = d;
  scene.add(g); marca = g;
}

// ================= ENTRADA =================
function acao(tipo) {
  if (estado !== 'jogando') return;
  audio();
  if (tipo === 'esq' || tipo === 'dir') {
    const nl = R.lane + (tipo === 'esq' ? -1 : 1);
    if (nl < 0 || nl > 2) { tropeca(true); return; }
    R.laneAnt = R.lane; R.lane = nl; SFX.lado(); evento('desvios');
  } else if (tipo === 'cima') {
    if (R.poder.jato > 0) return;
    if (R.noChao || R.coyote > 0) pula(); else R.pedidoPulo = 0.25;
  } else if (tipo === 'baixo') {
    if (R.poder.jato > 0) return;
    if (!R.noChao) R.vy = Math.min(R.vy, -28);
    if (R.rolando <= 0) { evento('rolagens'); SFX.rolar(); }
    R.rolando = 0.7;
  } else if (tipo === 'prancha') usaPrancha();
}
function pula() {
  R.vy = R.poder.tenis > 0 ? PULO_TENIS : PULO; R.noChao = false; R.coyote = 0; R.rolando = 0; R.pedidoPulo = 0;
  SFX.pulo(); evento('pulos');
}
function usaPrancha() {
  if (estado !== 'jogando' || R.prancha > 0 || S.pranchas <= 0) return;
  S.pranchas--; salvar(); R.prancha = 30; SFX.prancha(); evento('pranchas'); toast(ic('prancha') + '<span>Prancha ativada: aguenta uma batida</span>');
}
const TECLAS = { ArrowLeft: 'esq', KeyA: 'esq', ArrowRight: 'dir', KeyD: 'dir', ArrowUp: 'cima', KeyW: 'cima', Space: 'cima', ArrowDown: 'baixo', KeyS: 'baixo', KeyB: 'prancha', ShiftLeft: 'prancha', ShiftRight: 'prancha' };
window.addEventListener('keydown', e => {
  if (e.repeat) return;
  if ((e.code === 'Escape' || e.code === 'KeyP')) { if (estado === 'jogando') pausa(); else if (estado === 'pausado') retoma(); return; }
  if (estado === 'menu' && e.code === 'Enter' && !$('#tela-menu').classList.contains('oculto')) { e.preventDefault(); iniciar(); return; }
  const a = TECLAS[e.code]; if (a && estado === 'jogando') { e.preventDefault(); acao(a); }
});
let toque = null, ultimoToque = 0;
canvas.addEventListener('pointerdown', e => { toque = { x: e.clientX, y: e.clientY, t: performance.now(), usado: false }; });
canvas.addEventListener('pointermove', e => {
  if (!toque || toque.usado) return;
  const dx = e.clientX - toque.x, dy = e.clientY - toque.y;
  const lim = Math.max(24, Math.min(window.innerWidth, window.innerHeight) * 0.05);
  if (Math.abs(dx) > lim || Math.abs(dy) > lim) {
    toque.usado = true;
    if (Math.abs(dx) > Math.abs(dy)) acao(dx < 0 ? 'esq' : 'dir'); else acao(dy < 0 ? 'cima' : 'baixo');
  }
});
canvas.addEventListener('pointerup', () => {
  if (toque && !toque.usado && performance.now() - toque.t < 250) {
    const agora = performance.now();
    if (agora - ultimoToque < 320) { acao('prancha'); ultimoToque = 0; } else ultimoToque = agora;
  }
  toque = null;
});
canvas.addEventListener('pointercancel', () => { toque = null; });

// ================= ATUALIZAÇÃO =================
function tropeca(parede = false) {
  if (R.invul > 0 || R.poder.jato > 0) return;
  if (R.prancha > 0) { quebraPrancha(); return; }
  R.shake = 0.35;
  if (R.persegue > 0) { morre(); return; }
  SFX.tropeco(); vibra(50); R.persegue = 6; R.tropeco = 0.4; R.limpoDesde = R.dist;
  if (parede) R.x += (R.lane === 0 ? 0.35 : -0.35);
}
function quebraPrancha() { R.prancha = 0; R.invul = 1.3; R.shake = 0.3; R.limpoDesde = R.dist; SFX.quebra(); vibra(80); toast(ic('impacto') + '<span>A prancha quebrou!</span>'); }
function morre() {
  if (estado !== 'jogando') return;
  estado = 'morrendo'; R.morteT = 0; R.shake = 0.6; SFX.batida(); vibra([90, 50, 180]); musicaDesliga();
}
function colide(o) {
  if (R.invul > 0 || R.poder.jato > 0) return;
  const lateral = Math.abs(R.xAnt - o.x) >= o.hw + 0.3;
  if (lateral) { R.lane = R.laneAnt; R.x = R.xAnt; tropeca(); return; }
  if (R.prancha > 0) { scene.remove(o.g); obst.splice(obst.indexOf(o), 1); quebraPrancha(); return; }
  morre();
}
// física em subpassos de no máximo ~0,3 m: com quadro lento (dt = 0,05 s a 33 m/s = 1,65 m por quadro,
// comum em celular fraco e na ponte/túnel) o passo grande fazia o pé "afundar" abaixo do teto do trem
// na junção rampa→trem ou ao pousar de um pulo, e o jogador morria batendo em algo que não se via.
function fisica(dt) {
  R.vel = Math.min(33, 14 + 19 * (1 - Math.exp(-R.dist / 2800)));
  R.dist += R.vel * dt;
  while (genD < R.dist + 230) geraLinha();

  // trens na contramão
  for (const o of obst) if (o.movel && o.d0 - R.dist < 80) { const dd = o.vT * dt; o.d0 -= dd; o.d1 -= dd; o.g.position.z = -o.d0; }

  // lateral
  R.xAnt = R.x;
  R.x += (laneX(R.lane) - R.x) * Math.min(1, dt * 16);
  if (Math.abs(R.x - laneX(R.lane)) < 0.3) R.laneAnt = R.lane;

  // vertical
  const jato = R.poder.jato > 0;
  if (jato) { R.y += (8 - R.y) * Math.min(1, dt * 3); R.vy = 0; R.noChao = false; }
  else { R.vy -= GRAV * dt * (R.rolando > 0 && !R.noChao ? 1.6 : 1); R.y += R.vy * dt; }
  const alt = R.rolando > 0 ? 0.85 : 1.8;

  // chão e colisões
  let chao = 0, emTrem = null;
  const perto = obst.filter(o => o.d0 <= R.dist + 0.4 && o.d1 >= R.dist - 0.4);
  // 1º as rampas: o chão da rampa já vale neste passo (antes, na junção rampa→trem, o pé ainda estava na
  // altura do quadro anterior, abaixo de top - 0,5, e o trem contava como batida de frente)
  for (const o of perto) {
    if (o.tipo !== 'rampa' || Math.abs(R.x - o.x) >= o.hw + 0.3) continue;
    const s = Math.max(0, Math.min(1, (R.dist - o.d0) / (o.d1 - o.d0))) * o.top;
    if (R.y >= s - 1.1 || jato) chao = Math.max(chao, s); else colide(o);
    if (estado !== 'jogando') return;
  }
  for (const o of perto) {
    if (o.tipo === 'rampa' || Math.abs(R.x - o.x) >= o.hw + 0.3) continue;
    const pe = jato ? R.y : Math.max(R.y, chao); // altura real do pé (em cima da rampa, se estiver nela)
    if (o.tipo === 'trem') {
      if (pe >= o.top - 0.5 || jato) { chao = Math.max(chao, o.top); emTrem = o; }
      else colide(o);
    } else if (Math.abs(R.dist - (o.d0 + o.d1) / 2) < (o.d1 - o.d0) / 2 + 0.25 && pe < o.y1 - 0.2 && pe + alt > o.y0 + 0.15) colide(o); // margem generosa
    if (estado !== 'jogando') return;
  }
  if (!jato) {
    if (R.y <= chao) { R.y = chao; if (R.vy <= 0) { if (!R.noChao && R.vy < -8) R.shake = Math.max(R.shake, 0.05); R.vy = 0; R.noChao = true; } }
    else R.noChao = R.y - chao < 0.02;
    if (R.noChao && R.pedidoPulo > 0) pula();
  }
  if (emTrem && R.noChao && !R.trens.has(emTrem.id)) { R.trens.add(emTrem.id); S.tot.trens++; evento('trens'); }
  R.pedidoPulo = Math.max(0, R.pedidoPulo - dt);
  R.coyote = R.noChao ? 0.12 : Math.max(0, (R.coyote || 0) - dt);
}
function atualiza(dt) {
  R.tempo += dt;
  const nSub = Math.min(8, Math.max(1, Math.ceil(R.vel * dt / 0.3)));
  for (let i = 0; i < nSub; i++) { fisica(dt / nSub); if (estado !== 'jogando') return; }

  // moedas
  const ima = R.poder.ima > 0;
  const py = R.y + 0.9;
  for (let i = moedas.length - 1; i >= 0; i--) {
    const c = moedas[i]; const dd = c.d - R.dist;
    if (dd < -4) { scene.remove(c.m); moedas.splice(i, 1); continue; }
    if (ima && dd < 22 && dd > -2) c.puxada = true;
    if (c.puxada) {
      const k = Math.min(1, dt * 12);
      c.x += (R.x - c.x) * k; c.y += (py - c.y) * k; c.d += (R.dist - c.d) * k;
      c.m.position.set(c.x, c.y, -c.d);
    }
    c.m.rotation.y += dt * 4;
    if (Math.abs(c.d - R.dist) < 1.0 && Math.abs(c.x - R.x) < 1.0 && Math.abs(c.y - py) < 1.4) {
      scene.remove(c.m); moedas.splice(i, 1);
      R.moedas++; S.tot.moedas++; R.pontos += 5 * mult(); SFX.moeda(); evento('moedas'); pulaMoeda();
    }
  }
  // poderes
  for (let i = itens.length - 1; i >= 0; i--) {
    const it = itens[i]; const dd = it.d - R.dist;
    if (dd < -4) { scene.remove(it.m); itens.splice(i, 1); continue; }
    it.m.rotation.y += dt * 2.5; it.m.position.y = 1.3 + Math.sin(R.tempo * 4 + it.d) * 0.2;
    if (Math.abs(dd) < 1.1 && Math.abs(it.x - R.x) < 1.1 && Math.abs(it.m.position.y - py) < 1.6) {
      scene.remove(it.m); itens.splice(i, 1); pegaPoder(it.k);
    }
  }
  // timers
  for (const k in R.poder) if (R.poder[k] > 0) {
    R.poder[k] -= dt;
    if (R.poder[k] <= 0) { R.poder[k] = 0; if (k === 'jato') { R.invul = Math.max(R.invul, 1.8); R.vy = 0; } }
  }
  if (R.prancha > 0) R.prancha = Math.max(0, R.prancha - dt);
  R.invul = Math.max(0, R.invul - dt);
  R.persegue = Math.max(0, R.persegue - dt);
  R.rolando = Math.max(0, R.rolando - dt);
  R.shake = Math.max(0, R.shake - dt);

  // placa "seu recorde" e conquistas (2x por segundo basta)
  if (marca && !R.passouRecorde && R.dist >= marca.userData.d) {
    R.passouRecorde = true; SFX.missao(); vibra(40); toast(ic('bandeira') + '<span>Você passou sua maior distância!</span>');
  }
  if (marca && R.dist > marca.userData.d + 25) removeMarca();
  R.conqT += dt; if (R.conqT > 0.5) { R.conqT = 0; checaConquistas(); }

  // pontos
  R.pontos += R.vel * dt * mult() * (R.poder.dobro > 0 ? 2 : 1) * 0.6;
  atualizaMissaoCorrida('distancia', Math.floor(R.dist));
  atualizaMissaoCorrida('pontos', Math.floor(R.pontos));

  // limpeza de obstáculos que ficaram pra trás
  for (let i = obst.length - 1; i >= 0; i--) if (obst[i].d1 < R.dist - 14) { scene.remove(obst[i].g); obst.splice(i, 1); }
  // cenário
  for (const t of trechos) if (t.d + TRECHO < R.dist - 16) posicionaTrecho(t, t.d + N_TRECHOS * TRECHO);

  // vigia
  const alvoGap = R.persegue > 0 ? 3.6 : R.tempo < 2.5 ? 4.2 : 18;
  R.gapVigia += (alvoGap - R.gapVigia) * Math.min(1, dt * (alvoGap < R.gapVigia ? 3 : 0.8));
  hud();
}
function atualizaMissaoCorrida(tipo, valor) {
  if ((corridaStats[tipo] || 0) > valor) return;
  corridaStats[tipo] = valor;
  for (const ms of S.missoes) {
    const m = MODELOS[ms.i];
    if (ms.feita || m.t !== tipo) continue;
    if (valor > ms.prog) ms.prog = Math.min(ms.alvo, valor);
    if (valor >= ms.alvo) { ms.feita = true; SFX.missao(); toast(ic('alvo') + '<span>Missão concluída: ' + m.txt(ms.alvo) + '</span>'); checaMissoes(); }
  }
}
function pegaPoder(k) {
  R.poder[k] = duracao(k); SFX.poder(); evento('poderes'); vibra(25);
  if (k === 'jato') S.tot.jatos++;
  toast(PODERES[k].ic + '<span>' + PODERES[k].nome + '!</span>');
  if (k === 'jato') {
    SFX.jato(); R.rolando = 0;
    // trilha de moedas no ar
    let l = R.lane; const fim = R.dist + R.vel * (duracao(k) - 1.5);
    for (let d = R.dist + 18; d < fim; d += 2.6) {
      if (Math.random() < .06) l = Math.max(0, Math.min(2, l + (Math.random() < .5 ? -1 : 1)));
      criaMoeda(laneX(l), 8.9, d);
    }
  }
}
function atualizaMorte(dt) {
  R.morteT += dt; R.shake = Math.max(0, R.shake - dt);
  R.gapVigia += (1.3 - R.gapVigia) * Math.min(1, dt * 3);
  if (R.y > 0 && R.poder.jato <= 0) { R.vy -= GRAV * dt; R.y = Math.max(0, R.y + R.vy * dt); }
  if (R.morteT > 1.5 && estado === 'morrendo') fimDeJogo();
}

// ================= ANIMAÇÃO =================
function animaHeroi(dt) {
  const h = heroi;
  const rodando = estado === 'jogando';
  h.root.position.set(R ? R.x : 0, R ? R.y : 0, R ? -R.dist : 0);
  h.prancha.visible = !!(R && R.prancha > 0);
  h.jato.visible = !!(R && R.poder.jato > 0);
  if (h.jato.visible) h.chama.scale.y = 0.8 + Math.random() * 0.5;
  const alturaPes = h.prancha.visible ? 0.2 : 0;
  h.corpo.position.y = 0.95 + alturaPes;
  // piscar na invulnerabilidade
  h.root.visible = !(R && R.invul > 0 && estado === 'jogando' && Math.floor(R.invul * 12) % 2 === 0);
  if (estado === 'menu' || !R) {
    const t = performance.now() / 1000;
    h.corpo.rotation.set(0, 0, 0);
    h.tronco.rotation.x = Math.sin(t * 2) * 0.03;
    h.bracoE.rotation.set(0, 0, 0.15 + Math.sin(t * 2) * .05); h.bracoD.rotation.set(-0.3 + Math.sin(t * 3) * 0.1, 0, -0.5);
    h.pernaE.rotation.set(0, 0, 0.05); h.pernaD.rotation.set(0, 0, -0.05); h.cabeca.rotation.y = Math.sin(t * 0.8) * 0.3;
    h.corpo.position.y = 0.95 + Math.sin(t * 2) * 0.015;
    h.sombra.position.set(0, 0.03, 0); return;
  }
  h.corpo.rotation.y = 0; h.cabeca.rotation.y = 0;
  if (estado === 'morrendo') {
    const k = Math.min(1, R.morteT * 3);
    h.corpo.rotation.x = k * 1.4; h.corpo.position.y = 0.95 - k * 0.6;
    h.bracoE.rotation.set(-2.5 * k, 0, 0.4); h.bracoD.rotation.set(-2.5 * k, 0, -0.4);
  } else if (R.rolando > 0) {
    R.fase += dt * 18;
    h.corpo.rotation.x = -R.fase; h.corpo.position.y = 0.55 + alturaPes;
    h.tronco.rotation.x = 0.6;
    h.pernaE.rotation.x = h.pernaD.rotation.x = -1.8; h.bracoE.rotation.x = h.bracoD.rotation.x = -1.4;
  } else if (R.poder.jato > 0) {
    h.corpo.rotation.x = 0.35; h.tronco.rotation.x = 0;
    h.bracoE.rotation.set(-0.3, 0, 0.5); h.bracoD.rotation.set(-0.3, 0, -0.5);
    h.pernaE.rotation.x = 0.4 + Math.sin(R.tempo * 8) * .1; h.pernaD.rotation.x = 0.25 - Math.sin(R.tempo * 8) * .1;
  } else if (!R.noChao) {
    h.corpo.rotation.x = 0; h.tronco.rotation.x = -0.15;
    h.bracoE.rotation.set(-2.6, 0, 0.3); h.bracoD.rotation.set(-2.4, 0, -0.3);
    h.pernaE.rotation.x = -1.0; h.pernaD.rotation.x = 0.4;
  } else if (h.prancha.visible) {
    R.fase += dt * 3;
    h.corpo.rotation.set(0, 0.5, 0); h.tronco.rotation.x = 0.2;
    h.bracoE.rotation.set(0, 0, 1.0 + Math.sin(R.fase) * .1); h.bracoD.rotation.set(0, 0, -1.0 - Math.sin(R.fase) * .1);
    h.pernaE.rotation.x = -0.3; h.pernaD.rotation.x = 0.3;
    h.corpo.position.y = 0.85 + alturaPes;
  } else {
    R.fase += dt * (8 + R.vel * 0.35);
    const s = Math.sin(R.fase);
    h.corpo.rotation.set(0, 0, 0); h.tronco.rotation.x = 0.18 + (R.tropeco > 0 ? 0.5 : 0);
    h.pernaE.rotation.x = s * 1.0; h.pernaD.rotation.x = -s * 1.0;
    h.bracoE.rotation.set(-s * 1.1, 0, 0.1); h.bracoD.rotation.set(s * 1.1, 0, -0.1);
    h.corpo.position.y = 0.95 + Math.abs(Math.cos(R.fase)) * 0.12 + alturaPes;
  }
  if (R.tropeco > 0) R.tropeco -= dt;
  if (rodando || estado === 'morrendo') {
    // sombra no chão mais alto embaixo
    let chao = 0;
    for (const o of obst) if (o.tipo === 'trem' && o.d0 < R.dist && o.d1 > R.dist && Math.abs(R.x - o.x) < 1.2 && R.y >= o.top - 0.5) chao = o.top;
    h.sombra.position.set(R.x, chao + 0.03, -R.dist);
    const esc = Math.max(0.3, 1 - (R.y - chao) * 0.12); h.sombra.scale.set(esc, esc, 1);
  }
}
const VIGIA_LADO = -1.4;
let vigiaOff = VIGIA_LADO;
function animaVigia(dt) {
  const v = vigia;
  if (!R || estado === 'menu') { v.root.visible = false; return; }
  v.root.visible = R.gapVigia < 14;
  const t = performance.now() / 1000;
  // fica ao lado-esquerdo de trás do herói (e o cachorro mais pra fora) pra não tapar o personagem;
  // só encosta quando pega (morrendo)
  const alvoOff = estado === 'morrendo' ? -0.7 : VIGIA_LADO;
  vigiaOff += (alvoOff - vigiaOff) * Math.min(1, dt * 3);
  v.root.position.set(R.x + vigiaOff, 0, -(R.dist - R.gapVigia));
  v.cao.position.x = -0.95;
  const f = t * 13, s = Math.sin(f);
  const pegou = estado === 'morrendo' && R.morteT > 0.6;
  v.pE.rotation.x = pegou ? 0 : s * 0.9; v.pD.rotation.x = pegou ? 0 : -s * 0.9;
  // braços em oposição às pernas; ao pegar, estica os dois pra frente (rotação + = frente)
  v.bE.rotation.x = pegou ? 1.35 : -s * 0.75; v.bD.rotation.x = pegou ? 1.15 : s * 0.75;
  if (v.bE.ante) v.bE.ante.rotation.x = v.bD.ante.rotation.x = pegou ? 0.25 : 0.85;
  v.corpo.position.y = 1.05 + (pegou ? 0 : Math.abs(Math.cos(f)) * 0.1);
  v.patas.forEach((p, i) => { p.rotation.x = Math.sin(f * 1.3 + i * 1.6) * 0.8; });
  v.cao.position.y = Math.abs(Math.sin(f * 1.3)) * 0.12;
}

// ================= CÂMERA =================
const camPos = new THREE.Vector3(0, 4, 8), camOlha = new THREE.Vector3();
let camY = 0, menuAng = 0;
function atualizaCamera(dt) {
  if (estado === 'menu' || !R) {
    menuAng += dt * 0.25;
    const alvo = new THREE.Vector3(1.4 + Math.sin(menuAng) * 0.6, 2.3, -6.8);
    camera.position.lerp(alvo, Math.min(1, dt * 3));
    camera.lookAt(0, 2.25, 0); // personagem fica na metade de baixo, abaixo do logo
    camera.fov = camera.userData.fovBase; camera.updateProjectionMatrix();
    return;
  }
  camY += ((R.poder.jato > 0 ? R.y : Math.min(R.y, TOPO_TREM + 1)) - camY) * Math.min(1, dt * 4);
  camPos.set(R.x * 0.8, 4.3 + camY * 0.85, -R.dist + 7.6);
  camera.position.lerp(camPos, Math.min(1, dt * 10));
  camera.position.z = camPos.z;
  if (R.shake > 0 && !menosMov()) { camera.position.x += (Math.random() - .5) * R.shake * 1.2; camera.position.y += (Math.random() - .5) * R.shake * 1.2; }
  camOlha.set(R.x * 0.9, 1.2 + camY * 0.8, -R.dist - 12);
  camera.lookAt(camOlha);
  const fov = camera.userData.fovBase + (menosMov() ? 0 : (R.vel - 14) * 0.35);
  if (Math.abs(camera.fov - fov) > 0.05) { camera.fov = fov; camera.updateProjectionMatrix(); }
}

// ================= HUD =================
const H = { pontos: $('#hud-pontos'), moedas: $('#hud-moedas b'), moedasBox: $('#hud-moedas'), dist: $('#hud-dist'), mult: $('#hud-mult'),
  poderes: $('#hud-poderes'), prancha: $('#bt-prancha'), pranchaN: $('#bt-prancha b'), aviso: $('#aviso-pers') };
const hudCache = {};
function set(el, chave, valor, prop = 'textContent') { if (hudCache[chave] !== valor) { hudCache[chave] = valor; el[prop] = valor; } }
function hud() {
  set(H.pontos, 'p', fmt(R.pontos)); set(H.moedas, 'm', fmt(R.moedas)); set(H.dist, 'd', fmt(R.dist) + ' m');
  const dobro = R.poder.dobro > 0;
  set(H.mult, 'mu', 'x' + mult() * (dobro ? 2 : 1)); set(H.mult, 'mc', dobro ? 'selo dobro' : 'selo', 'className');
  set(H.pranchaN, 'pr', R.prancha > 0 ? Math.ceil(R.prancha) + 's' : String(S.pranchas));
  set(H.prancha, 'prc', 'bt-prancha' + (R.prancha > 0 ? ' ativa' : S.pranchas <= 0 ? ' vazia' : ''), 'className');
  set(H.aviso, 'av', R.persegue > 0 && estado === 'jogando' ? '' : 'oculto', 'className');
  let html = '';
  for (const k in R.poder) if (R.poder[k] > 0) {
    const p = PODERES[k];
    html += `<div class="poder"><span class="p-ic" style="background:${p.cor}">${p.ic}</span><span class="p-bar"><i style="width:${Math.round(R.poder[k] / duracao(k) * 100)}%"></i></span></div>`;
  }
  set(H.poderes, 'pw', html, 'innerHTML');
}
function pulaMoeda() { H.moedasBox.classList.remove('pula'); void H.moedasBox.offsetWidth; H.moedasBox.classList.add('pula'); }
let toastT = null;
function toast(msg) {
  const t = $('#toast'); t.innerHTML = msg; t.classList.add('mostra');
  clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('mostra'), 2200);
}

// ================= TELAS =================
const telas = ['#tela-menu', '#tela-ajuda', '#tela-loja', '#tela-missoes', '#tela-pausa', '#tela-fim', '#tela-ranking', '#tela-diario', '#tela-opcoes'];
function mostra(id) { telas.forEach(t => $(t).classList.toggle('oculto', t !== id)); $('#hud').classList.toggle('oculto', !(estado === 'jogando' || estado === 'pausado' || estado === 'morrendo')); }
function atualizaMenu() {
  $('#m-moedas').textContent = fmt(S.moedas); $('#m-pranchas').textContent = S.pranchas; $('#m-recorde').textContent = fmt(S.recorde);
  $('#m-mult').textContent = 'x' + mult();
  $('#bt-som').classList.toggle('desligado', !S.som); $('#bt-musica').classList.toggle('desligado', !S.musica);
}
function irMenu() {
  estado = 'menu'; musicaDesliga(); limpaPista(); R = null;
  trechos.forEach((t, i) => posicionaTrecho(t, (i - 1) * TRECHO));
  heroi.root.visible = true; removeMarca();
  atualizaMenu(); mostra('#tela-menu');
  if (diarioPendente()) setTimeout(() => estado === 'menu' && !$('#tela-menu').classList.contains('oculto') && abreDiario(), 500);
}
function iniciar() {
  audio(); novaCorrida(); rankingInicio(); estado = 'jogando'; mostra(null); hud();
  if (S.musica) musicaLiga();
  if (S.corridas < 3) setTimeout(() => estado === 'jogando' && toast(ic('seta-cima') + '<span>Deslize pra CIMA: pula a barreira listrada · pra BAIXO: passa sob a placa ABAIXE!</span>'), 600);
}
function pausa() { if (estado !== 'jogando') return; estado = 'pausado'; musicaDesliga(); renderMissoes('#pausa-missoes'); mostra('#tela-pausa'); }
function retoma() { if (estado !== 'pausado') return; estado = 'jogando'; mostra(null); if (S.musica) musicaLiga(); ultimo = performance.now(); }
let custoReviver = 400;
function fimDeJogo() {
  estado = 'fim';
  const novo = R.pontos > S.recorde;
  if (novo) S.recorde = Math.floor(R.pontos);
  S.melhorDist = Math.max(S.melhorDist || 0, Math.floor(R.dist));
  checaConquistas();
  somaMoedas(); S.corridas++; salvar();
  $('#fim-titulo').textContent = escolhe(['Pego!', 'Ops!', 'Não deu!', 'Quase!']);
  $('#fim-recorde').classList.toggle('oculto', !novo);
  $('#fim-pontos').textContent = fmt(R.pontos); $('#fim-moedas').textContent = fmt(R.moedas);
  $('#fim-dist').textContent = fmt(R.dist) + ' m'; $('#fim-melhor').textContent = fmt(S.recorde);
  custoReviver = 400; // continuar quantas vezes quiser, enquanto tiver moedas
  $('#custo-reviver').textContent = custoReviver;
  const bt = $('#bt-reviver');
  bt.classList.remove('oculto'); bt.disabled = S.moedas < custoReviver;
  bt.title = S.moedas < custoReviver ? `Faltam ${fmt(custoReviver - S.moedas)} moedas` : '';
  rankingFim({ pontos: R.pontos, moedas: R.moedas, dist: R.dist, revives: R.revives || 0 });
  mostra('#tela-fim');
}
// soma ao cofre só as moedas ainda não somadas (continuar não duplica)
function somaMoedas() { S.moedas += R.moedas - (R.somadas || 0); R.somadas = R.moedas; }
function reviver() {
  if (S.moedas < custoReviver) return;
  S.moedas -= custoReviver; salvar();
  R.continuou = true; R.revives = (R.revives || 0) + 1; R.limpoDesde = R.dist;
  for (let i = obst.length - 1; i >= 0; i--) { const o = obst[i]; if (o.d1 > R.dist - 3 && o.d0 < R.dist + 45) { scene.remove(o.g); obst.splice(i, 1); } }
  R.invul = 3; R.persegue = 0; R.gapVigia = 10; R.shake = 0; R.vy = 0; R.rolando = 0;
  estado = 'jogando'; mostra(null); SFX.poder(); if (S.musica) musicaLiga(); ultimo = performance.now();
}
function renderMissoes(sel) {
  $(sel).innerHTML = S.missoes.map((ms, i) => {
    const m = MODELOS[ms.i];
    return `<div class="missao${ms.feita ? ' feita' : ''}"><div class="missao-ic">${ms.feita ? ic('check') : i + 1}</div><div class="missao-txt">${m.txt(ms.alvo)}
      <div class="barra"><i style="width:${Math.round(ms.prog / ms.alvo * 100)}%"></i></div><div class="missao-num">${fmt(ms.prog)} / ${fmt(ms.alvo)}</div></div></div>`;
  }).join('');
}
let abaLoja = 'poderes';
function hex(c) { return '#' + c.toString(16).padStart(6, '0'); }
function renderLoja() {
  $('#l-moedas').textContent = fmt(S.moedas);
  document.querySelectorAll('#tela-loja .aba').forEach(a => a.classList.toggle('ativa', a.dataset.aba === abaLoja));
  let html = '';
  if (abaLoja === 'poderes') {
    for (const k in PODERES) {
      const p = PODERES[k], nv = S.nivel[k], custo = CUSTO_NIVEL[nv];
      html += `<div class="item"><div class="item-ic" style="background:${p.cor}">${p.ic}</div><div class="item-info"><b>${p.nome}</b><small>${p.desc} Dura ${duracao(k)}s.</small>
        <div class="niveis">${[0, 1, 2, 3, 4].map(i => `<i class="${i < nv ? 'on' : ''}"></i>`).join('')}</div></div>
        ${nv >= 5 ? '<button class="bt bt-verde" disabled>Máx.</button>' : `<button class="bt" data-comprar="${k}" ${S.moedas < custo ? 'disabled' : ''}><span class="moeda-ic"></span>${fmt(custo)}</button>`}</div>`;
    }
  } else if (abaLoja === 'pranchas') {
    html += `<div class="item"><div class="item-ic" style="background:#19c2ff">${ic('prancha')}</div><div class="item-info"><b>Prancha</b><small>Toque 2x (ou B) na corrida. Dura 30s e aguenta uma batida. Você tem <b style="display:inline">${S.pranchas}</b>.</small></div>
      <button class="bt" data-comprar="prancha" ${S.moedas < PRECO_PRANCHA ? 'disabled' : ''}><span class="moeda-ic"></span>${PRECO_PRANCHA}</button></div>`;
    html += `<div class="item"><div class="item-ic" style="background:#8a4dff">${ic('prancha')}<span class="qtd">×5</span></div><div class="item-info"><b>Pacote 5 pranchas</b><small>Sai mais barato.</small></div>
      <button class="bt" data-comprar="prancha5" ${S.moedas < PRECO_PRANCHA * 4 ? 'disabled' : ''}><span class="moeda-ic"></span>${PRECO_PRANCHA * 4}</button></div>`;
  } else {
    SKINS.forEach((s, i) => {
      const tem = S.skins.includes(i), sel = S.skin === i;
      const bone = `<div class="boneco" style="background:${hex(s.casaco)}"><i style="left:14px;top:6px;width:24px;height:22px;background:${hex(s.pele)};border-radius:4px"></i><i style="left:12px;top:4px;width:28px;height:8px;background:${hex(s.bone)};border-radius:3px"></i><i style="left:18px;top:14px;width:4px;height:5px;background:#16161e"></i><i style="left:30px;top:14px;width:4px;height:5px;background:#16161e"></i><i style="left:8px;top:34px;width:36px;height:18px;background:${hex(s.mochila)};border-radius:6px 6px 0 0;opacity:.9"></i></div>`;
      html += `<div class="item${sel ? ' sel' : ''}">${bone}<div class="item-info"><b>${s.nome}</b><small>${sel ? 'Em uso' : tem ? 'Liberado' : 'Personagem novo'}</small></div>
        ${sel ? '<button class="bt bt-verde" disabled>Usando</button>' : tem ? `<button class="bt bt-azul" data-usar="${i}">Usar</button>` : `<button class="bt" data-skin="${i}" ${S.moedas < s.preco ? 'disabled' : ''}><span class="moeda-ic"></span>${fmt(s.preco)}</button>`}</div>`;
    });
  }
  $('#loja-conteudo').innerHTML = html;
}
$('#loja-conteudo').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return; audio();
  if (b.dataset.comprar) {
    const k = b.dataset.comprar;
    if (k === 'prancha') { if (S.moedas < PRECO_PRANCHA) return; S.moedas -= PRECO_PRANCHA; S.pranchas++; }
    else if (k === 'prancha5') { if (S.moedas < PRECO_PRANCHA * 4) return; S.moedas -= PRECO_PRANCHA * 4; S.pranchas += 5; }
    else { const c = CUSTO_NIVEL[S.nivel[k]]; if (c === undefined || S.moedas < c) return; S.moedas -= c; S.nivel[k]++; }
    SFX.compra();
  } else if (b.dataset.skin) {
    const i = +b.dataset.skin; if (S.moedas < SKINS[i].preco) return;
    S.moedas -= SKINS[i].preco; S.skins.push(i); S.skin = i; trocaSkin(i); SFX.compra(); checaConquistas();
  } else if (b.dataset.usar) { S.skin = +b.dataset.usar; trocaSkin(S.skin); SFX.lado(); }
  salvar(); renderLoja();
});
document.querySelectorAll('#tela-loja .aba').forEach(a => a.addEventListener('click', () => { abaLoja = a.dataset.aba; renderLoja(); }));
$('#bt-jogar').onclick = iniciar;
$('#bt-loja').onclick = () => { audio(); renderLoja(); mostra('#tela-loja'); };
function renderConquistas() {
  const feitas = CONQ.filter(c => S.conq[c.id]).length;
  $('#mi-conq-n').textContent = `${feitas}/${CONQ.length}`;
  $('#lista-conq').innerHTML = CONQ.map(c => {
    const f = !!S.conq[c.id];
    return `<div class="missao conq${f ? ' feita' : ''}"><div class="missao-ic">${ic(f ? 'trofeu' : 'cadeado')}</div><div class="missao-txt"><b class="conq-nome">${c.nome}</b>
      <div class="missao-num">${c.desc}</div></div><div class="conq-premio"><span class="moeda-ic"></span>${fmt(c.premio)}</div></div>`;
  }).join('');
}
function abaMissoes(qual) {
  document.querySelectorAll('.mi-aba').forEach(a => { const on = a.dataset.mi === qual; a.classList.toggle('ativa', on); a.setAttribute('aria-selected', on); });
  $('#mi-missoes').classList.toggle('oculto', qual !== 'missoes'); $('#mi-conquistas').classList.toggle('oculto', qual !== 'conquistas');
}
document.querySelectorAll('.mi-aba').forEach(a => a.addEventListener('click', () => { audio(); abaMissoes(a.dataset.mi); }));
$('#bt-missoes').onclick = () => { audio(); renderMissoes('#lista-missoes'); renderConquistas(); abaMissoes('missoes'); $('#mi-mult').textContent = 'x' + mult(); mostra('#tela-missoes'); };

function abreDiario() {
  const dia = proximoDia();
  $('#diario-dias').innerHTML = PREMIO_DIA.map((p, i) => {
    const n = i + 1, cls = n < dia ? ' pego' : n === dia ? ' hoje' : '';
    return `<div class="dia${cls}${n === 7 ? ' dia7' : ''}"><small>Dia ${n}</small>${n < dia ? ic('check') : '<span class="moeda-ic"></span>'}<b>${fmt(p)}</b>${n === 7 ? `<em>${ic('prancha')} +1</em>` : ''}</div>`;
  }).join('');
  $('#diario-sub').textContent = dia > 1 ? `${dia} dias seguidos! Não perca a sequência amanhã.` : 'Volte todo dia: o prêmio cresce até o 7º dia.';
  mostra('#tela-diario');
}
$('#bt-diario').onclick = () => {
  audio();
  if (!diarioPendente()) { atualizaMenu(); mostra('#tela-menu'); return; }
  const dia = proximoDia(), p = PREMIO_DIA[dia - 1];
  S.diario = { ultimo: hojeStr(), seq: dia }; S.moedas += p; if (dia === 7) S.pranchas++;
  salvar(); SFX.compra(); vibra(40);
  atualizaMenu(); mostra('#tela-menu');
  toast(ic('presente') + `<span>Prêmio do dia ${dia}: +${fmt(p)} moedas${dia === 7 ? ' e 1 prancha' : ''}!</span>`);
  setTimeout(checaConquistas, 2400);
};

function aplicaOpcoes() {
  document.body.classList.toggle('menos-mov', menosMov());
  document.body.classList.toggle('letras-grandes', !!S.letras);
}
const OPCOES = { '#op-vibra': 'vibra', '#op-movimento': 'movimento', '#op-contraste': 'contraste', '#op-letras': 'letras' };
$('#bt-opcoes').onclick = () => {
  audio();
  for (const [sel, k] of Object.entries(OPCOES)) $(sel).checked = k === 'movimento' ? menosMov() : !!S[k];
  mostra('#tela-opcoes');
};
for (const [sel, k] of Object.entries(OPCOES)) $(sel).addEventListener('change', e => {
  S[k] = e.target.checked; salvar(); aplicaOpcoes(); SFX.lado();
  if (k === 'vibra' && S.vibra) vibra(60);
});
aplicaOpcoes();
// "Mais contraste": ignora a névoa extra da chuva/nublado e não deixa a luz ambiente cair à noite/no túnel
function aplicaContraste() {
  if (!S.contraste) return;
  hemi.intensity = Math.max(hemi.intensity, 1.05);
  scene.fog.near = Math.max(scene.fog.near, 70); scene.fog.far = Math.max(scene.fog.far, 235);
}
$('#bt-ajuda').onclick = () => { audio(); mostra('#tela-ajuda'); };
iniciaRanking({ mostra, audio });
document.querySelectorAll('.bt-voltar').forEach(b => b.onclick = () => { atualizaMenu(); mostra('#tela-menu'); });
$('#bt-som').onclick = () => { S.som = !S.som; salvar(); audio(); atualizaMenu(); };
$('#bt-musica').onclick = () => { S.musica = !S.musica; salvar(); atualizaMenu(); };
$('#bt-pausa').onclick = pausa;
$('#bt-continuar-pausa').onclick = retoma;
$('#bt-sair').onclick = () => { if (R) { somaMoedas(); if (R.pontos > S.recorde) S.recorde = Math.floor(R.pontos); S.melhorDist = Math.max(S.melhorDist || 0, Math.floor(R.dist)); salvar(); } irMenu(); };
$('#bt-reviver').onclick = reviver;
$('#bt-denovo').onclick = iniciar;
$('#bt-menu').onclick = irMenu;
$('#bt-prancha').addEventListener('pointerdown', e => { e.stopPropagation(); usaPrancha(); });
document.addEventListener('visibilitychange', () => { if (document.hidden) pausa(); });
// GPU fraca/celular sem memória pode perder o contexto WebGL: pausa (o three.js restaura sozinho) em vez de seguir correndo às cegas
canvas.addEventListener('webglcontextlost', () => pausa());

// ================= LOOP =================
let ultimo = performance.now(), fpsAcum = 0, fpsN = 0;
function loop(t) {
  requestAnimationFrame(loop);
  const dtReal = (t - ultimo) / 1000; ultimo = t;
  const dt = Math.min(0.05, Math.max(0, dtReal));
  if (estado === 'jogando') atualiza(dt);
  else if (estado === 'morrendo') atualizaMorte(dt);
  animaHeroi(dt); animaVigia(dt); atualizaCamera(dt);
  atualizaVisual(t); aplicaContraste();
  renderer.render(scene, camera);
  // qualidade adaptativa: se ficar pesado, reduz a resolução
  if (estado === 'jogando') {
    fpsAcum += dtReal; fpsN++;
    if (fpsN >= 90) {
      const fps = fpsN / fpsAcum; fpsAcum = 0; fpsN = 0;
      if (fps < 40 && pixelRatio > 1) { pixelRatio = Math.max(1, pixelRatio - 0.5); renderer.setPixelRatio(pixelRatio); redimensiona(); }
      else if (fps < 40 && sombrasLigadas) desligaSombras(); // já está em 1x e ainda pesado: tira as sombras reais
    }
  }
}
atualizaMenu(); mostra('#tela-menu');
if (diarioPendente()) setTimeout(() => estado === 'menu' && !$('#tela-menu').classList.contains('oculto') && abreDiario(), 900);
// pré-compila os shaders da ponte, do túnel e dos obstáculos ainda na tela de carregamento: sem isso,
// o 1º quadro na ponte/túnel travava o celular (compilação na hora) bem no meio da corrida
try {
  const tmp = new THREE.Group();
  [criaVisualTrem(1), criaVisualTrem(1, true), criaVisualRampa(), ...['baixa', 'alta', 'tapume'].map(criaVisualBarreira), ...Object.keys(PODERES).map(k => criaVisualPoder(k))].forEach(o => tmp.add(o));
  scene.add(tmp);
  for (const nome of ['tunel', 'ponte']) { BIOMAS.forca(nome, TRECHO * 2); trechos.forEach(t => BIOMAS.ajustaTrecho(t)); renderer.compile(scene, camera); }
  scene.remove(tmp);
} catch (e) { console.warn('pré-compilação', e); }
BIOMAS.forca(null); trechos.forEach(t => BIOMAS.ajustaTrecho(t));
$('#carregando').remove();
requestAnimationFrame(loop);
window.__surf = { get estado() { return estado; }, get R() { return R; }, get obst() { return obst; }, acao, iniciar, VERSAO, renderer, scene, camera, get sombras() { return sombrasLigadas; } };
// gancho de teste dos biomas: bioma('tunel'|'ponte'|'cidade'|'auto', aPartirDe?) e hora(0..1 | null = automático)
Object.defineProperties(window.__surf, Object.getOwnPropertyDescriptors({ // (defineProperties: mantém o getter climaEstado vivo)
  bioma(nome, ini) { BIOMAS.forca(nome, ini); trechos.forEach(t => BIOMAS.ajustaTrecho(t)); },
  hora(h) { BIOMAS.hora(h); },
  // clima('sol'|'nublado'|'chuva'|'auto', instantâneo?) e climaEstado
  clima(nome, ja) { BIOMAS.clima(nome, ja); },
  get climaEstado() { return BIOMAS.climaEstado; },
  // passo(dt): avança a simulação sem desenhar (testes de corrida longa acelerados)
  passo(dt = 1 / 60) {
    if (estado === 'jogando') atualiza(dt); else if (estado === 'morrendo') atualizaMorte(dt);
    animaHeroi(dt); atualizaCamera(dt); BIOMAS.atualiza(R ? R.dist : 0, camera.position.z, dt);
  },
  get moedas() { return moedas; }, get itens() { return itens; }, get trechos() { return trechos; },
  get S() { return S; }, get marca() { return marca; }, checaConquistas, abreDiario,
}));
