import * as THREE from "three";

// Cómicos de barrio con disfraces caseros: bailan en la vereda y se apartan si viene el torito.
// Nunca chocan. Solo en la web: dentro de YouTube Playables (window.ytgame) no aparecen.
export const imitadoresActivos = () => typeof window === "undefined" || !window.ytgame;

const SEPARACION_MIN = 230, SEPARACION_MAX = 360;
const ALCANCE = 95;            // m: más lejos ni se dibujan
const AVISO = 16;              // m: a esta distancia se apartan
const APARTA = 0.75;           // m que saltan hacia la pared: no llegan a atravesarla

// Atlas 2x2: cara, nuca, torso, piernas y brazos
const CELDAS = { cara: [0, 1], nuca: [1, 1], torso: [0, 0], tela: [1, 0] };
function cajaAtlas(ancho, alto, fondo, frente, resto) {
  const geo = new THREE.BoxGeometry(ancho, alto, fondo);
  const uv = geo.attributes.uv;
  for (let cara = 0; cara < 6; cara++) {
    const [cx, cy] = CELDAS[cara === 4 ? frente : resto];   // la cara 4 (+Z) mira al frente
    for (let i = cara * 4; i < cara * 4 + 4; i++) uv.setXY(i, (cx + uv.getX(i)) / 2, (cy + uv.getY(i)) / 2);
  }
  return geo;
}

const FIGURAS = [
  { foto: "imit-dino.jpg", color: 0x7b3fa0, escala: 1.25, panza: 1.5, extra: "cola" },
  { foto: "imit-arana.jpg", color: 0xc4202a, escala: 1, panza: 0.9, extra: null },
  { foto: "imit-soldado.jpg", color: 0x4c5a35, escala: 1.02, panza: 1, extra: "balas" },
  { foto: "imit-nino.jpg", color: 0x3a8fd0, escala: 0.74, panza: 1, extra: "gorra" },
  { foto: "imit-rojo.jpg", color: 0xd42a2a, escala: 0.86, panza: 1, extra: "antenas" },
];

const cargador = new THREE.TextureLoader();
let catalogo = null;
function prepararCatalogo() {
  if (catalogo) return catalogo;
  catalogo = FIGURAS.map((f) => {
    const material = new THREE.MeshStandardMaterial({ color: f.color, roughness: 0.9 });
    cargador.load(`assets/tex/n2/${f.foto}`, (t) => {
      t.colorSpace = THREE.SRGBColorSpace;
      material.map = t;
      material.color.set(0xffffff);
      material.needsUpdate = true;
    }, undefined, () => {});
    const liso = new THREE.MeshStandardMaterial({ color: f.color, roughness: 0.9 });
    return {
      ...f, material, liso,
      cabeza: cajaAtlas(0.46, 0.46, 0.42, "cara", "nuca"),
      torso: cajaAtlas(0.5 * f.panza, 0.66, 0.3 * f.panza, "torso", "tela"),
      pierna: cajaAtlas(0.2, 0.74, 0.22, "tela", "tela"),
      brazo: cajaAtlas(0.15, 0.62, 0.16, "tela", "tela"),
    };
  });
  return catalogo;
}
export function precargarImitadores() { if (imitadoresActivos()) prepararCatalogo(); }

function crearFigura(f) {
  const raiz = new THREE.Group();
  const cuerpo = new THREE.Group();
  raiz.add(cuerpo);
  const pieza = (geo, x, y, z = 0) => {
    const m = new THREE.Mesh(geo, f.material);
    m.position.set(x, y, z);
    m.castShadow = true;
    cuerpo.add(m);
    return m;
  };
  pieza(f.pierna, -0.13, 0.37);
  pieza(f.pierna, 0.13, 0.37);
  pieza(f.torso, 0, 1.07);
  pieza(f.cabeza, 0, 1.64);
  // Los brazos giran desde el hombro
  const hombro = (x) => {
    const pivote = new THREE.Group();
    pivote.position.set(x, 1.36, 0);
    const brazo = new THREE.Mesh(f.brazo, f.material);
    brazo.position.y = -0.3;
    brazo.castShadow = true;
    pivote.add(brazo);
    cuerpo.add(pivote);
    return pivote;
  };
  const brazoI = hombro(-(0.33 * f.panza)), brazoD = hombro(0.33 * f.panza);
  const adorno = (ancho, alto, fondo, x, y, z, giro = 0) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(ancho, alto, fondo), f.liso);
    m.position.set(x, y, z);
    m.rotation.z = giro;
    cuerpo.add(m);
  };
  if (f.extra === "cola") adorno(0.28, 0.24, 0.7, 0, 0.8, -0.55);
  if (f.extra === "balas") adorno(0.1, 0.8, 0.05, 0, 1.08, 0.17, 0.75);
  if (f.extra === "gorra") adorno(0.5, 0.1, 0.56, 0, 1.9, 0.06);
  if (f.extra === "antenas") { adorno(0.05, 0.3, 0.05, -0.12, 2, 0, 0.2); adorno(0.05, 0.3, 0.05, 0.12, 2, 0, -0.2); }
  raiz.scale.setScalar(f.escala);
  return { raiz, cuerpo, brazoI, brazoD };
}

export function crearImitadores(pista, escena) {
  const lista = [];
  const liberar = () => { for (const i of lista) escena.remove(i.raiz); };
  if (!imitadoresActivos()) return { lista, actualizar() {}, liberar };
  const figuras = prepararCatalogo(), azar = pista.rand;
  const fin = pista.meta - 40;
  const ancho = pista.ancho / 2, vereda = 0.6;   // al borde de la vereda, a la vista
  let turno = Math.floor(azar() * figuras.length);
  for (let s = 140 + azar() * 80; s < fin; s += SEPARACION_MIN + azar() * (SEPARACION_MAX - SEPARACION_MIN)) {
    if (pista.enPasoUrbano(s) || pista.bocaEn?.(s, 12) || pista.mirador(s)) continue;
    const lado = azar() < 0.5 ? -1 : 1, d = lado * (ancho + vereda);
    const figura = crearFigura(figuras[turno++ % figuras.length]);
    const base = pista.alturaLateral(d, s);
    pista.aMundo(s, d, base, figura.raiz.position);
    // Mira hacia quien llega: el frente del monigote es +Z
    figura.raiz.rotation.y = -pista.muestra(s).th + (lado > 0 ? -0.7 : 0.7);
    figura.raiz.visible = false;
    escena.add(figura.raiz);
    lista.push({ ...figura, s, d, lado, base, fase: azar() * 6.28, aparte: 0, inicio: figura.raiz.position.clone() });
  }
  const afuera = new THREE.Vector3();
  let tiempo = 0;
  return {
    lista,
    liberar,
    actualizar(dt, veh) {
      tiempo += dt;
      for (const i of lista) {
        const cerca = Math.abs(i.s - veh.s) < ALCANCE;
        i.raiz.visible = cerca;
        if (!cerca) continue;
        const t = tiempo * 5 + i.fase;
        // Baile: se mece y agita los brazos
        i.cuerpo.position.y = Math.abs(Math.sin(t)) * 0.12;
        i.cuerpo.rotation.z = Math.sin(t) * 0.12;
        i.brazoI.rotation.z = -2.1 + Math.sin(t * 1.3) * 0.6;
        i.brazoD.rotation.z = 2.1 - Math.cos(t * 1.3) * 0.6;
        const viene = veh.s > i.s - AVISO && veh.s < i.s + 6 && Math.sign(veh.d) === i.lado;
        i.aparte += ((viene ? 1 : 0) - i.aparte) * Math.min(1, dt * 7);
        pista.aMundo(i.s, i.lado * (Math.abs(i.d) + APARTA * i.aparte), i.base, afuera);
        i.raiz.position.copy(afuera);
      }
    },
  };
}
