import * as THREE from "three";
import { CHUNK } from "./pista.js?v=1.3.1";
import { crearChoza, liberarRecursos } from "./modelos.js?v=1.3.1";
import { reserva } from "./reciclaje.js?v=1.3.1";

// Carga por tramos: solo existen los bloques cercanos al torito. Al avanzar se piden los de
// adelante a un Web Worker (que calcula la geometría fuera del hilo principal), se montan al
// llegar y se liberan los de atrás. Sin soporte de workers, se calculan aquí mismo.
const ATRAS = 100;          // m que se conservan detrás del torito
const ADELANTE = 420;       // m que se piden por delante (la niebla tapa ~290 m)
const HOLGURA = 60;         // margen antes de liberar, para no armar/liberar en vaivén
const VISIBLE_ATRAS = 80, VISIBLE_ADELANTE = 340;
const URGENTE = 70;         // si falta un bloque a menos de esto, se calcula aquí sin esperar

// Un solo worker para todo el juego: se reutiliza entre partidas
let obrero = null, obreroFallo = false;
function obtenerObrero() {
  if (obrero || obreroFallo || typeof Worker === "undefined") return obrero;
  try {
    obrero = new Worker(new URL("./obrero-pista.js?v=1.3.1", import.meta.url), { type: "module" });
    obrero.addEventListener("error", () => { obreroFallo = true; obrero = null; });
  } catch (_) {
    obreroFallo = true;
  }
  return obrero;
}
let partidas = 0;

// Espejo de los materiales con claves de texto: lo que recibe pista.datosBloque.
// mat.fachadas[3] → "fachadas.3", mat.geoPoste → "geoPoste".
export function clavesDe(mat) {
  const claves = {};
  for (const [nombre, valor] of Object.entries(mat)) {
    claves[nombre] = Array.isArray(valor) ? valor.map((_, i) => `${nombre}.${i}`) : nombre;
  }
  return claves;
}

// Medidas de cada variante de choza (para ubicarlas en su terraza). De paso deja una de cada
// variante guardada en la reserva, lista para el primer bloque del cerro.
export function medidasChoza() {
  const medidas = {};
  for (const variante of [0, 1, 2]) {
    const choza = reserva.tomar(`choza|${variante}`, () => crearChoza({ variante }));
    medidas[variante] = { ancho: choza.userData.ancho || 3.5, largo: choza.userData.largo || 4.5 };
    reserva.devolver(choza, liberarRecursos);
  }
  return medidas;
}

export class GestorTramos {
  constructor(pista, escena, mat, semilla) {
    this.pista = pista;
    this.escena = escena;
    this.mat = mat;
    this.claves = clavesDe(mat);
    this.bloques = new Map();       // índice → THREE.Group
    this.pedidos = new Set();       // índices encargados al worker
    this.listos = [];               // datos que ya llegaron y esperan ser montados
    this.mallasLibres = [];         // contenedores reciclados (Mesh) de bloques liberados
    pista.medidasChoza = medidasChoza();
    this.partida = ++partidas;
    this.obrero = obtenerObrero();
    if (this.obrero) {
      this.alMensaje = ({ data }) => {
        if (data.tipo !== "bloque" || data.partida !== this.partida) return;
        this.pedidos.delete(data.datos.indice);
        if (!this.bloques.has(data.datos.indice)) this.listos.push(data.datos);
      };
      this.obrero.addEventListener("message", this.alMensaje);
      this.obrero.postMessage({ tipo: "pista", partida: this.partida, semilla, claves: this.claves, medidas: pista.medidasChoza });
    }
  }

  // Deja de escuchar al worker (al cambiar de partida)
  cerrar() {
    if (this.obrero) this.obrero.removeEventListener("message", this.alMensaje);
    this.liberarTodo();
    this.listos.length = 0;
    this.pedidos.clear();
  }

  resolver(clave) {
    if (typeof clave !== "string") return clave;
    const punto = clave.indexOf(".");
    return punto < 0 ? this.mat[clave] : this.mat[clave.slice(0, punto)][+clave.slice(punto + 1)];
  }

  // Índices que deberían existir para la posición s, del más cercano al más lejano
  pendientes(s) {
    const desde = Math.max(0, Math.floor((s - ATRAS) / CHUNK));
    const hasta = Math.min(this.pista.numBloques - 1, Math.floor((s + ADELANTE) / CHUNK));
    const centro = Math.floor(s / CHUNK);
    const lista = [];
    for (let i = desde; i <= hasta; i++) if (!this.bloques.has(i)) lista.push(i);
    return lista.sort((a, b) => Math.abs(a - centro) - Math.abs(b - centro));
  }

  necesario(i, s) {
    return (i + 1) * CHUNK >= s - ATRAS - HOLGURA && i * CHUNK <= s + ADELANTE + HOLGURA;
  }

  // Arma de inmediato lo cercano (al empezar la partida); el resto llega por actualizar()
  precargar(s) {
    for (const i of this.pendientes(s)) {
      if (i * CHUNK > s + 200) break;
      this.armar(i);
    }
    this.actualizarVisibles(s);
  }

  // Cada cuadro: libera lo lejano, monta lo que llegó del worker (con presupuesto de tiempo),
  // encarga lo que falta y calcula aquí solo lo urgente.
  actualizar(s, presupuestoMs = 4) {
    for (const i of [...this.bloques.keys()]) if (!this.necesario(i, s)) this.liberar(i);
    const inicio = performance.now();
    while (this.listos.length && performance.now() - inicio < presupuestoMs) {
      const datos = this.listos.shift();
      if (!this.bloques.has(datos.indice) && this.necesario(datos.indice, s)) this.colocar(datos.indice, this.montar(datos));
    }
    for (const i of this.pendientes(s)) {
      const urgente = i * CHUNK < s + URGENTE;
      if (this.obrero && !urgente) {
        if (!this.pedidos.has(i)) { this.pedidos.add(i); this.obrero.postMessage({ tipo: "bloque", partida: this.partida, indice: i }); }
      } else if (!this.obrero || urgente) {
        this.armar(i);   // sin worker, o el worker no llegó a tiempo
        if (this.obrero || performance.now() - inicio > presupuestoMs) break;
      }
    }
    this.actualizarVisibles(s);
  }

  actualizarVisibles(s) {
    for (const [i, g] of this.bloques) {
      g.visible = (i + 1) * CHUNK > s - VISIBLE_ATRAS && i * CHUNK < s + VISIBLE_ADELANTE;
    }
  }

  // Calcula y monta un bloque en el hilo principal (al empezar, o si el worker no llegó)
  armar(i) {
    this.pedidos.delete(i);
    this.colocar(i, this.montar(this.pista.datosBloque(i, this.claves)));
  }

  colocar(i, grupo) {
    this.escena.add(grupo);
    this.bloques.set(i, grupo);
  }

  // Datos del bloque → objetos de Three.js
  montar(datos) {
    const grupo = new THREE.Group();
    grupo.userData.modelos = [];
    for (const m of datos.mallas) {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.BufferAttribute(m.pos, 3));
      geo.setAttribute("normal", new THREE.BufferAttribute(m.normal, 3));
      geo.setAttribute("uv", new THREE.BufferAttribute(m.uv, 2));
      geo.setIndex(new THREE.BufferAttribute(m.idx, 1));
      geo.computeBoundingSphere();
      // Reutiliza contenedores de bloques ya liberados (solo cambia geometría y material)
      const malla = this.mallasLibres.pop() || new THREE.Mesh();
      malla.geometry = geo;
      malla.material = this.resolver(m.mat);
      malla.receiveShadow = m.sombra;
      grupo.add(malla);
    }
    for (const d of datos.inst) {
      const inst = new THREE.InstancedMesh(this.resolver(d.geo), this.resolver(d.mat), d.matrices.length / 16);
      inst.instanceMatrix.array.set(d.matrices);
      inst.instanceMatrix.needsUpdate = true;
      if (d.colores) inst.instanceColor = new THREE.InstancedBufferAttribute(d.colores, 3);
      inst.castShadow = d.sombra;
      grupo.add(inst);
    }
    for (const l of datos.lineas) {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.BufferAttribute(l.pos, 3));
      geo.computeBoundingSphere();
      grupo.add(new THREE.LineSegments(geo, this.resolver(l.mat)));
    }
    for (const mo of datos.modelos) {
      const choza = reserva.tomar(`choza|${mo.variante}`, () => crearChoza({ variante: mo.variante }));
      choza.position.fromArray(mo.pos);
      choza.rotation.set(0, mo.rotY, 0);
      choza.scale.fromArray(mo.escala);
      grupo.add(choza);
      grupo.userData.modelos.push(choza);
    }
    return grupo;
  }

  // Devuelve los modelos a la reserva y libera solo la geometría propia del bloque
  // (las geometrías de las instancias son compartidas: ahí solo se liberan las matrices).
  liberar(i) {
    const grupo = this.bloques.get(i);
    if (!grupo) return;
    for (const modelo of grupo.userData.modelos) reserva.devolver(modelo, liberarRecursos);
    for (const hijo of [...grupo.children]) {
      if (hijo.isInstancedMesh) hijo.dispose();
      else if (hijo.geometry) hijo.geometry.dispose();
      if (hijo.isMesh && !hijo.isInstancedMesh && this.mallasLibres.length < 400) {
        grupo.remove(hijo);
        this.mallasLibres.push(hijo);
      }
    }
    this.escena.remove(grupo);
    this.bloques.delete(i);
  }

  liberarTodo() {
    for (const i of [...this.bloques.keys()]) this.liberar(i);
  }
}
