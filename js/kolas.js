import * as THREE from "three";

// Latas flotantes de kola: cada una da medio corazón. Una sola malla instanciada por mundo.
const RADIO = 0.24, ALTO = 0.68;
const geoLata = new THREE.CylinderGeometry(RADIO, RADIO, ALTO, 16);
const ALTURA = 1.15, BALANCEO = 0.14, GIRO = 2.4;
const ALCANCE = 150;          // m: más lejos no hace falta animarlas
const LARGO_TOQUE = 2, ANCHO_TOQUE = 1.3, ALTO_TOQUE = 1.6;
const SEPARACION_MIN = 170, SEPARACION_MAX = 270;

export function crearKolas(pista, escena, material) {
  const kolas = [];
  const fin = pista.meta - 30;
  // Con el azar de la pista: la misma ruta trae las latas en el mismo sitio
  const azar = pista.rand;
  for (let s = 110 + azar() * 60; s < fin; s += SEPARACION_MIN + azar() * (SEPARACION_MAX - SEPARACION_MIN)) {
    if (pista.enPasoUrbano(s)) continue;
    kolas.push({ s, d: (azar() < 0.5 ? -1 : 1) * pista.carril, fase: azar() * 6.28, tomada: false });
  }
  const malla = new THREE.InstancedMesh(geoLata, material, Math.max(1, kolas.length));
  malla.frustumCulled = false;      // las instancias se mueven: el volumen de la malla no sirve
  malla.count = kolas.length;
  escena.add(malla);

  const matriz = new THREE.Matrix4(), pos = new THREE.Vector3(), giro = new THREE.Quaternion();
  const euler = new THREE.Euler(), uno = new THREE.Vector3(1, 1, 1), nada = new THREE.Vector3(0, 0, 0);
  let tiempo = 0;
  const colocar = (k, i) => {
    pista.aMundo(k.s, k.d, ALTURA + Math.sin(tiempo * 2 + k.fase) * BALANCEO, pos);
    giro.setFromEuler(euler.set(0.2, tiempo * GIRO + k.fase, 0));
    malla.setMatrixAt(i, matriz.compose(pos, giro, k.tomada ? nada : uno));
  };
  kolas.forEach(colocar);
  malla.instanceMatrix.needsUpdate = true;

  return {
    malla,
    kolas,
    // Mueve las cercanas y devuelve cuántas tomó el torito en este cuadro
    actualizar(dt, veh) {
      tiempo += dt;
      let tomadas = 0, cambio = false;
      kolas.forEach((k, i) => {
        if (k.tomada || Math.abs(k.s - veh.s) > ALCANCE) return;
        if (veh.estado === "ok" && Math.abs(k.s - veh.s) < LARGO_TOQUE && Math.abs(k.d - veh.d) < ANCHO_TOQUE && veh.h < ALTO_TOQUE) {
          k.tomada = true;
          tomadas++;
        }
        colocar(k, i);
        cambio = true;
      });
      if (cambio) malla.instanceMatrix.needsUpdate = true;
      return tomadas;
    },
    liberar() {
      escena.remove(malla);
      malla.dispose();
    },
  };
}
