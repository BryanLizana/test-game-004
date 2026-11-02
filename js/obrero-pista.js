// Web Worker: calcula los bloques de la pista (geometría pura) fuera del hilo principal.
// Recibe la semilla de la partida, arma la misma Pista y devuelve cada bloque como arreglos
// de números, transfiriendo la memoria sin copiarla.
import { Pista } from "./pista.js?v=1.8.6";

// El cerro y la ciudad se preparan juntos; cada gestor conserva su trazado.
const partidas = new Map();

self.onmessage = ({ data }) => {
  if (data.tipo === "pista") {
    const pista = new Pista(data.semilla, data.nivel);
    pista.medidasChoza = data.medidas;
    partidas.set(data.partida, { pista, claves: data.claves });
    return;
  }
  if (data.tipo === "cerrar") { partidas.delete(data.partida); return; }
  const actual = partidas.get(data.partida);
  if (data.tipo === "bloque" && actual) {
    const { pista, claves } = actual, partida = data.partida;
    const datos = pista.datosBloque(data.indice, claves);
    const transferir = [];
    for (const m of datos.mallas) {
      transferir.push(m.pos.buffer, m.uv.buffer, m.idx.buffer, m.normal.buffer);
      if (m.col) transferir.push(m.col.buffer);
    }
    for (const i of datos.inst) {
      transferir.push(i.matrices.buffer);
      if (i.colores) transferir.push(i.colores.buffer);
    }
    for (const l of datos.lineas) transferir.push(l.pos.buffer);
    self.postMessage({ tipo: "bloque", partida, datos }, transferir);
  }
};
