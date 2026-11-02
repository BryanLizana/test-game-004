import * as THREE from "three";

// La misma sección a ambos lados del enlace oculta el cambio de paisaje sin cortar la marcha.
const caja = new THREE.BoxGeometry(1, 1, 1);
const ANCHO_BOCA = 7, ALTO_BOCA = 5.2, ANCHO_PORTAL = 10.4, ALTO_PORTAL = 8.6;   // cabe entre las fachadas

const cargador = new THREE.TextureLoader();
// Si falta la foto, el material conserva su color liso
function conFoto(color, ruta, repetirU = 1, repetirV = 1) {
  const material = new THREE.MeshStandardMaterial({ color, roughness: 0.95, side: THREE.FrontSide });
  cargador.load(`assets/tex/n2/${ruta}`, (t) => {
    t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(repetirU, repetirV);
    material.map = t;
    material.color.set(0xffffff);
    material.needsUpdate = true;
  }, undefined, () => {});
  return material;
}
export const matPared = conFoto(0x888579, "tunel-pared.jpg");
export const matTecho = conFoto(0x77746a, "tunel-techo.jpg");
export const matExterior = conFoto(0x7c7566, "tunel-exterior.jpg");
export const matPortal = conFoto(0x8d8a7e, "tunel-portal.jpg");
matPortal.side = THREE.DoubleSide;
const pintura = new THREE.MeshStandardMaterial({ color: 0xe4c46c, roughness: 0.9 });
const lampara = new THREE.MeshBasicMaterial({ color: 0xffe2a0 });
const asfalto = conFoto(0x555457, "asfalto-liso.jpg", 0.4, 1);

// Muro de la boca con el hueco del túnel; las uv cubren la foto una vez
function geometriaPortal() {
  const a = ANCHO_PORTAL / 2, b = ANCHO_BOCA / 2;
  const forma = new THREE.Shape([[-a, 0], [-b, 0], [-b, ALTO_BOCA], [b, ALTO_BOCA], [b, 0], [a, 0], [a, ALTO_PORTAL], [-a, ALTO_PORTAL]]
    .map(([x, y]) => new THREE.Vector2(x, y)));
  const geo = new THREE.ShapeGeometry(forma);
  const uv = geo.attributes.uv, pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) uv.setXY(i, (pos.getX(i) + a) / ANCHO_PORTAL, pos.getY(i) / ALTO_PORTAL);
  return geo;
}
const geoPortal = geometriaPortal();

// Caras de la caja: +x, -x, +y, -y, +z, -z
const CARAS_IZQUIERDA = [matPared, matExterior, matExterior, matExterior, matExterior, matExterior];
const CARAS_DERECHA = [matExterior, matPared, matExterior, matExterior, matExterior, matExterior];
const CARAS_TECHO = [matExterior, matExterior, matExterior, matTecho, matExterior, matExterior];

export function crearPasoUrbano(pista, escena) {
  const centro = pista.nivel.id === 1 ? pista.meta : 8;
  const inicio = Math.max(0, centro - 100), fin = centro + 100;
  const izquierda = [], derecha = [], techo = [], bandas = [], suelo = [], lamparas = [];
  for (let s = inicio; s < fin; s += 5) {
    const largo = Math.min(5, fin - s), medio = s + largo / 2;
    for (const lado of [-1, 1]) {
      (lado < 0 ? izquierda : derecha).push({ s: medio, d: lado * 3.85, h: 2.6, escala: [0.7, 5.2, largo + 0.03] });
      bandas.push({ s: medio, d: lado * 3.49, h: 0.65, escala: [0.025, 0.15, largo + 0.03] });
    }
    for (const lado of [-1, 1]) lamparas.push({ s: medio, d: lado * 2.6, h: 5.1, escala: [0.22, 0.08, 1.5] });
    techo.push({ s: medio, d: 0, h: 5.35, escala: [8.4, 0.4, largo + 0.03] });
    suelo.push({ s: medio, d: 0, h: 0.015, escala: [7, 0.03, largo + 0.03] });
  }
  const grupo = new THREE.Group();
  grupo.name = "paso-cerro-ciudad";
  const matriz = new THREE.Matrix4(), pos = new THREE.Vector3(), giro = new THREE.Quaternion();
  const escala = new THREE.Vector3(), euler = new THREE.Euler(0, 0, 0, "YXZ");
  for (const [lista, material] of [[izquierda, CARAS_IZQUIERDA], [derecha, CARAS_DERECHA], [techo, CARAS_TECHO], [bandas, pintura], [suelo, asfalto], [lamparas, lampara]]) {
    const malla = new THREE.InstancedMesh(caja, material, lista.length);
    lista.forEach((p, i) => {
      const m = pista.muestra(p.s);
      pista.aMundo(p.s, p.d, p.h, pos);
      giro.setFromEuler(euler.set(-Math.atan(m.g), -m.th, 0, "YXZ"));
      escala.fromArray(p.escala);
      malla.setMatrixAt(i, matriz.compose(pos, giro, escala));
    });
    malla.castShadow = malla.receiveShadow = true;
    grupo.add(malla);
  }
  // Una boca por mundo: la de entrada en el cerro y la de salida en la ciudad
  const entrada = pista.nivel.id === 1;
  const sBoca = entrada ? inicio : fin;
  const portal = new THREE.Mesh(geoPortal, matPortal);
  pista.aMundo(sBoca, 0, 0, portal.position);
  portal.rotation.y = -pista.muestra(sBoca).th + (entrada ? 0 : Math.PI);
  portal.castShadow = portal.receiveShadow = true;
  grupo.add(portal);
  escena.add(grupo);
  return { grupo, liberar() { escena.remove(grupo); grupo.traverse((o) => { if (o.isInstancedMesh) o.dispose(); }); } };
}
