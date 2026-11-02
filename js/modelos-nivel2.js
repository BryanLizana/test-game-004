// modelos-nivel2.js — Modelos low-poly del nivel 2 (ciudad, San Isidro, malecón y playa).
// Mismas convenciones que modelos.js: metros, Y arriba, adelante = -Z, origen en el suelo centrado
// en la huella, userData.largo (Z) y userData.ancho (X).
// Texturas opcionales en assets/tex/n2/: si alguna falta, el material conserva su color liso.
// modelos.js no exporta sus utilidades, así que aquí va la copia mínima de las que hacen falta.
import * as THREE from "three";
import { conNieblaCielo } from "./niebla.js?v=1.8.2";
import { crearCarro, crearPersona } from "./modelos.js?v=1.8.2";

// ---------------------------------------------------------------------------
// Cachés. liberarRecursos() de modelos.js no conoce estas cachés: lo compartido anula su dispose()
// para que devolver un modelo a la reserva no borre lo que usan los demás.
// ---------------------------------------------------------------------------
const _geos = new Map();
const _mats = new Map();
const _texs = new Map();
const _fusiones = new Map();
const _cargador = typeof document !== "undefined" ? new THREE.TextureLoader() : null;
const EJE_Y = new THREE.Vector3(0, 1, 0);
const v3 = (x, y, z) => new THREE.Vector3(x, y, z);
const compartido = (r) => { r.dispose = () => {}; return r; };

function geo(clave, crear) {
  let g = _geos.get(clave);
  if (!g) { g = compartido(crear()); _geos.set(clave, g); }
  return g;
}
function mat(clave, crear) {
  let m = _mats.get(clave);
  if (!m) { m = compartido(crear()); _mats.set(clave, m); }
  return m;
}

// Como usarTextura de modelos.js, pero siempre con borde fijo: aquí no hay texturas repetidas.
function usarTextura(material, nombre, colorConMapa, aplicar = aplicarMapa) {
  if (!_cargador) return material;
  let e = _texs.get(nombre);
  if (!e) {
    e = { estado: 0, tex: null, pendientes: [] };
    _texs.set(nombre, e);
    const archivo = nombre.includes(".") ? nombre : `${nombre}.jpg`;
    const url = new URL(`../assets/tex/${archivo}`, import.meta.url).href;
    e.tex = compartido(_cargador.load(url, (t) => {
      t.colorSpace = THREE.SRGBColorSpace;
      t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
      t.anisotropy = 4;
      t.needsUpdate = true;
      e.estado = 1;
      for (const [m, c, fn] of e.pendientes) fn(m, t, c);
      e.pendientes.length = 0;
    }, undefined, () => { e.estado = -1; e.pendientes.length = 0; }));
  }
  if (e.estado === 1) aplicar(material, e.tex, colorConMapa);
  else if (e.estado === 0) e.pendientes.push([material, colorConMapa, aplicar]);
  return material;
}
function aplicarMapa(m, t, c) {
  m.map = t;
  if (c != null) m.color.set(c);
  m.needsUpdate = true;
}

function mStd(color, rough = 0.75, metal = 0, flat = true) {
  return mat(`std|${color}|${rough}|${metal}|${flat}`, () =>
    new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal, flatShading: flat }));
}
function mTex(nombre, colorSin, rough = 0.7) {
  return mat(`tex|${nombre}|${colorSin}|${rough}`, () => usarTextura(
    new THREE.MeshStandardMaterial({ name: nombre, color: colorSin, roughness: rough }), nombre, 0xffffff));
}
// Copia exacta de mFotoPintada: con la misma clave comparte el programa de modelos.js, no suma
// shaders. Sin `<nombre>-mascara.png` la foto queda tal cual, sin tomar `color`.
function mFotoPintada(nombre, color, rough) {
  return mat(`foto|${nombre}|${color}`, () => {
    const m = new THREE.MeshStandardMaterial({ name: nombre, color, roughness: rough });
    const u = { tintePintura: { value: new THREE.Color(color) }, tintePintura2: { value: new THREE.Color(0xffffff) },
      mascaraPintura: { value: null } };
    m.onBeforeCompile = (sh) => {
      conNieblaCielo(sh);
      Object.assign(sh.uniforms, u);
      sh.fragmentShader = sh.fragmentShader
        .replace("#include <common>", `#include <common>
uniform vec3 tintePintura;
uniform vec3 tintePintura2;
uniform sampler2D mascaraPintura;`)
        .replace("#include <map_fragment>", `#include <map_fragment>
#ifdef USE_MAP
  vec4 mascara = texture2D(mascaraPintura, vMapUv);
  diffuseColor.rgb *= mix(vec3(1.0), tintePintura, mascara.r) * mix(vec3(1.0), tintePintura2, mascara.g);
#endif`);
    };
    m.customProgramCacheKey = () => "fotoPintada";
    usarTextura(m, `${nombre}-mascara.png`, null, (mm, t) => { u.mascaraPintura.value = t; });
    return usarTextura(m, nombre, 0xffffff);
  });
}

const mNegro = () => mStd(0x1b1b1d, 0.8);
const mVidrioOscuro = () => mat("vidrioOsc", () => new THREE.MeshStandardMaterial({
  color: 0x0c1218, roughness: 0.1, metalness: 0.6 }));
const mMetal = () => mStd(0x7d8287, 0.5, 0.5);
const mCorteza = () => mStd(0x6b5844, 0.95);

// ---------------------------------------------------------------------------
// Construcción
// ---------------------------------------------------------------------------
function malla(g, m, sombra = true) {
  const me = new THREE.Mesh(g, m);
  me.castShadow = sombra;
  me.receiveShadow = true;
  return me;
}
function pon(padre, obj, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
  obj.position.set(x, y, z);
  obj.rotation.set(rx, ry, rz);
  padre.add(obj);
  return obj;
}
function caja(w, h, d) {
  return geo(`caja|${w}|${h}|${d}`, () => new THREE.BoxGeometry(w, h, d));
}
function segmento(a, b, radio, material, lados = 6, sombra = true) {
  const g = geo(`seg|${radio}|${lados}`, () => new THREE.CylinderGeometry(radio, radio, 1, lados, 1, radio <= 0.03));
  const m = malla(g, material, sombra);
  const d = new THREE.Vector3().subVectors(b, a);
  const L = d.length();
  m.position.copy(a).addScaledVector(d, 0.5);
  m.scale.set(1, L, 1);
  m.quaternion.setFromUnitVectors(EJE_Y, d.normalize());
  return m;
}
function ruido(x, y, z) {
  const s = Math.sin(+x.toFixed(3) * 12.9898 + +y.toFixed(3) * 78.233 + +z.toFixed(3) * 37.719) * 43758.5453;
  return s - Math.floor(s);
}
// Triángulos sueltos a geometría con normales de cara; `verts` son [x, y, z] de tres en tres.
function geometriaDe(verts) {
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(verts.flat(), 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(new Float32Array(verts.length * 2), 2));
  g.computeVertexNormals();
  return g;
}

function unirGeometrias(partes) {
  let n = 0;
  const geos = partes.map(([g, m]) => {
    const ng = (g.index ? g.toNonIndexed() : g.clone()).applyMatrix4(m);
    n += ng.getAttribute("position").count;
    return ng;
  });
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), uv = new Float32Array(n * 2);
  let o = 0;
  for (const g of geos) {
    pos.set(g.getAttribute("position").array, o * 3);
    nor.set(g.getAttribute("normal").array, o * 3);
    if (g.getAttribute("uv")) uv.set(g.getAttribute("uv").array, o * 2);
    o += g.getAttribute("position").count;
    g.dispose();
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  out.setAttribute("normal", new THREE.BufferAttribute(nor, 3));
  out.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  out.computeBoundingSphere();
  return out;
}
// Une las mallas de `contenedor` por material. La geometría se reutiliza por `cache` y por orden de
// material, así que dos modelos con la misma forma y otro color comparten geometría.
function fusionar(contenedor, cache) {
  contenedor.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(contenedor.matrixWorld).invert();
  const grupos = new Map();
  contenedor.traverse((c) => {
    if (!c.isMesh) return;
    if (!grupos.has(c.material)) grupos.set(c.material, []);
    grupos.get(c.material).push(c);
  });
  let i = 0;
  for (const [material, lista] of grupos) {
    const clave = `${cache}|${i++}`;
    if (lista.length < 2) continue;
    let g = _fusiones.get(clave);
    if (!g) {
      g = compartido(unirGeometrias(lista.map((m) => [m.geometry, new THREE.Matrix4().multiplyMatrices(inv, m.matrixWorld)])));
      _fusiones.set(clave, g);
    }
    const me = new THREE.Mesh(g, material);
    me.castShadow = lista.some((m) => m.castShadow);
    me.receiveShadow = true;
    contenedor.add(me);
    for (const m of lista) m.parent.remove(m);
  }
  return contenedor;
}

// Ruedas de modelos.js: crearRueda no se exporta, así que se clonan las de un sedán (radio 0,30).
// El clon comparte geometría y materiales, que siguen protegidos por las cachés de modelos.js.
const RADIO_RUEDA_BASE = 0.3;
let _ruedaBase = null;
function crearRueda(r) {
  _ruedaBase ??= crearCarro({ color: 0x1f1f22 }).userData.ruedas[0];
  const rueda = _ruedaBase.clone();
  rueda.rotation.set(0, 0, 0);
  rueda.scale.setScalar(r / RADIO_RUEDA_BASE);
  return rueda;
}

function arco(cx, cy, r, a0, a1, n) {
  const p = [];
  for (let i = 0; i <= n; i++) {
    const a = a0 + ((a1 - a0) * i) / n;
    p.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
  }
  return p;
}
function perfilConArcos(zIni, zFin, ySuelo, arcos, arriba) {
  const p = [[zIni, ySuelo]];
  for (const { z, r, yc } of arcos) {
    const a0 = Math.asin(Math.max(-1, Math.min(1, (ySuelo - yc) / r)));
    p.push(...arco(z, yc, r, Math.PI - a0, a0, 7));
  }
  p.push([zFin, ySuelo], ...arriba);
  return p;
}
// Contorno (z, y) extruido a lo largo de X, centrado en X, con bisel.
function perfilLateral(puntosZY, ancho, b = 0.03, segs = 1) {
  const s = new THREE.Shape();
  puntosZY.forEach(([x, y], i) => (i ? s.lineTo(x, y) : s.moveTo(x, y)));
  s.closePath();
  const depth = Math.max(0.002, ancho - 2 * b);
  const opts = { depth, curveSegments: 4, bevelEnabled: b > 0 };
  if (b > 0) Object.assign(opts, { bevelThickness: b, bevelSize: b, bevelOffset: -b, bevelSegments: segs });
  const g = new THREE.ExtrudeGeometry(s, opts);
  g.rotateY(-Math.PI / 2);
  g.translate(depth / 2, 0, 0);
  return g;
}
// Separa la carrocería por superficie para proyectar cada foto sin estirarla sobre el techo.
// Las fotos son como las de los buses de Lima: el panel bajo las ventanas, no el vehículo entero.
function pielVehiculo(S, superficie) {
  const original = perfilLateral(S.cuerpo(), S.ancho, S.bisel, 2);
  const fuente = original.index ? original.toNonIndexed() : original;
  const pos = fuente.getAttribute("position"), nor = fuente.getAttribute("normal"), uv0 = fuente.getAttribute("uv");
  const P = [], N = [], U = [];
  for (let i = 0; i < pos.count; i += 3) {
    const lateral = Math.abs(nor.getX(i)) > 0.9;
    const frente = !lateral && nor.getZ(i) < -0.65;
    const atras = !lateral && nor.getZ(i) > 0.65;
    if ((lateral ? "lateral" : frente ? "frente" : atras ? "atras" : "base") !== superficie) continue;
    for (let j = i; j < i + 3; j++) {
      const x = pos.getX(j), y = pos.getY(j), z = pos.getZ(j);
      P.push(x, y, z);
      N.push(nor.getX(j), nor.getY(j), nor.getZ(j));
      const v = (alto) => (y - S.ySuelo) / (alto - S.ySuelo);
      if (superficie === "lateral") {
        const u = (z - S.zFrente) / (S.zAtras - S.zFrente);
        U.push(nor.getX(j) > 0 ? 1 - u : u, v(S.altoLateral));
      } else if (superficie === "frente") U.push(0.5 - x / S.ancho, v(S.altoFrente));
      else if (superficie === "atras") U.push(0.5 + x / S.ancho, v(S.altoAtras));
      else U.push(uv0.getX(j), uv0.getY(j));
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(P, 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(N, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(U, 2));
  if (fuente !== original) fuente.dispose();
  original.dispose();
  return g;
}
function vidrioInclinado(padre, p0, p1, ancho) {
  const dz = p1[0] - p0[0], dy = p1[1] - p0[1];
  const sz = dz < 0 ? -1 : 1;
  const m = malla(caja(ancho, 0.02, Math.hypot(dz, dy) * 0.86), mVidrioOscuro(), false);
  m.rotation.x = -Math.atan2(dy * sz, dz * sz);
  m.position.set(0, (p0[1] + p1[1]) / 2 + 0.01, (p0[0] + p1[0]) / 2);
  padre.add(m);
}

// ---------------------------------------------------------------------------
// BUS AZUL: 12 m
// ---------------------------------------------------------------------------
const AZUL_BUS = 0x1d4fa3;
const SPEC_BUS_AZUL = {
  ancho: 2.55, bisel: 0.07, ySuelo: 0.42, zFrente: -6, zAtras: 6,
  altoLateral: 1.8, altoFrente: 1.7, altoAtras: 1.85,
  rRueda: 0.48, xRueda: 1.08, ejes: [-3.3, 2.5],
  cuerpo: () => perfilConArcos(-6, 6, 0.42, [{ z: -3.3, r: 0.58, yc: 0.48 }, { z: 2.5, r: 0.58, yc: 0.48 }],
    [[6, 0.7], [6, 2.95], [5.85, 3.1], [-5.75, 3.1], [-6, 2.8], [-6, 0.6]]),
};

export function crearBusAzul() {
  const S = SPEC_BUS_AZUL;
  const raiz = new THREE.Group();
  raiz.name = "busAzul";
  const carroceria = new THREE.Group();
  carroceria.name = "carroceria";
  raiz.add(carroceria);
  const piel = (superficie, material) => carroceria.add(
    malla(geo(`busAzul_${superficie}`, () => pielVehiculo(S, superficie)), material));
  piel("base", mStd(AZUL_BUS, 0.55));
  piel("lateral", mTex("n2/bus-azul-lado", AZUL_BUS));
  piel("frente", mTex("n2/bus-azul-frente", AZUL_BUS, 0.6));
  piel("atras", mTex("n2/bus-azul-atras", AZUL_BUS, 0.6));

  const vidrio = mVidrioOscuro();
  for (let i = 0; i < 9; i++) {
    pon(carroceria, malla(caja(S.ancho + 0.012, 0.9, 1.14), vidrio, false), 0, 2.35, -5.1 + i * 1.27);
  }
  pon(carroceria, malla(caja(2.2, 1, 0.02), vidrio, false), 0, 2.28, -6.01);
  pon(carroceria, malla(caja(2.1, 0.85, 0.02), vidrio, false), 0, 2.32, 6.01);
  pon(carroceria, malla(caja(1.5, 0.2, 0.02), mStd(0xffb020, 0.5), false), 0, 2.93, -5.88, -0.45);
  pon(carroceria, malla(caja(1.7, 0.2, 2.6), mStd(0xc9ccd0, 0.7)), 0, 3.2, 0.6);
  for (const s of [-1, 1]) {
    pon(carroceria, malla(caja(0.1, 0.32, 0.14), mNegro(), false), s * (S.ancho / 2 + 0.06), 2.3, -5.75);
  }
  const ruedas = [];
  for (const z of S.ejes) for (const s of [-1, 1]) {
    ruedas.push(pon(raiz, crearRueda(S.rRueda), s * S.xRueda, S.rRueda, z));
  }
  fusionar(carroceria, "busAzul");
  raiz.userData = { ruedas, carroceria, tipo: "busAzul", largo: 12, ancho: S.ancho + 0.12, alto: 3.3 };
  return raiz;
}

// ---------------------------------------------------------------------------
// DEPORTIVO: bajo, 4,3 m
// ---------------------------------------------------------------------------
const COLORES_DEPORTIVO = [0xc8102e, 0xf2c200, 0x14161a, 0xd5d8dc, 0x1d4fa3];
const SPEC_DEPORTIVO = {
  ancho: 1.84, bisel: 0.07, ySuelo: 0.16, zFrente: -2.15, zAtras: 2.15,
  altoLateral: 0.78, altoFrente: 0.62, altoAtras: 0.74,
  rRueda: 0.32, xRueda: 0.8, ejes: [-1.35, 1.3],
  cuerpo: () => perfilConArcos(-2.15, 2.15, 0.16, [{ z: -1.35, r: 0.39, yc: 0.32 }, { z: 1.3, r: 0.39, yc: 0.32 }],
    [[2.15, 0.42], [2.13, 0.76], [1.2, 0.8], [-0.8, 0.72], [-2.08, 0.62], [-2.15, 0.42]]),
};

// `color` se omite para uno al azar. La foto solo lo toma con su máscara (`-mascara.png`).
export function crearDeportivo(color) {
  const S = SPEC_DEPORTIVO;
  color ??= COLORES_DEPORTIVO[Math.floor(Math.random() * COLORES_DEPORTIVO.length)];
  const raiz = new THREE.Group();
  raiz.name = "deportivo";
  const carroceria = new THREE.Group();
  carroceria.name = "carroceria";
  raiz.add(carroceria);
  const mCuerpo = mStd(color, 0.4, 0.15);
  const piel = (superficie, material) => carroceria.add(
    malla(geo(`deportivo_${superficie}`, () => pielVehiculo(S, superficie)), material));
  piel("base", mCuerpo);
  piel("atras", mCuerpo);
  piel("lateral", mFotoPintada("n2/deportivo-lado", color, 0.45));
  piel("frente", mFotoPintada("n2/deportivo-frente", color, 0.45));

  const cabina = [[-0.85, 0.7], [-0.05, 1.16], [0.75, 1.17], [1.55, 0.76]];
  carroceria.add(malla(geo("deportivo_cabina", () => perfilLateral(cabina, 1.5, 0.05)), mCuerpo));
  for (const [k, p] of [["a", [[-0.72, 0.76], [-0.08, 1.12], [0.3, 1.12], [0.3, 0.76]]],
    ["b", [[0.38, 0.76], [0.38, 1.12], [0.72, 1.13], [1.3, 0.78]]]]) {
    carroceria.add(malla(geo(`deportivo_ventana${k}`, () => perfilLateral(p, 1.512, 0)), mVidrioOscuro(), false));
  }
  vidrioInclinado(carroceria, cabina[0], cabina[1], 1.34);
  vidrioInclinado(carroceria, cabina[2], cabina[3], 1.3);
  pon(carroceria, malla(caja(1.7, 0.03, 0.26), mCuerpo), 0, 0.88, 2.0);                 // alerón
  for (const s of [-1, 1]) pon(carroceria, malla(caja(0.04, 0.1, 0.16), mCuerpo), s * 0.7, 0.82, 2.0);
  pon(carroceria, malla(caja(1.5, 0.08, 0.02), mStd(0xb0141c, 0.4), false), 0, 0.62, S.zAtras);  // luces
  pon(carroceria, malla(caja(1.5, 0.14, 0.04), mNegro(), false), 0, 0.26, S.zAtras);    // difusor
  for (const s of [-1, 1]) {
    pon(carroceria, malla(caja(0.16, 0.08, 0.1), mNegro(), false), s * 0.84, 0.84, -0.62);
  }
  const ruedas = [];
  for (const z of S.ejes) for (const s of [-1, 1]) {
    ruedas.push(pon(raiz, crearRueda(S.rRueda), s * S.xRueda, S.rRueda, z));
  }
  fusionar(carroceria, "deportivo");
  raiz.userData = { ruedas, carroceria, tipo: "deportivo", largo: 4.3, ancho: S.ancho, alto: 1.17 };
  return raiz;
}

// ---------------------------------------------------------------------------
// PALMERA
// ---------------------------------------------------------------------------
const ALTO_TRONCO = 6.4;
// Copa procedural: visible hasta que carga palmera.png, y para siempre si falta.
const mHojasRespaldo = () => mat("palmeraHojas", () => new THREE.MeshStandardMaterial({
  color: 0x3f7a35, roughness: 0.9, flatShading: true, side: THREE.DoubleSide }));
const mCopaFoto = () => mat("palmeraCopa", () => usarTextura(new THREE.MeshStandardMaterial({
  color: 0xffffff, roughness: 0.9, side: THREE.DoubleSide, alphaTest: 0.5, visible: false }),
"n2/palmera.png", 0xffffff, (m, t, c) => {
  aplicarMapa(m, t, c);
  m.visible = true;
  mHojasRespaldo().visible = false;
}));

function geoTroncoPalmera() {
  const g = new THREE.CylinderGeometry(0.15, 0.25, ALTO_TRONCO, 6, 3, true);
  const pos = g.getAttribute("position");
  for (let i = 0; i < pos.count; i++) {
    const t = pos.getY(i) / ALTO_TRONCO + 0.5;
    pos.setX(i, pos.getX(i) + 0.45 * t * t);
  }
  g.translate(0, ALTO_TRONCO / 2, 0);
  g.computeVertexNormals();
  return g;
}
// Ocho hojas que salen de la punta y caen, cada una con tres tramos que se afinan.
function geoHojas() {
  const verts = [];
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const dir = [Math.cos(a), Math.sin(a)], lado = [-dir[1], dir[0]];
    const L = i % 2 ? 2.5 : 2.9;
    const punto = (t, ancho) => {
      const r = L * t, y = 0.9 * t - 1.7 * t * t;
      return [-1, 1].map((s) => [dir[0] * r + lado[0] * ancho * s, y, dir[1] * r + lado[1] * ancho * s]);
    };
    const tramos = [[0, 0.1], [0.35, 0.34], [0.7, 0.26], [1, 0.02]].map(([t, w]) => punto(t, w));
    for (let j = 0; j < 3; j++) {
      const [a0, a1] = tramos[j], [b0, b1] = tramos[j + 1];
      verts.push(a0, b0, b1, a0, b1, a1);
    }
  }
  return geometriaDe(verts);
}

// escala 1: 6,4 m de tronco, unos 8 m en total. La huella es la del tronco; la copa va en anchoCopa.
export function crearPalmera(escala = 1) {
  const g = new THREE.Group();
  g.name = "palmera";
  const base = pon(g, new THREE.Group());
  base.add(malla(geo("palmeraTronco", geoTroncoPalmera), mCorteza()));
  const tope = [0.45, ALTO_TRONCO, 0];
  const gPlano = geo("palmeraPlano", () => new THREE.PlaneGeometry(5.6, 3.6));
  for (let i = 0; i < 3; i++) {
    pon(base, malla(gPlano, mCopaFoto(), false), tope[0], tope[1], tope[2], 0, (i * Math.PI) / 3, 0);
  }
  pon(base, malla(geo("palmeraHojas", geoHojas), mHojasRespaldo(), false), tope[0], tope[1], tope[2]);
  fusionar(base, "palmera");
  g.scale.setScalar(escala);
  g.userData = { largo: +(0.5 * escala).toFixed(2), ancho: +(0.5 * escala).toFixed(2),
    alto: +(8.2 * escala).toFixed(2), anchoCopa: +(5.6 * escala).toFixed(2) };
  return g;
}

// ---------------------------------------------------------------------------
// PLAYA
// ---------------------------------------------------------------------------
const mTela = (color) => mat(`tela|${color}`, () => new THREE.MeshStandardMaterial({
  color, roughness: 0.85, flatShading: true, side: THREE.DoubleSide }));

function geoGajos(par) {
  const n = 4, paso = (Math.PI * 2) / (n * 2);
  return unirGeometrias(Array.from({ length: n }, (_, i) => [
    new THREE.ConeGeometry(1.15, 0.5, 1, 1, true, (i * 2 + par) * paso, paso), new THREE.Matrix4()]));
}
// Sombrilla de gajos alternos de `color` y blanco: 2,3 m de diámetro y 2,5 m de alto.
export function crearSombrilla(color = 0xe53935) {
  const g = new THREE.Group();
  g.name = "sombrilla";
  g.add(segmento(v3(0, 0, 0), v3(0, 2.5, 0), 0.025, mStd(0xd8d4c8, 0.5, 0.3)));
  pon(g, malla(geo("sombrillaA", () => geoGajos(0)), mTela(color)), 0, 2.2, 0);
  pon(g, malla(geo("sombrillaB", () => geoGajos(1)), mTela(0xf4efe2)), 0, 2.2, 0);
  g.userData = { largo: 2.3, ancho: 2.3, alto: 2.5 };
  return g;
}

// Cuadernas de la proa (-Z) a la popa: [z, media manga, y de la quilla, y de la borda]
const CUADERNAS = [[-2.1, 0.02, 0.4, 1], [-1.3, 0.5, 0.1, 0.8], [0, 0.74, 0, 0.7], [1.3, 0.7, 0.03, 0.74], [2.1, 0.55, 0.15, 0.8]];
function geoCasco(bajo) {
  const verts = [];
  const seccion = ([z, m, yq, yb]) => {
    const yc = yq + (yb - yq) * 0.35;
    return bajo ? [[0, yq, z], [m * 0.72, yc, z]] : [[m * 0.72, yc, z], [m, yb, z]];
  };
  for (let i = 0; i < CUADERNAS.length - 1; i++) {
    const [a0, a1] = seccion(CUADERNAS[i]), [b0, b1] = seccion(CUADERNAS[i + 1]);
    for (const s of [1, -1]) {
      const e = ([x, y, z]) => [x * s, y, z];
      verts.push(e(a0), e(a1), e(b1), e(a0), e(b1), e(b0));
    }
  }
  return geometriaDe(verts);
}
function geoEspejoPopa() {
  const [z, m, yq, yb] = CUADERNAS[CUADERNAS.length - 1];
  const yc = yq + (yb - yq) * 0.35;
  const p = [[0, yq, z], [m * 0.72, yc, z], [m, yb, z], [-m, yb, z], [-m * 0.72, yc, z]];
  return geometriaDe([p[0], p[1], p[2], p[0], p[2], p[3], p[0], p[3], p[4]]);
}
// Bote de pescadores varado: 4,2 m, de madera pintada.
export function crearBote() {
  const g = new THREE.Group();
  g.name = "bote";
  const doble = (color) => mat(`boteTabla|${color}`, () => new THREE.MeshStandardMaterial({
    color, roughness: 0.8, flatShading: true, side: THREE.DoubleSide }));
  g.add(malla(geo("boteBajo", () => geoCasco(true)), doble(0x1f6fa8)));
  g.add(malla(geo("boteAlto", () => geoCasco(false)), doble(0xeee8d8)));
  g.add(malla(geo("botePopa", geoEspejoPopa), doble(0xeee8d8)));
  const madera = mStd(0x8a6a45, 0.9);
  pon(g, malla(caja(1.3, 0.05, 0.28), madera, false), 0, 0.52, -0.5);
  pon(g, malla(caja(1.3, 0.05, 0.28), madera, false), 0, 0.52, 0.8);
  g.add(segmento(v3(0.5, 0.6, -0.9), v3(0.38, 0.6, 1.3), 0.025, madera, 5, false));     // remo
  fusionar(g, "bote");
  g.userData = { largo: 4.2, ancho: 1.5, alto: 1 };
  return g;
}

// ---------------------------------------------------------------------------
// CIUDAD
// ---------------------------------------------------------------------------
const LUCES = { rojo: 0xff2a1a, ambar: 0xffa81a, verde: 0x22e070 };
function mLuz(nombre, encendida) {
  return mat(`luz|${nombre}|${encendida}`, () => new THREE.MeshStandardMaterial({
    color: encendida ? LUCES[nombre] : 0x1c1c1e, roughness: 0.4,
    emissive: encendida ? LUCES[nombre] : 0x000000, emissiveIntensity: encendida ? 1.6 : 0 }));
}
// Discos de una luz en las dos cabezas (la del brazo y la del poste), en una sola malla.
function geoLuces(y) {
  const disco = new THREE.CircleGeometry(0.1, 10).rotateY(Math.PI);
  const g = unirGeometrias([[-2.7, 4.9], [0, 2.9]].map(([x, h]) =>
    [disco, new THREE.Matrix4().makeTranslation(x, h + y, -0.12)]));
  disco.dispose();
  return g;
}
// Mira a -Z (rotarlo para enfrentar a quien llega) y el brazo cruza hacia -X sobre la calzada.
// Sale en rojo; se cambia con ponerSemaforo().
export function crearSemaforo() {
  const g = new THREE.Group();
  g.name = "semaforo";
  const estructura = pon(g, new THREE.Group());
  const verde = mStd(0x2f4a3a, 0.6, 0.3);
  estructura.add(segmento(v3(0, 0, 0), v3(0, 5.3, 0), 0.08, verde));
  estructura.add(segmento(v3(0, 5.2, 0), v3(-2.7, 5.5, 0), 0.05, verde));
  for (const [x, y] of [[-2.7, 4.9], [0, 2.9]]) {
    pon(estructura, malla(caja(0.34, 0.88, 0.22), mNegro()), x, y, 0);
    for (const dy of [0.27, 0, -0.27]) {
      pon(estructura, malla(caja(0.26, 0.03, 0.14), mNegro(), false), x, y + dy + 0.11, -0.17);
    }
  }
  fusionar(estructura, "semaforo");
  const luces = {};
  for (const [nombre, y] of [["rojo", 0.27], ["ambar", 0], ["verde", -0.27]]) {
    luces[nombre] = malla(geo(`semLuz|${nombre}`, () => geoLuces(y)), mLuz(nombre, nombre === "rojo"), false);
    g.add(luces[nombre]);
  }
  g.userData = { luces, estado: "rojo", largo: 0.4, ancho: 0.4, alto: 5.5 };
  return g;
}
// estado: "rojo" | "ambar" | "verde". Cambia materiales compartidos, sin compilar nada nuevo.
export function ponerSemaforo(modelo, estado) {
  const ud = modelo.userData;
  if (ud.estado === estado) return;
  ud.estado = estado;
  for (const nombre of Object.keys(LUCES)) ud.luces[nombre].material = mLuz(nombre, nombre === estado);
}

// Paradero de 5,2 m a lo largo de Z, abierto hacia +X (la calzada).
export function crearParadero() {
  const g = new THREE.Group();
  g.name = "paradero";
  const azul = mStd(0x2d5fa8, 0.6), metal = mMetal();
  pon(g, malla(caja(1.9, 0.08, 5.2), azul), 0.1, 2.6, 0, 0, 0, 0.04);
  for (const z of [-2.3, 2.3]) {
    for (const x of [-0.72, 0.8]) g.add(segmento(v3(x, 0, z), v3(x, 2.58, z), 0.05, metal));
  }
  pon(g, malla(caja(0.05, 1.8, 4.5), mStd(0x37474f, 0.5)), -0.72, 1.4, 0);
  pon(g, malla(caja(1.2, 2, 0.1), mStd(0xeeeeea, 0.6)), 0, 1.25, 2.3);
  pon(g, malla(caja(1, 1.6, 0.11), mStd(0xf2c200, 0.6), false), 0, 1.3, 2.3);
  pon(g, malla(caja(0.42, 0.05, 2.6), mStd(0x8a6a45, 0.85)), -0.45, 0.48, -0.4);
  for (const z of [-1.5, 0.7]) pon(g, malla(caja(0.3, 0.46, 0.06), metal, false), -0.45, 0.23, z);
  g.add(segmento(v3(0.95, 0, -2.5), v3(0.95, 3, -2.5), 0.04, metal));
  pon(g, malla(geo("paraderoDisco", () => new THREE.CylinderGeometry(0.28, 0.28, 0.03, 12).rotateX(Math.PI / 2)), azul), 0.95, 3, -2.5);
  fusionar(g, "paradero");
  g.userData = { largo: 5.2, ancho: 1.9, alto: 3.3, frente: "+X" };
  return g;
}

// Rueda de bicicleta: grupo cuyo eje local X es el eje de giro, como las demás.
function ruedaBici() {
  const g = new THREE.Group();
  g.name = "rueda";
  g.add(malla(geo("biciAro", () => new THREE.TorusGeometry(0.325, 0.02, 4, 16).rotateY(Math.PI / 2)), mNegro(), false));
  for (let i = 0; i < 3; i++) {
    const a = (i * Math.PI) / 3, y = Math.cos(a) * 0.32, z = Math.sin(a) * 0.32;
    g.add(segmento(v3(0, -y, -z), v3(0, y, z), 0.006, mMetal(), 3, false));
  }
  return fusionar(g, "biciRueda");
}
const CAMISAS_CICLISTA = [0xf2c200, 0xe74c3c, 0x2e86c1, 0x27ae60, 0xff7f50];
const COLORES_BICI = [0xc8102e, 0x1d4fa3, 0x14161a, 0x228b3c];
// Ciclista quieto, sin pedaleo; mira a -Z. Usa crearPersona con las piernas en los pedales.
// userData no lleva `piernas` a propósito: trafico.js le aplicaría animarCaminar.
export function crearCiclista() {
  const azar = (l) => l[Math.floor(Math.random() * l.length)];
  const raiz = new THREE.Group();
  raiz.name = "ciclista";
  const bici = pon(raiz, new THREE.Group());
  const cuadro = mStd(azar(COLORES_BICI), 0.5, 0.2), negro = mNegro();
  const p = { eje: v3(0, 0.34, 0.5), del: v3(0, 0.34, -0.55), caja: v3(0, 0.235, -0.09), sillin: v3(0, 0.92, 0.22),
    tuboSup: v3(0, 0.98, -0.41), tuboInf: v3(0, 0.72, -0.45), manubrio: v3(0, 1.12, -0.5) };
  for (const [a, b] of [[p.caja, p.sillin], [p.caja, p.tuboInf], [p.sillin, p.tuboSup], [p.caja, p.eje], [p.sillin, p.eje]]) {
    bici.add(segmento(a, b, 0.02, cuadro, 5, false));
  }
  bici.add(segmento(p.tuboSup, p.manubrio, 0.018, negro, 5, false));
  bici.add(segmento(p.tuboInf, p.del, 0.018, cuadro, 5, false));
  bici.add(segmento(v3(-0.27, 1.12, -0.53), v3(0.27, 1.12, -0.53), 0.016, negro, 5, false));
  pon(bici, malla(caja(0.13, 0.05, 0.26), negro, false), 0, 0.96, 0.24);
  bici.add(segmento(v3(-0.1, 0.29, -0.23), v3(0.1, 0.18, 0.05), 0.012, negro, 4, false)); // bielas
  fusionar(bici, "bici");
  const ruedas = [p.eje, p.del].map((c) => pon(raiz, ruedaBici(), 0, c.y, c.z));

  const persona = pon(raiz, crearPersona({ tipo: "joven", ropa: { camisa: azar(CAMISAS_CICLISTA), falda: false } }), 0, 0.16, 0.22);
  const { piernas, brazos } = persona.userData;
  const INCLINA = 0.55;
  brazos[0].parent.rotation.x = -INCLINA;
  piernas[0].rotation.x = 0.55;
  piernas[1].rotation.x = 0.2;
  for (const b of brazos) b.rotation.x = 1 + INCLINA;
  raiz.userData = { ruedas, tipo: "ciclista", largo: 1.75, ancho: 0.6, alto: 1.7 };
  return raiz;
}

// Ficus de avenida: tronco grueso con raíces y copa ancha de bultos, 8,3 m de alto.
function geoBulto(r) {
  const g = new THREE.IcosahedronGeometry(r, 1);
  const pos = g.getAttribute("position");
  for (let i = 0; i < pos.count; i++) {
    const k = 0.85 + 0.3 * ruido(pos.getX(i), pos.getY(i), pos.getZ(i));
    pos.setXYZ(i, pos.getX(i) * k, pos.getY(i) * k * 0.8, pos.getZ(i) * k);
  }
  g.computeVertexNormals();
  return g;
}
export function crearFicus() {
  const g = new THREE.Group();
  g.name = "ficus";
  const corteza = mCorteza(), hoja = mStd(0x2f5a2e, 0.95);
  g.add(malla(geo("ficusTronco", () => new THREE.CylinderGeometry(0.3, 0.42, 3.4, 7, 1, true).translate(0, 1.7, 0)), corteza));
  for (const [x, z] of [[1.1, 0.5], [-1, 0.8], [0.2, -1.2]]) {
    g.add(segmento(v3(0, 2.8, 0), v3(x, 4.8, z), 0.14, corteza, 5));
  }
  for (let i = 0; i < 3; i++) {
    const a = (i * Math.PI * 2) / 3 + 0.4;
    g.add(segmento(v3(0, 0.55, 0), v3(Math.cos(a) * 0.75, 0.02, Math.sin(a) * 0.75), 0.11, corteza, 5, false));
  }
  const bultos = [[0, 6.1, 0, 2.5], [1.8, 5.2, 0.7, 1.9], [-1.8, 5.4, 0.6, 2], [0.3, 5.3, -1.9, 1.9], [-0.2, 5, 1.9, 1.7]];
  for (const [x, y, z, r] of bultos) pon(g, malla(geo(`ficusBulto|${r}`, () => geoBulto(r)), hoja), x, y, z);
  fusionar(g, "ficus");
  g.userData = { largo: 1.2, ancho: 1.2, alto: 8.3, anchoCopa: 7.6 };
  return g;
}
