import * as THREE from "three";
import { uniformesCielo, conNieblaCielo } from "./niebla.js?v=1.4.2";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { Pista, ANCHO, CELDA_ATLAS } from "./pista.js?v=1.4.2";
import { GestorTramos } from "./tramos.js?v=1.4.2";
import { Vehiculo } from "./vehiculo.js?v=1.4.2";
import { Trafico } from "./trafico.js?v=1.4.2";
import { Controles } from "./controles.js?v=1.4.2";
import { Sonido } from "./audio.js?v=1.4.2";
import { crearTorito, liberarRecursos } from "./modelos.js?v=1.4.2";
import { crearLetreros } from "./ambiente.js?v=1.4.2";

const elementos = new Map();
const $ = (id) => {
  if (!elementos.has(id)) elementos.set(id, document.getElementById(id));
  return elementos.get(id);
};
const textoHud = (id, texto) => {
  const el = $(id), valor = String(texto);
  if (el.textContent !== valor) el.textContent = valor;
};
const PASO_FISICA = 1 / 120;

// ---------- Render ----------
const renderer = new THREE.WebGLRenderer({ antialias: (devicePixelRatio || 1) < 2, powerPreference: "high-performance" });
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
$("escena").appendChild(renderer.domElement);

const escena = new THREE.Scene();
const COLOR_NIEBLA = 0xb3b9bd;               // cielo "panza de burro"
escena.background = new THREE.Color(COLOR_NIEBLA);
// Sin niebla a la vista: solo un fundido con la foto del cielo en el borde de lo cargado (~400 m)
// para que lo lejano no aparezca de golpe.
escena.fog = new THREE.Fog(COLOR_NIEBLA, 370, 420);

const camara = new THREE.PerspectiveCamera(72, 1, 0.08, 1200);

function redimensionar() {
  const ancho = Math.max(1, innerWidth), alto = Math.max(1, innerHeight);
  renderer.setSize(ancho, alto, false);
  camara.aspect = ancho / alto;
  camara.updateProjectionMatrix();
}
addEventListener("resize", redimensionar);
redimensionar();

const hemi = new THREE.HemisphereLight(0xdfe6ea, 0x5d4c3c, 1.5);
escena.add(hemi);
let hemiDia = 1.5, entornoTex = null;
const sol = new THREE.DirectionalLight(0xfff4e6, 1.3);
sol.castShadow = true;
sol.shadow.mapSize.set(1024, 1024);
Object.assign(sol.shadow.camera, { left: -22, right: 22, top: 22, bottom: -22, near: 1, far: 120 });
sol.shadow.bias = -0.0005;
escena.add(sol, sol.target);

// ---------- Texturas (con color de respaldo mientras cargan o si faltan) ----------
const cargador = new THREE.TextureLoader();
function textura(material, ruta, repetir = true, respaldo = null) {
  cargador.load(ruta, (t) => {
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    if (repetir) t.wrapS = t.wrapT = THREE.RepeatWrapping;
    else { t.wrapS = THREE.RepeatWrapping; t.wrapT = THREE.ClampToEdgeWrapping; }
    material.map = t;
    material.color.set(material.userData.tinte ?? 0xffffff);
    material.needsUpdate = true;
  }, undefined, () => { if (respaldo) textura(material, respaldo, repetir); });
}
const est = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.92, ...extra });

// Cuatro planos que usan cada uno un cuarto de una textura 2x2
function atlas2x2(ancho, alto) {
  return [0, 1, 2, 3].map((k) => {
    const g = new THREE.PlaneGeometry(ancho, alto).translate(0, -alto / 2, 0);   // cuelga desde arriba
    const uv = g.attributes.uv, ox = (k % 2) * 0.5, oy = k < 2 ? 0.5 : 0;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, ox + uv.getX(i) * 0.5, oy + uv.getY(i) * 0.5);
    return g;
  });
}

function degradadoRadial() {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d");
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, "rgba(255,255,255,1)");
  gr.addColorStop(0.5, "rgba(255,255,255,0.45)");
  gr.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = gr;
  g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

const rayas = document.createElement("canvas");
rayas.width = 128; rayas.height = 16;
{
  const c = rayas.getContext("2d");
  for (let i = 0; i < 8; i++) { c.fillStyle = i % 2 ? "#111" : "#f2c200"; c.fillRect(i * 16, 0, 16, 16); }
}
const texRayas = new THREE.CanvasTexture(rayas);
texRayas.colorSpace = THREE.SRGBColorSpace;

// ---------- Suciedad de fachadas: manchas y chorreados según la posición en el mundo ----------
// Se suma a la textura de cada casa sin reemplazarla: dos casas con la misma fachada se ensucian distinto.
function texturaSuciedad() {
  const N = 256, c = document.createElement("canvas");
  c.width = c.height = N;
  const g = c.getContext("2d"), img = g.createImageData(N, N);
  // Ruido de valor periódico (se repite sin costuras) en varias escalas
  const azar = (x, y, p) => { const h = Math.sin(((x % p) + p) % p * 127.1 + (((y % p) + p) % p) * 311.7) * 43758.5453; return h - Math.floor(h); };
  const ruido = (x, y, p) => {
    const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi;
    const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
    const a = azar(xi, yi, p), b = azar(xi + 1, yi, p), cc = azar(xi, yi + 1, p), d = azar(xi + 1, yi + 1, p);
    return a + (b - a) * sx + (cc - a) * sy + (a - b - cc + d) * sx * sy;
  };
  const chorreo = new Float32Array(N);
  for (let x = 0; x < N; x++) chorreo[x] = Math.pow(ruido(x / 6, 0.5, N / 6), 3);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    let v = 0, amp = 0.5, f = 4;
    for (let o = 0; o < 4; o++) { v += ruido((x / N) * f, (y / N) * f, f) * amp; amp *= 0.5; f *= 2; }
    // manchas suaves + chorreados verticales de garúa
    let k = 0.78 + (v - 0.5) * 0.7 - chorreo[x] * 0.35 * (0.6 + 0.4 * ruido(x / 3, y / 40, N / 3));
    k = Math.max(0.35, Math.min(1.08, k));
    const i = (y * N + x) * 4;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = Math.round(Math.min(1, k) * 255);
    img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}
const uniformSuciedad = { value: texturaSuciedad() };
// `mapa` reemplaza la lectura de la textura (el atlas de fachadas la cambia)
function ensuciar(material, mapa = "#include <map_fragment>", clave = "suciedad") {
  material.customProgramCacheKey = () => clave;
  material.onBeforeCompile = (sh) => {
    conNieblaCielo(sh);
    sh.uniforms.mapaSuciedad = uniformSuciedad;
    sh.vertexShader = "varying vec3 vMundo;\n" + sh.vertexShader.replace("#include <begin_vertex>",
      "#include <begin_vertex>\n vMundo = (modelMatrix * vec4(transformed, 1.0)).xyz;");
    sh.fragmentShader = "uniform sampler2D mapaSuciedad;\nvarying vec3 vMundo;\n" + sh.fragmentShader.replace("#include <map_fragment>", `${mapa}
      // dos muestras cruzadas para que funcione en paredes con cualquier orientación
      float s1 = texture2D(mapaSuciedad, vec2(vMundo.x, vMundo.y * 0.8) * 0.09).r;
      float s2 = texture2D(mapaSuciedad, vec2(vMundo.z + 17.0, vMundo.y * 0.8) * 0.09).r;
      float s3 = texture2D(mapaSuciedad, (vMundo.xz + vMundo.zx * 0.5) * 0.021).r;
      float suc = clamp(s1 * s2 * 1.25, 0.45, 1.05) * mix(0.82, 1.08, s3);
      #ifdef USE_MAP
        float pie = mix(0.62, 1.0, smoothstep(0.0, 0.16, vMapUv.y));   // polvo y humedad al pie del muro
      #else
        float pie = 1.0;
      #endif
      diffuseColor.rgb *= suc * pie;`);
  };
  return material;
}

const mat = {
  asfalto: est(0x77777a),
  vereda: est(0xb9b2a6, { side: THREE.DoubleSide }),
  bache: est(0x2c2a27, { roughness: 1, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
  reparacion: est(0x4c4a48, { side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2 }),
  grieta: est(0x292825, { side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -3 }),
  huella: est(0x282725, { transparent: true, opacity: 0.2, depthWrite: false, side: THREE.DoubleSide,
    polygonOffset: true, polygonOffsetFactor: -3 }),
  // Paredes pintadas y fachadas: el tinte de cada casa viene en el color de los vértices
  pared: est(0xffffff, { side: THREE.DoubleSide, vertexColors: true }),
  letreros: crearLetreros(),
  porton: est(0x728585, { side: THREE.DoubleSide }),
  grafiti: est(0xffffff, { side: THREE.DoubleSide }),
  fachada: est(0xffffff, { side: THREE.DoubleSide, vertexColors: true }),
  geoTanque: new THREE.CylinderGeometry(0.55, 0.55, 1.1, 12),
  tanque: est(0x1c1c1c, { roughness: 0.6 }),
  geoFierros: (() => {
    // Columnas sin terminar: 4 varillas oxidadas saliendo del techo
    const g = new THREE.CylinderGeometry(0.012, 0.012, 1, 3);
    const partes = [[-0.12, -0.12], [0.12, -0.12], [-0.12, 0.12], [0.12, 0.12]].map(([x, z]) => g.clone().translate(x, 0, z));
    return mergeGeometries(partes);
  })(),
  fierro: est(0x5a3a28, { roughness: 0.9 }),
  geoBrazo: new THREE.BoxGeometry(1.8, 0.08, 0.08),
  geoFoco: new THREE.BoxGeometry(0.55, 0.14, 0.28),
  foco: new THREE.MeshBasicMaterial({ color: 0x77776a }),
  geoCharco: new THREE.CircleGeometry(4.5, 20).rotateX(-Math.PI / 2),
  charco: new THREE.MeshBasicMaterial({ color: 0xffa94d, transparent: true, opacity: 0.32, depthWrite: false,
    blending: THREE.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -4, map: degradadoRadial() }),
  techo: est(0x7d746a, { side: THREE.DoubleSide }),
  poste: est(0x8f8f8f),
  posteMadera: est(0x6b4a2e),
  muroLateral: est(0xa8603f, { side: THREE.DoubleSide }),
  guardavia: est(0xb8bcc0, { metalness: 0.6, roughness: 0.45, side: THREE.DoubleSide }),
  madera: est(0x8a7056, { side: THREE.DoubleSide }),
  geoPosteGuardavia: new THREE.BoxGeometry(0.12, 1.1, 0.16),
  geoPosteValla: new THREE.CylinderGeometry(0.07, 0.08, 1.5, 6),
  ropa: est(0xffffff, { side: THREE.DoubleSide, alphaTest: 0.5 }),
  frazada: est(0xffffff, { side: THREE.DoubleSide, alphaTest: 0.5 }),
  geoPrendas: atlas2x2(0.6, 0.75),     // ropa.png: polo, jean, manta, toalla
  geoFrazadas: atlas2x2(1.3, 1.2),     // frazadas.png: tigre, tigre blanco, rosas, leopardo
  tierra: est(0x8a7458, { side: THREE.DoubleSide }),   // doble cara: la vereda de tierra izquierda queda invertida
  pirca: est(0x8d8172, { side: THREE.DoubleSide }),
  pircaLisa: est(0x8d8172, { side: THREE.DoubleSide }),
  cerro: est(0x9b8466, { side: THREE.DoubleSide }),
  baranda: est(0xd8d1c2, { side: THREE.DoubleSide }),
  cruz: est(0xf4f4f4),
  llantaPintada: est(0xffffff, { roughness: 0.8 }),
  geoLlanta: new THREE.TorusGeometry(0.38, 0.13, 6, 12),
  geoPalo: new THREE.CylinderGeometry(0.05, 0.06, 2.2, 5),
  geoPrenda: new THREE.PlaneGeometry(0.45, 0.6),
  prendas: [0xe63946, 0x2a9d8f, 0xf4a261, 0x3a86ff, 0xffffff, 0x8338ec].map((c) => est(c, { side: THREE.DoubleSide })),
  geoCilindro: new THREE.CylinderGeometry(0.3, 0.3, 0.9, 12),
  geoCruzPalo: new THREE.BoxGeometry(0.6, 9, 0.6),
  geoCruzBrazo: new THREE.BoxGeometry(4.5, 0.6, 0.6),
  cilindro: est(0x1f5fbf, { roughness: 0.5 }),
  geoPoste: new THREE.CylinderGeometry(0.11, 0.16, 8, 6),
  cable: new THREE.LineBasicMaterial({ color: 0x1d1d1d }),
  // Jardines y parques del barrio
  pasto: est(0x8f9a6a, { side: THREE.DoubleSide }),
  reja: est(0xffffff, { side: THREE.DoubleSide, alphaTest: 0.5, transparent: false }),
  follaje: est(0x4f7a35, { roughness: 0.95 }),
  corteza: est(0x6b5844),
  banca: est(0x2f5a3a),
  caminoParque: est(0xa9a49a, { side: THREE.DoubleSide }),
  geoArbusto: new THREE.IcosahedronGeometry(0.42, 0).scale(1, 0.75, 1),
  geoCopa: new THREE.IcosahedronGeometry(1.25, 1).scale(1, 0.8, 1),
  geoTronco: new THREE.CylinderGeometry(0.1, 0.15, 2.4, 6).translate(0, 1.2, 0),
  geoBanca: mergeGeometries([
    new THREE.BoxGeometry(1.6, 0.06, 0.42),
    new THREE.BoxGeometry(1.6, 0.32, 0.06).translate(0, 0.2, -0.2),
    new THREE.BoxGeometry(0.08, 0.42, 0.4).translate(-0.7, -0.22, 0),
    new THREE.BoxGeometry(0.08, 0.42, 0.4).translate(0.7, -0.22, 0),
  ]),
  rompemuelle: est(0xffffff, { map: texRayas }),
  geoRompemuelle: new THREE.BoxGeometry(ANCHO, 0.12, 0.7),
};
textura(mat.asfalto, "assets/tex/asfalto.jpg");
mat.reparacion.userData.tinte = 0x666a70;
textura(mat.reparacion, "assets/tex/asfalto.jpg");
mat.grieta.userData.tinte = 0x292b2e;
textura(mat.grieta, "assets/tex/asfalto.jpg");
mat.porton.userData.tinte = 0x69817d;
textura(mat.porton, "assets/tex/calamina.jpg");
textura(mat.grafiti, "assets/tex/grafiti-lima-v1.jpg", false);
textura(mat.pared, "assets/tex/vereda.jpg");
ensuciar(mat.pared);
textura(mat.vereda, "assets/tex/vereda.jpg");
textura(mat.tierra, "assets/tex/tierra.jpg");
textura(mat.pirca, "assets/tex/pirca2.jpg", true, "assets/tex/pirca.jpg");
textura(mat.pircaLisa, "assets/tex/pirca.jpg");
textura(mat.muroLateral, "assets/tex/muro_lateral.jpg", false, "assets/tex/ladrillos.jpg");
textura(mat.guardavia, "assets/tex/guardavia.jpg");
textura(mat.baranda, "assets/tex/vereda.jpg");
textura(mat.madera, "assets/tex/madera.jpg");
textura(mat.ropa, "assets/tex/ropa.png", false);
textura(mat.frazada, "assets/tex/frazadas.png", false);
textura(mat.cilindro, "assets/tex/bidon.jpg");
textura(mat.cerro, "assets/tex/cerro.jpg");
textura(mat.pasto, "assets/tex/pasto.jpg");
mat.reja.color.set(0x2f4a3a);   // reja verde oscura mientras carga
textura(mat.reja, "assets/tex/reja.png");
textura(mat.follaje, "assets/tex/follaje.jpg");
textura(mat.corteza, "assets/tex/corteza.jpg");
textura(mat.banca, "assets/tex/banca.jpg");
textura(mat.caminoParque, "assets/tex/camino-parque.jpg");
// Atlas 2x2 con las 4 fotos de fachada. La celda va en la u (u + 100·celda); fract() repite la
// foto a lo ancho y textureGrad evita la costura del mipmap donde se repite.
ensuciar(mat.fachada, `#ifdef USE_MAP
  float celdaAtlas = floor(vMapUv.x / ${CELDA_ATLAS.toFixed(1)} + 0.001);
  vec2 local = vec2(vMapUv.x - celdaAtlas * ${CELDA_ATLAS.toFixed(1)}, clamp(vMapUv.y, 0.002, 0.998));
  vec2 origen = vec2(mod(celdaAtlas, 2.0) * 0.5, 0.5 - floor(celdaAtlas / 2.0) * 0.5);
  vec2 uvAtlas = origen + (0.002 + vec2(fract(local.x), local.y) * 0.996) * 0.5;
  vec4 sampledDiffuseColor = textureGrad(map, uvAtlas, dFdx(local) * 0.5, dFdy(local) * 0.5);
  diffuseColor *= sampledDiffuseColor;
#endif`, "fachadaAtlas");
Promise.all([1, 2, 3, 4].map((k) => new Promise((ok, mal) => {
  const img = new Image();
  img.onload = () => ok(img);
  img.onerror = mal;
  img.src = `assets/tex/fachada${k}.jpg`;
}))).then((fotos) => {
  const lado = 1024, c = document.createElement("canvas");
  c.width = c.height = lado * 2;
  const g = c.getContext("2d");
  fotos.forEach((img, k) => g.drawImage(img, (k % 2) * lado, Math.floor(k / 2) * lado, lado, lado));
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  mat.fachada.map = t;
  mat.fachada.needsUpdate = true;
}).catch(() => {});
ensuciar(mat.muroLateral);
mat.charco.visible = false;

// Entorno 360° para reflejos reales en cromo, vidrio y vinilo
cargador.load("assets/tex/entorno.jpg", (t) => {
  t.mapping = THREE.EquirectangularReflectionMapping;
  t.colorSpace = THREE.SRGBColorSpace;
  const pmrem = new THREE.PMREMGenerator(renderer);
  entornoTex = pmrem.fromEquirectangular(t).texture;
  pmrem.dispose();
  t.dispose();
  hemiDia = 0.7;   // el entorno ya aporta luz ambiente
  aplicarHora();
}, undefined, () => {});

// Cielo panorámico con Lima al fondo
const cieloMat = new THREE.MeshBasicMaterial({ color: COLOR_NIEBLA, side: THREE.BackSide, fog: false, depthWrite: false });
// La esfera cubre también arriba y abajo: no deja huecos al girar o mirar al cerro.
const geoCielo = new THREE.SphereGeometry(900, 64, 40);
const uvCielo = geoCielo.getAttribute("uv");
for (let i = 0; i < uvCielo.count; i++) uvCielo.setY(i, Math.pow(uvCielo.getY(i), 1.5));
const cielo = new THREE.Mesh(geoCielo, cieloMat);
cielo.renderOrder = -1;
escena.add(cielo);
textura(cieloMat, "assets/tex/cielo-v2.jpg", false, "assets/tex/cielo.jpg");   // 360° sin costura

// ---------- Torito del jugador ----------
const torito = crearTorito({ color: 0xc8102e, conConductor: true });
escena.add(torito);
const partes = torito.userData;
const ojo = partes.ojoConductor || (() => { const o = new THREE.Object3D(); o.position.set(0, 1.3, 0.1); torito.add(o); return o; })();

// ---------- Modo noche: postes con luz de sodio, faro del torito y Lima iluminada ----------
let noche = false;
try { noche = localStorage.getItem("noche") === "1"; } catch (_) { /* sin almacenamiento */ }

const NIVELES_VIBRACION = ["Normal", "Suave", "Mínima", "Apagada"];
let nivelVibracion = 1;
try {
  const almacenado = localStorage.getItem("nivelVibracion");
  const guardado = Number(almacenado);
  if (almacenado !== null && Number.isInteger(guardado) && guardado >= 0 && guardado < NIVELES_VIBRACION.length) nivelVibracion = guardado;
} catch (_) { /* sin almacenamiento */ }

function factorVibracion(v) {
  if (nivelVibracion === 1) return 0.2 + 0.4 * Math.min(1, Math.max(0, v) / 25);
  if (nivelVibracion === 2) return 0.12;
  return nivelVibracion === 3 ? 0 : 1;
}

function vibrar(patron) {
  const factor = factorVibracion(vehiculo.v);
  if (!navigator.vibrate || factor === 0) return;
  const pulsos = Array.isArray(patron) ? patron.filter((_, i) => i % 2 === 0) : [patron];
  const limite = modoJuego === "carrera" ? Math.max(72, Math.max(...pulsos) * 0.9) : Infinity;
  // Solo se escalan los pulsos; las pausas entre ellos conservan su duración.
  navigator.vibrate(Array.isArray(patron)
    ? patron.map((ms, i) => i % 2 ? ms : Math.round(Math.min(ms, limite) * factor))
    : Math.round(Math.min(patron, limite) * factor));
}

function mostrarVibracion() {
  const texto = `Vibración: ${NIVELES_VIBRACION[nivelVibracion]}`;
  $("btn-vibracion").textContent = $("btn-vibracion-p").textContent = texto;
}

function alternarVibracion() {
  nivelVibracion = (nivelVibracion + 1) % NIVELES_VIBRACION.length;
  try { localStorage.setItem("nivelVibracion", String(nivelVibracion)); } catch (_) { /* sin almacenamiento */ }
  mostrarVibracion();
  colocarTorito(0);
  colocarCamara(0, true);
}

const lucesPoste = Array.from({ length: 4 }, () => {
  const l = new THREE.PointLight(0xffa94d, 40, 22, 1.6);
  escena.add(l);
  return l;
});
const faro = new THREE.SpotLight(0xfff1c8, 90, 50, 0.6, 0.45, 1.3);
faro.position.set(0, 1.0, -1.2);
faro.target.position.set(0, 0, -14);
torito.add(faro, faro.target);
const ciudadNoche = (() => {
  // Miles de luces lejanas de la ciudad, abajo del horizonte (un solo draw call)
  const n = 3000, pos = new Float32Array(n * 3), col = new Float32Array(n * 3);
  const c = new THREE.Color();
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, r = 480 + Math.random() * 380;
    pos.set([Math.cos(a) * r, -40 - Math.random() * 160 * (r / 860), Math.sin(a) * r], i * 3);
    c.setHSL(0.09 + Math.random() * 0.05, 0.8, 0.55 + Math.random() * 0.4);
    col.set([c.r, c.g, c.b], i * 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  g.setAttribute("color", new THREE.BufferAttribute(col, 3));
  const p = new THREE.Points(g, new THREE.PointsMaterial({ size: 2.2, sizeAttenuation: false, vertexColors: true, fog: false, depthWrite: false }));
  p.renderOrder = -1;
  cielo.add(p);
  return p;
})();

function aplicarHora() {
  const fondoColor = noche ? 0x0a0f1e : COLOR_NIEBLA;
  escena.background.set(fondoColor);
  escena.fog.color.set(fondoColor);
  cieloMat.userData.tinte = noche ? 0x1a2242 : 0xffffff;
  cieloMat.color.set(cieloMat.map ? cieloMat.userData.tinte : fondoColor);
  hemi.intensity = noche ? 0.32 : hemiDia;
  hemi.color.set(noche ? 0x4a5a8a : 0xdfe6ea);
  sol.intensity = noche ? 0.12 : 1.3;
  sol.color.set(noche ? 0x8899cc : 0xfff4e6);
  sol.castShadow = !noche && sombras;
  escena.environment = noche ? null : entornoTex;
  mat.foco.color.set(noche ? 0xffd27a : 0x77776a);
  mat.charco.visible = noche;
  for (const l of lucesPoste) l.visible = noche;
  faro.visible = noche;
  ciudadNoche.visible = noche;
  if (partes.faro && partes.faro.material.emissive) partes.faro.material.emissive.set(noche ? 0xffe9b0 : 0x000000);
  $("btn-hora").textContent = `Hora: ${noche ? "Noche 🌙" : "Día ☀️"}`;
}

// Las 4 luces dinámicas se mueven a los focos más cercanos delante de la cámara
let tLuces = 0;
const postesCerca = new Array(lucesPoste.length).fill(null);
const distanciasPoste = new Array(lucesPoste.length).fill(Infinity);
function actualizarLucesPoste(dt) {
  if (!noche || !pista.lamparas || (tLuces -= dt) > 0) return;
  tLuces = 0.2;
  const cam = camara.position;
  postesCerca.fill(null); distanciasPoste.fill(110 * 110);
  for (const p of pista.lamparas) {
    const d = p.distanceToSquared(cam);
    for (let i = 0; i < lucesPoste.length; i++) {
      if (d >= distanciasPoste[i]) continue;
      for (let j = lucesPoste.length - 1; j > i; j--) {
        distanciasPoste[j] = distanciasPoste[j - 1];
        postesCerca[j] = postesCerca[j - 1];
      }
      distanciasPoste[i] = d; postesCerca[i] = p;
      break;
    }
  }
  lucesPoste.forEach((l, i) => {
    l.visible = !!postesCerca[i];
    if (postesCerca[i]) l.position.copy(postesCerca[i]);
  });
}

// ---------- Calidad automática: si el celular no da, baja resolución y luego sombras ----------
let sombras = true, cuadros = 0, tCalidad = 0, nivelCalidad = 0;
function ajustarCalidad(dt) {
  cuadros++;
  if ((tCalidad += dt) < 2.5) return;
  const fps = cuadros / tCalidad;
  cuadros = 0; tCalidad = 0;
  if (fps < 42 && nivelCalidad === 0) { renderer.setPixelRatio(1); nivelCalidad = 1; }
  else if (fps < 32 && nivelCalidad === 1) { sombrasBaratas(); nivelCalidad = 2; }
  else if (fps < 26 && nivelCalidad === 2) { renderer.setPixelRatio(0.75); nivelCalidad = 3; }
}

// Apagar las sombras obliga a recompilar todos los shaders (≈7 s congelado justo cuando el
// celular ya va lento). En su lugar: mapa de sombra más chico y actualizado cuadro por medio.
let sombrasCadaDos = false, cuadroSombra = 0;
function sombrasBaratas() {
  sol.shadow.mapSize.set(512, 512);
  if (sol.shadow.map) { sol.shadow.map.dispose(); sol.shadow.map = null; }
  renderer.shadowMap.autoUpdate = false;
  renderer.shadowMap.needsUpdate = true;
  sombrasCadaDos = true;
}

// Compila de una vez los shaders de todos los materiales de la pista (normales e instanciados).
// Con la carga por tramos, un material nuevo (p. ej. el primer guardavía) causaba un tirón al aparecer.
function precompilarMateriales() {
  const geo = new THREE.PlaneGeometry(0.01, 0.01), temporales = [];
  const materiales = new Set(Object.values(mat).flat().filter((m) => m && m.isMaterial && !m.isLineBasicMaterial));
  for (const m of materiales) {
    const normal = new THREE.Mesh(geo, m), instanciado = new THREE.InstancedMesh(geo, m, 1);
    escena.add(normal, instanciado);
    temporales.push(normal, instanciado);
  }
  renderer.compile(escena, camara);
  for (const t of temporales) {
    escena.remove(t);
    if (t.isInstancedMesh) t.dispose();
  }
  geo.dispose();
}

// ---------- Estado de juego ----------
const controles = new Controles();
const sonido = new Sonido();
let pista, tramos, vehiculo, trafico;
let estado = "inicio";
let modoJuego = "sinFrenos";
try { if (localStorage.getItem("modoJuego") === "carrera") modoJuego = "carrera"; } catch (_) {}
let modoCamara = 1; // 0 = tercera persona, 1 = primera persona
let tiempoPartida = 0;
let acumulador = 0;
let tRevivir = 0, tFin = 0, mostrarFin = null;
const recursosPista = new Set(Object.values(mat).flat());

function nuevaPartida() {
  const liberados = new Set();
  if (tramos) tramos.cerrar();
  if (pista && pista.final) {
    escena.remove(pista.final);
    liberarRecursos(pista.final, recursosPista, liberados);
  }
  if (trafico) trafico.liberarTodo();
  tRevivir = tFin = 0; mostrarFin = null;
  eventos.length = 0;
  controles.limpiar();
  tGrito = tHud = tLuces = tRuido = 0;
  cuadros = tCalidad = 0;
  $("grito").classList.remove("visible");
  if (partes.adorno) { partes.adorno.userData.ang = partes.adorno.userData.vel = 0; partes.adorno.rotation.z = 0; }
  // La semilla se comparte con el worker que calcula los bloques: ambos arman la misma calle
  const semilla = (Math.random() * 1e9) | 0;
  pista = new Pista(semilla);
  tramos = new GestorTramos(pista, escena, mat, semilla);
  pista.construirFinal(escena);
  vehiculo = new Vehiculo(pista);
  tramos.precargar(vehiculo.s);
  trafico = new Trafico(escena, pista, modoJuego);
  tiempoPartida = 0;
  acumulador = 0;
  vidas = maxVidas();
  tInvulnerable = 0;
  caidaFinal = false;
  $("vidas").classList.remove("invulnerable");
  dibujarVidas();
  torito.rotation.set(0, 0, 0);
  controles.centrarDireccion();
  colocarTorito(0);
  colocarCamara(0, true);
  aviso(modoJuego === "carrera" ? "¡Carrera sin frenos contra 3 rivales!" : "¡Se cortó el cable del freno!", 2.5);
}

// ---------- Gritos del chofer (solo globo de texto) ----------
let tGrito = 0;
function gritar(texto) {
  if (tGrito > 0.6) return;            // no encimar gritos
  $("grito").textContent = texto;
  $("grito").classList.add("visible");
  tGrito = 1.6;
}

// ---------- Avisos ----------
let tAviso = 0;
function aviso(texto, seg = 2) {
  $("aviso").textContent = texto;
  $("aviso").classList.add("visible");
  tAviso = seg;
}

// ---------- Cámaras ----------
const vTmp = new THREE.Vector3(), vTmp2 = new THREE.Vector3(), qTmp = new THREE.Quaternion();
const eShake = new THREE.Euler();
const muestraTorito = {}, muestraCamara = {};
let tRuido = 0;

// Celular vertical: en vez de abrir el fov hasta el "ojo de pez" (que llenaba la pantalla de
// cabina), se usa un fov moderado como en PC, con el ojo algo más arriba/adelante y el timón
// más chico. Así la calle se ve grande y la cabina ocupa una franja razonable.
const VERTICAL = {
  fov1: 78, subeOjo: 0.08, adelantaOjo: 0.1, escTimon: 0.65, bajaTimon: -0.035,   // 1ª persona
  fov3: 72, atras3: 1.4, sube3: 0.7,                                                // 3ª persona
};
function pesoVertical() {
  const a = camara.aspect;
  if (a >= 1) return 0;
  const t = Math.min(1, (1 - a) / 0.3);
  return t * t * (3 - 2 * t);
}

function colocarCamara(dt, instantaneo = false) {
  const v = vehiculo;
  const m = pista.muestra(v.s, muestraCamara);
  const rumbo = m.th + v.psi;
  const adelante = vTmp2.set(Math.sin(rumbo), 0, -Math.cos(rumbo));
  tRuido += dt;
  const maximo = modoJuego === "carrera" ? 1.701 * 0.9 : 1.701;
  const intensidad = Math.min(maximo, (Math.min(1, v.v / 25) * 0.6 + v.sacudida) * 0.9) * factorVibracion(v.v);
  if (partes.conductor) partes.conductor.visible = modoCamara === 0;

  const fovAnterior = camara.fov;
  // 0 en horizontal/PC (todo igual que siempre), 1 en celular vertical, mezcla suave entre medio
  const kv = pesoVertical();
  const dir = partes.direccion;
  if (dir) {
    // En vertical 1ª persona el timón se achica y baja un poco para no tapar la pista
    const k1 = modoCamara === 1 ? kv : 0;
    dir.scale.setScalar(1 + (VERTICAL.escTimon - 1) * k1);
    dir.position.set(0, VERTICAL.bajaTimon * k1, 0);
  }
  if (modoCamara === 1) {
    torito.updateWorldMatrix(true, true);
    ojo.getWorldPosition(camara.position);
    ojo.getWorldQuaternion(camara.quaternion);
    if (kv > 0) {
      // Ojo un poco más arriba y adelante: el techo y el tablero salen del cuadro
      camara.position.add(vTmp.set(0, VERTICAL.subeOjo * kv, -VERTICAL.adelantaOjo * kv).applyQuaternion(torito.quaternion));
    }
    // Vibración del asiento: más fuerte a más velocidad y en golpes
    const a = 0.006 * intensidad;
    camara.position.y += Math.sin(tRuido * 31) * a + Math.sin(tRuido * 17.3) * a;
    eShake.set(Math.sin(tRuido * 23.1) * a * 0.8, Math.sin(tRuido * 13.7) * a * 0.5, Math.sin(tRuido * 19.9) * a * 0.6);
    camara.quaternion.multiply(qTmp.setFromEuler(eShake));
    const fovNormal = fovSegunPantalla(74 + Math.min(18, v.v * 0.6));
    camara.fov = kv > 0 ? fovNormal + (VERTICAL.fov1 + Math.min(10, v.v * 0.3) - fovNormal) * kv : fovNormal;
  } else {
    // Cámara alta que mira lejos: el torito queda abajo del cuadro y se ve la calle de adelante.
    // En vertical se aleja y sube un poco más para encuadrar el torito.
    const destino = vTmp.copy(torito.position).addScaledVector(adelante, -6.8 - VERTICAL.atras3 * kv);
    destino.y += 3.6 + VERTICAL.sube3 * kv;
    if (instantaneo) camara.position.copy(destino);
    else camara.position.lerp(destino, 1 - Math.exp(-dt * 6));
    camara.position.y += Math.sin(tRuido * 27) * 0.02 * intensidad;
    // Punto de mira 16 m adelante, a la altura real de la pista allí (en bajada queda más abajo)
    const yAdelante = pista.muestra(v.s + 16, muestraCamara).y;
    const mira = vTmp.copy(torito.position).addScaledVector(adelante, 16);
    mira.y = Math.min(torito.position.y, yAdelante) + 0.9;
    camara.lookAt(mira);
    const fovNormal = fovSegunPantalla(66 + Math.min(16, v.v * 0.55));
    camara.fov = kv > 0 ? fovNormal + (VERTICAL.fov3 + Math.min(12, v.v * 0.4) - fovNormal) * kv : fovNormal;
  }
  if (camara.fov !== fovAnterior) camara.updateProjectionMatrix();
}

// El fov de Three es vertical: en pantallas angostas (celular vertical) se abre para
// conservar el ángulo horizontal de una pantalla 16:10, con un tope para no deformar.
function fovSegunPantalla(fovBase) {
  const aspecto = camara.aspect;
  if (aspecto >= 1.3) return fovBase;
  const rad = Math.PI / 180;
  const horizontal = 2 * Math.atan(Math.tan((fovBase * rad) / 2) * 1.6);
  const vertical = (2 * Math.atan(Math.tan(horizontal / 2) / aspecto)) / rad;
  return Math.max(fovBase, Math.min(vertical, 106));
}

function alternarCamara() {
  modoCamara = 1 - modoCamara;
  $("btn-camara-ini").textContent = `Cámara: ${modoCamara ? "1ª" : "3ª"} persona`;
  if (vehiculo) colocarCamara(0, true);
}

// ---------- Torito en el mundo ----------
function colocarTorito(dt) {
  const v = vehiculo;
  const m = pista.muestra(v.s, muestraTorito);
  pista.aMundo(v.s, v.d, v.alturaSuelo, torito.position, m);
  const rumbo = m.th + v.psi;
  const factor = factorVibracion(v.v);
  const pico = modoJuego === "carrera" ? 0.9 : 1;
  // Sin amortiguador: cada rueda copia las ondulaciones de la pista
  const rf = pista.rugosidad(v.s + 1.1, v.d, pico) * factor;
  const ri = pista.rugosidad(v.s - 0.85, v.d - 0.53, pico) * factor, rd = pista.rugosidad(v.s - 0.85, v.d + 0.53, pico) * factor;
  const enSuelo = v.h <= 0.01;
  torito.position.y += enSuelo ? (rf + ri + rd) / 3 : 0;
  const cabeceo = -Math.atan(m.g * Math.cos(v.psi)) + (enSuelo ? (rf - (ri + rd) / 2) / 1.95 : 0);
  let balanceo = v.balanceo + (enSuelo ? (rd - ri) / 1.06 : 0);
  if (v.estado === "choque" && (v.motivo.includes("volcaste") || caidaFinal)) {
    torito.userData.vuelco = Math.min(1.65, (torito.userData.vuelco || Math.abs(balanceo)) + dt * 3);
    balanceo = Math.sign(v.ladoVuelco || 1) * torito.userData.vuelco;
  } else torito.userData.vuelco = 0;
  torito.rotation.set(cabeceo, -rumbo, balanceo, "YXZ");
  torito.position.y += Math.abs(Math.sin(balanceo)) * 0.65;   // pivota sobre las ruedas de un lado

  const giroRueda = (v.v * dt) / 0.2;
  if (partes.ruedaDelantera) partes.ruedaDelantera.rotation.x -= giroRueda;
  for (const r of partes.ruedasTraseras || []) r.rotation.x -= giroRueda;
  if (partes.direccion) partes.direccion.rotation.y = -v.giro * 1.6;
  // Aguja del velocímetro (0–80 km/h en ~260°) y adorno colgante que se mece
  if (partes.aguja) partes.aguja.rotation.z = 2.2 - Math.min(80, v.kmh) / 80 * 4.5 + Math.sin(tRuido * 40) * 0.01 * v.v * factor;
  if (partes.adorno) {
    const pendulo = partes.adorno.userData;
    pendulo.ang = pendulo.ang || 0; pendulo.vel = pendulo.vel || 0;
    pendulo.vel += (-pendulo.ang * 30 - v.acelLat * 0.6 - pendulo.vel * 1.5 + (Math.random() - 0.5) * v.sacudida * 40 * factor) * dt;
    pendulo.ang += pendulo.vel * dt;
    partes.adorno.rotation.z = pendulo.ang;
  }

  sol.position.copy(torito.position).add(vTmp.set(18, 40, 12));
  sol.target.position.copy(torito.position);
}

// ---------- HUD ----------
let tHud = 0, frenoAnterior = 100;
function actualizarHud(dt) {
  tHud -= dt;
  // Borde amarillo en la barra del freno mientras se está gastando
  const gastando = controles.freno && vehiculo.estado === "ok" && vehiculo.freno < frenoAnterior;
  frenoAnterior = vehiculo.freno;
  $("b-freno-vida").parentElement.classList.toggle("gastando", gastando);
  if (tAviso > 0 && (tAviso -= dt) <= 0) $("aviso").classList.remove("visible");
  if (tGrito > 0 && (tGrito -= dt) <= 0) $("grito").classList.remove("visible");
  $("alerta").classList.toggle("visible", vehiculo.inclinacion > 0.15 && vehiculo.estado === "ok");
  if (tHud > 0) return;
  tHud = 0.1;
  const v = vehiculo;
  textoHud("hud-vel", Math.round(v.kmh));
  textoHud("hud-dist", `${modoJuego === "carrera" ? `${trafico.puesto(v)}/4 · ` : ""}Faltan ${Math.max(0, Math.round(pista.largo - 60 - v.s))} m${modoJuego === "carrera" ? ` · ${tiempoPartida.toFixed(1)} s` : ""}`);
  const barra = (id, pct, invertido) => {
    const b = $(id);
    const ancho = `${Math.max(0, Math.min(100, pct))}%`;
    if (b.style.width !== ancho) b.style.width = ancho;
    const malo = invertido ? 100 - pct : pct;
    b.style.background = malo > 75 ? "#ff3b3b" : malo > 45 ? "#ffb300" : "#3ecf5a";
  };
  barra("b-dano", v.dano);
  barra("b-freno-vida", v.freno, true);
}

// ---------- Bucle principal ----------
const eventos = [];
let ultimo = performance.now();

function bucle(ahora) {
  requestAnimationFrame(bucle);
  const dt = Math.min(0.05, (ahora - ultimo) / 1000);
  ultimo = ahora;
  if (!vehiculo || document.hidden) return;

  if (estado === "jugando" || estado === "terminando") {
    if (estado === "jugando" && tRevivir > 0 && (tRevivir -= dt) <= 0) revivir();
    const entrada = controles.actualizar(dt);
    acumulador += dt;
    while (acumulador >= PASO_FISICA) {
      vehiculo.paso(PASO_FISICA, entrada, eventos);
      acumulador -= PASO_FISICA;
    }
    if (estado === "jugando") tiempoPartida += dt;
    if (tInvulnerable > 0 && (tInvulnerable -= dt) <= 0) $("vidas").classList.remove("invulnerable");
    vehiculo.invulnerable = tInvulnerable > 0;
    const choque = trafico.actualizar(dt, vehiculo);
    if (trafico.gritos.length) { gritar(trafico.gritos[trafico.gritos.length - 1]); trafico.gritos.length = 0; }
    if (trafico.noticias.length) { aviso(trafico.noticias[trafico.noticias.length - 1], 1.2); trafico.noticias.length = 0; }
    if (choque && vehiculo.estado === "ok") procesarChoque(choque);
    procesarEventos();
    tramos.actualizar(vehiculo.s);
    sonido.actualizar({
      rpm: vehiculo.rpm, v: vehiculo.v,
      chirrido: (vehiculo.raspando ? 0.2 : 0) + (vehiculo.derrapando ? 0.15 : 0) + Math.max(0, Math.abs(vehiculo.acelLat) - 4.5) * 0.05,
      motorVivo: vehiculo.estado === "ok",
    });
    actualizarHud(dt);
  }
  if (estado === "terminando" && (tFin -= dt) <= 0 && mostrarFin) {
    const mostrar = mostrarFin; mostrarFin = null; mostrar();
  }
  if (estado === "jugando" || estado === "terminando") {
    colocarTorito(dt);
    colocarCamara(dt);
  }
  cielo.position.copy(camara.position);
  if (cieloMat.map && !uniformesCielo.cieloListo.value) {
    // La niebla toma el color de la foto del cielo apenas termina de cargar
    uniformesCielo.cieloNiebla.value = cieloMat.map;
    uniformesCielo.cieloTinte.value = cieloMat.color;
    uniformesCielo.cieloListo.value = 1;
  }
  actualizarLucesPoste(dt);
  if (estado === "jugando") ajustarCalidad(dt);
  if (sombrasCadaDos && cuadroSombra++ % 2 === 0) renderer.shadowMap.needsUpdate = true;
  renderer.render(escena, camara);
}

// ---------- Vidas (corazones pixel-art) ----------
// En Carrera hay más tráfico y gente: 8 corazones en vez de 3
const maxVidas = () => (modoJuego === "carrera" ? 8 : 3);
let vidas = maxVidas(), tInvulnerable = 0, caidaFinal = false;
const CORAZON = [
  ".KKK.KKK.",
  "KRRRKRRRK",
  "KRWRRRRRK",
  "KRRRRRRRK",
  ".KRRRRRK.",
  "..KRRRK..",
  "...KRK...",
  "....K....",
];
function svgCorazon(lleno) {
  const color = { K: "#2b0000", R: lleno ? "#e3131b" : "#3d3d3d", W: lleno ? "#ffb3b3" : "#5a5a5a" };
  let rects = "";
  CORAZON.forEach((fila, y) => [...fila].forEach((c, x) => {
    if (c !== ".") rects += `<rect x="${x}" y="${y}" width="1" height="1" fill="${color[c]}"/>`;
  }));
  return `<svg viewBox="0 0 9 8" shape-rendering="crispEdges" class="${lleno ? "" : "vacio"}">${rects}</svg>`;
}
function dibujarVidas(perdida = -1) {
  $("vidas").innerHTML = Array.from({ length: maxVidas() }, (_, i) => svgCorazon(i < vidas)).join("");
  if (perdida >= 0) $("vidas").children[perdida].classList.add("perdido");
}

function perderVida(motivo) {
  controles.centrarDireccion();
  vehiculo.giro = 0;
  vidas--;
  dibujarVidas(vidas);
  sonido.golpe(1);
  vibrar([122, 60, 203]);
  if (vidas <= 0) return terminar(false, motivo);
  aviso(motivo, 1.6);
  tRevivir = 1.6;
}

function revivir() {
  if (estado !== "jugando") return;
  controles.centrarDireccion();
  const v = vehiculo;
  Object.assign(v, { estado: "ok", motivo: "", psi: 0, d: ANCHO / 4, v: 4, h: 0, vy: 0, inclinacion: 0, balanceo: 0, giro: 0 });
  v.dano = Math.min(v.dano, 60);
  v.suelo = pista.alturaLateral(v.d, v.s);
  v.acelLat = v.sacudida = v.ladoVuelco = 0;
  v.raspando = v.derrapando = false;
  torito.userData.vuelco = 0;
  tInvulnerable = 2.5;
  $("vidas").classList.add("invulnerable");
  aviso("¡Sigue bajando!", 1.2);
}

function procesarChoque({ agente, vRel }) {
  if (tInvulnerable > 0) return;
  if (agente.rival) {
    // El empuje y el reparto de velocidad ya los resolvió el tráfico; aquí solo daño y efectos
    const fuerza = Math.min(1, 0.25 + vRel / 10);
    vehiculo.dano += Math.min(8, 1 + vRel * 0.5);
    vehiculo.sacudida = Math.max(vehiculo.sacudida, 0.4 + fuerza * 0.5);
    sonido.golpe(fuerza);
    aviso(vRel > 4 ? `¡Chocaste con ${agente.nombre}!` : `¡Roce con ${agente.nombre}!`, 1);
    vibrar(Math.round(30 + fuerza * 50));
    return;
  }
  if (agente.peaton || agente.caminante) {
    if (agente.tipo === "persona") {
      agente.modelo.visible = false;   // salió volando del susto: se va de la escena
      return vehiculo.chocar("¡Atropellaste a alguien!", eventos);
    }
    vehiculo.dano += 12;
    vehiculo.v *= 0.85;
    sonido.golpe(0.4);
    aviso(agente.tipo === "gato" ? "¡Pobre michi!" : "¡Pobre firulais!", 1.5);
    return;
  }
  if (agente.tipo === "desmonte") {
    // El desmonte frena y hace saltar al torito, pero solo mata a mucha velocidad
    if (vRel > 14) return vehiculo.chocar("¡Volaste por el desmonte!", eventos);
    vehiculo.dano += vRel * 3;
    vehiculo.v *= 0.55;
    vehiculo.vy = Math.max(vehiculo.vy, 1.5 + vRel * 0.12);
    vehiculo.sacudida = 1.17;
    sonido.golpe(Math.min(1, vRel / 10));
    aviso("¡Te metiste al desmonte!", 1.5);
    vibrar(97);
    return;
  }
  if (vRel > 9) {
    const motivos = { torito: "¡Chocaste con otro torito!", obra: "¡Te estrellaste contra la obra!" };
    return vehiculo.chocar(motivos[agente.tipo] || "¡Choque frontal!", eventos);
  }
  vehiculo.dano += vRel * 4 + 2;
  vehiculo.v = Math.max(0, agente.v + (vehiculo.v - agente.v) * -0.2);
  vehiculo.sacudida = 1.08;
  agente.v = 0;
  sonido.golpe(Math.min(1, vRel / 9));
  aviso("¡Pum! Cuidado", 1.2);
  vibrar(72);
}

function procesarEventos() {
  for (const e of eventos) {
    if (e.tipo === "golpe") {
      sonido.golpe(e.fuerza);
      vibrar(Math.round(Math.min(89.1, (30 + e.fuerza * 80) * 0.9)));
    } else if (e.tipo === "aviso") {
      aviso(e.texto, 2.5);
    } else if (e.tipo === "choque") {
      perderVida(e.motivo);
    } else if (e.tipo === "llegada") {
      terminar(true, modoJuego === "carrera" ? "¡Carrera terminada!" : "¡Llegaste a la avenida con vida!");
    }
  }
  eventos.length = 0;
}

function terminar(gano, motivo) {
  if (estado !== "jugando") return;
  estado = "terminando";
  caidaFinal = !gano;   // al perder la última vida el torito siempre termina volcado
  sonido.claxon(false);
  const puestoFinal = modoJuego === "carrera" ? trafico.puesto(vehiculo) : 0;
  const metros = Math.round(Math.min(vehiculo.s, pista.largo - 60));
  let record = 0;
  try { record = +(localStorage.getItem(modoJuego === "carrera" ? "recordMetrosCarrera" : "recordMetros") || 0); } catch (_) { /* sin almacenamiento */ }
  const nuevo = metros > record;
  if (nuevo) try { localStorage.setItem(modoJuego === "carrera" ? "recordMetrosCarrera" : "recordMetros", metros); } catch (_) { /* sin almacenamiento */ }
  tRevivir = 0;
  tFin = gano ? 0.6 : 1.8;
  mostrarFin = () => {
    estado = "fin";
    $("fin-titulo").textContent = gano ? (modoJuego === "carrera" ? puestoFinal === 1 ? "¡GANASTE!" : "¡META!" : "¡LLEGASTE!") : "¡PUM!";
    $("fin-msg").textContent = modoJuego === "carrera" && gano ? `Puesto ${puestoFinal} de 4 · ${motivo}` : motivo;
    $("fin-resumen").innerHTML =
      `Recorrido: <b>${metros} m</b> de ${Math.round(pista.largo - 60)} m<br>` +
      `Tiempo: <b>${tiempoPartida.toFixed(1)} s</b><br>` +
      `Vidas: <b>${"❤".repeat(Math.max(0, vidas)) || "0"}</b> · Daño: <b>${Math.min(100, Math.round(vehiculo.dano))}%</b> · Freno: <b>${Math.round(vehiculo.freno)}%</b><br>` +
      (nuevo ? "<b>¡Nuevo récord!</b>" : `Récord: ${Math.max(record, metros)} m`);
    $("hud").classList.add("oculto");
    $("fin").classList.add("visible");
    sonido.actualizar({ rpm: 0, v: 0, chirrido: 0, motorVivo: false });
  };
}

// ---------- Interfaz ----------
function empezar() {
  sonido.iniciar();
  sonido.silenciar(false);
  $("inicio").classList.remove("visible");
  $("fin").classList.remove("visible");
  $("pausa").classList.remove("visible");
  $("hud").classList.remove("oculto");
  nuevaPartida();
  estado = "jugando";
  ultimo = performance.now();
}

async function pantallaCompleta() {
  try {
    if (matchMedia("(pointer: coarse)").matches && document.documentElement.requestFullscreen && !document.fullscreenElement) {
      await document.documentElement.requestFullscreen({ navigationUI: "hide" });
    }
  } catch (_) { /* no soportado (iOS) */ }
}

$("btn-jugar").addEventListener("click", async () => {
  if ($("btn-jugar").disabled) return;
  $("btn-jugar").disabled = true;
  try {
    sonido.iniciar();
    pantallaCompleta();                            // fullscreen necesita el gesto
    empezar();
    if (document.hidden) pausar();
  } finally { $("btn-jugar").disabled = false; }
});
$("btn-otra").addEventListener("click", empezar);
function mostrarModo() {
  const carrera = modoJuego === "carrera";
  $("btn-modo").textContent = `Modo: ${carrera ? "Carrera" : "Sin frenos"}`;
  $("ayuda-controles").innerHTML = `${carrera ? "<b>Carrera:</b> la misma bajada sin frenos contra 3 rivales, con autos y gente que suben. Tienes 8 vidas.<br>" : ""}<b>Celular:</b> toca cada mitad para girar, o inclina el teléfono. Pedales abajo.<br><b>PC:</b> ← → / A D dirección · S / ↓ / Espacio freno gastado · H claxon · C cámara`;
}
$("btn-modo").addEventListener("click", () => {
  modoJuego = modoJuego === "carrera" ? "sinFrenos" : "carrera";
  try { localStorage.setItem("modoJuego", modoJuego); } catch (_) {}
  mostrarModo();
});
mostrarModo();
$("btn-camara-ini").addEventListener("click", alternarCamara);
$("btn-vibracion").addEventListener("click", alternarVibracion);
$("btn-vibracion-p").addEventListener("click", alternarVibracion);
$("btn-hora").addEventListener("click", () => {
  noche = !noche;
  try { localStorage.setItem("noche", noche ? "1" : "0"); } catch (_) { /* sin almacenamiento */ }
  aplicarHora();
});


function pausar() {
  if (estado === "jugando") {
    estado = "pausa";
    controles.limpiar();
    sonido.silenciar(true);
    $("pausa").classList.add("visible");
  } else if (estado === "pausa") {
    estado = "jugando";
    sonido.silenciar(false);
    ultimo = performance.now();
    $("pausa").classList.remove("visible");
  }
}
$("btn-pausa").addEventListener("click", pausar);
$("btn-cam").addEventListener("click", alternarCamara);
$("btn-seguir").addEventListener("click", pausar);
$("btn-salir").addEventListener("click", () => {
  estado = "inicio";
  tRevivir = tFin = 0; mostrarFin = null;
  controles.limpiar();
  sonido.silenciar(false);
  sonido.actualizar({ rpm: 0, v: 0, chirrido: 0, motorVivo: false });
  $("pausa").classList.remove("visible");
  $("hud").classList.add("oculto");
  $("inicio").classList.add("visible");
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    if (estado === "jugando") pausar();
    sonido.silenciar(true);
  } else {
    ultimo = performance.now();
    if (estado !== "pausa") sonido.silenciar(false);
  }
});
addEventListener("blur", () => { if (estado === "jugando") pausar(); });

controles.alCamara = alternarCamara;
controles.alClaxon = (on) => {
  sonido.claxon(on && estado === "jugando");
  if (on && estado === "jugando") {
    trafico.claxon(vehiculo);
    gritar("¡Cuidao!");
  }
};
controles.alPausa = pausar;

// Un conjunto por lado permite varios dedos sin soltar otra pulsación activa.
const punterosGiro = { izq: new Set(), der: new Set() };
for (const lado of ["izq", "der"]) {
  const activos = punterosGiro[lado];
  const actualizar = () => {
    controles.botones[lado] = activos.size > 0;
    $("b-" + lado).classList.toggle("activo", activos.size > 0);
  };
  const soltarDireccion = () => { activos.clear(); actualizar(); };
  controles.soltadores.push(soltarDireccion);
  controles.soltadoresDireccion.push(soltarDireccion);
  const soltarPuntero = (e) => { activos.delete(e.pointerId); actualizar(); };
  addEventListener("pointerup", soltarPuntero);
  addEventListener("pointercancel", soltarPuntero);
  for (const id of ["zona-" + lado, "b-" + lado]) {
    const el = $(id);
    el.addEventListener("pointerdown", (e) => {
      if (estado !== "jugando") return;
      e.preventDefault();
      activos.add(e.pointerId);
      el.setPointerCapture(e.pointerId);
      actualizar();
    });
    for (const evento of ["pointerup", "pointercancel", "lostpointercapture"]) {
      el.addEventListener(evento, soltarPuntero);
    }
  }
}
// Los dos frenos y la franja de abajo comparten estado sin que soltar uno cancele los otros.
// Los botones FRENO solo muestran que se está frenando; la zona grande es la franja.
const frenosPresionados = new Set();
const pintarFrenos = () => {
  for (const id of ["b-freno", "b-freno-izq"]) $(id).classList.toggle("activo", frenosPresionados.size > 0);
};
controles.soltadores.push(() => { frenosPresionados.clear(); controles.botones.freno = false; pintarFrenos(); });
for (const id of ["b-freno", "b-freno-izq", "zona-freno"]) {
  controles.botonMantener($(id), () => {
    frenosPresionados.add(id); controles.botones.freno = true; pintarFrenos();
  }, () => {
    frenosPresionados.delete(id); controles.botones.freno = frenosPresionados.size > 0; pintarFrenos();
  });
}

// Escena de fondo detrás del menú mientras se juega la primera vez
nuevaPartida();
aplicarHora();
precompilarMateriales();
mostrarVibracion();
$("version-pausa").textContent = $("version").textContent;
$("btn-jugar").disabled = false;
$("btn-jugar").textContent = "JUGAR";
requestAnimationFrame(bucle);

// Acceso para depuración desde la consola
window.__juego = { get vehiculo() { return vehiculo; }, get pista() { return pista; }, get estado() { return estado; }, get tramos() { return tramos; }, escena, camara, renderer, THREE, nuevaPartida };
