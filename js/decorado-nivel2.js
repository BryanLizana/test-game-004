// Decorado del nivel 2 que no depende de los bloques: el mar y los modelos sueltos (ficus, palmeras,
// sombrillas y botes). Cada pieza de cada modelo es un solo InstancedMesh para todo el nivel, así que
// suma pocas llamadas de dibujo aunque haya decenas de árboles.
import * as THREE from "three";
import { crearFicus, crearPalmera, crearSombrilla, crearBote } from "./modelos-nivel2.js?v=1.7.0";

const TAM_MAR = 3200;
const COLORES_SOMBRILLA = [0xe53935, 0x1e88e5, 0xfdd835, 0x43a047];
const azarDe = (semilla) => () => { semilla = (semilla * 16807) % 2147483647; return semilla / 2147483647; };

const mBase = new THREE.Matrix4(), mParte = new THREE.Matrix4(), qGiro = new THREE.Quaternion();
const vPos = new THREE.Vector3(), vEscala = new THREE.Vector3(), ejeY = new THREE.Vector3(0, 1, 0);

// Convierte un modelo en un InstancedMesh por malla, con una copia por cada puesto
function instanciar(grupo, modelo, puestos) {
  if (!puestos.length) return;
  modelo.scale.setScalar(1);
  modelo.updateMatrixWorld(true);
  modelo.traverse((o) => {
    if (!o.isMesh) return;
    const inst = new THREE.InstancedMesh(o.geometry, o.material, puestos.length);
    puestos.forEach((p, i) => {
      mBase.compose(vPos.set(p.x, p.y, p.z), qGiro.setFromAxisAngle(ejeY, p.giro), vEscala.setScalar(p.k));
      inst.setMatrixAt(i, mParte.multiplyMatrices(mBase, o.matrixWorld));
    });
    inst.frustumCulled = false;   // repartidas por todo el nivel: el recorte por caja no serviría
    grupo.add(inst);
  });
}

export function armarDecorado(pista, escena, cargador) {
  const grupo = new THREE.Group();
  const azar = azarDe(4217);
  const puesto = (s, d, k = 1, h = 0) => {
    const p = pista.aMundo(s, d, h, new THREE.Vector3());
    return { x: p.x, y: p.y, z: p.z, k, giro: azar() * Math.PI * 2 };
  };
  const tramo = (barrio) => pista.tramosPuestos.find((t) => t.barrio === barrio);
  const borde = pista.ancho / 2 + 0.8, alto = 0.15;

  const ficus = [], palmeras = [], botes = [];
  const si = tramo("sanIsidro"), mal = tramo("malecon"), pla = tramo("playa");
  for (let s = si.s0 + 8; s < si.s1 - 8; s += 16 + azar() * 12) {
    ficus.push(puesto(s, (azar() < 0.5 ? -1 : 1) * borde, 0.85 + azar() * 0.3, alto));
  }
  for (let s = mal.s0 + 6; s < mal.s1; s += 18 + azar() * 8) palmeras.push(puesto(s, pista.ancho / 2 + pista.vereda - 0.5, 0.9 + azar() * 0.3, alto));
  for (let s = pla.s0 + 10; s < pla.s1 - 5; s += 22) palmeras.push(puesto(s, -(pista.ancho / 2 + 6 + azar() * 6), 0.9 + azar() * 0.4, -0.5));
  const porColor = COLORES_SOMBRILLA.map(() => []);
  for (let i = 0; i < 14; i++) {
    const s = pla.s0 + 8 + azar() * (pla.s1 - pla.s0 - 14), lado = azar() < 0.7 ? 1 : -1;
    porColor[i % porColor.length].push(puesto(s, lado * (pista.ancho / 2 + 2 + azar() * 7), 1, -0.3));
  }
  for (let i = 0; i < 3; i++) botes.push(puesto(pla.s1 - 30 + i * 12, pista.ancho / 2 + 9 + azar() * 4, 1, -0.5));

  instanciar(grupo, crearFicus(), ficus);
  instanciar(grupo, crearPalmera(1), palmeras);
  instanciar(grupo, crearBote(), botes);
  COLORES_SOMBRILLA.forEach((color, i) => instanciar(grupo, crearSombrilla(color), porColor[i]));

  // Mar: un plano que acompaña al jugador en saltos enteros de la textura, sin reflejos
  const REPETIR = 40, tamTex = TAM_MAR / REPETIR;
  const geoMar = new THREE.PlaneGeometry(TAM_MAR, TAM_MAR).rotateX(-Math.PI / 2);
  const uv = geoMar.getAttribute("uv");
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * REPETIR, uv.getY(i) * REPETIR);
  const matMar = new THREE.MeshStandardMaterial({ color: 0x3e6672, roughness: 0.7 });
  const mar = new THREE.Mesh(geoMar, matMar);
  mar.position.y = pista.marY;
  mar.frustumCulled = false;
  grupo.add(mar);
  let texMar = null, cancelado = false;
  cargador.load("assets/tex/n2/mar.jpg", (t) => {
    if (cancelado) return t.dispose();
    t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    texMar = t;
    matMar.map = t;
    matMar.color.set(0xffffff);
    matMar.needsUpdate = true;
  }, undefined, () => {});

  escena.add(grupo);
  let tiempo = 0;
  return {
    grupo,
    animar(dt, camara) {
      tiempo += dt;
      mar.position.x = Math.round(camara.x / tamTex) * tamTex;
      mar.position.z = Math.round(camara.z / tamTex) * tamTex;
      if (texMar) texMar.offset.set(tiempo * 0.012, tiempo * 0.007);
    },
    liberar() {
      cancelado = true;
      escena.remove(grupo);
      grupo.traverse((o) => { if (o.isInstancedMesh) o.dispose(); });
      geoMar.dispose();
      matMar.dispose();
      if (texMar) texMar.dispose();
    },
  };
}
