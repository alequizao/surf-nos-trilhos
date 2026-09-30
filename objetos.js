/*
 * Surf nos Trilhos · Desenvolvido por Alequizao <alequizao.dev@gmail.com>
 * https://github.com/alequizao · © 2026 Alequizao. Todos os direitos reservados.
 */
// Surf nos Trilhos — objetos da pista com visual realista (trens, rampa, barreiras, moedas, poderes)
// Tudo (geometrias, materiais, texturas) é criado uma única vez e compartilhado entre instâncias.
import * as THREE from 'three';

const CARRO = 12;             // comprimento de um vagão
const VAO = 0.5;              // vão entre vagões
const TOPO = 3.4;             // topo caminhável do trem
const HW = 1.15;              // meia largura do trem
const Y0 = 0.9, Y1 = 3.08;    // faixa da parede lateral pintada (base → início do teto)
const rnd = (a, b) => a + Math.random() * (b - a);
const escolhe = a => a[Math.floor(Math.random() * a.length)];

// ======================================================================
// utilidades
// ======================================================================
function tela(w, h, fn, { cor = true, repete = false } = {}) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d'); fn(g, w, h);
  const t = new THREE.CanvasTexture(c);
  if (cor) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  if (repete) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}
// ruído de pontinhos (sujeira, textura de pintura)
function granula(g, x, y, w, h, n, cores, tam = 2) {
  for (let i = 0; i < n; i++) { g.fillStyle = escolhe(cores); g.fillRect(x + Math.random() * w, y + Math.random() * h, tam * Math.random() + 0.6, tam * Math.random() + 0.6); }
}
// junta geometrias (já transformadas) numa só — só position/normal/uv
function junta(lista) {
  let n = 0; const gs = lista.map(g => { const q = g.index ? g.toNonIndexed() : g; n += q.attributes.position.count; return q; });
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), uv = new Float32Array(n * 2); let o = 0;
  for (const g of gs) {
    pos.set(g.attributes.position.array, o * 3); nor.set(g.attributes.normal.array, o * 3);
    if (g.attributes.uv) uv.set(g.attributes.uv.array, o * 2);
    o += g.attributes.position.count;
  }
  const r = new THREE.BufferGeometry();
  r.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  r.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  r.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  r.computeBoundingSphere(); r.computeBoundingBox();
  return r;
}
const bx = (w, h, d, x, y, z, rx = 0, ry = 0, rz = 0) => {
  const g = new THREE.BoxGeometry(w, h, d);
  if (rx) g.rotateX(rx); if (ry) g.rotateY(ry); if (rz) g.rotateZ(rz);
  return g.translate(x, y, z);
};
// cilindro com eixo 'x' | 'y' | 'z'
const cil = (rt, rb, h, seg, x, y, z, eixo = 'y') => {
  const g = new THREE.CylinderGeometry(rt, rb, h, seg);
  if (eixo === 'x') g.rotateZ(Math.PI / 2); else if (eixo === 'z') g.rotateX(Math.PI / 2);
  return g.translate(x, y, z);
};
// barra (tubo redondo ou quadrado) ligando dois pontos
const _q = new THREE.Quaternion(), _up = new THREE.Vector3(0, 1, 0);
function barra(a, b, r, quad = false, seg = 8) {
  const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), d = B.clone().sub(A), L = d.length();
  const g = quad ? new THREE.BoxGeometry(r * 2, L, r * 2) : new THREE.CylinderGeometry(r, r, L, seg, 1, true);
  _q.setFromUnitVectors(_up, d.normalize());
  g.applyQuaternion(_q); const m = A.add(B).multiplyScalar(0.5); g.translate(m.x, m.y, m.z);
  return g;
}
// acumulador de triângulos com orientação automática pela normal
class Acum {
  constructor() { this.p = []; this.n = []; this.u = []; }
  tri(a, b, c) {
    const ab = [b.p[0] - a.p[0], b.p[1] - a.p[1], b.p[2] - a.p[2]], ac = [c.p[0] - a.p[0], c.p[1] - a.p[1], c.p[2] - a.p[2]];
    const f = [ab[1] * ac[2] - ab[2] * ac[1], ab[2] * ac[0] - ab[0] * ac[2], ab[0] * ac[1] - ab[1] * ac[0]];
    const s = [a.n[0] + b.n[0] + c.n[0], a.n[1] + b.n[1] + c.n[1], a.n[2] + b.n[2] + c.n[2]];
    if (f[0] * s[0] + f[1] * s[1] + f[2] * s[2] < 0) [b, c] = [c, b];
    for (const v of [a, b, c]) { this.p.push(...v.p); this.n.push(...v.n); this.u.push(...v.u); }
  }
  quad(a, b, c, d) { this.tri(a, b, c); this.tri(a, c, d); }
  get cont() { return this.p.length / 3; }
}
function geoDeAcums(acs) { // várias Acum → uma geometria com um grupo por Acum
  const geo = new THREE.BufferGeometry(); const p = [], n = [], u = []; let ini = 0;
  acs.forEach((a, i) => { p.push(...a.p); n.push(...a.n); u.push(...a.u); geo.addGroup(ini, a.cont, i); ini += a.cont; });
  geo.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(n, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(u, 2));
  geo.computeBoundingSphere(); geo.computeBoundingBox();
  return geo;
}
function malha(geo, mat, sombra = true, recebe = false) {
  const m = new THREE.Mesh(geo, mat); m.castShadow = sombra; m.receiveShadow = recebe; return m;
}
const std = (o) => new THREE.MeshStandardMaterial(o);

// brilho aditivo (sprite)
const texBrilho = tela(128, 128, (g) => {
  const r = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.18, 'rgba(255,255,255,.75)');
  r.addColorStop(0.45, 'rgba(255,255,255,.18)'); r.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = r; g.fillRect(0, 0, 128, 128);
});
const matBrilho = (cor, op = 1) => new THREE.SpriteMaterial({ map: texBrilho, color: cor, transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false });
function brilho(mat, x, y, z, s) { const sp = new THREE.Sprite(mat); sp.position.set(x, y, z); sp.scale.set(s, s, 1); return sp; }

// materiais genéricos compartilhados
const M = {
  chassi: std({ color: 0x24272b, roughness: 0.75, metalness: 0.5 }),
  roda: std({ color: 0x4a4a4c, roughness: 0.4, metalness: 0.9 }),
  borracha: std({ color: 0x151515, roughness: 0.9, metalness: 0 }),
  galv: std({ color: 0x9aa1a8, roughness: 0.45, metalness: 0.85 }),
  aco: std({ color: 0x5d646c, roughness: 0.5, metalness: 0.8 }),
  amarelo: std({ color: 0xf2b705, roughness: 0.5, metalness: 0.3 }),
  cromo: std({ color: 0xe6e8ea, roughness: 0.18, metalness: 1 }),
  lampA: std({ color: 0xff8a1a, emissive: 0xff5a00, emissiveIntensity: 3, roughness: 0.25, metalness: 0 }),
  lampB: std({ color: 0xff8a1a, emissive: 0xff5a00, emissiveIntensity: 0.3, roughness: 0.25, metalness: 0 }),
};
const GLOW = { A: matBrilho(0xff7a1a, 0.9), B: matBrilho(0xff7a1a, 0.1) };

// ======================================================================
// TRENS
// ======================================================================
// layout da lateral (canvas 1024×256 = 12 m × 2,18 m)
const LW = 1024, LH = 256;
const JAN = [[50, 150], [305, 400], [408, 503], [521, 616], [624, 719], [874, 974]];
const JY0 = 38, JY1 = 120;
const PORTAS = [[170, 285], [739, 854]];
const PY0 = 12, PY1 = 250;
const FX0 = 130, FX1 = 150; // faixa principal (logo abaixo das janelas)

const PINTURAS = [
  { nome: 'inox', base: '#b8bdc3', faixa: '#c8202c', faixa2: '#1b1f27', porta: '#aeb3b9', metal: 0.8, rug: 0.55, num: '2041', letra: '#1b1f27' },
  { nome: 'vlt', base: '#eceeef', faixa: '#1d4fa0', faixa2: '#ffc400', porta: '#e2e5e7', metal: 0.1, rug: 0.5, num: 'VLT 07', letra: '#1d4fa0' },
  { nome: 'azul', base: '#1f4d96', faixa: '#ff7a1a', faixa2: '#f4f4f4', porta: '#1b4589', metal: 0.2, rug: 0.5, num: '3117', letra: '#ffffff' },
  { nome: 'grafite', base: '#8a2b22', faixa: '#e9dcb8', faixa2: '#2a1a14', porta: '#7e261e', metal: 0.1, rug: 0.85, num: '0917', letra: '#e9dcb8' },
];
const DESTINOS = ['MACEIÓ', 'JARAGUÁ', 'BEBEDOURO', 'RIO LARGO', 'FERNÃO VELHO', 'SATUBA'];

// vidro de janela com interior e reflexo do céu
function janelaVidro(g, x0, y0, x1, y1, r, bancos = true) {
  g.save(); g.beginPath(); g.roundRect(x0, y0, x1 - x0, y1 - y0, r); g.clip();
  const gi = g.createLinearGradient(0, y0, 0, y1); gi.addColorStop(0, '#2a3342'); gi.addColorStop(0.35, '#161c26'); gi.addColorStop(1, '#0b0e13');
  g.fillStyle = gi; g.fillRect(x0, y0, x1 - x0, y1 - y0);
  // luminária do teto e janelas do outro lado
  g.fillStyle = 'rgba(220,235,255,.35)'; g.fillRect(x0, y0 + 4, x1 - x0, 3);
  g.fillStyle = 'rgba(120,150,180,.18)'; g.fillRect(x0 + 6, y0 + 14, x1 - x0 - 12, (y1 - y0) * 0.35);
  if (bancos) {
    // silhuetas de encostos de banco e balaústres
    g.fillStyle = '#1d2a3a';
    for (let x = x0 + 6; x < x1 - 10; x += 30) { g.beginPath(); g.roundRect(x, y1 - (y1 - y0) * 0.32, 24, 40, 7); g.fill(); }
    g.fillStyle = '#304255'; for (let x = x0 + 8; x < x1 - 10; x += 30) g.fillRect(x + 2, y1 - (y1 - y0) * 0.32 + 2, 20, 3);
    g.fillStyle = 'rgba(170,180,190,.55)'; g.fillRect(x0 + (x1 - x0) * 0.62, y0, 2, y1 - y0);
    // cabeças de passageiros sentados (algumas)
    g.fillStyle = '#10151c';
    for (let x = x0 + 14; x < x1 - 14; x += 30) if (Math.random() < 0.35) { g.beginPath(); g.arc(x + 4, y1 - (y1 - y0) * 0.38, 7, 0, 7); g.fill(); g.fillRect(x - 5, y1 - (y1 - y0) * 0.33, 18, 30); }
  }
  // reflexo do céu: degradê diagonal + faixas claras
  const gr = g.createLinearGradient(x0, y0, x0 + (x1 - x0) * 0.5, y1);
  gr.addColorStop(0, 'rgba(190,215,240,.55)'); gr.addColorStop(0.45, 'rgba(150,185,220,.18)'); gr.addColorStop(1, 'rgba(120,150,190,.04)');
  g.fillStyle = gr; g.fillRect(x0, y0, x1 - x0, y1 - y0);
  g.fillStyle = 'rgba(255,255,255,.16)';
  const w = x1 - x0, h = y1 - y0;
  g.beginPath(); g.moveTo(x0 + w * 0.15, y0); g.lineTo(x0 + w * 0.42, y0); g.lineTo(x0 + w * 0.12, y1); g.lineTo(x0 - w * 0.15, y1); g.fill();
  g.fillStyle = 'rgba(255,255,255,.08)';
  g.beginPath(); g.moveTo(x0 + w * 0.55, y0); g.lineTo(x0 + w * 0.62, y0); g.lineTo(x0 + w * 0.36, y1); g.lineTo(x0 + w * 0.29, y1); g.fill();
  g.restore();
  // borracha da janela
  g.strokeStyle = '#0d0d0f'; g.lineWidth = 4; g.beginPath(); g.roundRect(x0, y0, w, h, r); g.stroke();
  g.strokeStyle = 'rgba(255,255,255,.18)'; g.lineWidth = 1; g.beginPath(); g.roundRect(x0 - 3, y0 - 3, w + 6, h + 6, r + 2); g.stroke();
}

function rebites(g, x0, x1, y, passo, cor = 'rgba(0,0,0,.35)', luz = 'rgba(255,255,255,.35)') {
  for (let x = x0; x <= x1; x += passo) { g.fillStyle = cor; g.fillRect(x, y + 1, 2, 2); g.fillStyle = luz; g.fillRect(x, y, 1.4, 1.4); }
}

function grafite(g, txt, cx, cy, tam, cores, rot = 0) {
  g.save(); g.translate(cx, cy); g.rotate(rot);
  g.font = `900 ${tam}px Impact, "Arial Black", sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.lineJoin = 'round';
  g.lineWidth = tam * 0.28; g.strokeStyle = '#111'; g.strokeText(txt, 3, 4);
  g.lineWidth = tam * 0.16; g.strokeStyle = cores[2] || '#fff'; g.strokeText(txt, 0, 0);
  const gr = g.createLinearGradient(0, -tam / 2, 0, tam / 2); gr.addColorStop(0, cores[0]); gr.addColorStop(1, cores[1]);
  g.fillStyle = gr; g.fillText(txt, 0, 0);
  g.fillStyle = 'rgba(255,255,255,.55)'; g.font = `900 ${tam * 0.18}px Arial`; // brilhos
  for (let i = 0; i < 5; i++) g.fillText('✦', rnd(-tam, tam), rnd(-tam * 0.4, tam * 0.2));
  // escorridos
  g.fillStyle = cores[0];
  for (let i = 0; i < 6; i++) { const x = rnd(-tam, tam); g.fillRect(x, tam * 0.3, 2.5, rnd(6, 22)); }
  g.restore();
}

function pintaLado(p) {
  const cor = tela(LW, LH, (g, w, h) => {
    // base
    g.fillStyle = p.base; g.fillRect(0, 0, w, h);
    if (p.nome === 'inox') {
      // aço escovado + corrugado vertical na parte de baixo e acima das janelas
      for (let y = 0; y < h; y++) { g.fillStyle = `rgba(${Math.random() < .5 ? '255,255,255' : '0,0,0'},${Math.random() * 0.05})`; g.fillRect(0, y, w, 1); }
      for (let x = 0; x < w; x += 7) {
        g.fillStyle = 'rgba(255,255,255,.22)'; g.fillRect(x, 156, 2, h - 156); g.fillRect(x, 0, 2, 26);
        g.fillStyle = 'rgba(0,0,0,.16)'; g.fillRect(x + 3, 156, 2, h - 156); g.fillRect(x + 3, 0, 2, 26);
      }
    } else {
      granula(g, 0, 0, w, h, 6000, ['rgba(255,255,255,.04)', 'rgba(0,0,0,.05)'], 2);
      const gv = g.createLinearGradient(0, 0, 0, h); gv.addColorStop(0, 'rgba(255,255,255,.10)'); gv.addColorStop(0.5, 'rgba(255,255,255,0)'); gv.addColorStop(1, 'rgba(0,0,0,.10)');
      g.fillStyle = gv; g.fillRect(0, 0, w, h);
    }
    if (p.nome === 'vlt' || p.nome === 'azul') {
      // faixa de vidro contínua (visual moderno)
      g.fillStyle = p.nome === 'vlt' ? '#121820' : '#0f1520'; g.fillRect(0, JY0 - 8, w, JY1 - JY0 + 16);
    }
    // portas
    for (const [a, b] of PORTAS) {
      g.fillStyle = p.porta; g.fillRect(a, PY0, b - a, PY1 - PY0);
      if (p.nome === 'inox') for (let x = a; x < b; x += 7) { g.fillStyle = 'rgba(255,255,255,.12)'; g.fillRect(x, PY0, 2, PY1 - PY0); }
      g.fillStyle = 'rgba(0,0,0,.55)'; g.fillRect(a - 2, PY0 - 2, b - a + 4, 3); g.fillRect(a - 2, PY0, 3, PY1 - PY0); g.fillRect(b - 1, PY0, 3, PY1 - PY0);
      const m = (a + b) / 2; g.fillStyle = '#111'; g.fillRect(m - 2, PY0, 4, PY1 - PY0);
      g.fillStyle = 'rgba(255,255,255,.25)'; g.fillRect(a + 2, PY0 + 1, 2, PY1 - PY0 - 2); g.fillRect(m + 3, PY0 + 1, 2, PY1 - PY0 - 2);
      janelaVidro(g, a + 9, 38, m - 7, 150, 9, false);
      janelaVidro(g, m + 7, 38, b - 9, 150, 9, false);
      // botão de abertura e adesivo de aviso
      g.fillStyle = '#1fc46b'; g.beginPath(); g.arc(m - 14, 175, 5, 0, 7); g.fill();
      g.fillStyle = '#ffd23f'; g.fillRect(m + 10, 168, 18, 12); g.fillStyle = '#111'; g.font = '900 9px Arial'; g.textAlign = 'center'; g.fillText('!', m + 19, 178);
      // degrau
      g.fillStyle = '#2a2a2a'; g.fillRect(a, PY1 - 6, b - a, 6);
    }
    // janelas
    for (const [a, b] of JAN) janelaVidro(g, a, JY0, b, JY1, 10);
    // faixas de pintura (continuam sobre as portas)
    const faixa = (y0, y1, c) => { g.fillStyle = c; g.fillRect(0, y0, w, y1 - y0); };
    if (p.nome === 'inox') { faixa(FX0, FX1, p.faixa); faixa(FX1 + 3, FX1 + 7, p.faixa2); faixa(28, 31, p.faixa); }
    else if (p.nome === 'vlt') { faixa(FX0 + 2, 200, p.faixa); faixa(203, 210, p.faixa2); faixa(12, 16, p.faixa); }
    else if (p.nome === 'azul') { faixa(FX0 + 2, FX1 + 4, p.faixa); faixa(FX1 + 8, FX1 + 12, p.faixa2); faixa(196, 204, p.faixa); }
    else { faixa(FX0 + 2, FX1, p.faixa); faixa(FX1 + 3, FX1 + 6, p.faixa2); }
    // de novo as portas por cima da faixa? não: a faixa passa pela porta, mas as frestas continuam visíveis
    for (const [a, b] of PORTAS) { const m = (a + b) / 2; g.fillStyle = '#111'; g.fillRect(m - 2, FX0, 4, 90); g.fillStyle = 'rgba(0,0,0,.55)'; g.fillRect(a - 2, FX0, 3, 90); g.fillRect(b - 1, FX0, 3, 90); }
    // linhas de painel e rebites
    g.fillStyle = 'rgba(0,0,0,.28)';
    for (const x of [30, 160, 295, 512, 729, 864, 994]) g.fillRect(x, 0, 2, h);
    g.fillStyle = 'rgba(255,255,255,.18)';
    for (const x of [32, 162, 297, 514, 731, 866, 996]) g.fillRect(x, 0, 1, h);
    g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(0, 4, w, 2); g.fillRect(0, h - 26, w, 2);
    rebites(g, 4, w - 4, 8, 12); rebites(g, 4, w - 4, h - 22, 12);
    for (const x of [26, 998]) for (let y = 14; y < h - 20; y += 14) rebites(g, x, x, y, 1);
    // número e logotipo (lado esquerdo, abaixo da 1ª janela)
    g.fillStyle = p.letra; g.font = '700 20px "Arial Narrow", Arial, sans-serif'; g.textAlign = 'left'; g.textBaseline = 'middle';
    g.fillText(p.num, 56, 176);
    g.beginPath(); g.arc(945, 176, 11, 0, 7); g.strokeStyle = p.letra; g.lineWidth = 3; g.stroke();
    g.font = '900 13px Arial'; g.textAlign = 'center'; g.fillText('A', 945, 177);
    g.font = '700 10px Arial'; g.textAlign = 'left'; g.fillText('CAP. 180 PASS.', 56, 196);
    // grafites (só no vermelho antigo)
    if (p.nome === 'grafite') {
      grafite(g, 'SURF', 400, 196, 64, ['#19f0e0', '#2f6bff', '#fff'], -0.05);
      grafite(g, 'MCZ', 640, 200, 58, ['#ffd23f', '#ff3d7f', '#fff'], 0.06);
      grafite(g, 'ZUM', 100, 222, 34, ['#8aff5a', '#1fc46b', '#111'], -0.1);
      grafite(g, 'ALQ', 930, 222, 34, ['#ff9ad0', '#ff3d7f', '#fff'], 0.08);
      g.strokeStyle = 'rgba(20,20,20,.8)'; g.lineWidth = 2.5; // tags de caneta
      for (let i = 0; i < 7; i++) { const x = rnd(40, 980), y = rnd(160, 240); g.beginPath(); g.moveTo(x, y); for (let k = 0; k < 6; k++) g.lineTo(x + k * 7 + rnd(-3, 3), y + rnd(-9, 9)); g.stroke(); }
      // desbotado e ferrugem
      granula(g, 0, 0, w, h, 2500, ['rgba(255,220,200,.06)', 'rgba(90,40,20,.10)'], 4);
      for (let i = 0; i < 20; i++) { const x = rnd(0, w); const gr = g.createLinearGradient(0, 120, 0, 250); gr.addColorStop(0, 'rgba(110,50,20,.35)'); gr.addColorStop(1, 'rgba(110,50,20,0)'); g.fillStyle = gr; g.fillRect(x, 120 + rnd(0, 40), rnd(2, 6), rnd(40, 100)); }
    }
    // escorridos de chuva sob as janelas
    for (const [a, b] of JAN) for (let i = 0; i < 4; i++) { const gr = g.createLinearGradient(0, JY1, 0, JY1 + 60); gr.addColorStop(0, 'rgba(40,35,30,.28)'); gr.addColorStop(1, 'rgba(40,35,30,0)'); g.fillStyle = gr; g.fillRect(rnd(a, b), JY1 + 2, rnd(1.5, 4), rnd(20, 60)); }
    // sujeira na base
    const gs = g.createLinearGradient(0, 170, 0, h); gs.addColorStop(0, 'rgba(60,45,30,0)'); gs.addColorStop(0.7, 'rgba(60,45,30,.35)'); gs.addColorStop(1, 'rgba(40,30,20,.7)');
    g.fillStyle = gs; g.fillRect(0, 170, w, h - 170);
    granula(g, 0, 200, w, 56, 1500, ['rgba(50,40,30,.35)', 'rgba(90,70,50,.3)'], 3);
    // saia da borda inferior
    g.fillStyle = 'rgba(0,0,0,.5)'; g.fillRect(0, h - 4, w, 4);
  });
  const rel = tela(LW, LH, (g, w, h) => { // bumpMap: linhas de painel, portas, janelas, rebites
    g.fillStyle = '#808080'; g.fillRect(0, 0, w, h);
    if (p.nome === 'inox') for (let x = 0; x < w; x += 7) { g.fillStyle = '#b0b0b0'; g.fillRect(x, 156, 3, h - 156); g.fillRect(x, 0, 3, 26); }
    g.fillStyle = '#303030'; for (const x of [30, 160, 295, 512, 729, 864, 994]) g.fillRect(x, 0, 2, h);
    g.fillRect(0, 4, w, 2); g.fillRect(0, h - 26, w, 2);
    for (const [a, b] of PORTAS) { g.fillStyle = '#202020'; g.fillRect(a - 2, PY0 - 2, b - a + 4, 3); g.fillRect(a - 2, PY0, 3, PY1 - PY0); g.fillRect(b - 1, PY0, 3, PY1 - PY0); g.fillRect((a + b) / 2 - 2, PY0, 4, PY1 - PY0); }
    g.strokeStyle = '#303030'; g.lineWidth = 5;
    for (const [a, b] of JAN) { g.beginPath(); g.roundRect(a, JY0, b - a, JY1 - JY0, 10); g.stroke(); g.fillStyle = '#6a6a6a'; g.fill(); }
    for (let x = 4; x < w; x += 12) { g.fillStyle = '#e0e0e0'; g.fillRect(x, 8, 2, 2); g.fillRect(x, h - 22, 2, 2); }
  }, { cor: false });
  return { cor, rel };
}
// mapa compartilhado de rugosidade (G) e metalicidade (B) da lateral
const texLadoRM = tela(LW, LH, (g, w, h) => {
  g.fillStyle = 'rgb(0,170,255)'; g.fillRect(0, 0, w, h);
  for (const [a, b] of PORTAS) { g.fillStyle = 'rgb(0,20,0)'; g.beginPath(); g.roundRect(a + 9, 38, (b - a) / 2 - 16, 112, 9); g.roundRect((a + b) / 2 + 7, 38, (b - a) / 2 - 16, 112, 9); g.fill(); }
  for (const [a, b] of JAN) { g.fillStyle = 'rgb(0,20,0)'; g.beginPath(); g.roundRect(a, JY0, b - a, JY1 - JY0, 10); g.fill(); g.strokeStyle = 'rgb(0,230,0)'; g.lineWidth = 4; g.stroke(); }
  const gs = g.createLinearGradient(0, 180, 0, h); gs.addColorStop(0, 'rgba(0,170,255,0)'); gs.addColorStop(1, 'rgba(0,255,120,1)');
  g.fillStyle = gs; g.fillRect(0, 180, w, h - 180);
}, { cor: false });

// teto (canvas 256 × 1024 = 2,3 m de arco × 12 m)
const texTeto = tela(256, 1024, (g, w, h) => {
  g.fillStyle = '#7b8086'; g.fillRect(0, 0, w, h);
  granula(g, 0, 0, w, h, 9000, ['rgba(255,255,255,.05)', 'rgba(0,0,0,.08)', 'rgba(120,90,60,.08)'], 3);
  // nervuras transversais
  for (let y = 10; y < h; y += 42) { g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(0, y, w, 3); g.fillStyle = 'rgba(255,255,255,.18)'; g.fillRect(0, y + 3, w, 2); }
  // passarela antiderrapante no meio
  g.fillStyle = '#4b4f55'; g.fillRect(70, 0, 116, h);
  for (let y = 0; y < h; y += 8) for (let x = 72; x < 184; x += 8) { g.fillStyle = 'rgba(255,255,255,.14)'; g.fillRect(x, y, 4, 2); g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(x, y + 2, 4, 2); }
  g.fillStyle = '#e8c21a'; g.fillRect(66, 0, 4, h); g.fillRect(186, 0, 4, h);
  // tampas de ar-condicionado / respiros pintados no nível do teto
  for (const y0 of [90, 760]) {
    g.fillStyle = '#9aa0a6'; g.fillRect(24, y0, 208, 170); g.strokeStyle = '#3a3e44'; g.lineWidth = 3; g.strokeRect(24, y0, 208, 170);
    for (let y = y0 + 12; y < y0 + 160; y += 9) { g.fillStyle = '#2d3136'; g.fillRect(40, y, 176, 4); }
    g.fillStyle = '#2d3136'; g.beginPath(); g.arc(128, y0 + 85, 34, 0, 7); g.fill();
    g.fillStyle = '#6d737a'; g.beginPath(); g.arc(128, y0 + 85, 26, 0, 7); g.fill();
  }
  // ferrugem, poças de sujeira e cocô de pombo
  for (let i = 0; i < 26; i++) { const r = g.createRadialGradient(0, 0, 0, 0, 0, 1); const x = rnd(0, w), y = rnd(0, h), s = rnd(8, 30);
    g.save(); g.translate(x, y); g.scale(s, s * rnd(0.5, 1.5)); r.addColorStop(0, 'rgba(110,60,25,.5)'); r.addColorStop(1, 'rgba(110,60,25,0)'); g.fillStyle = r; g.beginPath(); g.arc(0, 0, 1, 0, 7); g.fill(); g.restore(); }
  granula(g, 0, 0, w, h, 90, ['rgba(240,240,230,.8)'], 4);
  // rebites nas bordas
  for (let y = 4; y < h; y += 16) { g.fillStyle = 'rgba(0,0,0,.4)'; g.fillRect(6, y, 3, 3); g.fillRect(w - 9, y, 3, 3); }
}, { repete: false });

// frente da cabine (canvas 512×512 = 2,3 m × 2,5 m, y de 0,9 a 3,4)
const CAB = { px: 512 / 2.3, py: 512 / 2.5 };
const cabX = x => (x + HW) * CAB.px, cabY = y => (TOPO - y) * CAB.py;
function pintaCabine(p) {
  return tela(512, 512, (g, w, h) => {
    g.fillStyle = p.base; g.fillRect(0, 0, w, h);
    if (p.nome === 'inox') for (let x = 0; x < w; x += 8) { g.fillStyle = 'rgba(255,255,255,.12)'; g.fillRect(x, cabY(1.6), 2, h); }
    const gv = g.createLinearGradient(0, 0, 0, h); gv.addColorStop(0, 'rgba(0,0,0,.25)'); gv.addColorStop(0.2, 'rgba(0,0,0,0)'); gv.addColorStop(1, 'rgba(0,0,0,.1)');
    g.fillStyle = gv; g.fillRect(0, 0, w, h);
    // capa preta em volta do para-brisa
    const wy0 = cabY(3.03), wy1 = cabY(2.02), wx0 = cabX(-1.0), wx1 = cabX(1.0);
    g.fillStyle = '#121418'; g.beginPath(); g.roundRect(wx0 - 12, wy0 - 12, wx1 - wx0 + 24, wy1 - wy0 + 24, 34); g.fill();
    // para-brisa
    g.save(); g.beginPath(); g.roundRect(wx0, wy0, wx1 - wx0, wy1 - wy0, 26); g.clip();
    const gi = g.createLinearGradient(0, wy0, 0, wy1); gi.addColorStop(0, '#26303c'); gi.addColorStop(1, '#090c10'); g.fillStyle = gi; g.fillRect(wx0, wy0, wx1 - wx0, wy1 - wy0);
    // painel e cadeira do maquinista
    g.fillStyle = '#05070a'; g.beginPath(); g.moveTo(wx0, wy1 - 40); g.quadraticCurveTo(256, wy1 - 62, wx1, wy1 - 40); g.lineTo(wx1, wy1); g.lineTo(wx0, wy1); g.fill();
    g.fillStyle = '#0f141b'; g.beginPath(); g.roundRect(120, wy1 - 105, 60, 70, 12); g.fill();
    g.fillStyle = '#ffb347'; for (let i = 0; i < 6; i++) g.fillRect(200 + i * 14, wy1 - 50, 6, 3); // leds do painel
    g.fillStyle = '#3ad16b'; g.fillRect(300, wy1 - 50, 6, 3);
    // reflexo do céu
    const gr = g.createLinearGradient(wx0, wy0, wx0 + 260, wy1); gr.addColorStop(0, 'rgba(200,225,250,.6)'); gr.addColorStop(0.5, 'rgba(160,195,230,.2)'); gr.addColorStop(1, 'rgba(140,170,210,.05)');
    g.fillStyle = gr; g.fillRect(wx0, wy0, wx1 - wx0, wy1 - wy0);
    g.fillStyle = 'rgba(255,255,255,.18)'; g.beginPath(); g.moveTo(wx0 + 60, wy0); g.lineTo(wx0 + 170, wy0); g.lineTo(wx0 + 60, wy1); g.lineTo(wx0 - 50, wy1); g.fill();
    g.fillStyle = 'rgba(255,255,255,.08)'; g.beginPath(); g.moveTo(wx0 + 230, wy0); g.lineTo(wx0 + 260, wy0); g.lineTo(wx0 + 150, wy1); g.lineTo(wx0 + 120, wy1); g.fill();
    // silhueta de prédios refletida
    g.fillStyle = 'rgba(40,50,60,.25)'; for (let x = wx0; x < wx1; x += 26) { const hh = rnd(10, 40); g.fillRect(x, wy1 - 60 - hh, 22, hh); }
    g.restore();
    g.strokeStyle = 'rgba(255,255,255,.25)'; g.lineWidth = 2; g.beginPath(); g.roundRect(wx0, wy0, wx1 - wx0, wy1 - wy0, 26); g.stroke();
    // letreiro (a malha de LED fica por cima; aqui só a moldura)
    g.fillStyle = '#050505'; g.fillRect(cabX(-0.66), cabY(2.99), cabX(0.66) - cabX(-0.66), cabY(2.75) - cabY(2.99));
    g.strokeStyle = '#2a2a2a'; g.lineWidth = 3; g.strokeRect(cabX(-0.66), cabY(2.99), cabX(0.66) - cabX(-0.66), cabY(2.75) - cabY(2.99));
    // limpadores
    g.strokeStyle = '#0a0a0a'; g.lineWidth = 5; g.lineCap = 'round';
    g.beginPath(); g.moveTo(170, wy1 - 6); g.lineTo(60, wy1 - 70); g.moveTo(350, wy1 - 6); g.lineTo(245, wy1 - 72); g.stroke();
    // faixa (mesma altura da lateral)
    const fy0 = (Y1 - (Y1 - Y0) * FX0 / LH), fy1 = (Y1 - (Y1 - Y0) * FX1 / LH);
    const fY0 = cabY(fy0), fY1 = cabY(fy1);
    g.fillStyle = p.faixa;
    if (p.nome === 'vlt') { g.fillRect(0, fY0, w, cabY(1.35) - fY0); g.fillStyle = p.faixa2; g.fillRect(0, cabY(1.35), w, 8); }
    else { g.beginPath(); g.moveTo(0, fY0); g.lineTo(w, fY0); g.lineTo(w, fY1 + 6); g.lineTo(w / 2 + 70, fY1 + 6); g.lineTo(w / 2, fY1 + 40); g.lineTo(w / 2 - 70, fY1 + 6); g.lineTo(0, fY1 + 6); g.fill(); g.fillStyle = p.faixa2; g.fillRect(0, fY1 + 10, 120, 5); g.fillRect(w - 120, fY1 + 10, 120, 5); }
    // número
    g.fillStyle = p.nome === 'vlt' ? '#ffffff' : p.letra; g.font = '900 30px "Arial Narrow", Arial'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(p.num, w / 2, cabY(1.55));
    // faróis (conjuntos com farol + lanterna)
    for (const s of [-1, 1]) {
      const cx = cabX(s * 0.76), cy = cabY(1.3);
      g.fillStyle = '#0c0c0e'; g.beginPath(); g.roundRect(cx - 62, cy - 24, 124, 48, 18); g.fill();
      g.strokeStyle = '#8a9096'; g.lineWidth = 3; g.stroke();
      const fx = cx + s * -22, lx = cx + s * 34;
      const rf = g.createRadialGradient(fx - 4, cy - 5, 2, fx, cy, 18); rf.addColorStop(0, '#ffffff'); rf.addColorStop(0.5, '#d8dde2'); rf.addColorStop(1, '#6d747b');
      g.fillStyle = rf; g.beginPath(); g.arc(fx, cy, 17, 0, 7); g.fill();
      g.fillStyle = '#e8eaed'; g.beginPath(); g.arc(fx + s * -32, cy, 9, 0, 7); g.fill();
      g.fillStyle = '#7a0b0b'; g.beginPath(); g.roundRect(lx - 12, cy - 12, 24, 24, 6); g.fill();
      g.fillStyle = 'rgba(255,120,120,.5)'; g.fillRect(lx - 8, cy - 9, 7, 6);
    }
    // grade da buzina e logotipo
    g.fillStyle = '#1a1c20'; g.beginPath(); g.roundRect(w / 2 - 34, cabY(1.28) - 12, 68, 24, 6); g.fill();
    g.fillStyle = '#555'; for (let i = 0; i < 5; i++) g.fillRect(w / 2 - 28, cabY(1.28) - 8 + i * 4, 56, 2);
    // para-choque anti-escalada (nervuras)
    g.fillStyle = '#1c1e22'; g.fillRect(0, cabY(1.08), w, h - cabY(1.08));
    for (let y = cabY(1.08) + 4; y < h; y += 8) { g.fillStyle = 'rgba(255,255,255,.12)'; g.fillRect(0, y, w, 2); }
    if (p.nome === 'grafite') { grafite(g, 'ZN', 120, cabY(1.62), 40, ['#19f0e0', '#2f6bff', '#fff'], -0.1); granula(g, 0, 0, w, h, 1800, ['rgba(90,40,20,.12)'], 4); }
    // sujeira
    const gs = g.createLinearGradient(0, cabY(1.5), 0, h); gs.addColorStop(0, 'rgba(50,40,30,0)'); gs.addColorStop(1, 'rgba(50,40,30,.55)');
    g.fillStyle = gs; g.fillRect(0, cabY(1.5), w, h);
    granula(g, 0, cabY(1.3), w, h, 700, ['rgba(60,45,30,.4)'], 3);
    rebites(g, 10, w - 10, cabY(3.05) - 16, 14);
  });
}
const texCabRM = tela(512, 512, (g, w, h) => {
  g.fillStyle = 'rgb(0,170,255)'; g.fillRect(0, 0, w, h);
  g.fillStyle = 'rgb(0,230,0)'; g.beginPath(); g.roundRect(cabX(-1.0) - 12, cabY(3.03) - 12, cabX(1) - cabX(-1) + 24, cabY(2.02) - cabY(3.03) + 24, 34); g.fill();
  g.fillStyle = 'rgb(0,8,0)'; g.beginPath(); g.roundRect(cabX(-1.0), cabY(3.03), cabX(1) - cabX(-1), cabY(2.02) - cabY(3.03), 26); g.fill();
  for (const s of [-1, 1]) { g.fillStyle = 'rgb(0,15,255)'; g.beginPath(); g.arc(cabX(s * 0.76) - s * 22, cabY(1.3), 17, 0, 7); g.fill(); }
  g.fillStyle = 'rgb(0,220,60)'; g.fillRect(0, cabY(1.08), w, h);
}, { cor: false });
const emissivoCab = (lit) => tela(256, 256, (g, w, h) => {
  g.fillStyle = '#000'; g.fillRect(0, 0, w, h);
  const k = 256 / 512;
  for (const s of [-1, 1]) {
    const cx = cabX(s * 0.76) * k, cy = cabY(1.3) * k;
    if (lit) { g.fillStyle = '#fff'; g.beginPath(); g.arc(cx - s * 11, cy, 9, 0, 7); g.fill(); g.fillStyle = '#ddd'; g.beginPath(); g.arc(cx - s * 27, cy, 4.5, 0, 7); g.fill(); }
    else { g.fillStyle = '#ff3030'; g.fillRect(cx + s * 17 - 6, cy - 6, 12, 12); }
  }
});
const texEmisCab = { aceso: emissivoCab(true), apagado: emissivoCab(false) };

// letreiro de LED laranja (matriz de pontos)
function texLetreiro(txt) {
  return tela(512, 80, (g, w, h) => {
    g.fillStyle = '#060504'; g.fillRect(0, 0, w, h);
    const c = document.createElement('canvas'); c.width = 128; c.height = 20; const q = c.getContext('2d');
    q.fillStyle = '#000'; q.fillRect(0, 0, 128, 20); q.fillStyle = '#fff'; q.font = '700 17px "Arial Narrow", Arial'; q.textBaseline = 'middle'; q.textAlign = 'center';
    q.fillText('12', 11, 11); const larg = Math.min(100, q.measureText(txt).width);
    q.fillText(txt, 75, 11, 102); q.fillRect(23, 1, 1, 18);
    const d = q.getImageData(0, 0, 128, 20).data;
    for (let y = 0; y < 20; y++) for (let x = 0; x < 128; x++) {
      const on = d[(y * 128 + x) * 4] > 110;
      g.fillStyle = on ? '#ffa11a' : 'rgba(255,140,20,.07)';
      g.beginPath(); g.arc(x * 4 + 2, y * 4 + 2, on ? 1.8 : 1.3, 0, 7); g.fill();
    }
    void larg;
  });
}

// ---------- geometria do casco de um vagão ----------
// perfil: parede com "tumblehome" + teto arredondado com topo plano em y=3,4
function comNormais(pts) {
  const cx = 0, cy = 2.2; const seg = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1]; let nx = b.y - a.y, ny = -(b.x - a.x); const l = Math.hypot(nx, ny); nx /= l; ny /= l;
    if (nx * ((a.x + b.x) / 2 - cx) + ny * ((a.y + b.y) / 2 - cy) < 0) { nx = -nx; ny = -ny; }
    seg.push([nx, ny]);
  }
  return pts.map((p, i) => {
    const s0 = seg[Math.max(0, i - 1)], s1 = seg[Math.min(seg.length - 1, i)];
    let nx = s0[0] + s1[0], ny = s0[1] + s1[1]; const l = Math.hypot(nx, ny);
    return { x: p.x, y: p.y, nx: nx / l, ny: ny / l };
  });
}
const paredeE = comNormais([{ x: -1.07, y: Y0 }, { x: -1.13, y: 1.2 }, { x: -HW, y: 1.45 }, { x: -HW, y: Y1 }]);
const paredeD = comNormais([{ x: 1.07, y: Y0 }, { x: 1.13, y: 1.2 }, { x: HW, y: 1.45 }, { x: HW, y: Y1 }]);
const tetoPts = (() => {
  const p = []; const cx = 0.82, rx = HW - 0.82, ry = TOPO - Y1;
  for (let k = 0; k <= 6; k++) { const a = Math.PI - k * Math.PI / 12; p.push({ x: -cx + rx * Math.cos(a), y: Y1 + ry * Math.sin(a) }); }
  p.push({ x: -0.6, y: TOPO }, { x: 0, y: TOPO }, { x: 0.6, y: TOPO });
  for (let k = 0; k <= 6; k++) { const a = Math.PI / 2 - k * Math.PI / 12; p.push({ x: cx + rx * Math.cos(a), y: Y1 + ry * Math.sin(a) }); }
  const r = comNormais(p); let s = 0; r[0].s = 0;
  for (let i = 1; i < r.length; i++) { s += Math.hypot(r[i].x - r[i - 1].x, r[i].y - r[i - 1].y); r[i].s = s; }
  r.forEach(q => q.s /= s); return r;
})();
// contorno fechado para as tampas (esq de baixo p/ cima, teto, dir de cima p/ baixo)
const contorno = [...paredeE, ...tetoPts.slice(1, -1), ...paredeD.slice().reverse()];

function tampa(ac, z, nz, uvFn) {
  const c = { p: [0, 2.2, z], n: [0, 0, nz], u: uvFn(0, 2.2) };
  for (let i = 0; i < contorno.length; i++) {
    const a = contorno[i], b = contorno[(i + 1) % contorno.length];
    ac.tri(c, { p: [a.x, a.y, z], n: [0, 0, nz], u: uvFn(a.x, a.y) }, { p: [b.x, b.y, z], n: [0, 0, nz], u: uvFn(b.x, b.y) });
  }
}
const uvPonta = (x, y) => [0.012 + (x + HW) / 2.3 * 0.012, Math.min(1, Math.max(0, (y - Y0) / (Y1 - Y0)))];

// cache de geometrias por número de vagões
const cacheTrem = {};
function geoTrem(n) {
  if (cacheTrem[n]) return cacheTrem[n];
  const lado = new Acum(), teto = new Acum(); const ch = [], rd = [];
  for (let i = 0; i < n; i++) {
    const zmax = -i * (CARRO + VAO), zmin = zmax - CARRO, zc = zmax - CARRO / 2;
    // paredes
    for (const par of [paredeE, paredeD]) {
      const esq = par[0].x < 0;
      const u = z => esq ? (z - zmin) / CARRO : (zmax - z) / CARRO;
      for (let k = 0; k < par.length - 1; k++) {
        const a = par[k], b = par[k + 1];
        const V = (q, z) => ({ p: [q.x, q.y, z], n: [q.nx, q.ny, 0], u: [u(z), (q.y - Y0) / (Y1 - Y0)] });
        lado.quad(V(a, zmin), V(b, zmin), V(b, zmax), V(a, zmax));
      }
    }
    // teto
    for (let k = 0; k < tetoPts.length - 1; k++) {
      const a = tetoPts[k], b = tetoPts[k + 1];
      const V = (q, z) => ({ p: [q.x, q.y, z], n: [q.nx, q.ny, 0], u: [q.s, (z - zmin) / CARRO] });
      teto.quad(V(a, zmin), V(b, zmin), V(b, zmax), V(a, zmax));
    }
    // tampas das pontas (a frente do vagão 0 é a cabine, feita à parte)
    tampa(lado, zmin, -1, uvPonta);
    if (i > 0) tampa(lado, zmax, 1, uvPonta);
    // chassi: longarina, caixas de equipamento, truques
    ch.push(bx(2.05, 0.2, CARRO - 0.2, 0, 0.8, zc));
    ch.push(bx(2.12, 0.34, 4.6, 0, 0.62, zc));                // saia central com equipamentos
    for (const dz of [-1.3, 0.1, 1.4]) ch.push(bx(2.16, 0.26, 0.9, 0, 0.62, zc + dz));
    ch.push(cil(0.2, 0.2, 1.5, 10, 0.55, 0.6, zc - 0.3, 'z'));
    for (const bz of [zc - CARRO / 2 + 2.1, zc + CARRO / 2 - 2.1]) {
      for (const s of [-1, 1]) {
        ch.push(bx(0.12, 0.2, 2.7, s * 0.84, 0.55, bz));            // longarina do truque
        ch.push(bx(0.14, 0.12, 0.5, s * 0.84, 0.7, bz));            // mola / suspensão
        for (const az of [-0.95, 0.95]) ch.push(bx(0.18, 0.24, 0.3, s * 0.84, 0.54, bz + az)); // caixa de rolamento
        ch.push(cil(0.07, 0.07, 0.22, 8, s * 0.84, 0.78, bz - 0.28), cil(0.07, 0.07, 0.22, 8, s * 0.84, 0.78, bz + 0.28));
      }
      ch.push(bx(1.8, 0.16, 0.45, 0, 0.66, bz));                   // travessa
      for (const az of [-0.95, 0.95]) {
        for (const s of [-1, 1]) { rd.push(cil(0.42, 0.42, 0.1, 18, s * 0.66, 0.56, bz + az, 'x')); rd.push(cil(0.46, 0.46, 0.03, 18, s * 0.6, 0.56, bz + az, 'x')); }
        rd.push(cil(0.07, 0.07, 1.5, 8, 0, 0.56, bz + az, 'x'));
      }
    }
    // sanfona e engate até o próximo vagão
    if (i < n - 1) {
      const z0 = zmin - VAO;
      for (let k = 0; k < 7; k++) { const z = z0 - 0.05 + k * 0.1; const w = k % 2 ? 1.62 : 1.78; ch.push(bx(w, 2.15 - (k % 2) * 0.06, 0.07, 0, 2.05, z + 0.035)); }
      ch.push(bx(0.28, 0.16, VAO + 0.6, 0, 0.75, zmin - VAO / 2));
    }
  }
  // limpa-trilhos e engate da frente (sem passar de z=0)
  ch.push(bx(2.1, 0.32, 0.25, 0, 0.72, -0.14));
  ch.push(bx(1.9, 0.18, 0.5, 0, 0.47, -0.28, -0.35));
  ch.push(bx(0.3, 0.2, 0.3, 0, 0.72, -0.02));
  const r = { corpo: geoDeAcums([lado, teto]), chassi: junta(ch), rodas: junta(rd) };
  return (cacheTrem[n] = r);
}
// cabine (tampa da frente do vagão 0, em z=0)
const geoCabine = (() => { const a = new Acum(); tampa(a, 0.001, 1, (x, y) => [(x + HW) / 2.3, (y - Y0) / (TOPO - Y0)]); return geoDeAcums([a]); })();
const geoLetreiro = new THREE.PlaneGeometry(1.26, 0.2).translate(0, 2.87, 0.012);

// materiais por pintura
const MAT_TREM = PINTURAS.map(p => {
  const t = pintaLado(p); const cab = pintaCabine(p);
  const lado = std({ map: t.cor, bumpMap: t.rel, bumpScale: 1.2, roughnessMap: texLadoRM, metalnessMap: texLadoRM, roughness: p.rug, metalness: p.metal });
  const cabo = (lit) => std({ map: cab, roughnessMap: texCabRM, metalnessMap: texCabRM, roughness: p.rug, metalness: Math.min(p.metal, 0.6), emissive: 0xffffff, emissiveMap: lit ? texEmisCab.aceso : texEmisCab.apagado, emissiveIntensity: lit ? 2.2 : 0.8 });
  return { p, lado, cabParado: cabo(false), cabMovel: cabo(true) };
});
const matTeto = std({ map: texTeto, bumpMap: texTeto, bumpScale: 0.8, roughness: 0.8, metalness: 0.35 });
const MAT_LETREIRO = DESTINOS.map(d => new THREE.MeshBasicMaterial({ map: texLetreiro(d), toneMapped: false }));
const glowFarol = matBrilho(0xfff1c8, 0.95);

export function criaVisualTrem(carros, movel = false, pintura, destino) {
  carros = Math.max(1, carros | 0);
  const geo = geoTrem(carros);
  const mt = MAT_TREM[pintura ?? Math.floor(Math.random() * MAT_TREM.length)];
  const g = new THREE.Group();
  g.add(malha(geo.corpo, [mt.lado, matTeto], true, true));
  g.add(malha(geo.chassi, M.chassi, true, false));
  g.add(malha(geo.rodas, M.roda, true, false));
  g.add(malha(geoCabine, movel ? mt.cabMovel : mt.cabParado, false, true));
  const iDest = destino ?? Math.floor(Math.random() * DESTINOS.length);
  g.add(malha(geoLetreiro, MAT_LETREIRO[iDest], false, false));
  if (movel) for (const s of [-1, 1]) g.add(brilho(glowFarol, s * 0.66, 1.3, 0.06, 1.15));
  g.userData = { pintura: mt.p.nome, destino: DESTINOS[iDest], comprimento: carros * CARRO + (carros - 1) * VAO };
  return g;
}

// ======================================================================
// RAMPA
// ======================================================================
const texXadrez = tela(128, 128, (g, w, h) => {
  const gr = g.createLinearGradient(0, 0, w, h); gr.addColorStop(0, '#9aa0a6'); gr.addColorStop(1, '#868c93');
  g.fillStyle = gr; g.fillRect(0, 0, w, h);
  granula(g, 0, 0, w, h, 600, ['rgba(255,255,255,.08)', 'rgba(0,0,0,.08)'], 2);
  const lente = (x, y, a) => { g.save(); g.translate(x, y); g.rotate(a); g.fillStyle = 'rgba(0,0,0,.35)'; g.beginPath(); g.ellipse(1.5, 1.5, 13, 3.4, 0, 0, 7); g.fill(); g.fillStyle = '#c3c8cd'; g.beginPath(); g.ellipse(0, 0, 13, 3.4, 0, 0, 7); g.fill(); g.fillStyle = 'rgba(255,255,255,.5)'; g.beginPath(); g.ellipse(-1, -1, 9, 1.2, 0, 0, 7); g.fill(); g.restore(); };
  for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) lente(i * 32 + 16, j * 32 + 16, (i + j) % 2 ? Math.PI / 4 : -Math.PI / 4);
}, { repete: true });
texXadrez.repeat.set(4.4, 21);
const texXadrezRel = tela(128, 128, (g, w, h) => {
  g.fillStyle = '#404040'; g.fillRect(0, 0, w, h);
  for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) { g.save(); g.translate(i * 32 + 16, j * 32 + 16); g.rotate((i + j) % 2 ? Math.PI / 4 : -Math.PI / 4); g.fillStyle = '#e0e0e0'; g.beginPath(); g.ellipse(0, 0, 13, 3.4, 0, 0, 7); g.fill(); g.restore(); }
}, { cor: false, repete: true });
texXadrezRel.repeat.set(4.4, 21);
const texZebrado = tela(256, 32, (g, w, h) => {
  g.fillStyle = '#f2b705'; g.fillRect(0, 0, w, h); g.fillStyle = '#141414';
  for (let x = -h; x < w + h; x += 32) { g.beginPath(); g.moveTo(x, h); g.lineTo(x + 16, h); g.lineTo(x + 16 + h, 0); g.lineTo(x + h, 0); g.fill(); }
  granula(g, 0, 0, w, h, 300, ['rgba(60,50,40,.3)'], 2);
});
const matZebrado = std({ map: texZebrado, roughness: 0.6, metalness: 0.2 });
const matChapa = std({ map: texXadrez, bumpMap: texXadrezRel, bumpScale: 2, roughness: 0.42, metalness: 0.85 });

let protoRampa = null;
export function criaVisualRampa() {
  if (!protoRampa) {
    const ang = Math.atan2(TOPO, 10), L = Math.hypot(10, TOPO);
    const naRampa = (geo) => geo.rotateX(ang); // aplica a inclinação (z local negativo sobe)
    const g = new THREE.Group();
    // chapa (topo em y local 0, do z 0 ao -L)
    const chapa = naRampa(bx(2.2, 0.08, L, 0, -0.04, -L / 2));
    g.add(malha(chapa, matChapa, true, true));
    // faixa zebrada na ponta de baixo e de cima
    g.add(malha(junta([naRampa(bx(2.2, 0.01, 0.35, 0, 0.005, -0.2)), naRampa(bx(2.2, 0.01, 0.3, 0, 0.005, -L + 0.18))]), matZebrado, false, true));
    // longarinas laterais e corrimãos (amarelo)
    const am = [];
    for (const s of [-1, 1]) {
      am.push(naRampa(bx(0.08, 0.3, L, s * 1.1, -0.05, -L / 2)));
      am.push(naRampa(bx(0.14, 0.03, L, s * 1.1, 0.1, -L / 2)));
      const post = [];
      for (let k = 0; k <= 5; k++) { const d = -0.3 - k * (L - 0.6) / 5; post.push(d); am.push(naRampa(barra([s * 1.1, 0.1, d], [s * 1.1, 0.85, d], 0.028, false, 8))); }
      am.push(naRampa(barra([s * 1.1, 0.85, -0.3], [s * 1.1, 0.85, -L + 0.3], 0.035, false, 10)));
      am.push(naRampa(barra([s * 1.1, 0.47, -0.3], [s * 1.1, 0.47, -L + 0.3], 0.022, false, 8)));
    }
    g.add(malha(junta(am), M.amarelo));
    // estrutura de apoio (galvanizada): pilares, travessas e contraventamento em X
    const est = [];
    for (let k = 1; k <= 4; k++) {
      const z = -k * 2.5, yt = TOPO * k * 2.5 / 10 - 0.25;
      for (const s of [-1, 1]) { est.push(bx(0.12, yt, 0.12, s * 0.95, yt / 2, z)); est.push(bx(0.3, 0.03, 0.3, s * 0.95, 0.015, z)); }
      est.push(bx(2.1, 0.12, 0.14, 0, yt - 0.02, z));
      if (yt > 1.1) { est.push(barra([-0.95, 0.15, z], [0.95, yt - 0.1, z], 0.03, true)); est.push(barra([0.95, 0.15, z], [-0.95, yt - 0.1, z], 0.03, true)); }
      if (k > 1) for (const s of [-1, 1]) est.push(barra([s * 0.95, 0.2, z], [s * 0.95, TOPO * (k - 1) * 2.5 / 10 - 0.3, z + 2.5], 0.028, true));
    }
    g.add(malha(junta(est), M.galv));
    protoRampa = g;
  }
  return protoRampa.clone();
}

// ======================================================================
// BARREIRAS
// ======================================================================
const texRefletivo = tela(512, 64, (g, w, h) => {
  g.fillStyle = '#f4f4f2'; g.fillRect(0, 0, w, h); g.fillStyle = '#d2142a';
  for (let x = -h; x < w + h; x += 72) { g.beginPath(); g.moveTo(x, h); g.lineTo(x + 36, h); g.lineTo(x + 36 + h, 0); g.lineTo(x + h, 0); g.fill(); }
  // colmeia do refletivo
  for (let y = 0; y < h; y += 6) for (let x = (y / 6 % 2) * 3; x < w; x += 6) { g.fillStyle = 'rgba(255,255,255,.12)'; g.fillRect(x, y, 2, 2); }
  granula(g, 0, 0, w, h, 700, ['rgba(70,55,40,.25)', 'rgba(0,0,0,.15)'], 3);
  g.fillStyle = 'rgba(0,0,0,.3)'; g.fillRect(0, 0, w, 2); g.fillRect(0, h - 2, w, 2);
});
const matRefletivo = std({ map: texRefletivo, roughness: 0.3, metalness: 0.05, emissive: 0xffffff, emissiveMap: texRefletivo, emissiveIntensity: 0.08 });
const matCavalete = std({ color: 0xd9dcdf, roughness: 0.5, metalness: 0.6 });

// placa ABAIXE! (canvas 512×452 para 2,1 × 1,85 m)
const texPlacaAlta = tela(512, 452, (g, w, h) => {
  g.fillStyle = '#ffc712'; g.fillRect(0, 0, w, h);
  granula(g, 0, 0, w, h, 5000, ['rgba(255,255,255,.06)', 'rgba(120,80,0,.06)'], 2);
  // borda preta
  g.strokeStyle = '#121212'; g.lineWidth = 16; g.beginPath(); g.roundRect(20, 20, w - 40, h - 40, 22); g.stroke();
  // chevrons apontando para baixo (faixa inferior)
  g.save(); g.beginPath(); g.rect(36, 318, w - 72, 96); g.clip();
  g.fillStyle = '#121212';
  for (let x = 36; x < w; x += 74) { g.beginPath(); g.moveTo(x, 330); g.lineTo(x + 30, 360); g.lineTo(x + 60, 330); g.lineTo(x + 60, 352); g.lineTo(x + 30, 382); g.lineTo(x, 352); g.fill(); g.beginPath(); g.moveTo(x, 370); g.lineTo(x + 30, 400); g.lineTo(x + 60, 370); g.lineTo(x + 60, 392); g.lineTo(x + 30, 422); g.lineTo(x, 392); g.fill(); }
  g.restore();
  // pictograma: pessoa rolando por baixo
  g.fillStyle = '#121212'; g.beginPath(); g.arc(256, 76, 20, 0, 7); g.fill();
  g.lineWidth = 16; g.lineCap = 'round'; g.strokeStyle = '#121212';
  g.beginPath(); g.moveTo(236, 108); g.quadraticCurveTo(205, 132, 225, 158); g.moveTo(236, 108); g.lineTo(290, 128); g.moveTo(290, 128); g.lineTo(320, 110); g.stroke();
  g.fillRect(150, 172, 212, 10);
  // texto
  g.font = '900 104px Impact, "Arial Black", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillStyle = '#121212'; g.fillText('ABAIXE!', w / 2, 250);
  // parafusos com escorrido de ferrugem
  for (const [x, y] of [[44, 44], [w - 44, 44], [44, h - 44], [w - 44, h - 44], [w / 2, 44], [w / 2, h - 44]]) {
    const gr = g.createLinearGradient(0, y, 0, y + 70); gr.addColorStop(0, 'rgba(120,60,20,.55)'); gr.addColorStop(1, 'rgba(120,60,20,0)');
    g.fillStyle = gr; g.fillRect(x - 3, y, 6, 70);
    const r = g.createRadialGradient(x - 2, y - 2, 1, x, y, 9); r.addColorStop(0, '#f2f2f2'); r.addColorStop(1, '#6b6f73');
    g.fillStyle = r; g.beginPath(); g.arc(x, y, 9, 0, 7); g.fill(); g.strokeStyle = '#333'; g.lineWidth = 2; g.beginPath(); g.moveTo(x - 5, y); g.lineTo(x + 5, y); g.stroke();
  }
  // sujeira: borda inferior mais suja, arranhões
  const gs = g.createLinearGradient(0, h * 0.6, 0, h); gs.addColorStop(0, 'rgba(70,50,20,0)'); gs.addColorStop(1, 'rgba(70,50,20,.35)');
  g.fillStyle = gs; g.fillRect(0, 0, w, h);
  g.strokeStyle = 'rgba(255,255,255,.3)'; g.lineWidth = 1;
  for (let i = 0; i < 14; i++) { const x = rnd(0, w), y = rnd(0, h); g.beginPath(); g.moveTo(x, y); g.lineTo(x + rnd(-40, 40), y + rnd(-8, 8)); g.stroke(); }
  granula(g, 0, 0, w, h, 400, ['rgba(40,30,10,.35)'], 4);
});
const matPlacaFrente = std({ map: texPlacaAlta, roughness: 0.45, metalness: 0.1 });
const matPlacaVerso = std({ color: 0x8c9196, roughness: 0.6, metalness: 0.7 });

// tapume: chapa ondulada pintada
const texChapaObra = tela(512, 512, (g, w, h) => {
  g.fillStyle = '#4f7a3a'; g.fillRect(0, 0, w, h);
  granula(g, 0, 0, w, h, 8000, ['rgba(255,255,255,.05)', 'rgba(0,0,0,.07)'], 3);
  // faixa branca e marcas de parafuso
  g.fillStyle = '#e9ece6'; g.fillRect(0, 36, w, 30); g.fillRect(0, h - 70, w, 16);
  for (let x = 12; x < w; x += 44) { g.fillStyle = '#9aa0a0'; g.beginPath(); g.arc(x, 52, 4, 0, 7); g.arc(x, h - 62, 4, 0, 7); g.fill(); }
  // cartazes lambe-lambe
  const cart = (x, y, cw, ch, cor, txt) => { g.save(); g.translate(x, y); g.rotate(rnd(-.05, .05)); g.fillStyle = cor; g.fillRect(0, 0, cw, ch); g.fillStyle = '#111'; g.font = '900 20px Impact, Arial Black'; g.textAlign = 'center'; g.fillText(txt, cw / 2, ch / 2 + 7); g.fillStyle = 'rgba(0,0,0,.2)'; g.fillRect(0, ch - 8, cw, 8); g.restore(); };
  cart(28, 300, 90, 120, '#f5e24a', 'FORRÓ'); cart(126, 318, 80, 110, '#ff7eb6', 'SHOW'); cart(400, 290, 84, 116, '#9ad7ff', 'ALUGA');
  // grafite de tag
  g.strokeStyle = '#111'; g.lineWidth = 4; g.beginPath(); g.moveTo(240, 420); g.bezierCurveTo(270, 380, 300, 450, 330, 400); g.bezierCurveTo(350, 380, 360, 440, 380, 410); g.stroke();
  // ferrugem escorrendo
  for (let i = 0; i < 40; i++) { const x = rnd(0, w), y0 = rnd(40, 200); const gr = g.createLinearGradient(0, y0, 0, y0 + 160); gr.addColorStop(0, 'rgba(130,60,20,.45)'); gr.addColorStop(1, 'rgba(130,60,20,0)'); g.fillStyle = gr; g.fillRect(x, y0, rnd(2, 5), 160); }
  // lama na base
  const gs = g.createLinearGradient(0, h * 0.72, 0, h); gs.addColorStop(0, 'rgba(90,65,40,0)'); gs.addColorStop(1, 'rgba(90,65,40,.85)'); g.fillStyle = gs; g.fillRect(0, h * 0.72, w, h);
  granula(g, 0, h * 0.8, w, h * 0.2, 1500, ['rgba(80,60,40,.5)', 'rgba(120,95,60,.4)'], 4);
});
const matChapaObra = std({ map: texChapaObra, roughness: 0.6, metalness: 0.45 });
const texPlacaObra = tela(512, 224, (g, w, h) => {
  g.fillStyle = '#ffd21a'; g.fillRect(0, 0, w, h);
  g.save(); g.beginPath(); g.rect(0, 0, w, 40); g.rect(0, h - 40, w, 40); g.clip(); g.fillStyle = '#121212';
  for (let x = -40; x < w + 40; x += 48) { g.beginPath(); g.moveTo(x, 40); g.lineTo(x + 24, 40); g.lineTo(x + 64, 0); g.lineTo(x + 40, 0); g.fill(); g.beginPath(); g.moveTo(x, h); g.lineTo(x + 24, h); g.lineTo(x + 64, h - 40); g.lineTo(x + 40, h - 40); g.fill(); }
  g.restore();
  g.fillStyle = '#121212'; g.font = '900 104px Impact, "Arial Black", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('OBRA', w / 2, h / 2 - 8);
  g.font = '700 22px Arial'; g.fillText('PERIGO  •  NÃO ULTRAPASSE', w / 2, h / 2 + 50);
  g.strokeStyle = '#121212'; g.lineWidth = 8; g.strokeRect(4, 4, w - 8, h - 8);
  granula(g, 0, 0, w, h, 600, ['rgba(60,40,10,.25)'], 4);
  const gs = g.createLinearGradient(0, h / 2, 0, h); gs.addColorStop(0, 'rgba(70,50,20,0)'); gs.addColorStop(1, 'rgba(70,50,20,.3)'); g.fillStyle = gs; g.fillRect(0, 0, w, h);
});
const matPlacaObra = std({ map: texPlacaObra, roughness: 0.5, metalness: 0.1 });
const texCone = tela(64, 256, (g, w, h) => {
  g.fillStyle = '#ff5a0a'; g.fillRect(0, 0, w, h);
  g.fillStyle = '#f5f5f5'; g.fillRect(0, 70, w, 36); g.fillRect(0, 140, w, 26);
  for (let y = 70; y < 166; y += 4) { g.fillStyle = 'rgba(255,255,255,.3)'; g.fillRect(0, y, w, 1); }
  granula(g, 0, 0, w, h, 400, ['rgba(60,40,20,.3)'], 3);
  const gs = g.createLinearGradient(0, h * 0.7, 0, h); gs.addColorStop(0, 'rgba(60,40,20,0)'); gs.addColorStop(1, 'rgba(60,40,20,.5)'); g.fillStyle = gs; g.fillRect(0, 0, w, h);
});
const matCone = std({ map: texCone, roughness: 0.55, metalness: 0 });

function geoOndulada(z0, nz) { // chapa ondulada vertical (x -1.1..1.1, y 0.04..2.38)
  const a = new Acum(); const N = 120, A = 0.028, P = 0.15;
  for (let i = 0; i < N; i++) {
    const xa = -1.1 + 2.2 * i / N, xb = -1.1 + 2.2 * (i + 1) / N;
    const V = (x, y) => { const z = z0 + nz * A * Math.sin(2 * Math.PI * x / P); const dz = nz * A * 2 * Math.PI / P * Math.cos(2 * Math.PI * x / P); const l = Math.hypot(dz, 1);
      return { p: [x, y, z], n: [-dz / l * nz * nz, 0, nz / l], u: [nz > 0 ? (x + HW) / 2.3 : (HW - x) / 2.3, y / 2.5] }; };
    a.quad(V(xa, 0.04), V(xb, 0.04), V(xb, 2.38), V(xa, 2.38));
  }
  return geoDeAcums([a]);
}

const protoBarreira = {};
function montaBarreira(tipo) {
  const g = new THREE.Group();
  if (tipo === 'baixa') {
    // tábuas refletivas (superior 0,61–0,95 e inferior)
    const tb = [bx(2.3, 0.34, 0.05, 0, 0.78, -0.1), bx(2.3, 0.2, 0.04, 0, 0.3, -0.1)];
    g.add(malha(junta(tb), matRefletivo));
    // cavaletes em A (tubos) + pés
    const cv = [];
    for (const s of [-1, 1]) {
      const x = s * 0.98;
      cv.push(barra([x, 0.97, -0.14], [x, 0.02, 0.22], 0.03, true), barra([x, 0.97, -0.06], [x, 0.02, -0.45], 0.03, true));
      cv.push(bx(0.08, 0.04, 0.8, x, 0.02, -0.11), bx(0.1, 0.06, 0.12, x, 0.955, -0.1));
      cv.push(bx(0.05, 0.05, 0.55, x, 0.48, -0.11));
    }
    g.add(malha(junta(cv), matCavalete));
    // sacos de areia nos pés (borracha escura) e caixa do lampião
    const pr = [cil(0.11, 0.11, 0.05, 14, -0.82, 0.87, -0.045, 'z'), bx(0.1, 0.3, 0.03, -0.82, 0.78, -0.07)];
    for (const s of [-1, 1]) pr.push(bx(0.26, 0.09, 0.5, s * 0.98, 0.045, -0.11));
    g.add(malha(junta(pr), M.borracha));
    const lente = new THREE.Mesh(cil(0.085, 0.09, 0.05, 16, -0.82, 0.87, -0.005, 'z'), M.lampA); lente.castShadow = false; g.add(lente);
    g.add(brilho(GLOW.A, -0.82, 0.87, 0.08, 0.9));
  } else if (tipo === 'alta') {
    // pórtico: pilares em x ±1,12, viga no topo, sapatas e mãos-francesas atrás (fora do vão)
    const pt = [];
    for (const s of [-1, 1]) {
      pt.push(bx(0.12, 3.15, 0.12, s * 1.12, 1.575, 0));
      pt.push(bx(0.34, 0.03, 0.34, s * 1.12, 0.015, 0));
      pt.push(barra([s * 1.12, 1.0, -0.05], [s * 1.12, 0.02, -0.75], 0.03, true));
      pt.push(bx(0.2, 0.03, 0.2, s * 1.12, 0.015, -0.75));
      for (const y of [1.35, 2.8]) pt.push(bx(0.16, 0.08, 0.1, s * 1.06, y, -0.07));  // abraçadeiras
    }
    pt.push(bx(2.4, 0.14, 0.14, 0, 3.08, 0));
    g.add(malha(junta(pt), M.aco));
    // placa (frente com textura, bordas e verso metálicos)
    const pl = new THREE.Mesh(new THREE.BoxGeometry(2.1, 1.85, 0.04).translate(0, 2.075, 0.08),
      [matPlacaVerso, matPlacaVerso, matPlacaVerso, matPlacaVerso, matPlacaFrente, matPlacaVerso]);
    pl.castShadow = true; g.add(pl);
    // giroflex no topo dos pilares, piscando alternado
    const base = junta([-1, 1].map(s => cil(0.07, 0.08, 0.05, 12, s * 1.12, 3.175, 0)));
    g.add(malha(base, M.borracha));
    g.add(new THREE.Mesh(cil(0.055, 0.06, 0.1, 12, -1.12, 3.25, 0), M.lampA));
    g.add(new THREE.Mesh(cil(0.055, 0.06, 0.1, 12, 1.12, 3.25, 0), M.lampB));
    g.add(brilho(GLOW.A, -1.12, 3.26, 0.05, 1.0), brilho(GLOW.B, 1.12, 3.26, 0.05, 1.0));
  } else { // tapume
    g.add(malha(junta([geoOndulada(0.1, 1), geoOndulada(-0.1, -1)]), matChapaObra, true, true));
    // quadro: montantes, tampa superior zebrada
    g.add(malha(junta([bx(0.1, 2.44, 0.3, -1.1, 1.22, 0), bx(0.1, 2.44, 0.3, 1.1, 1.22, 0), bx(2.1, 0.06, 0.18, 0, 1.2, 0), bx(2.3, 0.1, 0.34, 0, 0.05, 0)]), M.galv));
    g.add(malha(bx(2.3, 0.08, 0.32, 0, 2.46, 0), matZebrado));
    // placa OBRA
    const po = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.57, 0.03).translate(0, 1.55, 0.155), [matPlacaVerso, matPlacaVerso, matPlacaVerso, matPlacaVerso, matPlacaObra, matPlacaVerso]);
    po.castShadow = true; g.add(po);
    // cone ao lado (base preta na mesma malha da borracha) + giroflex
    const cone = new THREE.LatheGeometry([new THREE.Vector2(0.17, 0), new THREE.Vector2(0.155, 0.05), new THREE.Vector2(0.03, 0.7), new THREE.Vector2(0.0, 0.71)], 20).translate(0.78, 0.04, 0.5);
    g.add(malha(cone, matCone));
    g.add(malha(junta([bx(0.42, 0.04, 0.42, 0.78, 0.02, 0.5), cil(0.09, 0.1, 0.06, 12, 0, 2.53, 0), bx(0.3, 0.02, 0.2, 0, 2.505, 0)]), M.borracha));
    g.add(new THREE.Mesh(cil(0.065, 0.075, 0.14, 12, 0, 2.63, 0), M.lampA));
    g.add(brilho(GLOW.A, 0, 2.64, 0.04, 1.2));
  }
  return g;
}
export function criaVisualBarreira(tipo) {
  if (tipo !== 'baixa' && tipo !== 'alta') tipo = 'tapume';
  if (!protoBarreira[tipo]) protoBarreira[tipo] = montaBarreira(tipo);
  return protoBarreira[tipo].clone();
}

// moedas e poderes ficam em itens.js (outro módulo) — reexportados aqui
import { animaItens } from './itens.js?v=1.2.0';
export { criaVisualMoeda, criaVisualPoder } from './itens.js?v=1.2.0';

// ======================================================================
// ANIMAÇÃO (materiais compartilhados)
// ======================================================================
export function animaObjetos(t) {
  const fase = (t * 1.6) % 1;
  const a = fase < 0.5, onA = a ? 1 : 0;
  M.lampA.emissiveIntensity = a ? 4 : 0.25;
  M.lampB.emissiveIntensity = a ? 0.25 : 4;
  GLOW.A.opacity = 0.1 + 0.85 * onA;
  GLOW.B.opacity = 0.1 + 0.85 * (1 - onA);
  glowFarol.opacity = 0.85 + 0.1 * Math.sin(t * 9);
  if (typeof animaItens === 'function') animaItens(t);
}
