import * as THREE from "three";

// Pirañitas flotantes (botellita chica de tapa azul): cada una da medio corazón.
// Una malla instanciada por pieza, por mundo. El origen de la botella queda en su centro.
const curva = (puntos) => puntos.map(([x, y]) => new THREE.Vector2(x, y));
// La gaseosa llega hasta la pared de la botella; el vidrio solo se ve arriba, con aire en el cuello
const geoLiquido = new THREE.LatheGeometry(curva([[0, -0.42], [0.2, -0.42], [0.25, -0.36], [0.255, 0.02], [0.22, 0.13], [0.195, 0.16], [0, 0.16]]), 14);
const geoBotella = new THREE.LatheGeometry(curva([[0.197, 0.155], [0.105, 0.27], [0.09, 0.35], [0.105, 0.365], [0.105, 0.39]]), 14);
const geoEtiqueta = new THREE.CylinderGeometry(0.26, 0.26, 0.26, 14, 1, true);
geoEtiqueta.translate(0, -0.15, 0);
const geoTapa = new THREE.CylinderGeometry(0.118, 0.118, 0.08, 12);
geoTapa.translate(0, 0.42, 0);
const ALTURA = 1.15, BALANCEO = 0.14, GIRO = 2.4;
const ALCANCE = 150;          // m: más lejos no hace falta animarlas
const LARGO_TOQUE = 2, ANCHO_TOQUE = 1.3, ALTO_TOQUE = 1.6;
const SEPARACION_MIN = 170, SEPARACION_MAX = 270;

export function crearKolas(pista, escena, materiales) {
  const kolas = [];
  const fin = pista.meta - 30;
  // Con el azar de la pista: la misma ruta trae las latas en el mismo sitio
  const azar = pista.rand;
  for (let s = 110 + azar() * 60; s < fin; s += SEPARACION_MIN + azar() * (SEPARACION_MAX - SEPARACION_MIN)) {
    if (pista.enPasoUrbano(s)) continue;
    kolas.push({ s, d: (azar() < 0.5 ? -1 : 1) * pista.carril, fase: azar() * 6.28, tomada: false });
  }
  const mallas = [[geoLiquido, materiales.liquido], [geoEtiqueta, materiales.etiqueta], [geoTapa, materiales.tapa], [geoBotella, materiales.vidrio]].map(([geo, material]) => {
    const malla = new THREE.InstancedMesh(geo, material, Math.max(1, kolas.length));
    malla.frustumCulled = false;    // las instancias se mueven: el volumen de la malla no sirve
    malla.count = kolas.length;
    escena.add(malla);
    return malla;
  });

  const matriz = new THREE.Matrix4(), pos = new THREE.Vector3(), giro = new THREE.Quaternion();
  const euler = new THREE.Euler(), uno = new THREE.Vector3(1, 1, 1), nada = new THREE.Vector3(0, 0, 0);
  let tiempo = 0;
  const colocar = (k, i) => {
    pista.aMundo(k.s, k.d, ALTURA + Math.sin(tiempo * 2 + k.fase) * BALANCEO, pos);
    giro.setFromEuler(euler.set(0.2, tiempo * GIRO + k.fase, 0));
    matriz.compose(pos, giro, k.tomada ? nada : uno);
    for (const malla of mallas) malla.setMatrixAt(i, matriz);
  };
  kolas.forEach(colocar);
  for (const malla of mallas) malla.instanceMatrix.needsUpdate = true;

  return {
    mallas,
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
      if (cambio) for (const malla of mallas) malla.instanceMatrix.needsUpdate = true;
      return tomadas;
    },
    liberar() {
      for (const malla of mallas) { escena.remove(malla); malla.dispose(); }
    },
  };
}
