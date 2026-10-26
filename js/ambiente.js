import * as THREE from "three";

// Letreros pintados: cuatro materiales compartidos por todo el barrio.
export function crearLetreros() {
  return [
    ["BODEGA", "ABARROTES", "#ead9a7", "#9e3427"],
    ["TALLER", "MECANICA", "#cfdbd5", "#244b61"],
    ["BOTICA", "SALUD", "#e2e4cd", "#287956"],
    ["PANADERIA", "PAN CALIENTE", "#e9bf6d", "#77392b"],
  ].map(([titulo, subtitulo, fondo, tinta]) => {
    const c = document.createElement("canvas");
    c.width = 512; c.height = 128;
    const g = c.getContext("2d");
    g.fillStyle = fondo; g.fillRect(0, 0, 512, 128);
    g.strokeStyle = tinta; g.lineWidth = 5; g.strokeRect(9, 9, 494, 110);
    g.textAlign = "center"; g.fillStyle = tinta;
    g.font = "bold 52px sans-serif"; g.fillText(titulo, 256, 65);
    g.font = "bold 23px sans-serif"; g.fillText(subtitulo, 256, 101);
    // Desgaste determinista de la pintura, sin actualizar texturas durante el juego.
    g.fillStyle = fondo;
    for (let i = 0; i < 100; i++) g.fillRect((i * 97) % 512, (i * 43) % 128, 1 + i % 5, 1 + i % 2);
    const mapa = new THREE.CanvasTexture(c);
    mapa.colorSpace = THREE.SRGBColorSpace;
    return new THREE.MeshStandardMaterial({ map: mapa, roughness: 1, side: THREE.DoubleSide });
  });
}

