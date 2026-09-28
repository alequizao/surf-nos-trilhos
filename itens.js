/*
 * Surf nos Trilhos · Desenvolvido por Alequizao <alequizao.dev@gmail.com>
 * https://github.com/alequizao · © 2026 Alequizao. Todos os direitos reservados.
 */
// itens.js — visual realista das moedas e dos poderes do "Surf nos Trilhos"
// Tudo é criado UMA vez no módulo (geometrias, materiais, texturas) e compartilhado:
// cada moeda é 1 mesh barato; cada poder é um protótipo clonado (clone compartilha geo/material).
import * as THREE from 'three';

// ---------- utilitários ----------
const canvas = (w, h = w) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; };
const texCanvas = (c, srgb = true) => { const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; };

// junta várias geometrias (já posicionadas) numa só — menos meshes/draw calls
function junta(geos) {
  const partes = geos.map(g => (g.index ? g.toNonIndexed() : g));
  const attrs = ['position', 'normal', 'uv'];
  const total = partes.reduce((s, g) => s + g.attributes.position.count, 0);
  const out = new THREE.BufferGeometry();
  for (const a of attrs) {
    const tam = a === 'uv' ? 2 : 3, arr = new Float32Array(total * tam);
    let o = 0;
    for (const g of partes) {
      const at = g.attributes[a];
      if (at) arr.set(at.array.subarray(0, at.count * tam), o);
      o += g.attributes.position.count * tam;
    }
    out.setAttribute(a, new THREE.BufferAttribute(arr, tam));
  }
  out.computeBoundingSphere();
  return out;
}
// aplica transformação (posição, rotação, escala) numa geometria
const tr = (g, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, s = null) => {
  const m = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), s ? new THREE.Vector3(...s) : new THREE.Vector3(1, 1, 1));
  return g.applyMatrix4(m);
};
const std = o => new THREE.MeshStandardMaterial(o);
const estrelaShape = (rE, rI, pontas = 5) => {
  const s = new THREE.Shape();
  for (let k = 0; k < pontas * 2; k++) {
    const a = Math.PI / 2 + k * Math.PI / pontas, r = k % 2 ? rI : rE;
    k ? s.lineTo(Math.cos(a) * r, Math.sin(a) * r) : s.moveTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  s.closePath(); return s;
};

// ================= MOEDA =================
// face: cor (map) + relevo (bumpMap) desenhados no mesmo layout circular das tampas do cilindro
function desenhaFace(ctx, S, relevo) {
  const c = S / 2, R = S / 2;
  const tom = (claro, escuro) => relevo ? claro : escuro; // no relevo: branco = alto
  ctx.fillStyle = relevo ? '#000' : '#b07a10'; ctx.fillRect(0, 0, S, S);
  // aro externo (alto)
  let g = ctx.createRadialGradient(c, c, R * 0.78, c, c, R);
  if (relevo) { g.addColorStop(0, '#fff'); g.addColorStop(1, '#ddd'); }
  else { g.addColorStop(0, '#ffe07a'); g.addColorStop(0.6, '#f5b92c'); g.addColorStop(1, '#c98a14'); }
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(c, c, R, 0, 7); ctx.fill();
  // campo rebaixado
  g = ctx.createRadialGradient(c * 0.8, c * 0.75, 0, c, c, R * 0.8);
  if (relevo) { g.addColorStop(0, '#5a5a5a'); g.addColorStop(1, '#4a4a4a'); }
  else { g.addColorStop(0, '#ffd257'); g.addColorStop(1, '#e0a322'); }
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(c, c, R * 0.8, 0, 7); ctx.fill();
  // filete (anel fino) e pontinhos em volta
  ctx.strokeStyle = tom('#bbb', '#fff0b0'); ctx.lineWidth = S * 0.018;
  ctx.beginPath(); ctx.arc(c, c, R * 0.72, 0, 7); ctx.stroke();
  ctx.fillStyle = tom('#aaa', '#ffe89a');
  for (let k = 0; k < 24; k++) { const a = k / 24 * Math.PI * 2; ctx.beginPath(); ctx.arc(c + Math.cos(a) * R * 0.88, c + Math.sin(a) * R * 0.88, S * 0.012, 0, 7); ctx.fill(); }
  // estrela central em alto relevo, com gradiente (bisel falso)
  const est = (r, ri) => { ctx.beginPath(); for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + k * Math.PI / 5, rr = k % 2 ? ri : r; ctx.lineTo(c + Math.cos(a) * rr, c + Math.sin(a) * rr); } ctx.closePath(); };
  if (relevo) {
    ctx.fillStyle = '#b0b0b0'; est(R * 0.6, R * 0.25); ctx.fill();
    ctx.fillStyle = '#fff'; est(R * 0.5, R * 0.21); ctx.fill();
  } else {
    g = ctx.createLinearGradient(c - R * 0.5, c - R * 0.5, c + R * 0.5, c + R * 0.5);
    g.addColorStop(0, '#fff6c4'); g.addColorStop(0.5, '#ffcc3a'); g.addColorStop(1, '#c78510');
    ctx.fillStyle = g; est(R * 0.6, R * 0.25); ctx.fill();
    ctx.strokeStyle = '#8a5a08'; ctx.lineWidth = S * 0.01; ctx.stroke();
  }
}
const [cFace, xFace] = canvas(256); desenhaFace(xFace, 256, false);
const [cRel, xRel] = canvas(256); desenhaFace(xRel, 256, true);
const texFace = texCanvas(cFace), texRelevo = texCanvas(cRel, false);
// serrilha da borda: listras verticais repetidas ao redor
const [cSer, xSer] = canvas(64, 8);
for (let x = 0; x < 64; x++) { const v = Math.round(128 + 127 * Math.sin(x / 64 * Math.PI * 2)); xSer.fillStyle = `rgb(${v},${v},${v})`; xSer.fillRect(x, 0, 1, 8); }
const texSerrilha = texCanvas(cSer, false); texSerrilha.wrapS = THREE.RepeatWrapping; texSerrilha.repeat.set(36, 1);

export const GEO_MOEDA = new THREE.CylinderGeometry(0.42, 0.42, 0.1, 32).rotateX(Math.PI / 2); // eixo em z
const matFaceMoeda = std({ map: texFace, bumpMap: texRelevo, bumpScale: 4, metalness: 1, roughness: 0.28, emissive: 0x6a4600, emissiveIntensity: 0.55 });
const matLadoMoeda = std({ color: 0xf2b634, bumpMap: texSerrilha, bumpScale: 3, metalness: 1, roughness: 0.3, emissive: 0x6a4600, emissiveIntensity: 0.5 });
// grupos do CylinderGeometry: 0 = lateral, 1 = tampa, 2 = fundo
export const MATS_MOEDA = [matLadoMoeda, matFaceMoeda, matFaceMoeda];

export function criaVisualMoeda() {
  const m = new THREE.Mesh(GEO_MOEDA, MATS_MOEDA);
  m.castShadow = true;
  return m;
}

// ================= HALO / ANEL =================
const [cBri, xBri] = canvas(128);
{ const g = xBri.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.25, 'rgba(255,255,255,.55)'); g.addColorStop(0.6, 'rgba(255,255,255,.15)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  xBri.fillStyle = g; xBri.fillRect(0, 0, 128, 128); }
const texHalo = texCanvas(cBri); // compartilhada: o repeat/offset dela faz o halo "respirar"
const COR = { ima: '#e8364f', jato: '#2f6bff', tenis: '#1fc46b', dobro: '#e2a300' };
const matHalo = {}, matAnel = {};
for (const k in COR) {
  matHalo[k] = new THREE.SpriteMaterial({ map: texHalo, color: COR[k], blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, opacity: 0.7, toneMapped: false });
  matAnel[k] = new THREE.MeshBasicMaterial({ color: new THREE.Color(COR[k]).multiplyScalar(1.15), blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, opacity: 0.85, toneMapped: false });
}
const geoAnel = new THREE.TorusGeometry(0.6, 0.024, 6, 64).rotateX(Math.PI / 2);
function enfeites(g, k) {
  const s = new THREE.Sprite(matHalo[k]); s.scale.set(2.2, 2.2, 1); s.renderOrder = 2; g.add(s);
  const a = new THREE.Mesh(geoAnel, matAnel[k]); a.position.y = -0.5; a.renderOrder = 2; g.add(a);
}
const malha = (geo, mat, sombra = true) => { const m = new THREE.Mesh(geo, mat); m.castShadow = sombra; return m; };

// ================= MATERIAIS DOS PODERES =================
const prata = std({ color: 0xe9edf2, metalness: 1, roughness: 0.18 });
const metalEscuro = std({ color: 0x767d88, metalness: 1, roughness: 0.3 });
const PROTO = {};

// ---------- ÍMÃ-FERRADURA ----------
{
  const vermelho = std({ color: 0xd61f33, metalness: 0.25, roughness: 0.3, emissive: 0x3a0008, emissiveIntensity: 0.6 });
  const R = 0.28, r = 0.12;
  const corpo = junta([
    tr(new THREE.TorusGeometry(R, r, 14, 28, Math.PI), 0, 0.08, 0),
    tr(new THREE.CylinderGeometry(r, r, 0.3, 20), -R, -0.07, 0),
    tr(new THREE.CylinderGeometry(r, r, 0.3, 20), R, -0.07, 0),
  ]);
  const pontas = junta([
    tr(new THREE.CylinderGeometry(r * 1.03, r * 1.03, 0.18, 20), -R, -0.31, 0),
    tr(new THREE.CylinderGeometry(r * 1.03, r * 1.03, 0.18, 20), R, -0.31, 0),
  ]);
  const g = new THREE.Group();
  g.add(malha(corpo, vermelho), malha(pontas, prata));
  enfeites(g, 'ima'); PROTO.ima = g;
}

// ---------- JETPACK ----------
{
  const branco = std({ color: 0xdfe4ea, metalness: 0.6, roughness: 0.25 });
  const azul = std({ color: 0x2f6bff, metalness: 0.4, roughness: 0.3, emissive: 0x06163f, emissiveIntensity: 0.6 });
  const couro = std({ color: 0x2a2d33, roughness: 0.7 });
  const chama = new THREE.MeshBasicMaterial({ color: 0xffb030, blending: THREE.AdditiveBlending, transparent: true, opacity: 0.9, depthWrite: false, toneMapped: false });
  const X = 0.19, tanques = [], metais = [], azuis = [], fogos = [];
  for (const x of [-X, X]) {
    tanques.push(tr(new THREE.CylinderGeometry(0.15, 0.15, 0.5, 22), x, 0.02, 0));
    metais.push(tr(new THREE.SphereGeometry(0.15, 22, 10, 0, Math.PI * 2, 0, Math.PI / 2), x, 0.27, 0)); // tampa de cima
    metais.push(tr(new THREE.SphereGeometry(0.15, 22, 10, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), x, -0.23, 0)); // fundo
    metais.push(tr(new THREE.CylinderGeometry(0.075, 0.115, 0.14, 18, 1, true), x, -0.42, 0)); // bocal
    metais.push(tr(new THREE.CylinderGeometry(0.03, 0.03, 0.06, 10), x, 0.44, 0)); // válvula
    azuis.push(tr(new THREE.TorusGeometry(0.152, 0.022, 8, 28), x, 0.14, 0, Math.PI / 2));
    azuis.push(tr(new THREE.TorusGeometry(0.152, 0.022, 8, 28), x, -0.1, 0, Math.PI / 2));
    fogos.push(tr(new THREE.ConeGeometry(0.075, 0.3, 14, 1, true), x, -0.64, 0, Math.PI));
  }
  azuis.push(tr(new THREE.BoxGeometry(0.22, 0.34, 0.08), 0, 0.03, -0.08)); // placa central
  const alcas = [
    tr(new THREE.TorusGeometry(0.2, 0.025, 8, 20, Math.PI), -0.12, 0.06, -0.14, 0, Math.PI / 2, 0, [1, 1.3, 1]),
    tr(new THREE.TorusGeometry(0.2, 0.025, 8, 20, Math.PI), 0.12, 0.06, -0.14, 0, Math.PI / 2, 0, [1, 1.3, 1]),
    tr(new THREE.BoxGeometry(0.6, 0.06, 0.06), 0, 0.3, -0.06),
  ];
  const g = new THREE.Group();
  g.add(malha(junta(tanques), branco), malha(junta(metais), metalEscuro), malha(junta(azuis), azul), malha(junta(alcas), couro), malha(junta(fogos), chama, false));
  g.scale.setScalar(1.05);
  enfeites(g, 'jato'); PROTO.jato = g;
}

// ---------- TÊNIS MOLA ----------
{
  const verde = std({ color: 0x1fc46b, roughness: 0.5, emissive: 0x03250f, emissiveIntensity: 0.5 });
  const branco = std({ color: 0xf7f7f2, roughness: 0.6 });
  // perfil lateral do tênis (plano z-y; z+ = bico)
  const p = new THREE.Shape();
  p.moveTo(-0.34, 0.0); p.lineTo(0.3, 0.0);
  p.quadraticCurveTo(0.44, 0.02, 0.42, 0.12);  // bico arredondado
  p.quadraticCurveTo(0.36, 0.2, 0.12, 0.24);   // peito do pé
  p.lineTo(-0.12, 0.38);                       // subida até o cano
  p.quadraticCurveTo(-0.2, 0.42, -0.3, 0.38);  // colarinho
  p.quadraticCurveTo(-0.38, 0.3, -0.36, 0.1);  // calcanhar
  p.quadraticCurveTo(-0.37, 0.02, -0.34, 0.0);
  const cabedal = new THREE.ExtrudeGeometry(p, { depth: 0.2, bevelEnabled: true, bevelThickness: 0.06, bevelSize: 0.05, bevelSegments: 4, curveSegments: 10 });
  cabedal.translate(0, 0, -0.1); cabedal.rotateY(-Math.PI / 2); // extrusão vira largura em x
  tr(cabedal, 0, 0.06, 0);
  // sola: contorno da pegada extrudado para baixo
  const s = new THREE.Shape(); s.absellipse(0, 0, 0.18, 0.42, 0, Math.PI * 2);
  const sola = new THREE.ExtrudeGeometry(s, { depth: 0.06, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 2, curveSegments: 24 });
  sola.rotateX(Math.PI / 2); tr(sola, 0, 0.08, 0.02);
  // cadarço: tiras brancas cruzando o peito do pé + faixa (swoosh-like) lateral
  const brancos = [sola];
  for (let k = 0; k < 4; k++) { const z = 0.16 - k * 0.075, y = 0.36 + k * 0.04; brancos.push(tr(new THREE.CylinderGeometry(0.014, 0.014, 0.24, 6), 0, y, z, 0.5, 0, Math.PI / 2)); }
  brancos.push(tr(new THREE.TorusGeometry(0.05, 0.012, 6, 12), 0.05, 0.53, -0.08, 0, 0, 0.6));
  brancos.push(tr(new THREE.TorusGeometry(0.05, 0.012, 6, 12), -0.05, 0.53, -0.08, 0, 0, -0.6));
  brancos.push(tr(new THREE.SphereGeometry(0.16, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), 0, 0.1, 0.33, Math.PI / 2 - 0.2, 0, 0, [1.05, 1, 0.55]));
  // mola helicoidal + base
  class Helice extends THREE.Curve { getPoint(t, o = new THREE.Vector3()) { const a = t * Math.PI * 2 * 4.5; return o.set(Math.cos(a) * 0.12, 0.02 - t * 0.34, Math.sin(a) * 0.12); } }
  const mola = junta([new THREE.TubeGeometry(new Helice(), 90, 0.024, 7, false), tr(new THREE.CylinderGeometry(0.16, 0.16, 0.035, 22), 0, -0.34, 0)]);
  const g = new THREE.Group(), pe = new THREE.Group();
  pe.add(malha(junta(brancos), branco), malha(cabedal, verde), malha(mola, prata));
  pe.position.y = 0.08; pe.rotation.y = 1.1; // de lado por padrão
  g.add(pe); enfeites(g, 'tenis'); PROTO.tenis = g;
}

// ---------- ESTRELA 2x ----------
{
  const ouro = std({ color: 0xffc23a, metalness: 1, roughness: 0.22, emissive: 0x5a3800, emissiveIntensity: 0.6 });
  const prof = 0.12, bev = 0.06;
  const eg = new THREE.ExtrudeGeometry(estrelaShape(0.56, 0.26), { depth: prof, bevelEnabled: true, bevelThickness: bev, bevelSize: 0.05, bevelSegments: 3 });
  eg.translate(0, 0, -prof / 2);
  // textura "2x" (branco com contorno escuro) nas duas faces
  const [c2, x2] = canvas(256, 192);
  x2.font = '900 150px Arial Black, Arial, sans-serif'; x2.textAlign = 'center'; x2.textBaseline = 'middle';
  x2.lineJoin = 'round'; x2.lineWidth = 22; x2.strokeStyle = '#7a3d00'; x2.strokeText('2x', 128, 100);
  x2.fillStyle = '#fff'; x2.fillText('2x', 128, 100);
  const mat2x = new THREE.MeshBasicMaterial({ map: texCanvas(c2), transparent: true, depthWrite: false, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -2 });
  const z = prof / 2 + bev + 0.004;
  const placas = junta([tr(new THREE.PlaneGeometry(0.52, 0.39), 0, -0.03, z), tr(new THREE.PlaneGeometry(0.52, 0.39), 0, -0.03, -z, 0, Math.PI, 0)]);
  const g = new THREE.Group();
  g.add(malha(eg, ouro), malha(placas, mat2x, false));
  enfeites(g, 'dobro'); PROTO.dobro = g;
}

export function criaVisualPoder(k) { return (PROTO[k] || PROTO.dobro).clone(); }

// pulsação suave do halo e do anel (mexe só nos materiais/textura compartilhados)
export function animaItens(t) {
  const p = 0.5 + 0.5 * Math.sin(t * 3.2);
  for (const k in matHalo) { matHalo[k].opacity = 0.5 + 0.3 * p; matAnel[k].opacity = 0.55 + 0.4 * p; }
  const s = 1.15 - 0.2 * p; // repeat > 1 encolhe o brilho dentro do sprite
  texHalo.repeat.set(s, s); texHalo.offset.set(0.5 - 0.5 * s, 0.5 - 0.5 * s);
}
