import * as THREE from "three";

// La misma sección a ambos lados del enlace oculta el cambio de paisaje sin cortar la marcha.
const caja = new THREE.BoxGeometry(1, 1, 1);
const hormigon = new THREE.MeshStandardMaterial({ color: 0x888579, roughness: 0.95 });
const pintura = new THREE.MeshStandardMaterial({ color: 0xe4c46c, roughness: 0.9 });
const asfalto = new THREE.MeshStandardMaterial({ color: 0x555457, roughness: 0.95 });
export function crearPasoUrbano(pista, escena) {
  const centro = pista.nivel.id === 1 ? pista.meta : 8;
  const inicio = Math.max(0, centro - 100), fin = centro + 100;
  const piezas = [], bandas = [], suelo = [];
  for (let s = inicio; s < fin; s += 5) {
    const largo = Math.min(5, fin - s), medio = s + largo / 2;
    for (const lado of [-1, 1]) {
      piezas.push({ s: medio, d: lado * 3.85, h: 2.6, escala: [0.7, 5.2, largo + 0.03] });
      bandas.push({ s: medio, d: lado * 3.49, h: 0.65, escala: [0.025, 0.15, largo + 0.03] });
    }
    piezas.push({ s: medio, d: 0, h: 5.35, escala: [8.4, 0.4, largo + 0.03] });
    suelo.push({ s: medio, d: 0, h: 0.015, escala: [7, 0.03, largo + 0.03] });
  }
  const grupo = new THREE.Group();
  grupo.name = "paso-cerro-ciudad";
  const matriz = new THREE.Matrix4(), pos = new THREE.Vector3(), giro = new THREE.Quaternion();
  const escala = new THREE.Vector3(), euler = new THREE.Euler(0, 0, 0, "YXZ");
  for (const [lista, material] of [[piezas, hormigon], [bandas, pintura], [suelo, asfalto]]) {
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
  escena.add(grupo);
  return { grupo, liberar() { escena.remove(grupo); grupo.traverse((o) => { if (o.isInstancedMesh) o.dispose(); }); } };
}
