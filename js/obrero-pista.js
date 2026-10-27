// Web Worker: calcula los bloques de la pista (geometría pura) fuera del hilo principal.
// Recibe la semilla de la partida, arma la misma Pista y devuelve cada bloque como arreglos
// de números, transfiriendo la memoria sin copiarla.
import { Pista } from "./pista.js?v=1.3.1";

let pista = null, claves = null, partida = -1;

self.onmessage = ({ data }) => {
  if (data.tipo === "pista") {
    partida = data.partida;
    claves = data.claves;
    pista = new Pista(data.semilla);
    pista.medidasChoza = data.medidas;
    return;
  }
  if (data.tipo === "bloque" && pista && data.partida === partida) {
    const datos = pista.datosBloque(data.indice, claves);
    const transferir = [];
    for (const m of datos.mallas) transferir.push(m.pos.buffer, m.uv.buffer, m.idx.buffer, m.normal.buffer);
    for (const i of datos.inst) {
      transferir.push(i.matrices.buffer);
      if (i.colores) transferir.push(i.colores.buffer);
    }
    for (const l of datos.lineas) transferir.push(l.pos.buffer);
    self.postMessage({ tipo: "bloque", partida, datos }, transferir);
  }
};
