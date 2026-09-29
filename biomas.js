/*
 * Surf nos Trilhos · Desenvolvido por Alequizao <alequizao.dev@gmail.com>
 * https://github.com/alequizao · © 2026 Alequizao. Todos os direitos reservados.
 */
// Biomas da pista (só visual, nada de colisão): Túnel do Farol, ponte sobre a Lagoa Mundaú e ciclo dia → pôr do sol → noite → amanhecer.
// Adaptado do Trilhos para o cenário de Maceió (coqueiros, muros grafitados, prédios da orla).
// Geometrias e materiais são criados uma vez e compartilhados por todos os trechos (só liga/desliga visibilidade).
import * as THREE from 'three';
import { criaClima } from './clima.js?v=1.1.6';

const CICLO = 1680;                    // a cada 1,68 km: cidade → túnel → cidade → ponte → cidade
const FAIXAS = { tunel: [640, 880], ponte: [1280, 1520] };
const CICLO_DIA = 3000;                // dia completo a cada 3 km
const W = 7.4, PAREDE = 6, ARCO = 6.6; // túnel: meia largura, altura da parede, flecha do arco (topo em 12,6 m: cabe o jato)
const MX = 60, MY = 22;                // morro sobre o túnel (semi-elipse)
const YAGUA = -22;

const mod = (a, n) => ((a % n) + n) % n;
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// ---------- texturas por canvas ----------
function tela(w, h, fn, rep = true) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; fn(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  if (rep) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}
let _s = 91; const r = (a = 0, b = 1) => { _s = _s * 16807 % 2147483647; return a + (_s - 1) / 2147483646 * (b - a); };
function ruido(g, w, h, n, a, tam = 3) {
  for (let i = 0; i < n; i++) { const v = r() < .5 ? 255 : 0; g.fillStyle = `rgba(${v},${v},${v},${r(0, a)})`; g.fillRect(r(0, w), r(0, h), r(1, tam), r(1, tam)); }
}
const texConc = tela(256, 256, (g, w, h) => { // concreto do túnel/ponte, com juntas e manchas de umidade
  g.fillStyle = '#8f8a82'; g.fillRect(0, 0, w, h); ruido(g, w, h, 5000, .18);
  for (let i = 0; i < 14; i++) { const x = r(0, w), gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, 'rgba(40,36,30,0)'); gr.addColorStop(1, 'rgba(40,36,30,.35)'); g.fillStyle = gr; g.fillRect(x, r(0, h * .5), r(6, 24), h); }
  g.fillStyle = 'rgba(30,28,25,.55)'; g.fillRect(0, 0, w, 3); g.fillRect(0, 0, 3, h);
});
const texRocha = tela(256, 256, (g, w, h) => {
  g.fillStyle = '#7d6b58'; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 70; i++) { const c = 90 + r(-25, 25) | 0; g.fillStyle = `rgb(${c + 25},${c + 8},${c - 10})`; g.beginPath(); g.ellipse(r(0, w), r(0, h), r(8, 30), r(6, 18), r(0, 3), 0, 7); g.fill(); }
  ruido(g, w, h, 4000, .25); g.strokeStyle = 'rgba(40,30,22,.5)'; g.lineWidth = 2;
  for (let i = 0; i < 18; i++) { g.beginPath(); let x = r(0, w), y = r(0, h); g.moveTo(x, y); for (let k = 0; k < 4; k++) g.lineTo(x += r(-20, 20), y += r(5, 22)); g.stroke(); }
});
const texMorro = tela(256, 256, (g, w, h) => { // mata atlântica da encosta do Farol por cima do túnel
  g.fillStyle = '#4f7f34'; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 260; i++) { const k = r(); g.fillStyle = k < .2 ? 'rgba(170,140,90,.45)' : k < .65 ? 'rgba(40,90,35,.6)' : 'rgba(110,165,60,.5)'; g.beginPath(); g.arc(r(0, w), r(0, h), r(3, 14), 0, 7); g.fill(); }
  ruido(g, w, h, 3000, .2);
});
const texAgua = tela(256, 256, (g, w, h) => {
  const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#2f6f6a'); gr.addColorStop(.5, '#3a7e72'); gr.addColorStop(1, '#2f6f6a'); // lagoa Mundaú: verde-esmeralda
  g.fillStyle = gr; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 220; i++) { g.strokeStyle = `rgba(255,255,255,${r(.05, .25)})`; g.lineWidth = r(1, 2); const x = r(0, w), y = r(0, h), l = r(8, 30); g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + l / 2, y - 2, x + l, y); g.stroke(); }
});
const texBrilho = tela(64, 64, (g, w, h) => {
  const q = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  q.addColorStop(0, 'rgba(255,240,200,1)'); q.addColorStop(.25, 'rgba(255,210,130,.55)'); q.addColorStop(1, 'rgba(255,190,100,0)');
  g.fillStyle = q; g.fillRect(0, 0, w, h);
}, false);
function placaTex(txt, fundo) { // placa de trânsito (verde = via, marrom = ponto turístico)
  return tela(256, 64, (g, w, h) => {
    g.fillStyle = fundo; g.fillRect(0, 0, w, h); g.strokeStyle = '#fff'; g.lineWidth = 4; g.strokeRect(5, 5, w - 10, h - 10);
    g.fillStyle = '#fff'; let fs = 38; do g.font = `bold ${fs}px "Lilita One", Impact, sans-serif`; while (g.measureText(txt).width > w - 28 && --fs > 12); g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(txt, w / 2, h / 2 + 2);
  }, false);
}
const texPlaca = placaTex('TÚNEL DO FAROL', '#1f5b33');
const texPlacaPonte = placaTex('LAGOA MUNDAÚ', '#6b3a1e');

// ---------- materiais ----------
const std = o => new THREE.MeshStandardMaterial(o);
const MAT = {
  conc: std({ map: texConc, roughness: 0.95, vertexColors: true }),
  rocha: std({ map: texRocha, roughness: 1, side: THREE.DoubleSide }),
  morro: std({ map: texMorro, roughness: 1 }),
  aco: std({ color: 0xffffff, vertexColors: true, metalness: 0.45, roughness: 0.5 }),
  agua: std({ map: texAgua, color: 0xbfe2ee, roughness: 0.12, metalness: 0.25 }),
  lampada: new THREE.MeshBasicMaterial({ color: 0xffd27a, toneMapped: false }),
  brilhoTunel: new THREE.MeshBasicMaterial({ map: texBrilho, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, opacity: 0.9 }),
  brilhoPoste: new THREE.MeshBasicMaterial({ map: texBrilho, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, opacity: 0 }),
  lampPoste: new THREE.MeshBasicMaterial({ color: 0x9a9a92, toneMapped: false }),
  placa: std({ map: texPlaca, roughness: 0.6 }),
  placaPonte: std({ map: texPlacaPonte, roughness: 0.6 }),
};

// ---------- montagem de geometrias (junta tudo num buffer com cor por vértice) ----------
const _q = new THREE.Quaternion(), _e = new THREE.Euler(), _v = new THREE.Vector3(), _s3 = new THREE.Vector3();
const mtx = (x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) =>
  new THREE.Matrix4().compose(_v.set(x, y, z), _q.setFromEuler(_e.set(rx, ry, rz)), _s3.set(sx, sy, sz));
function junta(partes) { // [geometria, matriz?, cor?, escalaUV?]
  let n = 0;
  const qs = partes.map(([g, m, c, su]) => { const q = g.index ? g.toNonIndexed() : g.clone(); if (m) q.applyMatrix4(m); n += q.attributes.position.count; return [q, c || [1, 1, 1], su || 1]; });
  const P = new Float32Array(n * 3), N = new Float32Array(n * 3), U = new Float32Array(n * 2), C = new Float32Array(n * 3);
  let o = 0;
  for (const [q, c, su] of qs) {
    const k = q.attributes.position.count;
    P.set(q.attributes.position.array, o * 3); N.set(q.attributes.normal.array, o * 3);
    if (q.attributes.uv) for (let i = 0; i < k * 2; i++) U[o * 2 + i] = q.attributes.uv.array[i] * su;
    for (let i = 0; i < k; i++) C.set(c, (o + i) * 3);
    o += k; q.dispose();
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.BufferAttribute(N, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(U, 2)); g.setAttribute('color', new THREE.BufferAttribute(C, 3));
  return g;
}
const BOX = new THREE.BoxGeometry(1, 1, 1), CIL = new THREE.CylinderGeometry(1, 1, 1, 8), PLANO = new THREE.PlaneGeometry(1, 1);
const caixa = (w, h, d, x, y, z, c, su) => [BOX, mtx(x, y, z, 0, 0, 0, w, h, d), c, su];
function viga(x, y0, z0, y1, z1, e, c) { // barra entre dois pontos no plano YZ
  const dy = y1 - y0, dz = z1 - z0, L = Math.hypot(dy, dz);
  return [BOX, mtx(x, (y0 + y1) / 2, (z0 + z1) / 2, Math.atan2(dz, dy), 0, 0, e, L, e), c];
}
// perfil do túnel (paredes retas + arco elíptico), de (W,0) até (-W,0)
function perfilTunel(w = W, p = PAREDE, a = ARCO, n = 18) {
  const pts = [[w, 0, -1, 0], [w, p, -1, 0]];
  for (let i = 0; i <= n; i++) { const t = i / n * Math.PI, c = Math.cos(t), s = Math.sin(t), nx = -c / w, ny = -s / a, l = Math.hypot(nx, ny); pts.push([w * c, p + a * s, nx / l, ny / l]); }
  pts.push([-w, p, 1, 0], [-w, 0, 1, 0]);
  return pts;
}
function casca(pts, comp, uvEsc, cor = () => [1, 1, 1]) { // extruda um perfil ao longo de z (0 → -comp)
  const P = [], N = [], U = [], C = [];
  let s = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1], sb = s + Math.hypot(b[0] - a[0], b[1] - a[1]);
    const v = [[a, s, 0], [b, sb, 0], [b, sb, -comp], [a, s, 0], [b, sb, -comp], [a, s, -comp]];
    for (const [q, ss, z] of v) { P.push(q[0], q[1], z); N.push(q[2], q[3], 0); U.push(ss / uvEsc, -z / uvEsc); C.push(...cor(q[0], q[1])); }
    s = sb;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2)); g.setAttribute('color', new THREE.Float32BufferAttribute(C, 3));
  return g;
}

export function criaBiomas({ scene, sol, hemi, ceu, matCeu, M, G, TRECHO, renderer, camera, fraco, audio, somAtivo }) {
  // ======== TÚNEL ========
  const perf = perfilTunel();
  const cascaGeo = casca(perf, TRECHO, 4, (x, y) => { const k = y < 1.2 ? 0.55 : y < 2 ? 0.8 : 1; return [k, k * 0.97, k * 0.92]; });
  const tunelGeo = (() => { // casca + passeio de serviço + canos
    const cano = [];
    for (const sx of [-1, 1]) {
      cano.push(caixa(1.1, 0.5, TRECHO, sx * 6.85, 0.25, -TRECHO / 2, [0.8, 0.78, 0.74], 0.25));
      for (const y of [2.6, 2.95]) cano.push([CIL, mtx(sx * 7.25, y, -TRECHO / 2, Math.PI / 2, 0, 0, 0.08, TRECHO, 0.08), [0.35, 0.33, 0.3]]);
    }
    return junta([[cascaGeo], ...cano]);
  })();
  const lampTunel = [], brilhoTunel = [];
  for (let z = -2.5; z > -TRECHO; z -= 5) {
    for (const sx of [-1, 1]) {
      const x = sx * 3.1, y = PAREDE + ARCO * Math.sqrt(1 - (x / W) ** 2) - 0.12;
      lampTunel.push(caixa(0.35, 0.12, 1.6, x, y, z));
      brilhoTunel.push([PLANO, mtx(x, y - 0.2, z + 0.9, 0, 0, 0, 2.6, 2.6, 1)]);
      if (Math.round(z / 5) % 2 === 0) { // arandelas nas paredes, passam rente à câmera
        lampTunel.push(caixa(0.12, 0.28, 0.9, sx * 7.32, 4.6, z));
        brilhoTunel.push([PLANO, mtx(sx * 7.2, 4.6, z + 0.5, 0, 0, 0, 1.8, 1.8, 1)]);
      }
    }
  }
  const lampTunelGeo = junta(lampTunel), brilhoTunelGeo = junta(brilhoTunel);
  const morroGeo = (() => {
    const pts = [];
    for (let i = 0; i <= 24; i++) { const t = Math.PI - i / 24 * Math.PI, c = Math.cos(t), s = Math.sin(t), nx = c / MX, ny = s / MY, l = Math.hypot(nx, ny); pts.push([MX * c, MY * s * (1 + 0.06 * Math.sin((24 - i) * 1.7)), nx / l, ny / l]); }
    return casca(pts, TRECHO, 10);
  })();
  const bocaGeo = (() => { // paredão de pedra com a boca + moldura de concreto + placa
    const sh = new THREE.Shape(); sh.moveTo(-MX, 0);
    for (let i = 0; i <= 24; i++) { const t = Math.PI - i / 24 * Math.PI; sh.lineTo(MX * Math.cos(t), MY * Math.sin(t) * (1 + 0.06 * Math.sin((24 - i) * 1.7))); }
    const furo = new THREE.Path(); perf.forEach((p, i) => i ? furo.lineTo(p[0], p[1]) : furo.moveTo(p[0], p[1])); sh.holes.push(furo);
    const face = new THREE.ShapeGeometry(sh, 4);
    const moldura = new THREE.Shape(); const ext = perfilTunel(W + 1.3, PAREDE, ARCO + 1.3);
    ext.forEach((p, i) => i ? moldura.lineTo(p[0], p[1]) : moldura.moveTo(p[0], p[1]));
    const f2 = new THREE.Path(); perf.forEach((p, i) => i ? f2.lineTo(p[0], p[1]) : f2.moveTo(p[0], p[1])); moldura.holes.push(f2);
    const mold = new THREE.ExtrudeGeometry(moldura, { depth: 1.2, bevelEnabled: false, curveSegments: 4 });
    return { face: junta([[face, mtx(0, 0, 0.02), [1, 1, 1], 1 / 8]]), moldura: junta([[mold, null, [0.95, 0.93, 0.9], 1 / 4]]) };
  })();
  const placaGeo = junta([caixa(9, 1.8, 0.2, 0, PAREDE + ARCO + 2.2, 1.3)]);

  // ======== PONTE ========
  const concGeoPonte = (() => {
    const p = [], c = [0.92, 0.9, 0.86];
    p.push(caixa(16.8, 1.4, TRECHO, 0, -0.95, -TRECHO / 2, c, 0.25));                   // tabuleiro
    for (const sx of [-1, 1]) p.push(caixa(1.2, 1.8, TRECHO, sx * 4.2, -2.5, -TRECHO / 2, [0.8, 0.78, 0.74], 0.25)); // longarinas
    p.push(caixa(17.5, 1.2, 3.4, 0, -3.8, -TRECHO / 2, c, 0.25));                      // travessa do pilar
    for (const sx of [-1, 1]) p.push(caixa(3, -YAGUA + 1, 2.6, sx * 4.2, (YAGUA - 5) / 2 - 1.2, -TRECHO / 2, [0.85, 0.83, 0.8], 0.25)); // pilares
    return junta(p);
  })();
  const acoGeoPonte = (() => {
    const p = [], ver = [0.72, 0.2, 0.12], cinza = [0.5, 0.52, 0.55], TOPO = 8.2, X = 8;
    for (const sx of [-1, 1]) {
      const x = sx * X;
      p.push(caixa(0.45, 0.5, TRECHO, x, 0.05, -TRECHO / 2, ver), caixa(0.4, 0.4, TRECHO, x, TOPO, -TRECHO / 2, ver));
      for (let z = 0; z >= -TRECHO + 0.1; z -= 8) {
        p.push(caixa(0.36, TOPO, 0.36, x, TOPO / 2, z, ver));
        p.push(Math.round(z / 8) % 2 ? viga(x, 0.1, z, TOPO, z - 8, 0.26, ver) : viga(x, TOPO, z, 0.1, z - 8, 0.26, ver));
      }
      for (let z = -1; z > -TRECHO; z -= 2) p.push(caixa(0.08, 1.1, 0.08, sx * 7.25, 0.35, z, cinza)); // guarda-corpo
      for (const y of [0.55, 0.95]) p.push(caixa(0.08, 0.08, TRECHO, sx * 7.25, y, -TRECHO / 2, cinza));
    }
    return junta(p);
  })();
  const aguaGeo = junta([[PLANO, mtx(0, YAGUA, -TRECHO / 2, -Math.PI / 2, 0, 0, 420, TRECHO, 1), [1, 1, 1], 1]]);
  aguaGeo.attributes.uv.array.forEach((v, i, a) => { a[i] = i % 2 ? v * TRECHO / 16 : v * 420 / 16; });
  // placa marrom (turística) presa no alto da treliça do lado esquerdo, fora do caminho do jato (x ≤ -5,5; jato voa a 8 m sobre os trilhos)
  const placaPonteGeo = junta([caixa(5, 1.25, 0.2, -8, 9.35, -0.4), caixa(0.2, 1.1, 0.2, -9.6, 8.6, -0.4, [0.72, 0.2, 0.12]), caixa(0.2, 1.1, 0.2, -6.4, 8.6, -0.4, [0.72, 0.2, 0.12])]);
  const barrancoGeo = junta([[PLANO, mtx(0, YAGUA / 2 - 1, 0, 0, 0, 0, 2 * MX, -YAGUA + 2, 1), [0.95, 0.9, 0.85], 1]]);
  barrancoGeo.attributes.uv.array.forEach((v, i, a) => { a[i] = i % 2 ? v * 3 : v * 15; });

  // ======== POSTES (cidade, acendem à noite) ========
  const Z_POSTE = -17;
  const posteGeo = junta([-1, 1].flatMap(sx => [
    [CIL, mtx(sx * 8.25, 3.6, Z_POSTE, 0, 0, 0, 0.1, 7.2, 0.1), [0.42, 0.44, 0.46]],
    caixa(2.1, 0.1, 0.1, sx * 7.25, 7.15, Z_POSTE, [0.42, 0.44, 0.46]),
  ]));
  const lampPosteGeo = junta([-1, 1].map(sx => caixa(0.7, 0.14, 0.34, sx * 6.35, 7.05, Z_POSTE)));
  const brilhoPosteGeo = junta([-1, 1].flatMap(sx => [
    [PLANO, mtx(sx * 6.35, 6.9, Z_POSTE + 0.3, 0, 0, 0, 3.2, 3.2, 1)],
    [PLANO, mtx(sx * 5.4, 0.06, Z_POSTE, -Math.PI / 2, 0, 0, 6.5, 7, 1)],
  ]));

  // ======== ESTRELAS ========
  const est = [];
  for (let i = 0; i < 380; i++) { const a = r(0, Math.PI * 2), e = Math.asin(r(0.08, 1)); est.push(Math.cos(a) * Math.cos(e) * 280, Math.sin(e) * 280, Math.sin(a) * Math.cos(e) * 280); }
  const geoEst = new THREE.BufferGeometry(); geoEst.setAttribute('position', new THREE.Float32BufferAttribute(est, 3));
  const matEst = new THREE.PointsMaterial({ color: 0xffffff, size: 2, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false, toneMapped: false });
  const estrelas = new THREE.Points(geoEst, matEst); estrelas.renderOrder = -9; estrelas.frustumCulled = false; estrelas.visible = false; ceu.add(estrelas);
  const fundoMats = []; ceu.traverse(o => { if (o !== ceu && o.material && o.material.color && o !== estrelas) { o.material.userData.c0 = o.material.color.clone(); fundoMats.push(o.material); } });

  // ======== CLIMA (sol / nublado / chuva) — clima.js aplica por cima do ciclo do dia ========
  const clima = criaClima({ scene, sol, hemi, ceu, matCeu, fundoMats, matEst, renderer, camera, fraco, audio, somAtivo, excluir: [MAT.agua, M.sombra] });

  // ======== montagem por trecho ========
  let forcado = null, forcadoIni = -Infinity;
  function biomaEm(d) {
    if (forcado) return d >= forcadoIni ? forcado : 'cidade';
    const p = mod(Math.round(d), CICLO);
    for (const k in FAIXAS) if (p >= FAIXAS[k][0] && p < FAIXAS[k][1]) return k;
    return 'cidade';
  }
  function mesh(g, geo, mat, sombra = false) { const m = new THREE.Mesh(geo, mat); m.receiveShadow = true; m.castShadow = sombra; m.visible = false; g.add(m); return m; }
  function montaTrecho(t) {
    const g = t.g, cidade = [];
    for (const o of g.children) {
      if (o.geometry === G.muroCorpo || o.geometry === G.calcada || o.geometry === t.geoPred || o.material === M.palmeira || t.muros.includes(o)) cidade.push(o); // muro, calçada, prédios, coqueiros e grafites
    }
    const B = t.bio = { cidade, tipo: '' };
    B.tunel = [mesh(g, tunelGeo, MAT.conc), mesh(g, lampTunelGeo, MAT.lampada), mesh(g, brilhoTunelGeo, MAT.brilhoTunel), mesh(g, morroGeo, MAT.morro)];
    B.boca = [mesh(g, bocaGeo.face, MAT.rocha), mesh(g, bocaGeo.moldura, MAT.conc), mesh(g, placaGeo, MAT.placa)];
    B.saida = [mesh(g, bocaGeo.face, MAT.rocha), mesh(g, bocaGeo.moldura, MAT.conc)];
    B.saida.forEach(m => { m.rotation.y = Math.PI; m.position.z = -TRECHO; });
    B.ponte = [mesh(g, concGeoPonte, MAT.conc), mesh(g, acoGeoPonte, MAT.aco, true), mesh(g, aguaGeo, MAT.agua)];
    B.placaPonte = mesh(g, placaPonteGeo, MAT.placaPonte);
    B.barrA = mesh(g, barrancoGeo, MAT.rocha); B.barrB = mesh(g, barrancoGeo, MAT.rocha); B.barrB.position.z = -TRECHO;
    B.postes = [mesh(g, posteGeo, MAT.aco), mesh(g, lampPosteGeo, MAT.lampPoste), mesh(g, brilhoPosteGeo, MAT.brilhoPoste)];
    B.postes[2].castShadow = B.postes[2].receiveShadow = false;
    B.tunel[2].receiveShadow = false;
    [B.tunel[2], B.postes[2]].forEach(m => { m.renderOrder = 2; });
  }
  function ajustaTrecho(t) {
    const B = t.bio; if (!B) return;
    const b = biomaEm(t.d), antes = biomaEm(t.d - TRECHO), depois = biomaEm(t.d + TRECHO);
    const cid = b === 'cidade';
    B.cidade.forEach(o => { o.visible = cid; });
    B.postes.forEach(m => { m.visible = cid; });
    B.tunel.forEach(m => { m.visible = b === 'tunel'; });
    B.boca.forEach(m => { m.visible = b === 'tunel' && antes !== 'tunel'; });
    B.saida.forEach(m => { m.visible = b === 'tunel' && depois !== 'tunel'; });
    B.ponte.forEach(m => { m.visible = b === 'ponte'; });
    B.barrA.visible = B.placaPonte.visible = b === 'ponte' && antes !== 'ponte';
    B.barrB.visible = b === 'ponte' && depois !== 'ponte';
    B.tipo = b;
  }
  // quanto a câmera está "dentro" do túnel (<0 fora, em metros até a borda mais próxima)
  function profTunel(d) {
    const i0 = Math.floor(d / TRECHO);
    if (biomaEm(i0 * TRECHO) !== 'tunel') {
      let m = -40;
      for (const k of [i0 + 1, i0 - 1]) if (biomaEm(k * TRECHO) === 'tunel') m = Math.max(m, -(k > i0 ? k * TRECHO - d : d - (k + 1) * TRECHO));
      return m;
    }
    let a = i0, b = i0; while (a > i0 - 10 && biomaEm((a - 1) * TRECHO) === 'tunel') a--; while (b < i0 + 10 && biomaEm((b + 1) * TRECHO) === 'tunel') b++;
    return Math.min(d - a * TRECHO, (b + 1) * TRECHO - d);
  }

  // ======== ciclo do dia ========
  const C = h => new THREE.Color(h);
  // DIA.nevoa = NEVOA do surf (#dcdcd2, maresia da orla): de dia o cenário fica igual ao de antes
  const DIA = { ceu: C(0xffffff), nevoa: C('#dcdcd2'), solC: C(0xfff0d6), solI: 2.7, hemiC: C(0xd6e6ff), hemiG: C(0x8a7864), hemiI: 0.75, jan: 0.55, env: 0.6, luz: 0, est: 0, exp: 1.05 };
  const POR = { ceu: C(0xffa27a), nevoa: C('#e3a888'), solC: C(0xff9550), solI: 1.7, hemiC: C(0xffc7a4), hemiG: C(0x6a4c40), hemiI: 0.62, jan: 1.3, env: 0.42, luz: 0.55, est: 0.15, exp: 1.08 };
  const NOITE = { ceu: C(0x1d2750), nevoa: C('#1c2640'), solC: C(0x9bb2ff), solI: 0.42, hemiC: C(0x4a5c90), hemiG: C(0x221e18), hemiI: 0.42, jan: 2.8, env: 0.16, luz: 1, est: 1, exp: 1.15 };
  const AMAN = { ceu: C(0xffc6b4), nevoa: C('#dfc0b4'), solC: C(0xffc896), solI: 1.5, hemiC: C(0xe2d4ff), hemiG: C(0x6a5a50), hemiI: 0.58, jan: 1.0, env: 0.4, luz: 0.4, est: 0.1, exp: 1.06 };
  const KEYS = [[0, DIA], [0.38, DIA], [0.47, POR], [0.56, NOITE], [0.83, NOITE], [0.91, AMAN], [0.98, DIA], [1, DIA]];
  const cur = { ceu: new THREE.Color(), nevoa: new THREE.Color(), solC: new THREE.Color(), hemiC: new THREE.Color(), hemiG: new THREE.Color() };
  const CORES = Object.keys(cur);
  const ESCURO_TUNEL = new THREE.Color(0x201a12), HEMI_TUNEL = new THREE.Color(0xffcf8a), HEMI_TUNEL_G = new THREE.Color(0x3a3024);
  const nevoaFundo = new THREE.Color();
  let horaForcada = null, tAgua = 0;
  function mistura(h) {
    let i = 0; while (i < KEYS.length - 2 && h > KEYS[i + 1][0]) i++;
    const [h0, A] = KEYS[i], [h1, Bk] = KEYS[i + 1], t = smooth(h0, h1, h);
    for (const k of CORES) cur[k].copy(A[k]).lerp(Bk[k], t);
    for (const k of ['solI', 'hemiI', 'jan', 'env', 'luz', 'est', 'exp']) cur[k] = A[k] + (Bk[k] - A[k]) * t;
  }
  function atualiza(dist, camZ, dt = 0.016) {
    const h = horaForcada != null ? horaForcada : mod(dist / CICLO_DIA, 1);
    mistura(h);
    const f = smooth(-8, 18, profTunel(-camZ)); // 0 fora, 1 dentro do túnel
    matCeu.color.copy(cur.ceu);
    for (const m of fundoMats) m.color.copy(cur.ceu).lerp(DIA.ceu, 0.15).multiply(m.userData.c0);
    nevoaFundo.copy(cur.nevoa);
    scene.background.copy(nevoaFundo);
    scene.fog.color.copy(nevoaFundo).lerp(ESCURO_TUNEL, f * 0.6);
    sol.color.copy(cur.solC); sol.intensity = cur.solI * (1 - 0.9 * f);
    hemi.color.copy(cur.hemiC).lerp(HEMI_TUNEL, f * 0.8); hemi.groundColor.copy(cur.hemiG).lerp(HEMI_TUNEL_G, f);
    hemi.intensity = cur.hemiI + (0.5 - cur.hemiI) * f;
    scene.environmentIntensity = cur.env * (1 - 0.75 * f);
    M.predio.emissiveIntensity = cur.jan;
    MAT.brilhoPoste.opacity = cur.luz * 0.85;
    MAT.lampPoste.color.setRGB(0.6 + cur.luz * 0.4, 0.6 + cur.luz * 0.3, 0.57 + cur.luz * 0.05);
    matEst.opacity = cur.est; estrelas.visible = cur.est > 0.02;
    renderer.toneMappingExposure = cur.exp + 0.12 * f;
    tAgua += dt; texAgua.offset.set(tAgua * 0.02, tAgua * 0.05);
    if (camera) clima.atualiza({ dist, camZ, tunel: f, noite: cur.luz });
  }

  return {
    montaTrecho, ajustaTrecho, atualiza, biomaEm,
    forca(nome, ini = -Infinity) { forcado = nome && nome !== 'auto' ? nome : null; forcadoIni = ini; },
    hora(h) { horaForcada = h == null ? null : mod(h, 1); },
    clima(nome, ja) { clima.forca(nome, ja); },
    get climaEstado() { return clima.estado; },
  };
}
