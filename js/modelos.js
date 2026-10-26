// modelos.js — Modelos 3D procedurales low-poly para "¡Sin Frenos!"
// Unidades: metros. Y arriba. Adelante = -Z. Origen de cada modelo en el suelo, centrado.
// Texturas opcionales en assets/tex/*.jpg: si alguna falta, el material conserva su color liso.
import * as THREE from "three";

// ---------------------------------------------------------------------------
// Cachés de geometrías, materiales y texturas (compartidos entre instancias)
// ---------------------------------------------------------------------------
const _geos = new Map();
const _mats = new Map();
const _texs = new Map();
const _compartidos = new WeakSet();
const HAY_DOM = typeof document !== "undefined";
const _cargador = HAY_DOM ? new THREE.TextureLoader() : null;

function geo(clave, crear) {
  let g = _geos.get(clave);
  if (!g) { g = crear(); _geos.set(clave, g); _compartidos.add(g); }
  return g;
}
function mat(clave, crear) {
  let m = _mats.get(clave);
  if (!m) { m = crear(); _mats.set(clave, m); _compartidos.add(m); }
  return m;
}

// Asigna la textura `nombre` (una por archivo) al material cuando termina de cargar.
// Si falla, el material queda con su color liso. `colorConMapa` reemplaza el color al cargar.
function usarTextura(material, nombre, colorConMapa) {
  if (!_cargador) return material;
  let e = _texs.get(nombre);
  if (!e) {
    e = { estado: 0, tex: null, pendientes: [] };
    _texs.set(nombre, e);
    const archivo = nombre.includes(".") ? nombre : `${nombre}.jpg`;
    const url = new URL(`../assets/tex/${archivo}`, import.meta.url).href;
    e.tex = _cargador.load(url, (t) => {
      t.colorSpace = THREE.SRGBColorSpace;
      t.wrapS = t.wrapT = nombre.includes("-lima-v1") ? THREE.ClampToEdgeWrapping : THREE.RepeatWrapping;
      t.anisotropy = 4;
      t.needsUpdate = true;
      e.estado = 1;
      for (const [m, c] of e.pendientes) aplicarMapa(m, t, c);
      e.pendientes.length = 0;
    }, undefined, () => { e.estado = -1; e.pendientes.length = 0; });
    e.tex.colorSpace = THREE.SRGBColorSpace;
    _compartidos.add(e.tex);
    e.tex.wrapS = e.tex.wrapT = nombre.includes("-lima-v1") ? THREE.ClampToEdgeWrapping : THREE.RepeatWrapping;
  }
  if (e.estado === 1) aplicarMapa(material, e.tex, colorConMapa);
  else if (e.estado === 0) e.pendientes.push([material, colorConMapa]);
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
// Material texturizado: `colorSin` sin textura, `colorCon` (multiplica el mapa) cuando carga.
function mTex(nombre, colorSin, colorCon = 0xffffff, rough = 0.85, { metal = 0, flat = false, doble = false } = {}) {
  return mat(`tex|${nombre}|${colorSin}|${colorCon}|${rough}|${metal}|${flat}|${doble}`, () => usarTextura(
    new THREE.MeshStandardMaterial({
      name: nombre, color: colorSin, roughness: rough, metalness: metal, flatShading: flat,
      side: doble ? THREE.DoubleSide : THREE.FrontSide,
    }), nombre, colorCon));
}
// Pintura gastada multiplicada por el color del vehículo (cacheada por color).
const mPintura = (color, doble = false) => mTex("pintura", color, color, 0.55, { flat: true, doble });

const mCromo = () => mat("cromo", () => new THREE.MeshStandardMaterial({
  color: 0xf0f2f5, roughness: 0.15, metalness: 1 }));
const mEspejo = () => mat("espejo", () => new THREE.MeshStandardMaterial({
  color: 0xf4f7fa, roughness: 0.02, metalness: 1 }));
const mNegro = () => mStd(0x1b1b1d, 0.8);
// Luna de espejo azul plana, sin reflejos (como la primera versión)
const mEspejoAzul = () => mat("espejoAzul", () => new THREE.MeshStandardMaterial({
  color: 0x3a6fb5, roughness: 0.4, metalness: 0, envMapIntensity: 0 }));
const mGrisOsc = () => mStd(0x3a3c40, 0.8);
const mAmarillo = () => mStd(0xf2c200, 0.6);
const mNeumatico = () => mTex("llanta", 0x1a1a1a, 0xffffff, 0.92);
const mAro = () => mat("aro", () => new THREE.MeshStandardMaterial({
  color: 0xb4bac2, roughness: 0.35, metalness: 0.7, flatShading: true }));
const mVidrio = () => mat("vidrio", () => new THREE.MeshStandardMaterial({
  color: 0xdcecff, roughness: 0.04, metalness: 0.15, transparent: true, opacity: 0.14,
  depthWrite: false, side: THREE.DoubleSide,
}));
const mVidrioOscuro = () => mat("vidrioOsc", () => new THREE.MeshStandardMaterial({
  color: 0x0c1218, roughness: 0.1, metalness: 0.6 }));
const mCuerina = () => mTex("cuerina", 0x222326, 0xffffff, 0.7);
const mConcreto = () => mStd(0x9c9890, 0.95);
const mMadera = () => mStd(0x8a6a45, 0.9);

// Materiales compartidos para el motor
export function materialPirca() { return mTex("pirca", 0x8a7d6b, 0xffffff, 0.95); }
export function materialTierra() { return mTex("tierra", 0x8b6f4e, 0xffffff, 0.95); }
export function materialCalamina() { return mTex("calamina", 0x9aa0a6, 0xffffff, 0.55, { metal: 0.3, doble: true }); }

// ---------------------------------------------------------------------------
// Utilidades de construcción
// ---------------------------------------------------------------------------
const v3 = (x, y, z) => new THREE.Vector3(x, y, z);
const _EJE_Y = new THREE.Vector3(0, 1, 0);
let _rnd = Math.random;
const pick = (arr) => arr[Math.floor(_rnd() * arr.length)];
const azar = (a, b) => a + _rnd() * (b - a);
// Ejecuta fn con un generador pseudoaleatorio con semilla (mulberry32): mismo resultado siempre.
function conSemilla(semilla, fn) {
  let t = Math.floor(semilla * 9973) >>> 0;
  const prev = _rnd;
  _rnd = () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
  try { return fn(); } finally { _rnd = prev; }
}

// ---------------------------------------------------------------------------
// Fusión de mallas estáticas por material (menos draw calls)
// ---------------------------------------------------------------------------
const _fusiones = new Map();
// Une las mallas descendientes de `contenedor` que comparten material en una sola malla.
// `excluir`: nodos (y su subárbol) que deben quedar separados (piezas animadas o referenciadas).
// `cache`: clave de estructura; con ella la geometría fusionada se reutiliza entre instancias
// (solo para modelos deterministas). Sin clave se crea una geometría nueva por instancia.
function fusionar(contenedor, { excluir = [], cache = null } = {}) {
  contenedor.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(contenedor.matrixWorld).invert();
  const ex = new Set(excluir.filter(Boolean));
  const grupos = new Map();
  const recorrer = (o) => {
    for (const c of o.children) {
      if (ex.has(c)) continue;
      if (c.isMesh && c.children.length === 0) {
        let l = grupos.get(c.material);
        if (!l) { l = []; grupos.set(c.material, l); }
        l.push(c);
      } else recorrer(c);
    }
  };
  recorrer(contenedor);
  const firma = [...grupos.values()].map((l) => l.length).join(",");
  let i = 0;
  for (const [material, lista] of grupos) {
    const k = i++;
    if (lista.length < 2) continue;
    const clave = cache ? `${cache}|${firma}|${k}` : null;
    let g = clave ? _fusiones.get(clave) : null;
    if (!g) {
      g = unirGeometrias(lista.map((m) => [m.geometry, new THREE.Matrix4().multiplyMatrices(inv, m.matrixWorld)]));
      if (clave) { _fusiones.set(clave, g); _compartidos.add(g); }
    }
    const me = new THREE.Mesh(g, material);
    me.castShadow = lista.some((m) => m.castShadow);
    me.receiveShadow = true;
    contenedor.add(me);
    for (const m of lista) m.parent.remove(m);
  }
  return contenedor;
}

// Libera solo recursos propios; las cachés y los materiales de la pista sobreviven.
export function liberarRecursos(raiz, conservar = new Set(), liberados = new Set()) {
  const liberar = (r) => {
    if (!r || _compartidos.has(r) || conservar.has(r) || liberados.has(r)) return;
    liberados.add(r);
    r.dispose();
  };
  raiz.traverse((o) => {
    if (o.isInstancedMesh) liberar(o);
    liberar(o.geometry);
    if (!o.material) return;
    const materiales = Array.isArray(o.material) ? o.material : [o.material];
    for (const m of materiales) {
      if (_compartidos.has(m) || conservar.has(m) || liberados.has(m)) continue;
      for (const valor of Object.values(m)) if (valor && valor.isTexture) liberar(valor);
      liberar(m);
    }
  });
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
    const c = g.getAttribute("position").count;
    pos.set(g.getAttribute("position").array, o * 3);
    if (g.getAttribute("normal")) nor.set(g.getAttribute("normal").array, o * 3);
    if (g.getAttribute("uv")) uv.set(g.getAttribute("uv").array, o * 2);
    o += c;
    g.dispose();
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  out.setAttribute("normal", new THREE.BufferAttribute(nor, 3));
  out.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  out.computeBoundingSphere();
  out.computeBoundingBox();
  return out;
}

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
function escalarUV(g, su, sv) {
  const uv = g.getAttribute("uv");
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * su, uv.getY(i) * sv);
  uv.needsUpdate = true;
  return g;
}

// Extrusión con bisel que conserva las dimensiones nominales del contorno.
function extruir(puntos, prof, b, segs = 1) {
  const s = new THREE.Shape();
  puntos.forEach(([x, y], i) => (i ? s.lineTo(x, y) : s.moveTo(x, y)));
  s.closePath();
  const depth = Math.max(0.002, prof - 2 * b);
  const opts = { depth, curveSegments: 4, bevelEnabled: b > 0 };
  if (b > 0) Object.assign(opts, { bevelThickness: b, bevelSize: b, bevelOffset: -b, bevelSegments: segs });
  return { g: new THREE.ExtrudeGeometry(s, opts), depth };
}
// Contorno en plano XY extruido a lo largo de Z (centrado en Z).
function perfilFrontal(puntos, prof, b = 0.02, segs = 1) {
  const { g, depth } = extruir(puntos, prof, b, segs);
  g.translate(0, 0, -depth / 2);
  return g;
}
// Contorno lateral en plano (z, y) extruido a lo largo de X (centrado en X).
function perfilLateral(puntosZY, ancho, b = 0.03, segs = 1) {
  const { g, depth } = extruir(puntosZY, ancho, b, segs);
  g.rotateY(-Math.PI / 2);           // x_forma -> z del mundo, profundidad -> -x
  g.translate(depth / 2, 0, 0);
  return g;
}
function cajaR(w, h, d, b = 0.02) {
  return geo(`cajaR|${w}|${h}|${d}|${b}`, () =>
    perfilFrontal([[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [-w / 2, h / 2]], d, b));
}
function caja(w, h, d) {
  return geo(`caja|${w}|${h}|${d}`, () => new THREE.BoxGeometry(w, h, d));
}
function arco(cx, cy, r, a0, a1, n) {
  const p = [];
  for (let i = 0; i <= n; i++) {
    const a = a0 + ((a1 - a0) * i) / n;
    p.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
  }
  return p;
}
// Contorno lateral con pasos de rueda: borde inferior de zIni a zFin (adelante -> atrás),
// luego `arriba` (puntos de atrás hacia adelante).
function perfilConArcos(zIni, zFin, ySuelo, arcos, arriba) {
  const p = [[zIni, ySuelo]];
  for (const { z, r, yc } of arcos) {
    const a0 = Math.asin(Math.max(-1, Math.min(1, (ySuelo - yc) / r)));
    p.push(...arco(z, yc, r, Math.PI - a0, a0, 7));
  }
  p.push([zFin, ySuelo], ...arriba);
  return p;
}
// Cilindro entre dos puntos (geometría unitaria compartida, escalada en Y).
// Las barras finas (radio <= 3 cm) van sin tapas para ahorrar triángulos.
function segmento(a, b, radio, material, lados = 6, sombra = true, abierto = radio <= 0.03) {
  const g = geo(`seg|${radio}|${lados}|${abierto}`, () => new THREE.CylinderGeometry(radio, radio, 1, lados, 1, abierto));
  const m = malla(g, material, sombra);
  const d = new THREE.Vector3().subVectors(b, a);
  const L = d.length();
  m.position.copy(a).addScaledVector(d, 0.5);
  m.scale.set(1, L, 1);
  m.quaternion.setFromUnitVectors(_EJE_Y, d.normalize());
  return m;
}
// Hash determinista [0,1) para deformaciones reproducibles.
function ruido(x, y, z) {
  const s = Math.sin(+x.toFixed(3) * 12.9898 + +y.toFixed(3) * 78.233 + +z.toFixed(3) * 37.719) * 43758.5453;
  return s - Math.floor(s);
}
function piedra(r, material, sombra = true) {
  const g = geo(`piedra|${r}`, () => {
    const p = new THREE.IcosahedronGeometry(r, 0);
    const pos = p.getAttribute("position");
    for (let i = 0; i < pos.count; i++) {
      const k = 0.75 + 0.5 * ruido(pos.getX(i), pos.getY(i), pos.getZ(i));
      pos.setXYZ(i, pos.getX(i) * k, pos.getY(i) * k * 0.7, pos.getZ(i) * k);
    }
    p.computeVertexNormals();
    return p;
  });
  return malla(g, material, sombra);
}

// Rueda: grupo cuyo eje local X es el eje de giro.
function crearRueda(r, w) {
  const g = new THREE.Group();
  g.name = "rueda";
  const neu = geo(`neu|${r}|${w}`, () => {
    const p = [[0.6, -0.5], [0.88, -0.5], [1, -0.3], [1, 0.3], [0.88, 0.5], [0.6, 0.5]]
      .map(([a, b]) => new THREE.Vector2(a * r, b * w));
    const lg = new THREE.LatheGeometry(p, 12);
    escalarUV(lg, Math.max(3, Math.round(r * 16)), 1); // banda de rodadura repetida alrededor
    lg.rotateZ(Math.PI / 2);
    return lg;
  });
  g.add(malla(neu, mNeumatico()));
  const aro = geo(`aro|${r}|${w}`, () => new THREE.CylinderGeometry(r * 0.62, r * 0.62, w * 0.84, 10).rotateZ(Math.PI / 2));
  g.add(malla(aro, mAro(), false));
  // Maza pentagonal: hace visible el giro
  const maza = geo(`maza|${r}|${w}`, () => new THREE.CylinderGeometry(r * 0.3, r * 0.3, w * 0.96, 5).rotateZ(Math.PI / 2));
  g.add(malla(maza, mAro(), false));
  return fusionar(g, { cache: `rueda|${r}|${w}` }); // neumático + aro: 2 draw calls
}

// Rueda de bajo detalle: un solo cilindro (una draw call).
function crearRuedaSimple(r, w) {
  const g = new THREE.Group();
  g.name = "rueda";
  g.add(malla(geo(`ruedaS|${r}|${w}`, () => new THREE.CylinderGeometry(r, r, w, 8).rotateZ(Math.PI / 2)), mNeumatico()));
  return g;
}
// Espejo pequeño redondo junto al pilar A: varilla corta, carcasa negra, luna azul mate.
function espejoPequeno(padre, s, conAro = true) {
  padre.add(segmento(v3(s * 0.655, 1.2, -0.935), v3(s * 0.71, 1.3, -0.95), 0.007, mNegro(), 5, false));
  const esp = pon(padre, new THREE.Group(), s * 0.73, 1.33, -0.955, -0.05, s * -0.15, 0);
  const gCasc = geo(`t_espejo4|${conAro}`, () => new THREE.LatheGeometry(
    [[0, -0.022], [0.035, -0.02], [0.052, -0.01], [0.058, 0], [0.058, 0.003]].map(([r, y]) => new THREE.Vector2(r, y)),
    conAro ? 12 : 8).rotateX(Math.PI / 2));
  esp.add(malla(gCasc, mNegro(), false));
  if (conAro) esp.add(malla(geo("t_aroesp2", () => new THREE.TorusGeometry(0.057, 0.0035, 4, 16)), mCromo(), false));
  pon(esp, malla(geo(`t_luna4|${conAro}`, () => new THREE.CircleGeometry(0.054, conAro ? 16 : 10)), mEspejoAzul(), false), 0, 0, 0.003);
  return esp;
}

// ---------------------------------------------------------------------------
// TORITO (mototaxi tipo Bajaj RE)
// ---------------------------------------------------------------------------
const RAKE = 0.33;                          // inclinación del eje de dirección (rad)
const EJE_DEL = v3(0, 0.2, -1.103);         // eje de la rueda delantera
const LARGO_HORQ = 0.793;                   // del eje delantero a la tija superior (eje inclinado)
const CABEZA_DIR = v3(0, 0.2 + LARGO_HORQ * Math.cos(RAKE), -1.103 + LARGO_HORQ * Math.sin(RAKE)); // ≈ (0, 0.95, -0.846)
const _qRakeInv = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -RAKE);
// Mundo (torito en reposo) -> local de `direccion`
const aDir = (x, y, z) => v3(x, y, z).sub(CABEZA_DIR).applyQuaternion(_qRakeInv);
const vDir = (v) => v.clone().applyQuaternion(_qRakeInv);

// Manubrio (mitad derecha, coordenadas del torito en reposo; la izquierda es espejo)
const MANUBRIO = [v3(0, 1.005, -0.83), v3(0.09, 1.012, -0.832), v3(0.17, 1.035, -0.815),
  v3(0.235, 1.052, -0.78), v3(0.275, 1.058, -0.755), v3(0.405, 1.064, -0.705)];
const PUNO_INI = 0.03, PUNO_LARGO = 0.115, R_BARRA = 0.011;
const CODO = v3(0.3, 0.97, -0.47);          // codo del conductor (derecha)

// Carenado frontal (perfil lateral z,y): frente inclinado, arista bajo el parabrisas,
// cara trasera vertical (tablero) y escudo de piernas.
const NARIZ = [[-1.03, 0.48], [-0.985, 0.97], [-0.94, 0.975], [-0.94, 0.62], [-0.7, 0.48]];
const NARIZ_TILT = Math.atan2(0.045, 0.49);
const anchoNariz = (y) => 0.58 + 0.42 * Math.min(1, Math.max(0, (y - 0.48) / 0.5));
// Marco del parabrisas
const MARCO = { z: -0.95, y0: 0.96, y1: 1.625, ancho: 1.32, tilt: 0.06,
  hueco: { x: 0.575, y0: 1.07, y1: 1.555, r: 0.11 } };

function rectRedondeado(path, x0, y0, x1, y1, r) {
  path.moveTo(x0 + r, y0);
  path.lineTo(x1 - r, y0); path.quadraticCurveTo(x1, y0, x1, y0 + r);
  path.lineTo(x1, y1 - r); path.quadraticCurveTo(x1, y1, x1 - r, y1);
  path.lineTo(x0 + r, y1); path.quadraticCurveTo(x0, y1, x0, y1 - r);
  path.lineTo(x0, y0 + r); path.quadraticCurveTo(x0, y0, x0 + r, y0);
  return path;
}
// Marco (forma con hueco redondeado) extruido en Z, centrado en Z.
function marcoConHueco(ext, hueco, prof, b, curvas = 5) {
  const s = rectRedondeado(new THREE.Shape(), ...ext);
  s.holes.push(rectRedondeado(new THREE.Path(), ...hueco));
  const depth = Math.max(0.002, prof - 2 * b);
  const g = new THREE.ExtrudeGeometry(s, { depth, curveSegments: curvas, bevelEnabled: b > 0,
    bevelThickness: b, bevelSize: b, bevelOffset: -b, bevelSegments: 2 });
  g.translate(0, 0, -depth / 2);
  return g;
}
// Base ortonormal para piezas a lo largo del manubrio: Y = dirección del puño (hacia afuera),
// Z = arriba, X tal que la base sea derecha. Devuelve también "hacia el conductor" en ese marco.
function marcoPuno(s, inicio, dirMundo) {
  const yW = dirMundo.clone().normalize();
  const upW = new THREE.Vector3(0, 1, 0).addScaledVector(yW, -yW.y).normalize();
  const atrasW = new THREE.Vector3().crossVectors(upW, yW).multiplyScalar(-s).normalize(); // +Z aprox.
  const xW = atrasW.clone().multiplyScalar(s);
  const m = new THREE.Matrix4().makeBasis(vDir(xW), vDir(yW), vDir(upW));
  const o = new THREE.Group();
  o.quaternion.setFromRotationMatrix(m);
  o.position.copy(aDir(inicio.x, inicio.y, inicio.z));
  return { o, atras: s }; // en el marco: "hacia el conductor" = s * X local
}

// detalle: "alto" (jugador, cabina completa) | "bajo" (tráfico, solo exterior, < 1500 triángulos).
export function crearTorito({ color = 0xc8102e, conConductor = true, detalle = "alto", techo = null } = {}) {
  if (detalle === "bajo") return crearToritoBajo(color, conConductor, techo ?? color);
  const raiz = new THREE.Group();
  raiz.name = "torito";
  const carroceria = new THREE.Group();
  carroceria.name = "carroceria";
  raiz.add(carroceria);

  const mCuerpo = mPintura(color);
  const mMarco = color === 0xc8102e ? mTex("metal_rojo", color, 0xffffff, 0.45, { metal: 0.3 }) : mPintura(color);
  const mNeg = mNegro();
  const mAsiento = mCuerina();
  const mLona = mTex("lona", 0x6e1420, 0xb07070, 0.95);
  const mVinilo = mat(`vinilo|${color}`, () => {
    // vinilo brillante; un leve emisivo evita que el forro (iluminado solo desde abajo) se vea negro
    const m = new THREE.MeshStandardMaterial({ color: color === 0xc8102e ? 0x9e0f1f : color, roughness: 0.35,
      emissive: color, emissiveIntensity: 0.12 });
    return color === 0xc8102e ? usarTextura(m, "vinilo_rojo", 0xffffff) : m;
  });
  const mPlastico = mTex("plastico", 0x1c1c1e, 0xffffff, 0.75);
  const mGoma = mStd(0x0e0e0f, 0.9, 0, false);
  const mAceroNegro = mat("aceroNegro", () => new THREE.MeshStandardMaterial({ color: 0x141416, roughness: 0.32, metalness: 0.55 }));

  // --- Piso / chasis ---
  pon(carroceria, malla(cajaR(1.22, 0.12, 1.2, 0.03), mCuerpo), 0, 0.36, -0.1);
  pon(carroceria, malla(cajaR(0.88, 0.12, 0.82, 0.02), mGrisOsc()), 0, 0.36, 0.9);
  pon(carroceria, malla(caja(1.1, 0.012, 1.1), mNeg, false), 0, 0.425, -0.12);

  // --- Paneles laterales traseros (con paso de rueda) ---
  const gPanel = geo("t_panel", () => perfilLateral(perfilConArcos(0.42, 1.31, 0.3,
    [{ z: 0.85, r: 0.29, yc: 0.24 }],
    [[1.32, 0.42], [1.32, 0.98], [0.56, 0.98], [0.42, 0.84]]), 0.05, 0.02));
  const mPegatina = mat("pegatina", () => usarTextura(new THREE.MeshStandardMaterial({
    color: 0xf2c200, roughness: 0.5, transparent: true, alphaTest: 0.4 }), "pegatina.png", 0xffffff));
  for (const s of [-1, 1]) {
    pon(carroceria, malla(gPanel, mCuerpo), s * 0.625, 0, 0);
    pon(carroceria, malla(caja(0.012, 0.05, 0.86), mAmarillo(), false), s * 0.652, 0.9, 0.89);
    pon(carroceria, malla(geo("t_pegatina", () => new THREE.PlaneGeometry(0.3, 0.3)), mPegatina, false), s * 0.652, 0.62, 1.12, 0, s * Math.PI / 2, 0);
  }
  // Panel trasero, franja y luces
  pon(carroceria, malla(cajaR(1.22, 0.68, 0.08, 0.02), mCuerpo), 0, 0.64, 1.28);
  pon(carroceria, malla(caja(1.2, 0.05, 0.012), mAmarillo(), false), 0, 0.9, 1.322);
  const mStop = new THREE.MeshStandardMaterial({ color: 0xd81020, emissive: 0xff1020, emissiveIntensity: 0.25, roughness: 0.4 });
  const luces = [];
  for (const s of [-1, 1]) {
    luces.push(pon(carroceria, malla(cajaR(0.13, 0.11, 0.03, 0.008), mStop, false), s * 0.48, 0.74, 1.325));
  }
  pon(carroceria, malla(caja(0.28, 0.14, 0.01), mStd(0xf4f4f0, 0.6), false), 0, 0.5, 1.325); // placa
  carroceria.add(segmento(v3(0.32, 0.27, 0.95), v3(0.35, 0.3, 1.36), 0.03, mGrisOsc(), 6, false)); // escape
  // Pared trasera de lona con ventanita
  pon(carroceria, malla(cajaR(1.24, 0.62, 0.04, 0.01), mCuerpo), 0, 1.28, 1.3);
  pon(carroceria, malla(caja(1.18, 0.56, 0.005), mLona, false), 0, 1.28, 1.277);
  pon(carroceria, malla(caja(0.6, 0.22, 0.01), mVidrioOscuro(), false), 0, 1.32, 1.323);

  // --- Carenado frontal: cuña con frente negro, faro abultado ---
  const gNariz = geo("t_nariz3", () => {
    const g = perfilLateral(NARIZ, 1.26, 0.03, 2);
    const pos = g.getAttribute("position");
    for (let i = 0; i < pos.count; i++) pos.setX(i, pos.getX(i) * anchoNariz(pos.getY(i)));
    g.computeVertexNormals();
    return g;
  });
  carroceria.add(malla(gNariz, mCuerpo));
  const nariz = pon(carroceria, new THREE.Group(), 0, 0.48, -1.03, NARIZ_TILT); // z local 0 = cara frontal
  const gPanelNegro = geo("t_panelnegro2", () =>
    perfilFrontal([[-0.17, 0.02], [0.17, 0.02], [0.27, 0.45], [-0.27, 0.45]], 0.03, 0.008));
  pon(nariz, malla(gPanelNegro, mNeg), 0, 0, -0.012);
  pon(nariz, malla(caja(1.14, 0.04, 0.012), mAmarillo(), false), 0, 0.47, -0.008);
  const gCasco = geo("t_cascofaro", () => new THREE.CylinderGeometry(0.125, 0.105, 0.08, 14, 1, true).rotateX(Math.PI / 2));
  pon(nariz, malla(gCasco, mNeg), 0, 0.3, -0.06);
  const aroFaro = geo("t_arofaro", () => new THREE.CylinderGeometry(0.104, 0.104, 0.02, 14).rotateX(Math.PI / 2));
  pon(nariz, malla(aroFaro, mCromo(), false), 0, 0.3, -0.1);
  const lente = geo("t_lente", () => new THREE.CylinderGeometry(0.086, 0.086, 0.02, 14).rotateX(Math.PI / 2));
  const mFaro = new THREE.MeshStandardMaterial({ color: 0xfff8e0, emissive: 0xfff2c0, emissiveIntensity: 0.15, roughness: 0.25 });
  const faro = pon(nariz, malla(lente, mFaro, false), 0, 0.3, -0.108);
  faro.name = "faro";
  const mNaranja = mat("direccional", () => new THREE.MeshStandardMaterial({ color: 0xff8a00, emissive: 0xff6a00, emissiveIntensity: 0.2, roughness: 0.4 }));
  for (const s of [-1, 1]) pon(nariz, malla(cajaR(0.1, 0.065, 0.03, 0.008), mNaranja, false), s * 0.4, 0.4, -0.012);
  // Tanque / cubierta roja abombada al pie de la dirección (se ve abajo al centro)
  const gTanque = geo("t_tanque", () => new THREE.SphereGeometry(0.17, 14, 6, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.55, 1.15));
  pon(carroceria, malla(gTanque, mCuerpo), 0, 0.7, -0.84);

  // --- Tablero de plástico negro (cara trasera del carenado, mira al conductor) ---
  const tablero = pon(carroceria, new THREE.Group(), 0, 0, -0.925);
  tablero.name = "tablero";
  const gTab = geo("t_tablero3", () => {
    const s = new THREE.Shape();
    const w = 0.575, y0 = 0.6, y1 = 0.965, r = 0.03, hx = 0.12, hy = 0.8;
    s.moveTo(-w + r, y0); s.lineTo(-hx, y0); s.lineTo(-hx, hy - 0.04);
    s.quadraticCurveTo(-hx, hy, -hx + 0.04, hy); s.lineTo(hx - 0.04, hy);
    s.quadraticCurveTo(hx, hy, hx, hy - 0.04); s.lineTo(hx, y0); s.lineTo(w - r, y0);
    s.quadraticCurveTo(w, y0, w, y0 + r); s.lineTo(w, y1 - r); s.quadraticCurveTo(w, y1, w - r, y1);
    s.lineTo(-w + r, y1); s.quadraticCurveTo(-w, y1, -w, y1 - r); s.lineTo(-w, y0 + r);
    s.quadraticCurveTo(-w, y0, -w + r, y0);
    const g = new THREE.ExtrudeGeometry(s, { depth: 0.014, curveSegments: 3, bevelEnabled: true,
      bevelThickness: 0.008, bevelSize: 0.008, bevelOffset: -0.008, bevelSegments: 2 });
    return escalarUV(g, 2, 2);
  });
  tablero.add(malla(gTab, mPlastico, false));
  pon(tablero, malla(caja(0.24, 0.22, 0.02), mNeg, false), 0, 0.69, -0.03); // hueco de la horquilla
  // Guantera izquierda y compartimento derecho, interruptores
  pon(tablero, malla(cajaR(0.3, 0.13, 0.02, 0.008), mPlastico, false), -0.34, 0.86, 0.03);
  pon(tablero, malla(cajaR(0.27, 0.11, 0.008, 0.003), mStd(0x0b0b0c, 0.6), false), -0.34, 0.86, 0.042);
  pon(tablero, malla(cajaR(0.3, 0.12, 0.02, 0.008), mPlastico, false), 0.33, 0.86, 0.03);
  pon(tablero, malla(cajaR(0.06, 0.05, 0.02, 0.006), mNeg, false), -0.22, 0.72, 0.03);
  pon(tablero, malla(caja(0.02, 0.03, 0.012), mStd(0x2a2a2c, 0.5), false), -0.22, 0.72, 0.045);
  for (const x of [0.22, 0.4]) {
    pon(tablero, malla(cajaR(0.04, 0.045, 0.016, 0.005), mNeg, false), x, 0.865, 0.045);
    pon(tablero, malla(caja(0.014, 0.022, 0.01), mStd(0xbfbfbf, 0.4, 0.5), false), x, 0.865, 0.056);
  }
  // Llave de contacto con llavero
  const gChapa = geo("t_chapa", () => new THREE.CylinderGeometry(0.022, 0.024, 0.02, 12).rotateX(Math.PI / 2));
  pon(tablero, malla(gChapa, mCromo(), false), 0.3, 0.865, 0.048);
  pon(tablero, malla(caja(0.012, 0.05, 0.004), mStd(0xb8bcc2, 0.25, 1), false), 0.3, 0.845, 0.062);
  pon(tablero, malla(geo("t_aro_llavero", () => new THREE.TorusGeometry(0.012, 0.0025, 4, 10)), mCromo(), false), 0.3, 0.81, 0.064);
  pon(tablero, malla(cajaR(0.024, 0.04, 0.006, 0.002), mStd(0xc8102e, 0.6), false), 0.302, 0.782, 0.064, 0, 0, 0.1);
  // Estampita de la Virgen
  const mVirgen = mat("virgen", () => usarTextura(new THREE.MeshStandardMaterial({
    color: 0x6f9fd8, roughness: 0.6, transparent: true, alphaTest: 0.3 }), "virgen.png", 0xffffff));
  pon(tablero, malla(geo("t_virgen", () => new THREE.PlaneGeometry(0.065, 0.1)), mVirgen, false), 0.47, 0.84, 0.042);

  // --- Marco del parabrisas: acero rojo grueso, empaque negro, vidrio sutil ---
  const marco = pon(carroceria, new THREE.Group(), 0, 0, MARCO.z, MARCO.tilt);
  const H = MARCO.hueco, w2 = MARCO.ancho / 2;
  const gMarco = geo("t_marco", () => marcoConHueco([-w2, MARCO.y0, w2, MARCO.y1, 0.04],
    [-H.x, H.y0, H.x, H.y1, H.r], 0.05, 0.012));
  // el marco rota alrededor de su base: compensar la altura
  marco.position.y = MARCO.y0 * (1 - Math.cos(MARCO.tilt));
  marco.position.z = MARCO.z - MARCO.y0 * Math.sin(MARCO.tilt);
  marco.add(malla(gMarco, mMarco));
  const gEmpaque = geo("t_empaque2", () => marcoConHueco([-H.x - 0.01, H.y0 - 0.01, H.x + 0.01, H.y1 + 0.01, H.r + 0.01],
    [-H.x + 0.005, H.y0 + 0.005, H.x - 0.005, H.y1 - 0.005, H.r - 0.005], 0.022, 0.004, 4));
  marco.add(malla(gEmpaque, mGoma, false));
  const gVidrio = geo("t_vidrio", () => new THREE.ShapeGeometry(rectRedondeado(new THREE.Shape(), -H.x, H.y0, H.x, H.y1, H.r), 5));
  const vidrio = malla(gVidrio, mVidrio(), false);
  vidrio.receiveShadow = false;
  marco.add(vidrio);
  // Limpiaparabrisas único a lo largo del borde inferior
  pon(marco, malla(cajaR(0.46, 0.014, 0.012, 0.004), mGoma, false), -0.2, H.y0 + 0.035, -0.012, 0, 0, 0.012);
  pon(marco, malla(caja(0.44, 0.006, 0.006), mAceroNegro, false), -0.2, H.y0 + 0.045, -0.018);
  marco.add(segmento(v3(0.02, H.y0 + 0.043, -0.02), v3(0.2, H.y0 + 0.02, -0.02), 0.005, mAceroNegro, 4, false));
  // Barra transversal del techo y empaque superior
  carroceria.add(segmento(v3(-0.64, 1.585, -0.9), v3(0.64, 1.585, -0.9), 0.024, mMarco, 8, false, true));
  pon(carroceria, malla(caja(1.26, 0.012, 0.02), mGoma, false), 0, 1.565, -0.905);

  for (const s of [-1, 1]) {
    // Pilar B (amarillo) y pasamanos lateral
    carroceria.add(segmento(v3(s * 0.62, 0.4, -0.12), v3(s * 0.62, 1.6, -0.12), 0.025, mAmarillo(), 6));
    carroceria.add(segmento(v3(s * 0.63, 1.22, -0.12), v3(s * 0.63, 1.22, 1.28), 0.018, mAmarillo(), 6, false));
    // Pilares A gruesos (rojos) bajando por los costados
    pon(carroceria, malla(cajaR(0.06, 0.5, 0.07, 0.015), mMarco), s * 0.635, 0.73, -0.95);
    // Espejos pequeños redondos, luna azul sin reflejos, pegados a los pilares
    espejoPequeno(carroceria, s, true);
    // Cortinas de lluvia enrolladas al borde del techo, con amarras
    carroceria.add(segmento(v3(s * 0.625, 1.53, -0.08), v3(s * 0.625, 1.53, 1.26), 0.038, mLona, 8, false, true));
    for (const z of [0.1, 0.6, 1.1]) pon(carroceria, malla(caja(0.085, 0.09, 0.025), mNeg, false), s * 0.625, 1.53, z);
  }

  // --- Techo (canopy) con bóveda suave y forro de vinilo rojo brillante ---
  const gTecho = geo("t_techo", () => perfilFrontal([[-0.645, 0], [0.645, 0], [0.645, 0.08], [0.58, 0.135], [0.32, 0.165],
    [-0.32, 0.165], [-0.58, 0.135], [-0.645, 0.08]], 2.32, 0.04, 2));
  pon(carroceria, malla(gTecho, mCuerpo), 0, 1.585, 0.17);
  const gForro = geo("t_forro", () => {
    const g = new THREE.PlaneGeometry(1.22, 2.2, 4, 8);
    const pos = g.getAttribute("position");
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i);
      const sx = 1 - Math.pow((2 * x) / 1.22, 2);
      const sz = Math.abs(Math.sin((y / 2.2 + 0.5) * Math.PI * 3));
      pos.setZ(i, -0.035 * sx * (0.4 + 0.6 * sz));
    }
    g.rotateX(Math.PI / 2);
    g.computeVertexNormals();
    return escalarUV(g, 1.2, 2.2);
  });
  pon(carroceria, malla(gForro, mVinilo, false), 0, 1.582, 0.17);
  for (const z of [-0.12, 0.6, 1.2]) carroceria.add(segmento(v3(-0.62, 1.565, z), v3(0.62, 1.565, z), 0.014, mGrisOsc(), 5, false));

  // Estampita del Señor de los Milagros colgada de la barra frontal, a la derecha del conductor.
  // Pivote arriba; oscila con rotation.x / rotation.z.
  const adorno = pon(carroceria, new THREE.Group(), 0.27, 1.565, -0.9);
  adorno.name = "adorno";
  const mCuenta = mStd(0x4a2412, 0.45, 0, false);
  const gCuenta = geo("t_cuenta2", () => new THREE.IcosahedronGeometry(0.0055, 0));
  for (let i = 0; i < 4; i++) pon(adorno, malla(gCuenta, mCuenta, false), (i % 2) * 0.002, -0.006 - i * 0.0105, 0);
  const mEstampa = mat("senorMilagros", () => usarTextura(new THREE.MeshStandardMaterial({
    color: 0x5b2a86, roughness: 0.35, side: THREE.DoubleSide, transparent: true, alphaTest: 0.3 }), "senor_milagros.png", 0xffffff));
  pon(adorno, malla(geo("t_estampa", () => new THREE.PlaneGeometry(0.06, 0.09).translate(0, -0.045, 0)), mEstampa, false), 0, -0.044, 0);

  // --- Asiento del conductor (cuerina) ---
  pon(carroceria, malla(caja(0.34, 0.18, 0.24), mGrisOsc()), 0, 0.51, -0.27);
  pon(carroceria, malla(cajaR(0.5, 0.1, 0.32, 0.035), mAsiento), 0, 0.645, -0.27);
  pon(carroceria, malla(cajaR(0.46, 0.22, 0.06, 0.02), mAsiento), 0, 0.88, -0.09, 0.1);
  carroceria.add(segmento(v3(-0.62, 0.99, -0.07), v3(0.62, 0.99, -0.07), 0.016, mCromo(), 6, false)); // agarradera
  // --- Asiento de pasajeros (cuerina) con respaldo ---
  pon(carroceria, malla(caja(0.95, 0.16, 0.56), mGrisOsc()), 0, 0.5, 0.88);
  pon(carroceria, malla(cajaR(1.14, 0.12, 0.52, 0.04), mAsiento), 0, 0.64, 0.86);
  pon(carroceria, malla(cajaR(1.14, 0.44, 0.1, 0.035), mAsiento), 0, 0.94, 1.18, 0.12);

  // --- Dirección: cabezal inclinado + pivote (rotación local Y) ---
  const cabezal = pon(carroceria, new THREE.Group(), CABEZA_DIR.x, CABEZA_DIR.y, CABEZA_DIR.z, RAKE);
  const direccion = new THREE.Group();
  direccion.name = "direccion";
  cabezal.add(direccion);

  // Tija superior negra con tapas cromadas y tuerca central
  const gTija = geo("t_tija", () => {
    const s = new THREE.Shape();
    s.moveTo(-0.12, -0.03); s.quadraticCurveTo(-0.15, 0, -0.12, 0.03);
    s.quadraticCurveTo(0, 0.06, 0.12, 0.03); s.quadraticCurveTo(0.15, 0, 0.12, -0.03);
    s.quadraticCurveTo(0, -0.055, -0.12, -0.03);
    const g = new THREE.ExtrudeGeometry(s, { depth: 0.016, curveSegments: 4, bevelEnabled: true,
      bevelThickness: 0.006, bevelSize: 0.006, bevelOffset: -0.006, bevelSegments: 2 });
    g.rotateX(-Math.PI / 2);
    return g;
  });
  pon(direccion, malla(gTija, mAceroNegro, false), 0, -0.01, 0);
  const gTapa = geo("t_tapa", () => new THREE.CylinderGeometry(0.019, 0.019, 0.014, 12));
  const gTuerca = geo("t_tuerca", () => new THREE.CylinderGeometry(0.022, 0.022, 0.02, 6));
  for (const s of [-1, 1]) {
    pon(direccion, malla(gTapa, mCromo(), false), s * 0.085, 0.02, 0);
    // Abrazaderas del manubrio con pernos cromados
    pon(direccion, malla(cajaR(0.034, 0.05, 0.036, 0.008), mAceroNegro, false), s * 0.045, 0.035, 0);
    pon(direccion, malla(geo("t_perno", () => new THREE.CylinderGeometry(0.007, 0.007, 0.01, 8)), mCromo(), false), s * 0.045, 0.064, 0.012);
    // Barras de la horquilla
    direccion.add(segmento(v3(s * 0.085, 0.01, 0), v3(s * 0.085, -LARGO_HORQ, 0), 0.02, mCromo(), 10));
  }
  pon(direccion, malla(gTuerca, mCromo(), false), 0, 0.012, 0.035);

  // Manubrio tubular negro (TubeGeometry sobre CatmullRom)
  const gBarra = geo("t_barra", () => {
    const der = MANUBRIO.map((p) => aDir(p.x, p.y, p.z));
    const izq = der.slice(1).reverse().map((p) => v3(-p.x, p.y, p.z));
    const curva = new THREE.CatmullRomCurve3([...izq, ...der], false, "centripetal");
    return new THREE.TubeGeometry(curva, 40, R_BARRA, 8, false);
  });
  direccion.add(malla(gBarra, mAceroNegro, false));

  // Puños, contrapesos, comandos, manetas y cables (por lado)
  const gPuno = geo("t_puno", () => {
    const L = PUNO_LARGO;
    const p = [[0, 0], [0.019, 0], [0.022, 0.005], [0.0175, 0.013], [0.0165, 0.03], [0.0165, L - 0.03],
      [0.0175, L - 0.012], [0.0215, L - 0.004], [0.02, L], [0, L]].map(([r, y]) => new THREE.Vector2(r, y));
    return escalarUV(new THREE.LatheGeometry(p, 12), 2, 1);
  });
  const mPuno = mTex("puno", 0x161616, 0xffffff, 0.9);
  const gContrapeso = geo("t_contrapeso", () => new THREE.LatheGeometry(
    [[0, 0], [0.016, 0], [0.018, 0.006], [0.017, 0.022], [0.012, 0.028], [0, 0.029]].map(([r, y]) => new THREE.Vector2(r, y)), 12));
  const gComando = cajaR(0.05, 0.04, 0.055, 0.012);
  for (const s of [-1, 1]) {
    const B4 = MANUBRIO[4].clone(), B5 = MANUBRIO[5].clone();
    B4.x *= s; B5.x *= s;
    const dir = B5.clone().sub(B4).normalize();
    const { o } = marcoPuno(s, B4, dir);
    direccion.add(o);
    pon(o, malla(gPuno, mPuno, false), 0, PUNO_INI, 0);
    pon(o, malla(gContrapeso, mCromo(), false), 0, PUNO_INI + PUNO_LARGO, 0);
    // Comando de luces/bocina (negro con botones)
    pon(o, malla(gComando, mAceroNegro, false), 0, 0.0, 0.004, Math.PI / 2, 0, 0);
    pon(o, malla(caja(0.012, 0.012, 0.012), mStd(0xc81818, 0.5), false), s * 0.026, 0.006, 0.012);
    pon(o, malla(caja(0.012, 0.016, 0.01), mStd(0x2a2a2c, 0.5), false), s * 0.027, -0.01, -0.004);
    // Maneta cromada delante del puño
    pon(o, malla(geo("t_soporte_maneta", () => new THREE.CylinderGeometry(0.012, 0.012, 0.03, 8).rotateX(Math.PI / 2)), mCromo(), false), -s * 0.03, -0.012, 0.0);
    o.add(segmento(v3(-s * 0.04, -0.005, 0.0), v3(-s * 0.045, PUNO_INI + PUNO_LARGO - 0.005, -0.006), 0.0055, mCromo(), 6, false));
    // Cables que bajan en lazo hacia el tablero
    const ini = B4.clone().add(v3(-s * 0.01, -0.02, -0.01));
    for (const k of [0, 1]) {
      const pts = [ini.clone().add(v3(0, 0, -k * 0.012)), v3(s * (0.3 - k * 0.04), 0.97, -0.7), v3(s * (0.2 - k * 0.03), 0.9, -0.76), v3(s * 0.08, 0.86, -0.9)]
        .map((p) => aDir(p.x, p.y, p.z));
      const gCable = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 12, 0.0035, 4, false);
      direccion.add(malla(gCable, mGoma, false));
    }
  }

  // Velocímetro: copa negra, bisel cromado, esfera con textura y aguja. Su eje Y mira al conductor.
  const posVelo = aDir(0, 1.075, -0.8);
  const velo = pon(direccion, new THREE.Group(), posVelo.x, posVelo.y, posVelo.z, 0.82);
  direccion.add(segmento(v3(0, 0.02, 0.0), v3(posVelo.x, posVelo.y - 0.035, posVelo.z - 0.02), 0.009, mAceroNegro, 6, false));
  velo.add(malla(geo("t_copa", () => new THREE.LatheGeometry(
    [[0, -0.042], [0.035, -0.04], [0.052, -0.026], [0.058, -0.006], [0.058, 0.002]].map(([r, y]) => new THREE.Vector2(r, y)), 16)), mAceroNegro, false));
  pon(velo, malla(geo("t_bisel", () => new THREE.TorusGeometry(0.054, 0.0055, 6, 20).rotateX(Math.PI / 2)), mCromo(), false), 0, 0.003, 0);
  const gEsfera = geo("t_esfera3", () => new THREE.CircleGeometry(0.05, 20).rotateX(-Math.PI / 2));
  const mEsfera = mat("esferaVelo", () => usarTextura(new THREE.MeshStandardMaterial({
    color: 0xf5f3e8, emissive: 0x111111, roughness: 0.45 }), "velocimetro", 0xffffff));
  pon(velo, malla(gEsfera, mEsfera, false), 0, 0.001, 0);
  // Aguja: gira sobre su Z local (normal de la esfera, hacia el conductor).
  // rotation.z = 0 apunta a las 12; valores negativos giran en sentido horario.
  const aguja = pon(velo, new THREE.Group(), 0, 0.004, 0, -Math.PI / 2);
  aguja.name = "aguja";
  pon(aguja, malla(geo("t_aguja2", () => new THREE.BoxGeometry(0.0035, 0.046, 0.0015).translate(0, 0.017, 0)), mStd(0xe8401a, 0.5), false));
  pon(aguja, malla(geo("t_eje_aguja", () => new THREE.CylinderGeometry(0.006, 0.006, 0.004, 8).rotateX(Math.PI / 2)), mNeg, false), 0, 0, 0.002);
  aguja.rotation.z = 2.2;

  // Rueda delantera y guardabarro
  const ruedaDelantera = pon(direccion, crearRueda(0.2, 0.12), 0, -LARGO_HORQ, 0);
  ruedaDelantera.name = "ruedaDelantera";
  const guarda = pon(direccion, new THREE.Group(), 0, -LARGO_HORQ, 0, -RAKE);
  const gGuarda = geo("t_guardabarro", () =>
    new THREE.CylinderGeometry(0.255, 0.255, 0.16, 10, 1, true, 0.45, 2.45).rotateZ(Math.PI / 2));
  guarda.add(malla(gGuarda, mPintura(color, true)));

  // --- Ruedas traseras ---
  const ruedasTraseras = [-1, 1].map((s) => {
    const r = pon(raiz, crearRueda(0.21, 0.13), s * 0.53, 0.21, 0.85);
    r.name = s < 0 ? "ruedaTraseraIzq" : "ruedaTraseraDer";
    return r;
  });

  // --- Ojo del conductor (ancla de cámara en primera persona, transformación final) ---
  const ojoConductor = pon(carroceria, new THREE.Object3D(), OJO.x, OJO.y, OJO.z, OJO.rx);
  ojoConductor.name = "ojoConductor";

  raiz.userData = {
    ruedaDelantera, direccion, ruedasTraseras, ojoConductor, carroceria,
    faro, lucesTraseras: luces, aguja, adorno, detalle: "alto",
  };

  let conductor = null;
  if (conConductor) {
    conductor = crearConductor();
    carroceria.add(conductor);
    raiz.userData.conductor = conductor;
  }
  // Fusionar piezas estáticas por material (mismo resultado para cada color -> geometría cacheada)
  const k = `toritoA|${color}`;
  fusionar(carroceria, { excluir: [cabezal, conductor, adorno, ojoConductor, faro, ...luces], cache: `${k}|carr` });
  fusionar(direccion, { excluir: [ruedaDelantera, aguja], cache: `${k}|dir` });
  fusionar(adorno, { cache: "toritoA|adorno" });
  if (conductor) fusionar(conductor, { cache: "toritoA|conductor" });
  return raiz;
}

// Torito de tráfico: exterior simplificado, ruedas simples, conductor simple, sin cabina.
function crearToritoBajo(color, conConductor, colorTecho = color) {
  const raiz = new THREE.Group();
  raiz.name = "torito";
  const carroceria = new THREE.Group();
  carroceria.name = "carroceria";
  raiz.add(carroceria);
  const mCuerpo = mPintura(color);
  const mNeg = mNegro();
  pon(carroceria, malla(caja(1.2, 0.12, 2.0), mCuerpo), 0, 0.36, 0.3);
  const gPanel = geo("t_panel", () => perfilLateral(perfilConArcos(0.42, 1.31, 0.3,
    [{ z: 0.85, r: 0.29, yc: 0.24 }],
    [[1.32, 0.42], [1.32, 0.98], [0.56, 0.98], [0.42, 0.84]]), 0.05, 0.02));
  for (const s of [-1, 1]) {
    pon(carroceria, malla(gPanel, mCuerpo), s * 0.625, 0, 0);
    pon(carroceria, malla(caja(0.012, 0.05, 0.86), mAmarillo(), false), s * 0.652, 0.9, 0.89);
    carroceria.add(segmento(v3(s * 0.62, 0.4, -0.12), v3(s * 0.62, 1.6, -0.12), 0.025, mAmarillo(), 5));
    pon(carroceria, malla(caja(0.06, 1.15, 0.07), mCuerpo), s * 0.635, 1.05, -0.94);   // pilar A
    espejoPequeno(carroceria, s, false);
  }
  pon(carroceria, malla(caja(1.22, 0.68, 0.08), mCuerpo), 0, 0.64, 1.28);
  pon(carroceria, malla(caja(1.2, 0.05, 0.012), mAmarillo(), false), 0, 0.9, 1.322);
  // Techo y pared trasera de la cabina pueden ir en otro color (combinaciones con blanco)
  const mTecho = mPintura(colorTecho);
  pon(carroceria, malla(caja(1.24, 0.62, 0.04), mTecho), 0, 1.28, 1.3);
  const mStop = new THREE.MeshStandardMaterial({ color: 0xd81020, emissive: 0xff1020, emissiveIntensity: 0.25, roughness: 0.4 });
  const luces = [-1, 1].map((s) => pon(carroceria, malla(caja(0.13, 0.11, 0.03), mStop, false), s * 0.48, 0.74, 1.325));
  // Carenado, panel negro, faro
  const gNariz = geo("t_nariz3", () => {
    const g = perfilLateral(NARIZ, 1.26, 0.03, 2);
    const pos = g.getAttribute("position");
    for (let i = 0; i < pos.count; i++) pos.setX(i, pos.getX(i) * anchoNariz(pos.getY(i)));
    g.computeVertexNormals();
    return g;
  });
  carroceria.add(malla(gNariz, mCuerpo));
  const nariz = pon(carroceria, new THREE.Group(), 0, 0.48, -1.03, NARIZ_TILT);
  pon(nariz, malla(caja(0.48, 0.43, 0.03), mNeg), 0, 0.235, -0.012);
  pon(nariz, malla(caja(1.14, 0.04, 0.012), mAmarillo(), false), 0, 0.47, -0.008);
  const mFaro = new THREE.MeshStandardMaterial({ color: 0xfff8e0, emissive: 0xfff2c0, emissiveIntensity: 0.15, roughness: 0.25 });
  const faro = pon(nariz, malla(geo("t_lenteB", () => new THREE.CylinderGeometry(0.09, 0.1, 0.06, 10).rotateX(Math.PI / 2)), mFaro, false), 0, 0.3, -0.05);
  faro.name = "faro";
  // Marco del parabrisas simplificado y vidrio
  pon(carroceria, malla(caja(1.32, 0.11, 0.05), mCuerpo), 0, 1.015, -0.95);
  pon(carroceria, malla(caja(1.32, 0.06, 0.05), mCuerpo), 0, 1.59, -0.91);
  pon(carroceria, malla(geo("t_vidrioB", () => new THREE.PlaneGeometry(1.18, 0.5)), mVidrio(), false), 0, 1.31, -0.93, 0.06);
  // Techo
  const gTecho = geo("t_techo", () => perfilFrontal([[-0.645, 0], [0.645, 0], [0.645, 0.08], [0.58, 0.135], [0.32, 0.165],
    [-0.32, 0.165], [-0.58, 0.135], [-0.645, 0.08]], 2.32, 0.04, 2));
  pon(carroceria, malla(gTecho, mTecho), 0, 1.585, 0.17);
  // Asiento de pasajeros como bloque oscuro (se ve por los costados abiertos)
  pon(carroceria, malla(caja(1.1, 0.5, 0.5), mGrisOsc()), 0, 0.68, 0.9);

  // Dirección simple
  const cabezal = pon(carroceria, new THREE.Group(), CABEZA_DIR.x, CABEZA_DIR.y, CABEZA_DIR.z, RAKE);
  const direccion = new THREE.Group();
  direccion.name = "direccion";
  cabezal.add(direccion);
  for (const s of [-1, 1]) direccion.add(segmento(v3(s * 0.085, 0.01, 0), v3(s * 0.085, -LARGO_HORQ, 0), 0.02, mCromo(), 5));
  direccion.add(segmento(v3(-0.41, 0.07, 0.06), v3(0.41, 0.07, 0.06), 0.014, mNeg, 5, false));
  const ruedaDelantera = pon(direccion, crearRuedaSimple(0.2, 0.12), 0, -LARGO_HORQ, 0);
  ruedaDelantera.name = "ruedaDelantera";
  const guarda = pon(direccion, new THREE.Group(), 0, -LARGO_HORQ, 0, -RAKE);
  guarda.add(malla(geo("t_guardabarroB", () =>
    new THREE.CylinderGeometry(0.255, 0.255, 0.16, 6, 1, true, 0.45, 2.45).rotateZ(Math.PI / 2)), mPintura(color, true)));
  const ruedasTraseras = [-1, 1].map((s) => {
    const r = pon(raiz, crearRuedaSimple(0.21, 0.13), s * 0.53, 0.21, 0.85);
    r.name = s < 0 ? "ruedaTraseraIzq" : "ruedaTraseraDer";
    return r;
  });
  // Marcadores vacíos para compatibilidad
  const ojoConductor = pon(carroceria, new THREE.Object3D(), OJO.x, OJO.y, OJO.z, OJO.rx);
  ojoConductor.name = "ojoConductor";
  const aguja = new THREE.Object3D();
  const adorno = new THREE.Object3D();

  let conductor = null;
  if (conConductor) {
    conductor = new THREE.Group();
    conductor.name = "conductor";
    const piel = mStd(0xb07850, 0.8), camisa = mStd(0xf2f2f2, 0.85), pantalon = mStd(0x2b3a55, 0.85);
    pon(conductor, malla(caja(0.36, 0.44, 0.22), mStd(0xd4142a, 0.8)), 0, 0.97, -0.26);
    pon(conductor, malla(caja(0.34, 0.14, 0.4), pantalon), 0, 0.73, -0.4);
    pon(conductor, malla(caja(0.3, 0.3, 0.12), pantalon), 0, 0.6, -0.6);
    pon(conductor, malla(geo("p_cabezaB", () => new THREE.IcosahedronGeometry(0.11, 0)), piel), 0, 1.29, -0.27);
    pon(conductor, malla(geo("p_gorraB", () => new THREE.SphereGeometry(0.117, 6, 2, 0, Math.PI * 2, 0, Math.PI / 2)), mStd(0xf0f0ea, 0.8)), 0, 1.31, -0.27);
    for (const s of [-1, 1]) {
      const p4 = MANUBRIO[4];
      conductor.add(segmento(v3(s * 0.2, 1.12, -0.25), v3(s * p4.x, p4.y, p4.z), 0.045, camisa, 4));
    }
    carroceria.add(conductor);
  }
  raiz.userData = { ruedaDelantera, direccion, ruedasTraseras, ojoConductor, carroceria, faro,
    lucesTraseras: luces, aguja, adorno, detalle: "bajo" };
  if (conductor) raiz.userData.conductor = conductor;
  const k = `toritoB|${color}`;
  fusionar(carroceria, { excluir: [cabezal, conductor, ojoConductor, faro, ...luces], cache: `${k}|carr` });
  fusionar(direccion, { excluir: [ruedaDelantera], cache: `${k}|dir` });
  if (conductor) fusionar(conductor, { cache: "toritoB|conductor" });
  return raiz;
}
const OJO = { x: 0, y: 1.3, z: -0.27, rx: -0.14 };

// Conductor (se oculta en primera persona; los puños quedan libres).
function crearConductor() {
  const g = new THREE.Group();
  g.name = "conductor";
  const piel = mStd(0xb07850, 0.8);
  const chaleco = mStd(0xd4142a, 0.8);
  const camisa = mStd(0xf2f2f2, 0.85);
  const pantalon = mStd(0x2b3a55, 0.85);
  pon(g, malla(cajaR(0.34, 0.16, 0.26, 0.04), pantalon), 0, 0.74, -0.27);
  pon(g, malla(cajaR(0.36, 0.42, 0.22, 0.05), chaleco), 0, 0.98, -0.25, -0.05);
  pon(g, malla(caja(0.2, 0.1, 0.1), camisa, false), 0, 1.18, -0.26);
  const gCab = geo("p_cabeza", () => new THREE.IcosahedronGeometry(0.11, 1));
  pon(g, malla(gCab, piel), 0, 1.29, -0.27);
  const gGorra = geo("p_gorra", () => new THREE.SphereGeometry(0.117, 8, 3, 0, Math.PI * 2, 0, Math.PI / 2));
  pon(g, malla(gGorra, mStd(0xf0f0ea, 0.8)), 0, 1.31, -0.27);
  pon(g, malla(caja(0.18, 0.015, 0.11), mStd(0xc8102e, 0.8), false), 0, 1.315, -0.39);
  for (const s of [-1, 1]) {
    const hombro = v3(s * 0.2, 1.12, -0.25);
    const codo = CODO.clone(); codo.x *= s;
    g.add(segmento(hombro, codo, 0.048, camisa, 6));
    pon(g, malla(geo("p_codo", () => new THREE.IcosahedronGeometry(0.042, 0)), camisa, false), codo.x, codo.y, codo.z);
    // Antebrazo y mano sobre el puño (posición en reposo; el conductor se oculta en primera persona)
    const p4 = MANUBRIO[4], p5 = MANUBRIO[5];
    const mano = v3(s * (p4.x + p5.x) / 2, (p4.y + p5.y) / 2 + 0.01, (p4.z + p5.z) / 2 + 0.01);
    g.add(segmento(codo, mano, 0.036, piel, 5));
    pon(g, malla(cajaR(0.07, 0.05, 0.09, 0.015), piel, false), mano.x, mano.y + 0.01, mano.z);
    const cadera = v3(s * 0.1, 0.73, -0.27);
    const rodilla = v3(s * 0.15, 0.76, -0.55);
    const tobillo = v3(s * 0.16, 0.5, -0.6);
    g.add(segmento(cadera, rodilla, 0.07, pantalon, 5));
    g.add(segmento(rodilla, tobillo, 0.055, pantalon, 5));
    pon(g, malla(caja(0.09, 0.06, 0.2), mNegro(), false), tobillo.x, 0.46, tobillo.z - 0.05);
  }
  return g;
}

// ---------------------------------------------------------------------------
// CARROS: sedán limeño y combi
// ---------------------------------------------------------------------------
const COLORES_CARRO = [0xe8e8e4, 0x9aa3ad, 0x2f5d8c, 0x8c1c24, 0xd9b44a, 0x3d6b45, 0x1f1f22, 0xc75b2a, 0x6fa8c9];
const COLORES_COMBI = [0xf1efe6, 0xe9d9a6, 0xbfd8e8, 0xf2c94c, 0xd8e6d0];
const COLORES_FRANJA = [0x1a4fa0, 0xc8102e, 0x228b3c, 0xf28c00, 0x6a2c91];

const SPEC_SEDAN = {
  ancho: 1.66, rRueda: 0.3, wRueda: 0.19, xRueda: 0.72, ejes: [-1.3, 1.25],
  cuerpo: () => perfilConArcos(-2.1, 2.1, 0.3, [{ z: -1.3, r: 0.37, yc: 0.3 }, { z: 1.25, r: 0.37, yc: 0.3 }],
    [[2.13, 0.55], [2.08, 0.9], [1.0, 0.97], [-1.05, 0.97], [-1.95, 0.86], [-2.12, 0.7], [-2.13, 0.45]]),
  bisel: 0.06,
  cabina: { puntos: [[-1.0, 0.95], [-0.2, 1.42], [0.75, 1.43], [1.35, 0.95]], ancho: 1.46 },
  ventanas: [[[-0.82, 1.0], [-0.23, 1.37], [0.22, 1.37], [0.22, 1.0]], [[0.3, 1.0], [0.3, 1.37], [0.72, 1.38], [1.17, 1.0]]],
  anchoVentanas: 1.472,
  parabrisas: [[-1.0, 0.95], [-0.2, 1.42], 1.3],
  luneta: [[0.75, 1.43], [1.35, 0.95], 1.3],
  centroCabina: [0.3, 1.1],
  zFrente: -2.13, zAtras: 2.13, yFaros: 0.74, yStops: 0.8, yParachoque: 0.42,
  franjas: [],
};
const SPEC_COMBI = {
  ancho: 1.8, rRueda: 0.33, wRueda: 0.2, xRueda: 0.78, ejes: [-1.7, 1.45],
  cuerpo: () => perfilConArcos(-2.5, 2.5, 0.34, [{ z: -1.7, r: 0.4, yc: 0.33 }, { z: 1.45, r: 0.4, yc: 0.33 }],
    [[2.52, 0.6], [2.52, 2.05], [2.42, 2.2], [-1.75, 2.2], [-2.35, 1.35], [-2.5, 1.15], [-2.53, 0.55]]),
  bisel: 0.07,
  cabina: null,
  ventanas: [
    [[-2.17, 1.4], [-1.8, 1.98], [-1.68, 1.98], [-1.68, 1.4]],
    [[-1.58, 1.4], [-1.58, 1.98], [-0.72, 1.98], [-0.72, 1.4]],
    [[-0.62, 1.4], [-0.62, 1.98], [0.36, 1.98], [0.36, 1.4]],
    [[0.46, 1.4], [0.46, 1.98], [1.4, 1.98], [1.4, 1.4]],
    [[1.5, 1.4], [1.5, 1.98], [2.36, 1.98], [2.36, 1.4]],
  ],
  anchoVentanas: 1.812,
  parabrisas: [[-2.35, 1.35], [-1.75, 2.2], 1.55],
  luneta: null,
  centroCabina: [0, 1.4],
  zFrente: -2.53, zAtras: 2.52, yFaros: 0.85, yStops: 0.95, yParachoque: 0.46,
  franjas: [[1.02, 1.18], [0.92, 0.96]],
};

const SPEC_BUS = {
  ancho: 2.1, rRueda: 0.42, wRueda: 0.24, xRueda: 0.94, ejes: [-2.2, 2.15],
  cuerpo: () => perfilConArcos(-3.5, 3.5, 0.4, [{ z: -2.2, r: 0.49, yc: 0.42 }, { z: 2.15, r: 0.49, yc: 0.42 }],
    [[3.5, 0.7], [3.5, 2.7], [3.35, 2.9], [-3.28, 2.9], [-3.5, 2.65], [-3.5, 0.6]]),
  bisel: 0.06, cabina: null,
  ventanas: Array.from({ length: 6 }, (_, i) => {
    const z = -3.25 + i * 1.08;
    return [[z, 1.78], [z, 2.65], [z + 0.96, 2.65], [z + 0.96, 1.78]];
  }),
  anchoVentanas: 2.112,
  parabrisas: [[-3.51, 1.55], [-3.5, 2.65], 1.85],
  luneta: null, centroCabina: [0, 1.7],
  zFrente: -3.5, zAtras: 3.5, yFaros: 0.92, yStops: 1.0, yParachoque: 0.5,
  franjas: [],
};

// Separar laterales permite proyectar la imagen sin estirarla sobre techo y capó.
function geometriaCarro(S, superficie) {
  const original = perfilLateral(S.cuerpo(), S.ancho, S.bisel, 2);
  const fuente = original.index ? original.toNonIndexed() : original;
  const pos = fuente.getAttribute("position"), normal = fuente.getAttribute("normal");
  const uvOriginal = fuente.getAttribute("uv");
  const posiciones = [], normales = [], uvs = [];
  const techoPanel = S === SPEC_SEDAN ? 0.97 : S === SPEC_BUS ? 1.78 : 1.4;
  for (let i = 0; i < pos.count; i += 3) {
    const esLateral = Math.abs(normal.getX(i)) > 0.9;
    const esFrente = !esLateral && normal.getZ(i) < -0.65;
    if (superficie === "lateral" ? !esLateral : superficie === "frente" ? !esFrente : esLateral || esFrente) continue;
    for (let j = i; j < i + 3; j++) {
      posiciones.push(pos.getX(j), pos.getY(j), pos.getZ(j));
      normales.push(normal.getX(j), normal.getY(j), normal.getZ(j));
      if (superficie === "lateral") {
        const u = (pos.getZ(j) - S.zFrente) / (S.zAtras - S.zFrente);
        uvs.push(normal.getX(j) > 0 ? 1 - u : u,
          (pos.getY(j) - 0.3) / (techoPanel - 0.3));
      } else if (superficie === "frente") {
        const altoFrente = S === SPEC_SEDAN ? 0.97 : S === SPEC_BUS ? 1.55 : 1.35;
        uvs.push(0.5 - pos.getX(j) / S.ancho, (pos.getY(j) - 0.3) / (altoFrente - 0.3));
      } else uvs.push(uvOriginal.getX(j), uvOriginal.getY(j));
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(posiciones, 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(normales, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  if (fuente !== original) fuente.dispose();
  original.dispose();
  return g;
}

function vidrioInclinado(padre, p0, p1, ancho, centro) {
  const dz = p1[0] - p0[0], dy = p1[1] - p0[1];
  const L = Math.hypot(dz, dy);
  let nz = -dy / L, ny = dz / L;
  const mz = (p0[0] + p1[0]) / 2, my = (p0[1] + p1[1]) / 2;
  if (nz * (mz - centro[0]) + ny * (my - centro[1]) < 0) { nz = -nz; ny = -ny; }
  const m = malla(caja(ancho, 0.02, L * 0.86), mVidrioOscuro(), false);
  const sz = dz < 0 ? -1 : 1;
  m.rotation.x = -Math.atan2(dy * sz, dz * sz);
  m.position.set(0, my + ny * 0.008, mz + nz * 0.008);
  padre.add(m);
}

export function crearCarro({ color, tipo = "sedan" } = {}) {
  const esCombi = tipo === "combi";
  const esBus = tipo === "bus";
  const S = esBus ? SPEC_BUS : esCombi ? SPEC_COMBI : SPEC_SEDAN;
  if (esBus && color == null) color = 0xeac46a;
  if (color == null) color = pick(esCombi ? COLORES_COMBI : COLORES_CARRO);
  const raiz = new THREE.Group();
  raiz.name = esBus ? "bus" : esCombi ? "combi" : "carro";
  const carroceria = new THREE.Group();
  carroceria.name = "carroceria";
  raiz.add(carroceria);
  const mCuerpo = mPintura(color);
  const k = esBus ? "bus" : esCombi ? "combi" : "sedan";

  carroceria.add(malla(geo(`${k}_cuerpo`, () => geometriaCarro(S, "base")), mCuerpo));
  const nombreTextura = esBus ? "bus-lima-v1" : esCombi ? "combi-lima-v1" : "carro-lima-v1";
  const mLateral = mTex(nombreTextura, color, esBus || esCombi ? 0xffffff : color, 0.7);
  carroceria.add(malla(geo(`${k}_laterales`, () => geometriaCarro(S, "lateral")), mLateral));
  const texturaFrente = esBus ? "bus-frente-lima-v1" : esCombi ? "combi-frente-lima-v1" : "carro-frente-lima-v1";
  const mFrente = mTex(texturaFrente, color, esBus || esCombi ? 0xffffff : color, 0.65);
  carroceria.add(malla(geo(`${k}_frente`, () => geometriaCarro(S, "frente")), mFrente));
  if (S.cabina) {
    carroceria.add(malla(geo(`${k}_cabina`, () => perfilLateral(S.cabina.puntos, S.cabina.ancho, 0.05, 1)), mCuerpo));
  }
  const gVent = geo(`${k}_ventanas`, () => mergeSimple(S.ventanas.map((p) => perfilLateral(p, S.anchoVentanas, 0))));
  carroceria.add(malla(gVent, mVidrioOscuro(), false));
  vidrioInclinado(carroceria, S.parabrisas[0], S.parabrisas[1], S.parabrisas[2], S.centroCabina);
  if (S.luneta) vidrioInclinado(carroceria, S.luneta[0], S.luneta[1], S.luneta[2], S.centroCabina);
  else pon(carroceria, malla(caja(esBus ? 1.8 : 1.4, esBus ? 0.8 : 0.55, 0.02), mVidrioOscuro(), false), 0, esBus ? 2.2 : 1.68, S.zAtras + 0.005);

  if (S.franjas.length) {
    const mF = mPintura(0x1a4fa0);
    const largo = S.zAtras - S.zFrente - 0.2;
    for (const [y0, y1] of S.franjas) {
      pon(carroceria, malla(caja(S.ancho + 0.014, y1 - y0, largo), mF, false), 0, (y0 + y1) / 2, (S.zAtras + S.zFrente) / 2 + 0.05);
    }
    pon(carroceria, malla(caja(1.0, 0.14, 0.02), mStd(0xf6f1d8, 0.6), false), 0, 2.08, -1.86, -Math.atan2(0.85, 0.6) + Math.PI / 2);
  }

  const mFaroC = mat("faroCarro", () => new THREE.MeshStandardMaterial({ color: 0xfff8e6, emissive: 0xfff0c8, emissiveIntensity: 0.2, roughness: 0.2, metalness: 0.2 }));
  const mStopC = mat("stopCarro", () => new THREE.MeshStandardMaterial({ color: 0xc81020, emissive: 0xff1020, emissiveIntensity: 0.25, roughness: 0.3 }));
  const mAmbar = mat("ambarCarro", () => new THREE.MeshStandardMaterial({ color: 0xff8a00, emissive: 0xff6a00, emissiveIntensity: 0.15, roughness: 0.4 }));
  const xL = S.ancho / 2 - 0.22;
  for (const s of [-1, 1]) {
    pon(carroceria, malla(cajaR(0.3, 0.13, 0.05, 0.012), mCromo(), false), s * xL, S.yFaros, S.zFrente + 0.016);
    pon(carroceria, malla(cajaR(0.26, 0.1, 0.03, 0.01), mFaroC, false), s * xL, S.yFaros, S.zFrente - 0.005);
    pon(carroceria, malla(cajaR(0.08, 0.06, 0.03, 0.008), mAmbar, false), s * (xL + 0.2), S.yFaros - 0.08, S.zFrente + 0.02);
    pon(carroceria, malla(cajaR(0.22, 0.14, 0.05, 0.012), mStopC, false), s * (xL + 0.04), S.yStops, S.zAtras - 0.005);
  }
  const gPara = cajaR(S.ancho + 0.04, 0.16, 0.14, 0.04);
  pon(carroceria, malla(gPara, mGrisOsc()), 0, S.yParachoque, S.zFrente + 0.02);
  pon(carroceria, malla(gPara, mGrisOsc()), 0, S.yParachoque, S.zAtras - 0.02);
  pon(carroceria, malla(caja(0.62, 0.11, 0.02), mNegro(), false), 0, S.yFaros - 0.02, S.zFrente + 0.005);
  // Placas lisas (sin texto)
  pon(carroceria, malla(caja(0.34, 0.12, 0.01), mStd(0xf4f4ee, 0.5), false), 0, S.yParachoque, S.zFrente - 0.055);
  pon(carroceria, malla(caja(0.34, 0.12, 0.01), mStd(0xf2d64b, 0.5), false), 0, S.yParachoque + 0.17, S.zAtras + 0.01);
  // Espejos laterales con luna
  const yEsp = esBus ? 1.9 : esCombi ? 1.45 : 1.02, zEsp = esBus ? -3.25 : esCombi ? -2.05 : -0.85;
  for (const s of [-1, 1]) {
    pon(carroceria, malla(cajaR(0.08, 0.1, 0.14, 0.02), mNegro(), false), s * (S.ancho / 2 + 0.05), yEsp, zEsp);
    pon(carroceria, malla(caja(0.06, 0.08, 0.005), mEspejo(), false), s * (S.ancho / 2 + 0.05), yEsp, zEsp + 0.072);
  }

  const ruedas = [];
  for (const z of S.ejes) for (const s of [-1, 1]) {
    ruedas.push(pon(raiz, crearRueda(S.rRueda, S.wRueda), s * S.xRueda, S.rRueda, z));
  }
  raiz.userData = { ruedas, carroceria, tipo: k, largo: S.zAtras - S.zFrente, ancho: S.ancho + 0.12 };
  fusionar(carroceria, { cache: `carro|${k}` });
  return raiz;
}

// Fusión simple de geometrías no indexadas con los mismos atributos (sin addons).
function mergeSimple(geos) {
  const attrs = ["position", "normal", "uv"];
  const out = new THREE.BufferGeometry();
  for (const a of attrs) {
    const parts = geos.map((g) => (g.index ? g.toNonIndexed() : g).getAttribute(a));
    const size = parts[0].itemSize;
    const arr = new Float32Array(parts.reduce((n, p) => n + p.count * size, 0));
    let off = 0;
    for (const p of parts) { arr.set(p.array, off); off += p.count * size; }
    out.setAttribute(a, new THREE.BufferAttribute(arr, size));
  }
  geos.forEach((g) => g.dispose());
  return out;
}

// ---------------------------------------------------------------------------
// PERSONA
// ---------------------------------------------------------------------------
const PIELES = [0x8d5524, 0xa86b3c, 0xc68642, 0xb57a4c, 0x7a4a2a, 0xe0ac69];
const CAMISAS = [0x7b3fa0, 0xf2c200, 0x2e86c1, 0xe74c3c, 0x27ae60, 0xf5f5f5, 0xff7f50, 0x34495e, 0xe91e63];
const PANTALONES = [0x2b3a55, 0x1f1f22, 0x3e5c76, 0x5d4037, 0x4a4a4a, 0x2f4f2f];
const POLLERAS = [0xd81b60, 0x8e24aa, 0x00897b, 0xf4511e, 0x3949ab];
const PELOS = [0x111111, 0x1e1410, 0x2a1a10, 0x3b2a1e];

const MANTAS = [0xe53935, 0xff7043, 0x8e24aa, 0x00897b, 0xfdd835, 0x3949ab];
const CAMISAS_VIEJO = [0x8d8170, 0x5d6d7e, 0xbfb6a0, 0x6d4c41, 0x7f8c8d];
const TIPOS_PERSONA = ["senora", "viejo", "joven"];

// tipo: "senora" | "viejo" | "joven" (al azar si no se da). userData.tipo guarda el valor final.
export function crearPersona({ ropa, piel, tipo } = {}) {
  const r = typeof ropa === "object" && ropa !== null ? ropa : { camisa: ropa };
  if (!TIPOS_PERSONA.includes(tipo)) {
    tipo = r.falda === true ? "senora" : r.falda === false
      ? (Math.random() < 0.35 ? "viejo" : "joven")
      : (() => { const x = Math.random(); return x < 0.35 ? "senora" : x < 0.6 ? "viejo" : "joven"; })();
  }
  const esSenora = tipo === "senora", esViejo = tipo === "viejo";
  let sombrero = esSenora ? "hongo" : "no";
  const cCamisa = r.camisa ?? pick(esViejo ? CAMISAS_VIEJO : CAMISAS);
  const cPant = r.pantalon ?? pick(PANTALONES);
  const falda = esSenora ? r.falda !== false : (r.falda ?? (tipo === "joven" && Math.random() < 0.15));
  const cPiel = piel ?? pick(PIELES);
  const mPiel = mStd(cPiel, 0.8), mCam = mStd(cCamisa, 0.85), mPan = mStd(cPant, 0.85);

  const g = new THREE.Group();
  g.name = "persona";
  // Tronco con pivote en la cadera: el viejo camina encorvado
  const tronco = pon(g, new THREE.Group(), 0, 0.86, 0, esViejo ? -0.22 : 0);
  const sup = (obj, x, y, z, rx = 0, ry = 0, rz = 0) => pon(tronco, obj, x, y - 0.86, z, rx, ry, rz);
  const gPierna = geo("per_pierna", () => new THREE.BoxGeometry(0.13, 0.8, 0.15).translate(0, -0.4, 0));
  const gZapato = geo("per_zapato", () => new THREE.BoxGeometry(0.13, 0.06, 0.22).translate(0, -0.83, -0.03));
  const piernas = [-1, 1].map((s) => {
    const p = pon(g, new THREE.Group(), s * 0.09, 0.86, 0);
    p.add(malla(gPierna, falda ? mPiel : mPan));
    p.add(malla(gZapato, mNegro(), false));
    return p;
  });
  if (falda) {
    const gFalda = geo("per_falda", () => new THREE.CylinderGeometry(0.18, 0.3, 0.42, 8));
    pon(g, malla(gFalda, mStd(r.pollera ?? pick(POLLERAS), 0.85)), 0, 0.72, 0);
  } else {
    pon(g, malla(cajaR(0.34, 0.14, 0.2, 0.03), mPan), 0, 0.89, 0);
  }
  sup(malla(cajaR(0.38, 0.52, 0.22, 0.05), mCam), 0, 1.15, 0);
  sup(malla(caja(0.1, 0.08, 0.1), mPiel, false), 0, 1.43, 0);
  sup(malla(geo("p_cabeza2", () => new THREE.IcosahedronGeometry(0.115, 1)), mPiel), 0, 1.52, 0);
  const gPelo = geo("per_pelo", () => new THREE.SphereGeometry(0.122, 10, 4, 0, Math.PI * 2, 0, Math.PI / 2));
  const mPelo = esViejo ? mStd(0xbdbdbd, 0.9) : mStd(pick(PELOS), 0.9);
  sup(malla(gPelo, mPelo), 0, 1.53, 0.01, 0.25);
  const mOjo = mStd(0x111111, 0.6);
  for (const s of [-1, 1]) sup(malla(caja(0.025, 0.025, 0.01), mOjo, false), s * 0.04, 1.53, -0.11);

  if (esSenora) {
    // Manta sobre los hombros, atado (aguayo) a la espalda, trenzas y sombrero hongo
    const mManta = mStd(pick(MANTAS), 0.9);
    sup(malla(geo("per_manta", () => new THREE.CylinderGeometry(0.17, 0.27, 0.34, 6)), mManta), 0, 1.24, 0.01);
    sup(malla(cajaR(0.32, 0.3, 0.17, 0.05), mStd(pick(MANTAS), 0.9)), 0, 1.13, 0.17);
    for (const s of [-1, 1]) sup(malla(caja(0.03, 0.3, 0.03), mPelo, false), s * 0.06, 1.37, 0.1);
    const mHongo = mStd(pick([0x1f1f1f, 0x4e342e, 0xe8e0d0]), 0.8);
    sup(malla(geo("per_hongo", () => new THREE.CylinderGeometry(0.075, 0.09, 0.11, 8)), mHongo), 0, 1.68, 0.01);
    sup(malla(geo("per_ala", () => new THREE.CylinderGeometry(0.15, 0.15, 0.015, 10)), mHongo), 0, 1.625, 0.01);
  } else if (esViejo) {
    sombrero = Math.random() < 0.5 ? "gorra" : "ala";
    if (sombrero === "gorra") {
      // Gorra con visera
      const mG = mStd(pick([0x2b3a55, 0x5d4037, 0x3e3e3e]), 0.85);
      sup(malla(geo("per_gorra", () => new THREE.CylinderGeometry(0.12, 0.125, 0.06, 10)), mG), 0, 1.62, 0.0);
      sup(malla(caja(0.17, 0.015, 0.09), mG, false), 0, 1.6, -0.15);
    } else {
      // Sombrero de ala ancha
      const mS = mStd(pick([0xd8c9a3, 0x6d5a45, 0x2a2a2a]), 0.85);
      sup(malla(geo("per_copa", () => new THREE.CylinderGeometry(0.1, 0.115, 0.12, 8)), mS), 0, 1.66, 0.01);
      sup(malla(geo("per_alaancha", () => new THREE.CylinderGeometry(0.21, 0.21, 0.015, 10)), mS), 0, 1.61, 0.01);
    }
  }

  const gManga = geo("per_manga", () => new THREE.BoxGeometry(0.11, 0.26, 0.12).translate(0, -0.13, 0));
  const gAnte = geo("per_ante", () => new THREE.BoxGeometry(0.09, 0.32, 0.1).translate(0, -0.42, 0));
  const mManga = esSenora ? mStd(cCamisa, 0.85) : mCam;
  const brazos = [-1, 1].map((s) => {
    const b = sup(new THREE.Group(), s * 0.245, 1.37, 0);
    b.add(malla(gManga, mManga));
    b.add(malla(gAnte, mPiel));
    return b;
  });
  const baston = esViejo && Math.random() < 0.6;
  if (baston) {
    // Bastón en la mano derecha (sigue el balanceo del brazo)
    brazos[1].add(segmento(v3(0, -0.56, -0.02), v3(0.02, -1.25, -0.12), 0.012, mStd(0x5d4037, 0.8), 5, false));
  }
  const bolsa = esSenora && Math.random() < 0.5;
  if (bolsa) {
    // Bolsa colgada del brazo izquierdo
    pon(brazos[0], malla(cajaR(0.08, 0.2, 0.26, 0.03), mStd(pick(MANTAS), 0.9)), -0.07, -0.5, 0);
  }
  g.userData = { piernas, brazos, tipo };
  // Fusionar por pieza articulada (geometría cacheada por estructura; los colores van en los materiales)
  const kp = `per|${tipo}|${falda}|${sombrero}|${baston}|${bolsa}`;
  fusionar(g, { excluir: [tronco, ...piernas], cache: `${kp}|base` });
  fusionar(tronco, { excluir: brazos, cache: `${kp}|tronco` });
  piernas.forEach((pp, i) => fusionar(pp, { cache: `per|pierna|${falda}|${i}` }));
  brazos.forEach((b, i) => fusionar(b, { cache: `${kp}|brazo${i}` }));
  return g;
}

// ---------------------------------------------------------------------------
// PERRO callejero
// ---------------------------------------------------------------------------
const PELAJES = [0xa0682f, 0xd9b27c, 0x5a3a22, 0x222222, 0xc9a06a, 0x8b5a2b];

export function crearPerro({ pelaje } = {}) {
  const g = new THREE.Group();
  g.name = "perro";
  const mPel = mStd(pelaje ?? pick(PELAJES), 0.9);
  const mBlanco = mStd(0xf2ece0, 0.9);
  pon(g, malla(cajaR(0.17, 0.16, 0.36, 0.035), mPel), 0, 0.33, 0);
  pon(g, malla(cajaR(0.15, 0.12, 0.1, 0.02), mBlanco), 0, 0.31, -0.15);
  pon(g, malla(cajaR(0.14, 0.13, 0.15, 0.03), mPel), 0, 0.45, -0.22);
  pon(g, malla(cajaR(0.08, 0.07, 0.1, 0.015), mBlanco), 0, 0.42, -0.33);
  pon(g, malla(caja(0.035, 0.03, 0.02), mNegro(), false), 0, 0.445, -0.385);
  for (const s of [-1, 1]) {
    pon(g, malla(caja(0.04, 0.07, 0.03), mPel, false), s * 0.055, 0.53, -0.2, 0.3, 0, s * 0.35);
    pon(g, malla(caja(0.02, 0.02, 0.01), mNegro(), false), s * 0.04, 0.475, -0.297);
  }
  const cola = pon(g, new THREE.Group(), 0, 0.38, 0.17);
  cola.add(segmento(v3(0, 0, 0), v3(0, 0.08, 0.08), 0.018, mPel, 5, false));
  const gPata = geo("dog_pata", () => new THREE.BoxGeometry(0.05, 0.26, 0.05).translate(0, -0.13, 0));
  const patas = [];
  for (const z of [-0.12, 0.13]) for (const s of [-1, 1]) {
    const p = pon(g, new THREE.Group(), s * 0.055, 0.26, z);
    p.add(malla(gPata, mPel, false));
    patas.push(p); // orden: delIzq, delDer, trasIzq, trasDer
  }
  g.userData = { patas, cola };
  return fusionar(g, { excluir: [...patas, cola], cache: "perro" });
}

// ---------------------------------------------------------------------------
// GATO callejero ("michi"), ~0.45 m de largo
// ---------------------------------------------------------------------------
const PELAJES_GATO = {
  naranja: { base: 0xd9822b, rayas: 0xa85a1a },
  negro: { base: 0x1c1c1e },
  gris: { base: 0x7f8388, rayas: 0x5c6066 },
  blanconegro: { base: 0xf2efe8, manchas: 0x1c1c1e },
};

// pelaje: "naranja" | "negro" | "gris" | "blanconegro" o un color (número). Al azar si no se da.
export function crearGato({ pelaje } = {}) {
  const g = new THREE.Group();
  g.name = "gato";
  let p = typeof pelaje === "number" ? { base: pelaje } : PELAJES_GATO[pelaje];
  if (!p) p = PELAJES_GATO[pick(Object.keys(PELAJES_GATO))];
  const mBase = mStd(p.base, 0.9);
  const mMancha = p.manchas != null ? mStd(p.manchas, 0.9) : mBase;
  pon(g, malla(cajaR(0.12, 0.11, 0.27, 0.03), mBase), 0, 0.2, 0);
  pon(g, malla(cajaR(0.11, 0.1, 0.1, 0.025), mMancha), 0, 0.28, -0.17);   // cabeza
  pon(g, malla(cajaR(0.06, 0.04, 0.04, 0.012), mBase), 0, 0.26, -0.225);  // hocico
  pon(g, malla(caja(0.018, 0.012, 0.01), mStd(0xd88a94, 0.6), false), 0, 0.27, -0.247);
  const gOreja = geo("gato_oreja", () => new THREE.ConeGeometry(0.025, 0.05, 4));
  const mOjoG = mat("ojoGato", () => new THREE.MeshStandardMaterial({ color: 0xc8d23a, emissive: 0x6a7010, emissiveIntensity: 0.4 }));
  for (const s of [-1, 1]) {
    pon(g, malla(gOreja, mMancha, false), s * 0.033, 0.345, -0.165, 0, Math.PI / 4, s * -0.15);
    pon(g, malla(caja(0.018, 0.014, 0.008), mOjoG, false), s * 0.026, 0.295, -0.221);
  }
  if (p.rayas != null) {
    const mR = mStd(p.rayas, 0.9);
    for (const z of [-0.06, 0.0, 0.06]) pon(g, malla(caja(0.124, 0.02, 0.022), mR, false), 0, 0.247, z);
  }
  if (p.manchas != null) pon(g, malla(caja(0.124, 0.06, 0.1), mMancha, false), 0, 0.235, 0.05);
  // Cola levantada (pivote en la base)
  const cola = pon(g, new THREE.Group(), 0, 0.23, 0.13);
  cola.add(segmento(v3(0, 0, 0), v3(0, 0.1, 0.07), 0.012, mMancha, 5, false));
  cola.add(segmento(v3(0, 0.1, 0.07), v3(0, 0.2, 0.05), 0.012, mMancha, 5, false));
  const gPata = geo("gato_pata", () => new THREE.BoxGeometry(0.032, 0.15, 0.032).translate(0, -0.075, 0));
  const patas = [];
  for (const z of [-0.09, 0.09]) for (const s of [-1, 1]) {
    const pt = pon(g, new THREE.Group(), s * 0.038, 0.15, z);
    pt.add(malla(gPata, mBase, false));
    patas.push(pt); // orden: delIzq, delDer, trasIzq, trasDer
  }
  g.userData = { patas, cola };
  return fusionar(g, { excluir: [...patas, cola], cache: `gato|${p.rayas != null}|${p.manchas != null}` });
}

// ---------------------------------------------------------------------------
// Animación de caminata
// ---------------------------------------------------------------------------
// frecuencia en pasos completos por segundo (~1.6 caminando, ~3 corriendo).
export function animarCaminar(modelo, t, frecuencia = 1.6) {
  const ud = modelo.userData;
  if (ud.piernas) {
    const a = Math.sin(t * Math.PI * 2 * frecuencia) * 0.55;
    ud.piernas[0].rotation.x = a;
    ud.piernas[1].rotation.x = -a;
    if (ud.brazos) {
      ud.brazos[0].rotation.x = -a * 0.8;
      ud.brazos[1].rotation.x = a * 0.8;
    }
  }
  if (ud.patas) {
    const a = Math.sin(t * Math.PI * 2 * frecuencia * 1.6) * 0.6;
    ud.patas[0].rotation.x = a;
    ud.patas[3].rotation.x = a;
    ud.patas[1].rotation.x = -a;
    ud.patas[2].rotation.x = -a;
  }
  if (ud.cola) ud.cola.rotation.z = Math.sin(t * 14) * 0.5;
}

// ---------------------------------------------------------------------------
// OBJETOS ESTÁTICOS DEL CERRO
// Todos: origen en el suelo, centrados en su huella; userData.largo (Z) y userData.ancho (X).
// ---------------------------------------------------------------------------
const mLadrillos = () => mTex("ladrillos", 0xb5562f, 0xffffff, 0.9);
const mLadrilloSuelto = () => mStd(0xb5562f, 0.9);

function pilaLadrillos(padre, w, h, d, x, y, z, ry = 0) {
  return pon(padre, malla(caja(w, h, d), mLadrillos()), x, y + h / 2, z, 0, ry, 0);
}
function sacoCemento(padre, x, y, z, ry) {
  return pon(padre, malla(cajaR(0.42, 0.13, 0.62, 0.05), mStd(0xc9bfa5, 0.95)), x, y + 0.065, z, 0, ry, 0);
}
function balde(padre, x, y, z, rx, rz, color = 0x2a7fd4) {
  const g = geo("balde", () => new THREE.CylinderGeometry(0.15, 0.12, 0.28, 9, 1, true, 0, 5.2));
  return pon(padre, malla(g, mat(`balde|${color}`, () =>
    new THREE.MeshStandardMaterial({ color, roughness: 0.6, side: THREE.DoubleSide, flatShading: true }))), x, y, z, rx, 0, rz);
}
function carretilla(padre, x, z, ry) {
  const c = pon(padre, new THREE.Group(), x, 0, z, 0, ry, 0);
  const mVerde = mStd(0x2f6b3a, 0.5, 0.3);
  const gBandeja = geo("carretilla_bandeja", () => {
    const g = new THREE.CylinderGeometry(0.42, 0.3, 0.28, 4, 1, false, Math.PI / 4).scale(0.9, 1, 1.25);
    return g;
  });
  pon(c, malla(gBandeja, mVerde), 0, 0.5, 0);
  pon(c, malla(geo("carretilla_arena", () => new THREE.CylinderGeometry(0.33, 0.33, 0.06, 4, 1, false, Math.PI / 4).scale(0.9, 1, 1.25)),
    mTex("arena", 0xc9a66b, 0xffffff, 1)), 0, 0.62, 0);
  pon(c, crearRueda(0.17, 0.07), 0, 0.17, -0.62);
  for (const s of [-1, 1]) {
    c.add(segmento(v3(s * 0.05, 0.17, -0.62), v3(s * 0.24, 0.42, -0.1), 0.018, mGrisOsc(), 5, false));
    c.add(segmento(v3(s * 0.24, 0.42, -0.1), v3(s * 0.28, 0.55, 0.85), 0.018, mGrisOsc(), 5, false));
    c.add(segmento(v3(s * 0.2, 0.4, 0.3), v3(s * 0.22, 0, 0.36), 0.015, mGrisOsc(), 5, false));
  }
  return c;
}

export function crearObra({ variante = 0 } = {}) {
  const vr0 = ((variante % 3) + 3) % 3;
  return fusionar(conSemilla(100 + vr0, () => obraBase(vr0)), { cache: `obra|${vr0}` });
}
function obraBase(variante) {
  const g = new THREE.Group();
  g.name = "obra";
  const vr = ((variante % 3) + 3) % 3;
  let largo, ancho;
  if (vr === 0) {
    // Montículo de arena + ladrillos + carretilla
    const gArena = geo("obra_arena", () => {
      const c = new THREE.ConeGeometry(1.0, 0.75, 10, 2);
      const pos = c.getAttribute("position");
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
        const k = y > 0.37 ? 1 : 0.85 + 0.3 * ruido(x, 0, z);
        pos.setXYZ(i, x * k * 0.9, y * (0.8 + 0.2 * ruido(z, y, x)), z * k * 1.15);
      }
      c.translate(0, 0.3, 0);
      c.computeVertexNormals();
      return escalarUV(c, 3, 1);
    });
    pon(g, malla(gArena, mTex("arena", 0xc9a66b, 0xffffff, 1)), 0.1, 0, -0.55);
    pilaLadrillos(g, 0.8, 0.55, 0.6, -0.25, 0, 1.0, 0.15);
    pilaLadrillos(g, 0.4, 0.2, 0.6, 0.45, 0, 1.15, -0.2);
    carretilla(g, 0.75, 0.45, 0.5);
    for (let i = 0; i < 3; i++) pon(g, malla(caja(0.24, 0.09, 0.12), mLadrilloSuelto()), azar(-0.8, 0.8), 0.045, azar(0.3, 1.5), 0, azar(0, 3), 0);
    largo = 3.3; ancho = 2.3;
  } else if (vr === 1) {
    // Columnas de concreto con fierros + muro a medio levantar
    const zs = [-1.3, 0, 1.3];
    const alturas = [2.5, 2.3, 2.6];
    zs.forEach((z, i) => {
      pon(g, malla(caja(0.25, alturas[i], 0.25), mConcreto()), 0, alturas[i] / 2, z);
      for (const [dx, dz] of [[-0.08, -0.08], [0.08, -0.08], [-0.08, 0.08], [0.08, 0.08]]) {
        g.add(segmento(v3(dx, alturas[i], z + dz), v3(dx * 1.4, alturas[i] + 0.55 + dx, z + dz * 1.5), 0.008, mStd(0x4a3328, 0.7, 0.4), 4, false));
      }
    });
    // Muro: tramo alto entre las dos primeras columnas, tramo bajo escalonado después
    const gMuro1 = geo("obra_muro1", () => escalarUV(new THREE.BoxGeometry(0.14, 1.4, 1.05), 1, 1));
    pon(g, malla(gMuro1, mTex("fachada1", 0xa85a3c, 0xffffff, 0.9)), 0, 0.7, -0.65);
    pon(g, malla(caja(0.14, 0.6, 0.7), mLadrillos()), 0, 0.3, 0.5);
    pon(g, malla(caja(0.14, 0.3, 0.35), mLadrillos()), 0, 0.15, 1.0);
    pon(g, malla(cajaR(0.6, 0.06, 0.25, 0.01), mConcreto()), 0, 0.03, 1.55); // ladrillos y baldes al pie
    pilaLadrillos(g, 0.5, 0.35, 0.5, 0.55, 0, -0.2, 0.2);
    balde(g, 0.6, 0.12, 0.7, 0.2, 1.3, 0x606060);
    pon(g, malla(caja(0.06, 0.06, 2.6), mMadera()), 0.4, 0.03, 0.2, 0, 0.1, 0); // tablón
    largo = 3.2; ancho = 1.6;
  } else {
    // Ladrillos sobre parihuela + bolsas de cemento
    const pal = pon(g, new THREE.Group(), -0.3, 0, -0.5);
    for (const z of [-0.45, 0, 0.45]) pon(pal, malla(caja(1.1, 0.09, 0.1), mMadera()), 0, 0.045, z);
    for (const x of [-0.45, -0.15, 0.15, 0.45]) pon(pal, malla(caja(0.12, 0.03, 1.05), mMadera()), x, 0.105, 0);
    pilaLadrillos(pal, 1.0, 0.75, 0.95, 0, 0.12, 0);
    pilaLadrillos(pal, 0.5, 0.25, 0.95, -0.25, 0.87, 0);
    const pos = [[0.5, 0.8, 0.1], [0.5, 1.45, -0.1], [-0.3, 1.0, 1.4], [0.45, 1.1, 0.25], [0.5, 1.15, 0.12]];
    sacoCemento(g, pos[0][0], 0, pos[0][1], pos[0][2]);
    sacoCemento(g, pos[1][0], 0, pos[1][1], pos[1][2]);
    sacoCemento(g, pos[2][0], 0, pos[2][1], 1.4);
    sacoCemento(g, 0.5, 0.13, 1.1, 0.25);
    balde(g, -0.55, 0.14, 0.75, 0, 0, 0x2a7fd4);
    largo = 2.8; ancho = 1.8;
  }
  g.userData = { largo, ancho, variante: vr };
  return g;
}

export function crearDesmonte({ tamano = 1 } = {}) {
  return fusionar(conSemilla(200 + tamano * 10, () => desmonteBase(tamano)), { cache: `desmonte|${tamano}` });
}
function desmonteBase(tamano) {
  const g = new THREE.Group();
  g.name = "desmonte";
  const gMonte = geo("desmonte_monte", () => {
    const s = new THREE.SphereGeometry(1, 11, 5, 0, Math.PI * 2, 0, Math.PI / 2);
    const pos = s.getAttribute("position");
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
      const k = 0.8 + 0.4 * ruido(x, y, z);
      const ky = y < 0.01 ? 0 : 0.75 + 0.5 * ruido(z, x, y);
      pos.setXYZ(i, x * k, y * ky, z * k);
    }
    s.computeVertexNormals();
    return escalarUV(s, 3, 1.5);
  });
  const monte = pon(g, malla(gMonte, mTex("desmonte", 0x8a7f72, 0xffffff, 1, { flat: true })), 0, 0, 0);
  monte.scale.set(1.0 * tamano, 0.8 * tamano, 1.2 * tamano);
  const mPiedra = mConcreto();
  const n = Math.round(6 * tamano);
  for (let i = 0; i < n; i++) {
    const a = azar(0, Math.PI * 2), r = azar(0.5, 1.15) * tamano;
    const x = Math.cos(a) * r * 0.95, z = Math.sin(a) * r * 1.15;
    const altura = Math.max(0, 0.8 * tamano * (1 - (r / (1.15 * tamano)) ** 2) * 0.8);
    if (i % 2) pon(g, malla(caja(0.24, 0.09, 0.12), mLadrilloSuelto()), x, altura + 0.04, z, azar(-0.5, 0.5), azar(0, 3), azar(-0.4, 0.4));
    else pon(g, piedra(azar(0.1, 0.18), mPiedra), x, altura + 0.05, z, 0, azar(0, 3), 0);
  }
  balde(g, 0.75 * tamano, 0.12, -0.9 * tamano, 1.35, 0.4, pick([0x2a7fd4, 0xe0a020, 0x3a9a3a, 0xd03030]));
  g.userData = { largo: +(2.75 * tamano).toFixed(2), ancho: +(2.1 * tamano).toFixed(2) };
  return g;
}

// Plancha de calamina: ancho a lo largo de Z, pendiente bajando hacia -X.
function techoCalamina(padre, largoZ, anchoX, yFrente, yFondo, material = materialCalamina()) {
  const caida = yFrente - yFondo;
  const pend = Math.hypot(anchoX, caida);
  const g = geo(`calamina|${largoZ}|${anchoX}|${caida}`, () => {
    const p = new THREE.PlaneGeometry(largoZ, pend);
    escalarUV(p, largoZ / 0.9, 1);
    p.rotateX(-Math.PI / 2);   // normal +Y, y local -> -Z
    p.rotateY(Math.PI / 2);    // ancho -> -Z, pendiente -> -X
    p.rotateZ(Math.atan2(caida, anchoX));
    return p;
  });
  const m = pon(padre, malla(g, material), 0, (yFrente + yFondo) / 2, 0);
  return { malla: m, yEn: (x) => yFondo + ((x + anchoX / 2) / anchoX) * caida };
}
// Pared con textura "vista de frente" (suelo abajo): caja fina con UV 0..1 por cara.
function pared(padre, mat_, w, h, t, x, y, z, ry = 0) {
  return pon(padre, malla(caja(w, h, t), mat_), x, y + h / 2, z, 0, ry, 0);
}
// Pared lateral trapezoidal (techo inclinado) en el plano XY, espesor en Z.
function hastial(padre, mat_, anchoX, hFrente, hFondo, t, z) {
  const g = geo(`hastial|${anchoX}|${hFrente}|${hFondo}|${t}`, () => {
    const p = perfilFrontal([[-anchoX / 2, 0], [anchoX / 2, 0], [anchoX / 2, hFrente], [-anchoX / 2, hFondo]], t, 0);
    // UV de las tapas en metros (x desde -ancho/2): normalizar a 0..1 para ver la textura completa
    const uv = p.getAttribute("uv");
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / anchoX + 0.5, uv.getY(i) / hFrente);
    return p;
  });
  return pon(padre, malla(g, mat_), 0, 0, z);
}

// crearChoza: el FRENTE (puerta) mira hacia +X. Largo a lo largo de Z, ancho (fondo) a lo largo de X.
// Rotar el grupo en Y para orientar la puerta hacia la calle.
export function crearChoza({ variante = 0 } = {}) {
  const vr0 = ((variante % 3) + 3) % 3;
  return fusionar(conSemilla(300 + vr0, () => chozaBase(vr0)), { cache: `choza|${vr0}` });
}
function chozaBase(variante) {
  const g = new THREE.Group();
  g.name = "choza";
  const vr = ((variante % 3) + 3) % 3;
  const cfg = [
    { L: 4.0, A: 3.0, hF: 2.3, hB: 2.0, tex: "triplay1", sin: 0xa98a62 },
    { L: 4.6, A: 3.4, hF: 2.5, hB: 2.15, tex: "triplay2", sin: 0x5f8fae },
    { L: 3.4, A: 2.8, hF: 2.1, hB: 1.85, tex: "estera", sin: 0xb89a5e },
  ][vr];
  const { L, A, hF, hB } = cfg;
  const mPared = mTex(cfg.tex, cfg.sin, 0xffffff, 0.92);
  const t = 0.05;
  // Frente (+X) y fondo (-X): paredes rotadas para que la cara texturizada mire hacia afuera
  pared(g, mPared, L, hF, t, A / 2 - t / 2, 0, 0, Math.PI / 2);
  pared(g, mPared, L, hB, t, -A / 2 + t / 2, 0, 0, -Math.PI / 2);
  hastial(g, mPared, A, hF, hB, t, L / 2 - t / 2);
  hastial(g, mPared, A, hF, hB, t, -L / 2 + t / 2);
  // Puerta y ventana en el frente
  const xF = A / 2 + 0.005;
  const mPuerta = vr === 2 ? mStd(0x2f6fb0, 0.9) : mStd(0x5a3d26, 0.85);
  pon(g, malla(caja(0.02, 1.85, 0.8), mPuerta), xF, 0.925, L * 0.18);
  pon(g, malla(caja(0.02, 0.5, 0.7), mStd(0x15181c, 0.7)), xF, 1.35, -L * 0.25);
  if (vr !== 2) pon(g, malla(caja(0.025, 0.06, 0.82), mMadera()), xF + 0.005, 1.63, -L * 0.25); // alféizar
  // Techo
  const mTecho = vr === 2
    ? mat("toldo", () => new THREE.MeshStandardMaterial({ color: 0x2a6fdb, roughness: 0.7, side: THREE.DoubleSide, flatShading: true }))
    : materialCalamina();
  const techo = techoCalamina(g, L + 0.3, A + 0.4, hF + 0.04, hB + 0.01, mTecho);
  // Piedras sobre el techo
  const mPied = mStd(0x7d766c, 0.95);
  const filas = vr === 1 ? [-1.2, 0, 1.2] : [-0.9, 0.9];
  for (const zf of filas) for (const xf of [-0.25, 0.3]) {
    const x = xf * A;
    pon(g, piedra(azar(0.1, 0.16), mPied), x, techo.yEn(x) + 0.05, zf * L / 3.2, 0, azar(0, 3), 0);
  }
  if (vr === 2) {
    // Estructura de palos en las esquinas
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const h = sx > 0 ? hF : hB;
      g.add(segmento(v3(sx * (A / 2 + 0.03), 0, sz * (L / 2 + 0.03)), v3(sx * (A / 2 + 0.03), h + 0.18, sz * (L / 2 + 0.03)), 0.05, mMadera(), 6));
    }
  }
  if (vr === 1) {
    // Tanque de agua negro sobre el techo
    const tq = geo("tanque", () => new THREE.CylinderGeometry(0.4, 0.4, 0.75, 10));
    pon(g, malla(tq, mStd(0x1c1c1e, 0.6)), -0.6, techo.yEn(-0.6) + 0.4, 1.3);
  }
  g.userData = { largo: +(L + 0.3).toFixed(2), ancho: +(A + 0.4).toFixed(2), variante: vr, frente: "+X" };
  return g;
}

// Pirca recta de piedra seca, a lo largo de Z de -largo/2 a +largo/2.
export function crearPirca(largo = 4) {
  return fusionar(conSemilla(400 + largo, () => pircaBase(largo)), { cache: `pirca|${largo}` });
}
function pircaBase(largo) {
  const g = new THREE.Group();
  g.name = "pirca";
  const gP = geo(`pirca|${largo}`, () => {
    const b = new THREE.BoxGeometry(0.5, 0.9, largo);
    const pos = b.getAttribute("position");
    for (let i = 0; i < pos.count; i++) if (pos.getY(i) > 0) pos.setX(i, pos.getX(i) * 0.75); // talud
    b.computeVertexNormals();
    const rep = Math.max(1, largo / 1.8); // textura 2:1 ~ 1.8 m x 0.9 m
    const uv = b.getAttribute("uv");
    for (let i = 0; i < 8; i++) uv.setX(i, uv.getX(i) * rep);   // caras ±X: u a lo largo de Z
    for (let i = 8; i < 16; i++) uv.setY(i, uv.getY(i) * rep);  // caras ±Y
    b.translate(0, 0.45, 0);
    return b;
  });
  g.add(malla(gP, materialPirca()));
  const mPied = mStd(0x8a8174, 0.95);
  const n = Math.max(2, Math.round(largo * 1.2));
  for (let i = 0; i < n; i++) {
    pon(g, piedra(azar(0.09, 0.14), mPied), azar(-0.1, 0.1), 0.92, -largo / 2 + (i + 0.5) * (largo / n), 0, azar(0, 3), 0);
  }
  g.userData = { largo, ancho: 0.5 };
  return g;
}
