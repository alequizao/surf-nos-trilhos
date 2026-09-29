/*
 * Surf nos Trilhos · Desenvolvido por Alequizao <alequizao.dev@gmail.com>
 * https://github.com/alequizao · © 2026 Alequizao. Todos os direitos reservados.
 */
// Clima da corrida (só visual e som, nada de jogabilidade): SOL, NUBLADO e CHUVA.
// É chamado pelo biomas.js DEPOIS do ciclo dia/noite de cada quadro e aplica os ajustes por cima
// (céu cinza, sol fraco, sombra suave, névoa mais densa, gotas, pista molhada, relâmpago e som de chuva).
// Nada é criado por quadro: uma LineSegments de gotas acompanha a câmera e é reaproveitada.
import * as THREE from 'three';

const ALVOS = { sol: [0, 0], nublado: [1, 0], chuva: [1, 1] }; // [nublado, chuva]
const TRANS = 6.5;                       // segundos de transição entre estados
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const LX = 14, Y0 = -6, YH = 18, Z0 = 4, ZD = 46; // caixa das gotas em volta da câmera

export function criaClima({ scene, sol, hemi, ceu, matCeu, fundoMats = [], matEst, renderer, camera, fraco = false, audio, somAtivo, excluir = [] }) {
  // ---------- estado ----------
  let nub = 0, chu = 0, mol = 0;          // valores atuais (0..1)
  let alvo = 'sol', forcado = null, proxD = 0, ultD = 0, iniciou = false;
  let tAnt = performance.now();
  const fogNear = scene.fog.near, fogFar = scene.fog.far;
  const tmp = new THREE.Color(), cinza = new THREE.Color();
  const cinzaDe = (c, k) => { const l = (c.r * 0.3 + c.g * 0.59 + c.b * 0.11) * k; return cinza.setRGB(l * 0.97, l, l * 1.04); };

  function sorteia(d) {
    const x = Math.random();
    if (d < 400) return x < 0.7 ? 'sol' : 'nublado';          // nunca chuva nos primeiros 400 m
    return x < 0.25 ? 'chuva' : x < 0.6 ? 'nublado' : 'sol';
  }

  // ---------- véu de nuvens: cúpula cinza por dentro do céu (opaca no alto, some no horizonte) ----------
  const geoVeu = new THREE.SphereGeometry(285, 24, 12), nv = geoVeu.attributes.position.count, cor4 = new Float32Array(nv * 4);
  for (let i = 0; i < nv; i++) { cor4.set([1, 1, 1, smooth(-0.02, 0.3, geoVeu.attributes.position.getY(i) / 285)], i * 4); }
  geoVeu.setAttribute('color', new THREE.BufferAttribute(cor4, 4));
  const matVeu = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0, side: THREE.BackSide, fog: false, depthWrite: false, toneMapped: false });
  const veu = new THREE.Mesh(geoVeu, matVeu); veu.renderOrder = -8; veu.frustumCulled = false; veu.visible = false;
  if (ceu) ceu.add(veu);

  // ---------- gotas ----------
  const NMAX = fraco ? 520 : 1400;
  let nAtivo = NMAX;
  const px = new Float32Array(NMAX), py = new Float32Array(NMAX), pz = new Float32Array(NMAX), vy = new Float32Array(NMAX), ln = new Float32Array(NMAX);
  for (let i = 0; i < NMAX; i++) {
    px[i] = (Math.random() * 2 - 1) * LX; py[i] = Y0 + Math.random() * YH; pz[i] = Z0 - Math.random() * ZD;
    vy[i] = 20 + Math.random() * 9; ln[i] = 0.55 + Math.random() * 0.5;
  }
  const pos = new Float32Array(NMAX * 6);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
  const matGota = new THREE.LineBasicMaterial({ color: 0xc4d2e0, transparent: true, opacity: 0, depthWrite: false, fog: true });
  const gotas = new THREE.LineSegments(geo, matGota);
  gotas.frustumCulled = false; gotas.visible = false; gotas.renderOrder = 3;
  scene.add(gotas);
  let lentoT = 0, lentoN = 0;

  function animaGotas(dt, vz) {
    const ventoX = 0.9, rastro = Math.min(1.4, vz * 0.025);
    for (let i = 0; i < nAtivo; i++) {
      let y = py[i] - vy[i] * dt, z = pz[i] + vz * dt;
      if (y < Y0) { y += YH; px[i] = (Math.random() * 2 - 1) * LX; }
      if (z > Z0) z -= ZD; else if (z < Z0 - ZD) z += ZD;
      py[i] = y; pz[i] = z;
      const o = i * 6, x = px[i];
      pos[o] = x; pos[o + 1] = y; pos[o + 2] = z;
      pos[o + 3] = x + ln[i] * 0.05 * ventoX; pos[o + 4] = y + ln[i]; pos[o + 5] = z - rastro;
    }
    geo.setDrawRange(0, nAtivo * 2);
    geo.attributes.position.needsUpdate = true;
  }

  // ---------- pista/trens molhados (roughness menor, cor mais escura) ----------
  const exclui = new Set([matCeu, matGota, matVeu, matEst, ...fundoMats, ...excluir].filter(Boolean));
  const molhaveis = []; const vistos = new WeakSet();
  let coletaT = 0, molAplicado = -1;
  function coleta() {
    scene.traverse(o => {
      if (!o.isMesh || o === gotas) return;
      const ms = Array.isArray(o.material) ? o.material : [o.material];
      for (const m of ms) {
        if (!m || vistos.has(m)) continue; vistos.add(m);
        if (!m.isMeshStandardMaterial || m.transparent || exclui.has(m) || m.userData.semChuva) continue;
        m.userData.clima = { r: m.roughness, c: m.color.clone() };
        molhaveis.push(m);
      }
    });
    molAplicado = -1;
  }
  function aplicaMolhado() {
    if (Math.abs(mol - molAplicado) < 0.015 && !(mol === 0 && molAplicado !== 0)) return;
    const w = mol < 0.01 ? 0 : mol;
    for (const m of molhaveis) {
      const u = m.userData.clima;
      m.roughness = u.r * (1 - 0.5 * w);
      m.color.copy(u.c).multiplyScalar(1 - 0.28 * w);
    }
    molAplicado = w;
  }

  // ---------- som de chuva (ruído filtrado) e trovão ----------
  let som = null, somAlvo = -1;
  function criaSom() {
    const a = audio && audio(); if (!a || !a.AC) return null;
    const AC = a.AC, sr = AC.sampleRate, buf = AC.createBuffer(1, sr * 2, sr), d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const src = AC.createBufferSource(); src.buffer = buf; src.loop = true;
    const hp = AC.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 450;
    const lp = AC.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 3200;
    const g = AC.createGain(); g.gain.value = 0;
    src.connect(hp); hp.connect(lp); lp.connect(g); g.connect(a.master || AC.destination); src.start();
    return { AC, g, lp, buf, saida: a.master || AC.destination, lpAlvo: 3200 };
  }
  function trovao() {
    if (!som || !somAtivo || !somAtivo()) return;
    const { AC } = som, t = AC.currentTime;
    const s = AC.createBufferSource(); s.buffer = som.buf;
    const f = AC.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 160;
    const g = AC.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.35, t + 0.12); g.gain.exponentialRampToValueAtTime(0.001, t + 2.2);
    s.connect(f); f.connect(g); g.connect(som.saida); s.start(t); s.stop(t + 2.3);
  }
  function atualizaSom(tunel) {
    if (!som && chu > 0.01) som = criaSom();
    if (!som) return;
    const ativo = somAtivo ? somAtivo() : false;
    const alvoG = ativo ? 0.075 * chu * (1 - 0.7 * tunel) : 0;
    if (Math.abs(alvoG - somAlvo) > 0.002) { som.g.gain.setTargetAtTime(alvoG, som.AC.currentTime, 0.25); somAlvo = alvoG; }
    const lp = tunel > 0.5 ? 600 : 3200; // dentro do túnel o som abafa
    if (lp !== som.lpAlvo) { som.lp.frequency.setTargetAtTime(lp, som.AC.currentTime, 0.3); som.lpAlvo = lp; }
  }

  // ---------- relâmpago ----------
  let raioProx = 14 + Math.random() * 20, raioT = 0, trovaoEm = -1;

  function atualiza({ dist = 0, camZ = 0, tunel = 0, noite = 0 }) {
    const agora = performance.now(), dt = Math.min(0.1, Math.max(0, (agora - tAnt) / 1000)); tAnt = agora;
    // ----- sorteio ao longo da corrida -----
    if (dist < ultD - 30 || !iniciou) { // corrida nova (ou menu): recomeça
      iniciou = true; proxD = 800 + Math.random() * 400;
      if (!forcado) { alvo = sorteia(0); nub = ALVOS[alvo][0]; chu = 0; mol = 0; }
    }
    ultD = dist;
    if (!forcado && dist >= proxD) { alvo = sorteia(dist); proxD = dist + 800 + Math.random() * 400; }
    const [an, ac] = ALVOS[forcado || alvo];
    const passo = dt / TRANS;
    nub += Math.max(-passo, Math.min(passo, an - nub));
    chu += Math.max(-passo, Math.min(passo, ac - chu));
    mol += Math.max(-dt / 12, Math.min(dt / 5, chu - mol)); // molha rápido, seca devagar
    const N = smooth(0, 1, nub), C = smooth(0, 1, chu);

    // ----- céu, névoa e luz (por cima do que o ciclo dia/noite já pôs) -----
    if (N > 0.001) {
      const escuro = 0.92 - 0.2 * C - 0.25 * C * noite;
      matCeu.color.lerp(tmp.copy(cinzaDe(matCeu.color, escuro)), 0.8 * N);
      for (const m of fundoMats) m.color.lerp(tmp.copy(cinzaDe(m.color, escuro)), 0.75 * N);
      scene.background.lerp(tmp.copy(cinzaDe(scene.background, escuro)), 0.75 * N);
      matVeu.color.copy(cinzaDe(matCeu.color, escuro * 0.95)); matVeu.opacity = 0.82 * N;
      scene.fog.color.lerp(tmp.copy(cinzaDe(scene.fog.color, escuro)), 0.75 * N);
      sol.intensity *= 1 - 0.55 * N - 0.2 * C;
      sol.color.lerp(tmp.set(0xdfe6ee), 0.6 * N);
      hemi.intensity *= 1 + 0.3 * N - 0.15 * C * noite;
      hemi.color.lerp(tmp.copy(cinzaDe(hemi.color, 1)), 0.6 * N);
      if (matEst) matEst.opacity *= 1 - N;
      renderer.toneMappingExposure *= 1 - 0.06 * C - 0.1 * C * noite;
    }
    veu.visible = N > 0.001;
    scene.fog.near = fogNear * (1 - 0.25 * N - 0.25 * C);
    scene.fog.far = fogFar * (1 - 0.18 * N - 0.22 * C);
    if (sol.shadow && 'intensity' in sol.shadow) sol.shadow.intensity = 1 - 0.55 * N - 0.2 * C; // sombras suaves
    scene.environmentIntensity *= 1 + 0.5 * mol;

    // ----- relâmpago raro (só com chuva forte e fora do túnel) -----
    if (C > 0.85 && tunel < 0.3) {
      raioProx -= dt;
      if (raioProx <= 0) { raioT = 0.45; raioProx = 16 + Math.random() * 26; trovaoEm = 0.5 + Math.random() * 1.2; }
    }
    if (raioT > 0) {
      raioT -= dt;
      const k = raioT > 0.3 ? 1 : raioT > 0.22 ? 0.2 : raioT > 0.12 ? 0.8 : Math.max(0, raioT / 0.12) * 0.5;
      hemi.intensity += 2.2 * k; scene.background.lerp(tmp.set(0xdfe4f0), 0.5 * k); matCeu.color.lerp(tmp.set(0xeef2ff), 0.5 * k); matVeu.color.lerp(tmp.set(0xeef2ff), 0.5 * k);
    }
    if (trovaoEm > 0) { trovaoEm -= dt; if (trovaoEm <= 0) trovao(); }

    // ----- gotas (escondidas no túnel) -----
    const vzCam = dt > 0 ? Math.max(0, Math.min(60, (gotas.userData.zAnt ?? camZ) - camZ) / dt) : 0;
    gotas.userData.zAnt = camZ;
    const opac = C * (1 - smooth(0.2, 0.7, tunel)) * (0.55 - 0.15 * noite);
    gotas.visible = opac > 0.01;
    if (gotas.visible) {
      // qualidade adaptativa: se o quadro ficar lento durante a chuva, corta gotas pela metade (até 1/4)
      lentoT += dt; lentoN++;
      if (lentoT > 3) { if (lentoN / lentoT < 36 && nAtivo > NMAX / 4) nAtivo = Math.floor(nAtivo / 2); lentoT = 0; lentoN = 0; }
      gotas.position.copy(camera.position);
      matGota.opacity = opac;
      animaGotas(dt, vzCam);
    }

    // ----- pista molhada -----
    coletaT -= dt;
    if (mol > 0.005 && coletaT <= 0) { coleta(); coletaT = 1.5; }
    aplicaMolhado();
    atualizaSom(tunel);
  }

  return {
    atualiza,
    forca(nome, ja = false) {
      forcado = nome && nome !== 'auto' && ALVOS[nome] ? nome : null;
      if (forcado && ja) { [nub, chu] = ALVOS[forcado]; mol = chu; }
    },
    get estado() { return { alvo: forcado || alvo, nublado: +nub.toFixed(2), chuva: +chu.toFixed(2), molhado: +mol.toFixed(2), gotas: nAtivo, proxTroca: Math.round(proxD) }; },
  };
}
