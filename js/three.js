// Puente a Three.js por URL completa: los Web Workers no usan el importmap del HTML.
// Es la misma URL del importmap, así que en el hilo principal se reutiliza el mismo módulo.
export * from "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js";
