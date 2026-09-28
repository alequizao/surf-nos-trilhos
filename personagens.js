/*
 * Surf nos Trilhos · Desenvolvido por Alequizao <alequizao.dev@gmail.com>
 * https://github.com/alequizao · © 2026 Alequizao. Todos os direitos reservados.
 */
// Surf nos Trilhos — personagens (corredor, vigia e cachorro)
// Modelos estilizados feitos só com primitivas do Three.js (sem arquivos externos).
// Para economizar draw calls no celular, peças estáticas da mesma cor são
// fundidas numa geometria só (função `junta`).
import * as THREE from 'three';

// ================= AJUDANTES =================
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler();
const _p = new THREE.Vector3(), _s = new THREE.Vector3();

// matriz a partir de {p:[x,y,z], r:[x,y,z], s:[x,y,z]}
function matriz(t = {}) {
  _p.set(...(t.p || [0, 0, 0]));
  _q.setFromEuler(_e.set(...(t.r || [0, 0, 0])));
  _s.set(...(t.s || [1, 1, 1]));
  return _m.compose(_p, _q, _s);
}

// funde várias geometrias (cada uma com sua transformação) numa só
function junta(partes) {
  const pos = [], nor = [], uv = [];
  for (const [g0, t] of partes) {
    const g = g0.index ? g0.toNonIndexed() : g0.clone();
    g.applyMatrix4(matriz(t));
    pos.push(...g.attributes.position.array);
    nor.push(...g.attributes.normal.array);
    if (g.attributes.uv) uv.push(...g.attributes.uv.array);
    else for (let i = 0; i < g.attributes.position.count; i++) uv.push(0, 0);
    g.dispose();
  }
  for (const [g0] of partes) g0.dispose();
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  out.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  return out;
}

// cria um Mesh já posicionado e projetando sombra
function malha(geo, mat, t = {}) {
  const m = new THREE.Mesh(geo, mat);
  if (t.p) m.position.set(...t.p);
  if (t.r) m.rotation.set(...t.r);
  if (t.s) m.scale.set(...t.s);
  m.castShadow = true;
  return m;
}

// sólido de revolução; pts = [[raio, y], ...] listados de baixo pra cima
function torno(pts, seg = 20, escZ = 1) {
  const g = new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), seg);
  if (escZ !== 1) g.scale(1, 1, escZ);
  return g;
}

// retângulo com cantos arredondados (Shape 2D)
function retRedondo(w, h, r) {
  const s = new THREE.Shape(), x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
  return s;
}

// extrusão com chanfro arredondado, centralizada na origem
function extruda(shape, prof, bevel, centraliza = true) {
  const g = new THREE.ExtrudeGeometry(shape, {
    depth: prof, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel,
    bevelSegments: 3, curveSegments: 10,
  });
  if (centraliza) g.center();
  return g;
}

// aba de boné/quepe em forma de "D"
function formaAba(larg, comp) {
  const s = new THREE.Shape();
  s.moveTo(-larg, 0);
  s.bezierCurveTo(-larg, comp * 1.3, larg, comp * 1.3, larg, 0);
  return s;
}

const tecido = (c, r = 0.85) => new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: 0 });
const peleMat = c => new THREE.MeshStandardMaterial({ color: c, roughness: 0.55, metalness: 0 });
const escurece = (c, k) => new THREE.Color(c).multiplyScalar(k);
const brilhoMat = c => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.9,
  blending: THREE.AdditiveBlending, depthWrite: false });

// ================= CORREDOR =================
export function criaCorredor(P) {
  const neon = !!P.neon;
  const root = new THREE.Group();
  const corpo = new THREE.Group(); corpo.position.y = 0.95; root.add(corpo);

  // ---- materiais ----
  const mCasaco = tecido(P.casaco, 0.88);
  const mCasacoEsc = tecido(escurece(P.casaco, 0.78), 0.9);
  const mCalca = tecido(P.calca, 0.8);
  const mPele = peleMat(P.pele);
  const mCabelo = tecido(P.cabelo, 0.7);
  const mBone = tecido(P.bone, 0.65);
  const mTenis = tecido(P.tenis, 0.6);
  const mSola = tecido(0xf4f2ec, 0.7);
  const corListra = P.tenis === 0xffffff ? P.bone : 0xffffff;
  const mListra = tecido(corListra, 0.6);
  const mMochila = tecido(P.mochila, 0.75);
  const mMochilaEsc = tecido(escurece(P.mochila, 0.6), 0.8);
  const mZiper = new THREE.MeshStandardMaterial({ color: 0xc9ccd2, roughness: 0.35, metalness: 0.7 });
  const mCordao = tecido(neon ? P.bone : 0xf6f6f6, 0.7);
  const mOlhoB = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 });
  const mIris = new THREE.MeshStandardMaterial({ color: 0x2a1a10, roughness: 0.25 });
  const mBrilho = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const mBoca = tecido(0x8a2f2a, 0.6);
  if (neon) {
    // Nina Neon: bordas e detalhes brilhando
    const acende = (m, c, k) => { m.emissive = new THREE.Color(c); m.emissiveIntensity = k; };
    acende(mBone, P.bone, 0.9); acende(mTenis, P.tenis, 0.7); acende(mListra, P.mochila, 0.9);
    acende(mCordao, P.bone, 1.2); acende(mCasacoEsc, P.bone, 0.9); mCasacoEsc.color.set(P.bone);
    acende(mMochila, P.mochila, 0.35); acende(mMochilaEsc, P.bone, 0.8); mMochilaEsc.color.set(P.bone);
    acende(mCabelo, P.cabelo, 0.25);
  }

  // ---- tronco: moletom com capuz ----
  const tronco = new THREE.Group(); corpo.add(tronco);
  tronco.add(malha(torno([
    [0, -0.05], [0.25, -0.05], [0.29, -0.01], [0.29, 0.05], [0.268, 0.09], [0.27, 0.28],
    [0.295, 0.46], [0.315, 0.58], [0.31, 0.67], [0.25, 0.75], [0.13, 0.8], [0, 0.81],
  ], 22, 0.64), mCasaco));
  // capuz dobrado em volta do pescoço (caindo mais atrás)
  tronco.add(malha(new THREE.TorusGeometry(0.155, 0.07, 10, 22), mCasaco,
    { p: [0, 0.755, 0.035], r: [Math.PI / 2 - 0.25, 0, 0], s: [1.1, 0.95, 1] }));
  // bolso canguru (trapézio chanfrado)
  const bolso = new THREE.Shape();
  bolso.moveTo(-0.2, 0); bolso.lineTo(0.2, 0); bolso.lineTo(0.14, 0.19); bolso.lineTo(-0.14, 0.19); bolso.lineTo(-0.2, 0);
  tronco.add(malha(extruda(bolso, 0.015, 0.014), mCasacoEsc, { p: [0, 0.2, -0.172], r: [-0.06, 0, 0] }));
  // cordões do capuz com ponteiras
  const cord = new THREE.CapsuleGeometry(0.011, 0.17, 3, 6);
  const ponta = new THREE.CylinderGeometry(0.018, 0.018, 0.04, 8);
  tronco.add(malha(junta([
    [cord.clone(), { p: [-0.065, 0.62, -0.205], r: [-0.12, 0, 0.05] }],
    [cord, { p: [0.065, 0.61, -0.205], r: [-0.12, 0, -0.08] }],
    [ponta.clone(), { p: [-0.07, 0.515, -0.192] }],
    [ponta, { p: [0.057, 0.505, -0.193] }],
  ]), mCordao));

  // ---- mochila ----
  tronco.add(malha(extruda(retRedondo(0.4, 0.46, 0.13), 0.1, 0.06), mMochila, { p: [0, 0.42, 0.32] }));
  const alca = new THREE.TorusGeometry(0.2, 0.03, 6, 16, Math.PI);
  const alcaFrente = new THREE.CapsuleGeometry(0.03, 0.26, 3, 8);
  tronco.add(malha(junta([
    [extruda(retRedondo(0.3, 0.19, 0.07), 0.035, 0.025), { p: [0, 0.3, 0.45] }],
    [alca.clone(), { p: [-0.18, 0.6, 0.02], r: [0, Math.PI / 2, 0] }],
    [alca, { p: [0.18, 0.6, 0.02], r: [0, Math.PI / 2, 0] }],
    [alcaFrente.clone(), { p: [-0.18, 0.46, -0.185], r: [0.12, 0, 0] }],
    [alcaFrente, { p: [0.18, 0.46, -0.185], r: [0.12, 0, 0] }],
  ]), mMochilaEsc));
  const ziperLinha = new THREE.CapsuleGeometry(0.009, 0.3, 3, 6);
  const puxador = new THREE.CapsuleGeometry(0.014, 0.04, 3, 6);
  tronco.add(malha(junta([
    [ziperLinha.clone(), { p: [0, 0.58, 0.42], r: [0.6, 0, Math.PI / 2] }],
    [puxador.clone(), { p: [0.1, 0.55, 0.44], r: [0.3, 0, 0] }],
    [ziperLinha, { p: [0, 0.39, 0.495], r: [0, 0, Math.PI / 2], s: [1, 0.75, 1] }],
    [puxador, { p: [-0.08, 0.36, 0.5] }],
  ]), mZiper));

  // ---- cabeça ----
  const cabeca = new THREE.Group(); cabeca.position.y = 0.78; tronco.add(cabeca);
  const orelha = new THREE.SphereGeometry(0.06, 10, 8);
  cabeca.add(malha(junta([
    [new THREE.CylinderGeometry(0.085, 0.095, 0.2, 14), { p: [0, 0.04, 0.01] }],        // pescoço
    [new THREE.SphereGeometry(0.26, 28, 20), { p: [0, 0.32, 0], s: [1, 1.06, 0.98] }],  // crânio
    [orelha.clone(), { p: [-0.255, 0.3, 0.01], s: [0.5, 1, 0.8] }],
    [orelha, { p: [0.255, 0.3, 0.01], s: [0.5, 1, 0.8] }],
    [new THREE.SphereGeometry(0.036, 10, 8), { p: [0, 0.25, -0.253], s: [0.9, 1, 1] }], // nariz
  ]), mPele));
  // cabelo: casca atrás e dos lados, aparecendo sob o boné
  cabeca.add(malha(new THREE.SphereGeometry(0.268, 24, 10, -0.45, Math.PI + 0.9, Math.PI * 0.3, Math.PI * 0.31), mCabelo,
    { p: [0, 0.33, 0.012], s: [1, 1.04, 1] }));
  // boné virado pra trás: copa + aba + botão
  cabeca.add(malha(junta([
    [new THREE.SphereGeometry(0.278, 26, 12, 0, Math.PI * 2, 0, Math.PI * 0.47), { p: [0, 0.37, 0], s: [1, 0.98, 1] }],
    [extruda(formaAba(0.2, 0.2), 0.012, 0.01, false), { p: [0, 0.39, 0.16], r: [Math.PI / 2 + 0.2, 0, 0] }],
    [new THREE.SphereGeometry(0.032, 10, 6), { p: [0, 0.64, 0] }],
    [new THREE.TorusGeometry(0.276, 0.02, 6, 32), { p: [0, 0.405, 0], r: [Math.PI / 2, 0, 0] }], // debrum
  ]), mBone));
  // olhos: branco + íris + brilho
  const olhoB = new THREE.SphereGeometry(0.055, 14, 10);
  cabeca.add(malha(junta([
    [olhoB.clone(), { p: [-0.095, 0.3, -0.224], s: [1, 1.2, 0.5] }],
    [olhoB, { p: [0.095, 0.3, -0.224], s: [1, 1.2, 0.5] }],
  ]), mOlhoB));
  const iris = new THREE.SphereGeometry(0.033, 12, 8);
  cabeca.add(malha(junta([
    [iris.clone(), { p: [-0.09, 0.296, -0.245], s: [1, 1.1, 0.45] }],
    [iris, { p: [0.09, 0.296, -0.245], s: [1, 1.1, 0.45] }],
  ]), mIris));
  const pontoLuz = new THREE.SphereGeometry(0.011, 6, 4);
  cabeca.add(malha(junta([
    [pontoLuz.clone(), { p: [-0.078, 0.31, -0.259] }],
    [pontoLuz, { p: [0.102, 0.31, -0.259] }],
  ]), mBrilho));
  // sobrancelhas
  const sob = new THREE.CapsuleGeometry(0.014, 0.065, 3, 6);
  cabeca.add(malha(junta([
    [sob.clone(), { p: [-0.098, 0.372, -0.232], r: [0.35, 0, Math.PI / 2 - 0.12] }],
    [sob, { p: [0.098, 0.372, -0.232], r: [0.35, 0, Math.PI / 2 + 0.12] }],
  ]), mCabelo));
  // boca sorrindo (arco de toro)
  const arco = Math.PI * 0.62;
  cabeca.add(malha(new THREE.TorusGeometry(0.05, 0.011, 6, 12, arco), mBoca,
    { p: [0, 0.2, -0.232], r: [0.3, 0, -Math.PI / 2 - arco / 2] }));

  // ---- braços (pivô no ombro, membro pende pra -y) ----
  const manga = torno([
    [0, -0.43], [0.084, -0.43], [0.088, -0.36], [0.094, -0.2], [0.1, -0.04], [0.09, 0.03], [0.05, 0.065], [0, 0.07],
  ], 16);
  const punho = new THREE.CylinderGeometry(0.092, 0.088, 0.08, 16);
  const mao = new THREE.SphereGeometry(0.078, 14, 10);
  const braco = x => {
    const piv = new THREE.Group(); piv.position.set(x, 0.66, 0);
    piv.add(malha(manga, mCasaco));
    piv.add(malha(punho, mCasacoEsc, { p: [0, -0.46, 0] }));
    piv.add(malha(mao, mPele, { p: [0, -0.575, -0.005], s: [0.85, 1.12, 0.95] }));
    tronco.add(piv); return piv;
  };
  const bracoE = braco(-0.41), bracoD = braco(0.41);

  // ---- pernas (pivô no quadril) ----
  const calca = torno([
    [0, -0.765], [0.122, -0.765], [0.127, -0.67], [0.112, -0.645], [0.116, -0.5], [0.13, -0.2], [0.14, 0], [0.12, 0.06], [0, 0.08],
  ], 16);
  const cabedal = new THREE.SphereGeometry(0.13, 18, 12);
  const sola = new THREE.CylinderGeometry(0.135, 0.13, 0.055, 20);
  const cadarco = new THREE.CapsuleGeometry(0.012, 0.09, 3, 6);
  const listra = new THREE.CapsuleGeometry(0.016, 0.16, 3, 6);
  const perna = x => {
    const piv = new THREE.Group(); piv.position.set(x, 0, 0);
    piv.add(malha(calca, mCalca));
    piv.add(malha(cabedal, mTenis, { p: [0, -0.835, -0.075], s: [0.92, 0.66, 1.55] }));
    const solaCadarco = junta([
      [sola.clone(), { p: [0, -0.9, -0.075], s: [0.95, 1, 1.6] }],
      [cadarco.clone(), { p: [0, -0.765, -0.14], r: [0.5, 0, Math.PI / 2] }],
      [cadarco.clone(), { p: [0, -0.785, -0.185], r: [0.8, 0, Math.PI / 2] }],
      [cadarco.clone(), { p: [0, -0.81, -0.225], r: [1.0, 0, Math.PI / 2] }],
    ]);
    piv.add(malha(solaCadarco, mSola));
    piv.add(malha(junta([
      [listra.clone(), { p: [-0.118, -0.835, -0.07], r: [Math.PI / 2 - 0.35, 0, 0] }],
      [listra.clone(), { p: [0.118, -0.835, -0.07], r: [Math.PI / 2 - 0.35, 0, 0] }],
    ]), mListra));
    corpo.add(piv); return piv;
  };
  const pernaE = perna(-0.17), pernaD = perna(0.17);
  [cadarco, listra, sola].forEach(g => g.dispose());

  // ---- prancha flutuante (só aparece quando ativa) ----
  const prancha = new THREE.Group();
  const mPrancha = new THREE.MeshStandardMaterial({ color: 0x19c2ff, roughness: 0.35, metalness: 0.2,
    emissive: 0x0a4a66, emissiveIntensity: 0.6 });
  prancha.add(malha(extruda(retRedondo(0.72, 1.7, 0.34), 0.04, 0.03), mPrancha, { p: [0, 0.12, 0], r: [-Math.PI / 2, 0, 0] }));
  const mFaixa = new THREE.MeshStandardMaterial({ color: 0xff3d7f, roughness: 0.5, emissive: 0xff3d7f, emissiveIntensity: 0.35 });
  prancha.add(malha(extruda(retRedondo(0.16, 1.3, 0.08), 0.006, 0.006), mFaixa, { p: [0, 0.178, 0], r: [-Math.PI / 2, 0, 0] }));
  const brilhoPrancha = malha(new THREE.ShapeGeometry(retRedondo(0.86, 1.86, 0.4), 12), brilhoMat(0x6ff0ff),
    { p: [0, 0.05, 0], r: [-Math.PI / 2, 0, 0] });
  brilhoPrancha.material.opacity = 0.55;
  prancha.add(brilhoPrancha);
  prancha.visible = false; root.add(prancha);

  // ---- jato nas costas ----
  const jato = new THREE.Group(); jato.position.set(0, 0.35, 0.45);
  const tanque = new THREE.CapsuleGeometry(0.1, 0.36, 6, 16);
  jato.add(malha(junta([
    [tanque.clone(), { p: [-0.15, 0, 0.12] }],
    [tanque, { p: [0.15, 0, 0.12] }],
  ]), new THREE.MeshStandardMaterial({ color: 0xe8364f, roughness: 0.35, metalness: 0.45 })));
  const anel = new THREE.TorusGeometry(0.103, 0.018, 6, 18);
  const bocal = new THREE.CylinderGeometry(0.06, 0.085, 0.11, 16, 1, true);
  const valvula = new THREE.CylinderGeometry(0.025, 0.025, 0.07, 8);
  const partesMetal = [];
  for (const x of [-0.15, 0.15]) {
    partesMetal.push([anel.clone(), { p: [x, 0.12, 0.12], r: [Math.PI / 2, 0, 0] }]);
    partesMetal.push([anel.clone(), { p: [x, -0.12, 0.12], r: [Math.PI / 2, 0, 0] }]);
    partesMetal.push([bocal.clone(), { p: [x, -0.33, 0.12] }]);
    partesMetal.push([valvula.clone(), { p: [x, 0.3, 0.12] }]);
  }
  partesMetal.push([new THREE.CapsuleGeometry(0.03, 0.22, 3, 8), { p: [0, 0.12, 0.12], r: [0, 0, Math.PI / 2] }]);  // ponte
  partesMetal.push([new THREE.CapsuleGeometry(0.022, 0.3, 3, 8), { p: [0, -0.12, 0.03], r: [0, 0, Math.PI / 2] }]); // alça que prende
  [anel, bocal, valvula].forEach(g => g.dispose());
  jato.add(malha(junta(partesMetal), new THREE.MeshStandardMaterial({ color: 0x2b2f3a, roughness: 0.45, metalness: 0.6 })));
  // chama: cone externo laranja + núcleo claro; a da direita é filha da da esquerda (escala junto)
  const cone = (r, h) => { const g = new THREE.ConeGeometry(r, h, 14, 1, true); g.rotateX(Math.PI); g.translate(0, -h / 2, 0); return g; };
  const gChama = cone(0.075, 0.6), gNucleo = cone(0.04, 0.34);
  const mChama = brilhoMat(0xff8a1a), mNucleo = brilhoMat(0xfff2b0);
  const chama = malha(gChama, mChama, { p: [-0.15, -0.385, 0.12] });
  chama.add(malha(gNucleo, mNucleo));
  const chamaD = malha(gChama, mChama, { p: [0.3, 0, 0] });
  chamaD.add(malha(gNucleo, mNucleo));
  chama.add(chamaD);
  jato.add(chama);
  jato.visible = false; tronco.add(jato);

  return { root, corpo, tronco, cabeca, bracoE, bracoD, pernaE, pernaD, prancha, jato, chama };
}

// ================= VIGIA + CACHORRO =================
export function criaVigia() {
  const root = new THREE.Group();
  const corpo = new THREE.Group(); corpo.position.y = 1.05; root.add(corpo);

  const farda = tecido(0x1e2b4d, 0.85);
  const pele = peleMat(0xd89a72);
  const preto = new THREE.MeshStandardMaterial({ color: 0x17171c, roughness: 0.5 });
  const colete = new THREE.MeshStandardMaterial({ color: 0xc8f02a, roughness: 0.7, emissive: 0x3a4a00, emissiveIntensity: 0.5 });
  const prata = new THREE.MeshStandardMaterial({ color: 0xe4e8ee, roughness: 0.25, metalness: 0.6, emissive: 0x666a70, emissiveIntensity: 0.6 });
  const dourado = new THREE.MeshStandardMaterial({ color: 0xf2c230, roughness: 0.3, metalness: 0.8 });
  const pelo = tecido(0x4a3a2c, 0.8);

  // ---- corpo ----
  const EZ = 0.72; // achatamento frente/costas
  corpo.add(malha(torno([
    [0, -0.06], [0.31, -0.06], [0.35, 0.08], [0.37, 0.35], [0.4, 0.62], [0.39, 0.76], [0.3, 0.87], [0.15, 0.93], [0, 0.94],
  ], 22, EZ), farda));
  // colete refletivo por cima
  corpo.add(malha(torno([
    [0, 0.13], [0.378, 0.13], [0.383, 0.35], [0.412, 0.6], [0.405, 0.74], [0.33, 0.84], [0.22, 0.88], [0.2, 0.88],
  ], 22, EZ), colete));
  // faixas prata horizontais + tiras nos ombros
  const faixa = (y0, y1, r0, r1) => torno([[r0, y0], [r1, y1]], 22, EZ);
  const tira = new THREE.CapsuleGeometry(0.03, 0.3, 3, 8);
  corpo.add(malha(junta([
    [faixa(0.3, 0.36, 0.386, 0.391), {}],
    [faixa(0.45, 0.51, 0.399, 0.405), {}],
    [tira.clone(), { p: [-0.2, 0.7, -0.28], r: [0.35, 0, 0] }],
    [tira, { p: [0.2, 0.7, -0.28], r: [0.35, 0, 0] }],
  ]), prata));
  // cinto + rádio com antena + viseira e faixa do quepe (tudo preto)
  const pretos = [
    [torno([[0.36, 0.0], [0.365, 0.1]], 22, EZ), {}],
    [extruda(retRedondo(0.1, 0.16, 0.03), 0.04, 0.015), { p: [-0.36, 0.13, -0.08], r: [0, 0.5, 0] }],
    [new THREE.CylinderGeometry(0.012, 0.012, 0.16, 6), { p: [-0.38, 0.28, -0.08] }],
    [new THREE.CylinderGeometry(0.28, 0.28, 0.075, 24, 1, true), { p: [0, 1.365, 0] }],
    [extruda(formaAba(0.2, 0.17), 0.012, 0.01, false), { p: [0, 1.335, -0.2], r: [-Math.PI / 2 - 0.35, 0, 0] }],
  ];
  corpo.add(malha(junta(pretos), preto));
  // dourado: fivela, distintivo no peito, emblema do quepe
  corpo.add(malha(junta([
    [extruda(retRedondo(0.09, 0.06, 0.015), 0.01, 0.008), { p: [0, 0.05, -0.27] }],
    [new THREE.CylinderGeometry(0.045, 0.045, 0.015, 6), { p: [0.18, 0.62, -0.3], r: [Math.PI / 2 - 0.2, 0, 0] }],
    [new THREE.CylinderGeometry(0.045, 0.045, 0.015, 12), { p: [0, 1.45, -0.285], r: [Math.PI / 2 - 0.2, 0, 0] }],
  ]), dourado));

  // ---- cabeça ----
  const orelha = new THREE.SphereGeometry(0.065, 10, 8);
  corpo.add(malha(junta([
    [new THREE.CylinderGeometry(0.12, 0.13, 0.16, 14), { p: [0, 0.97, 0] }],
    [new THREE.SphereGeometry(0.27, 26, 18), { p: [0, 1.16, 0], s: [1, 1.08, 0.98] }],
    [orelha.clone(), { p: [-0.265, 1.15, 0.01], s: [0.5, 1, 0.8] }],
    [orelha, { p: [0.265, 1.15, 0.01], s: [0.5, 1, 0.8] }],
    [new THREE.SphereGeometry(0.05, 10, 8), { p: [0, 1.12, -0.268], s: [0.9, 1, 1] }],
  ]), pele));
  // quepe azul (copa alta)
  corpo.add(malha(torno([
    [0.278, 1.33], [0.285, 1.4], [0.32, 1.49], [0.3, 1.52], [0, 1.53],
  ], 24), farda));
  // olhos
  const olhoB = new THREE.SphereGeometry(0.045, 12, 8), pup = new THREE.SphereGeometry(0.027, 10, 6), luz = new THREE.SphereGeometry(0.009, 6, 4);
  corpo.add(malha(junta([
    [olhoB.clone(), { p: [-0.1, 1.2, -0.232], s: [1, 1.05, 0.5] }],
    [olhoB, { p: [0.1, 1.2, -0.232], s: [1, 1.05, 0.5] }],
  ]), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 })));
  corpo.add(malha(junta([
    [pup.clone(), { p: [-0.098, 1.197, -0.25], s: [1, 1, 0.45] }],
    [pup, { p: [0.098, 1.197, -0.25], s: [1, 1, 0.45] }],
  ]), new THREE.MeshStandardMaterial({ color: 0x1a120c, roughness: 0.25 })));
  corpo.add(malha(junta([
    [luz.clone(), { p: [-0.088, 1.208, -0.262] }],
    [luz, { p: [0.108, 1.208, -0.262] }],
  ]), new THREE.MeshBasicMaterial({ color: 0xffffff })));
  // sobrancelhas grossas, bigode e costeletas
  const sob = new THREE.CapsuleGeometry(0.02, 0.08, 3, 6);
  const big = new THREE.CapsuleGeometry(0.032, 0.1, 4, 8);
  const cost = new THREE.CapsuleGeometry(0.03, 0.08, 3, 6);
  corpo.add(malha(junta([
    [sob.clone(), { p: [-0.1, 1.265, -0.24], r: [0.3, 0, Math.PI / 2 + 0.15] }],
    [sob, { p: [0.1, 1.265, -0.24], r: [0.3, 0, Math.PI / 2 - 0.15] }],
    [big.clone(), { p: [-0.055, 1.065, -0.255], r: [0, 0.3, Math.PI / 2 + 0.3] }],
    [big, { p: [0.055, 1.065, -0.255], r: [0, -0.3, Math.PI / 2 - 0.3] }],
    [cost.clone(), { p: [-0.255, 1.25, 0.03] }],
    [cost, { p: [0.255, 1.25, 0.03] }],
    [new THREE.SphereGeometry(0.27, 20, 8, 0, Math.PI, Math.PI * 0.42, Math.PI * 0.14), { p: [0, 1.16, 0.01], s: [1.03, 1.08, 1.02] }], // nuca
  ]), pelo));

  // ---- pernas ----
  const gCalca = new THREE.CapsuleGeometry(0.145, 0.62, 4, 14);
  const gBota = junta([
    [new THREE.SphereGeometry(0.15, 16, 10), { p: [0, -0.955, -0.06], s: [0.95, 0.62, 1.45] }],
    [new THREE.CylinderGeometry(0.155, 0.15, 0.05, 18), { p: [0, -1.025, -0.06], s: [0.95, 1, 1.5] }],
    [new THREE.CylinderGeometry(0.135, 0.14, 0.14, 14), { p: [0, -0.88, 0] }], // cano da bota
  ]);
  const perna = x => {
    const p = new THREE.Group(); p.position.set(x, 0, 0);
    p.add(malha(gCalca, farda, { p: [0, -0.42, 0] }));
    p.add(malha(gBota, preto));
    corpo.add(p); return p;
  };
  const pE = perna(-0.19), pD = perna(0.19);

  // ---- braços ----
  const gManga = new THREE.CapsuleGeometry(0.105, 0.42, 4, 14);
  const gMao = new THREE.SphereGeometry(0.095, 12, 10);
  const braco = x => {
    const p = new THREE.Group(); p.position.set(x, 0.78, 0);
    p.add(malha(gManga, farda, { p: [0, -0.28, 0] }));
    p.add(malha(gMao, pele, { p: [0, -0.64, 0], s: [0.9, 1.1, 1] }));
    corpo.add(p); return p;
  };
  const bE = braco(-0.5), bD = braco(0.5);
  // lanterna na mão direita
  bD.add(malha(junta([
    [new THREE.CylinderGeometry(0.045, 0.045, 0.3, 12), { p: [0, -0.66, -0.12], r: [Math.PI / 2, 0, 0] }],
    [new THREE.CylinderGeometry(0.075, 0.05, 0.09, 14, 1, true), { p: [0, -0.66, -0.3], r: [-Math.PI / 2, 0, 0] }],
  ]), preto));
  bD.add(malha(new THREE.CircleGeometry(0.07, 16), new THREE.MeshStandardMaterial({ color: 0xfff1a8, emissive: 0xffe066, emissiveIntensity: 1.4 }),
    { p: [0, -0.66, -0.34], r: [0, Math.PI, 0] }));

  // ---- cachorro caramelo ----
  const cao = new THREE.Group(); cao.position.set(1.0, 0, 0.3);
  const caramelo = tecido(0xc98a45, 0.9), creme = tecido(0xf0d2a0, 0.9), marrom = tecido(0x8e5526, 0.9);
  cao.add(malha(junta([
    [new THREE.CapsuleGeometry(0.19, 0.42, 6, 16), { p: [0, 0.6, 0.02], r: [Math.PI / 2, 0, 0] }],   // corpo
    [new THREE.SphereGeometry(0.14, 14, 10), { p: [0, 0.74, -0.3] }],                                   // pescoço
    [new THREE.SphereGeometry(0.17, 18, 14), { p: [0, 0.88, -0.44], s: [1, 0.95, 1.05] }],             // cabeça
    [new THREE.CapsuleGeometry(0.038, 0.26, 4, 8), { p: [0, 0.83, 0.47], r: [0.75, 0, 0] }],           // rabo
  ]), caramelo));
  cao.add(malha(junta([
    [new THREE.SphereGeometry(0.095, 14, 10), { p: [0, 0.8, -0.6], s: [0.9, 0.78, 1.35] }],            // focinho
    [new THREE.SphereGeometry(0.13, 14, 10), { p: [0, 0.55, -0.26], s: [0.95, 1, 0.8] }],             // peito
  ]), creme));
  const gOrelha = new THREE.SphereGeometry(0.08, 10, 8);
  cao.add(malha(junta([
    [gOrelha.clone(), { p: [-0.13, 0.99, -0.42], r: [0, 0, 0.45], s: [0.45, 1.2, 0.9] }],
    [gOrelha, { p: [0.13, 0.99, -0.42], r: [0, 0, -0.45], s: [0.45, 1.2, 0.9] }],
  ]), marrom));
  const gOlhoCao = new THREE.SphereGeometry(0.03, 10, 8);
  cao.add(malha(junta([
    [new THREE.SphereGeometry(0.038, 10, 8), { p: [0, 0.83, -0.72], s: [1.2, 0.9, 1] }],               // nariz
    [gOlhoCao.clone(), { p: [-0.075, 0.93, -0.57] }],
    [gOlhoCao, { p: [0.075, 0.93, -0.57] }],
  ]), new THREE.MeshStandardMaterial({ color: 0x14100d, roughness: 0.3 })));
  cao.add(malha(new THREE.SphereGeometry(0.04, 10, 6), tecido(0xe86a7a, 0.5), { p: [0.02, 0.73, -0.62], s: [0.8, 0.3, 1.4], r: [0.4, 0, 0] })); // língua
  cao.add(malha(new THREE.TorusGeometry(0.13, 0.028, 8, 20), tecido(0xd42a2a, 0.6), { p: [0, 0.76, -0.33], r: [Math.PI / 2 - 0.6, 0, 0] })); // coleira
  // patas: pivô no topo, perna pende pra baixo
  const gPata = new THREE.CapsuleGeometry(0.055, 0.32, 4, 10);
  const gPe = new THREE.SphereGeometry(0.066, 10, 8);
  const patas = [[-0.11, -0.22], [0.11, -0.22], [-0.11, 0.26], [0.11, 0.26]].map(([x, z]) => {
    const piv = new THREE.Group(); piv.position.set(x, 0.48, z);
    piv.add(malha(gPata, caramelo, { p: [0, -0.21, 0] }));
    piv.add(malha(gPe, creme, { p: [0, -0.445, -0.02], s: [1, 0.55, 1.3] }));
    cao.add(piv); return piv;
  });
  root.add(cao);

  return { root, corpo, pE, pD, bE, bD, cao, patas };
}
