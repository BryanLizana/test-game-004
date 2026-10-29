import * as THREE from "three";
import { CHUNK } from "./pista.js?v=1.4.2";
import { crearChoza, liberarRecursos } from "./modelos.js?v=1.4.2";
import { reserva } from "./reciclaje.js?v=1.4.2";

// Carga por tramos: solo existen los bloques cercanos al torito. Al avanzar se piden los de
// adelante a un Web Worker (que calcula la geometría fuera del hilo principal), se montan al
// llegar y se liberan los de atrás. Sin soporte de workers, se calculan aquí mismo.
const ATRAS = 100;          // m que se conservan detrás del torito
const ADELANTE = 420;       // m que se piden por delante (la niebla tapa ~290 m)
const HOLGURA = 60;         // margen antes de liberar, para no armar/liberar en vaivén
const URGENTE = 70;         // si falta un bloque a menos de esto, se calcula aquí sin esperar
// Además de lo que toca por metros de calle, existe y se ve toda pieza (bloque de calle o losa del
// terreno) cuya caja quede a menos de esta distancia real: en las curvas cerradas un tramo ya
// pasado (o uno lejano por la calle) queda delante, y antes desaparecía dejando un hueco.
const ALCANCE_VISTA = 430;  // el fundido con el cielo termina a 420 m
// Más lejos que esto no se dibujan los detalles chicos (postes, focos, plantas, tanques, cables,
// baches, letreros…): casi no se distinguen y son la mayoría de las llamadas de dibujo.
const DETALLE_LEJOS = 150;
const ES_DETALLE = /^(bache|reparacion|grieta|huella|letreros|porton|grafiti|reja)/;
const SIEMPRE_VISIBLE = new Set(["geoCruzPalo", "geoCruzBrazo"]);   // la cruz del cerro se ve de lejos

// Un solo worker para todo el juego: se reutiliza entre partidas
let obrero = null, obreroFallo = false;
function obtenerObrero() {
  if (obrero || obreroFallo || typeof Worker === "undefined") return obrero;
  try {
    obrero = new Worker(new URL("./obrero-pista.js?v=1.4.2", import.meta.url), { type: "module" });
    obrero.addEventListener("error", () => { obreroFallo = true; obrero = null; });
  } catch (_) {
    obreroFallo = true;
  }
  return obrero;
}
let partidas = 0;

// Espejo de los materiales con claves de texto: lo que recibe pista.datosBloque.
// mat.letreros[3] → "letreros.3", mat.geoPoste → "geoPoste".
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
    this.cajas = this.calcularCajas();
    this.punto = { x: 0, z: 0 };
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

  // Caja en planta (x, z) de cada pieza: la calle con sus casas, o el cuadrado de la losa
  calcularCajas() {
    const p = this.pista, cajas = [], ANCHO_CASAS = 15;
    for (let i = 0; i < p.numBloques; i++) {
      const caja = { x0: Infinity, x1: -Infinity, z0: Infinity, z1: -Infinity };
      const a = i * CHUNK, b = Math.min(p.n - 1, (i + 1) * CHUNK);
      for (let j = a; j <= b; j++) {
        caja.x0 = Math.min(caja.x0, p.x[j] - ANCHO_CASAS); caja.x1 = Math.max(caja.x1, p.x[j] + ANCHO_CASAS);
        caja.z0 = Math.min(caja.z0, p.z[j] - ANCHO_CASAS); caja.z1 = Math.max(caja.z1, p.z[j] + ANCHO_CASAS);
      }
      cajas.push(caja);
    }
    for (let i = p.numBloques; i < p.numPiezas; i++) cajas.push(p.cajaLosa(i));
    return cajas;
  }

  // Distancia en planta desde el torito hasta la caja de la pieza (0 si está dentro)
  distancia(i) {
    const c = this.cajas[i], { x, z } = this.punto;
    return Math.hypot(Math.max(c.x0 - x, 0, x - c.x1), Math.max(c.z0 - z, 0, z - c.z1));
  }

  ubicar(s) {
    const m = this.pista.muestra(s);
    this.punto.x = m.x; this.punto.z = m.z;
  }

  porCalle(i, s, margen = 0) {
    return i < this.pista.numBloques && (i + 1) * CHUNK >= s - ATRAS - margen && i * CHUNK <= s + ADELANTE + margen;
  }

  // Índices que deberían existir para la posición s, del más cercano al más lejano
  pendientes(s) {
    const lista = [];
    for (let i = 0; i < this.pista.numPiezas; i++) {
      if (!this.bloques.has(i) && (this.porCalle(i, s) || this.distancia(i) < ALCANCE_VISTA)) lista.push(i);
    }
    return lista.sort((a, b) => this.distancia(a) - this.distancia(b));
  }

  necesario(i, s) {
    return this.porCalle(i, s, HOLGURA) || this.distancia(i) < ALCANCE_VISTA + HOLGURA;
  }

  // Arma de inmediato lo cercano (al empezar la partida); el resto llega por actualizar()
  precargar(s) {
    this.ubicar(s);
    for (const i of this.pendientes(s)) {
      if (this.distancia(i) > 150 && !(i < this.pista.numBloques && i * CHUNK <= s + 200)) continue;
      this.armar(i);
    }
    this.actualizarVisibles(s);
  }

  // Cada cuadro: libera lo lejano, monta lo que llegó del worker (con presupuesto de tiempo),
  // encarga lo que falta y calcula aquí solo lo urgente.
  actualizar(s, presupuestoMs = 4) {
    this.ubicar(s);
    for (const i of [...this.bloques.keys()]) if (!this.necesario(i, s)) this.liberar(i);
    const inicio = performance.now();
    while (this.listos.length && performance.now() - inicio < presupuestoMs) {
      const datos = this.listos.shift();
      if (!this.bloques.has(datos.indice) && this.necesario(datos.indice, s)) this.colocar(datos.indice, this.montar(datos));
    }
    for (const i of this.pendientes(s)) {
      const urgente = i < this.pista.numBloques ? (i + 1) * CHUNK > s - 10 && i * CHUNK < s + URGENTE : this.distancia(i) < 40;
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
      const distancia = this.distancia(i);
      g.visible = distancia < ALCANCE_VISTA;
      const cerca = distancia < DETALLE_LEJOS;
      if (g.userData.cerca !== cerca) {
        g.userData.cerca = cerca;
        for (const o of g.userData.detalles) o.visible = cerca;
      }
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
    grupo.userData.detalles = [];
    for (const m of datos.mallas) {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.BufferAttribute(m.pos, 3));
      geo.setAttribute("normal", new THREE.BufferAttribute(m.normal, 3));
      geo.setAttribute("uv", new THREE.BufferAttribute(m.uv, 2));
      if (m.col) geo.setAttribute("color", new THREE.BufferAttribute(m.col, 3));
      geo.setIndex(new THREE.BufferAttribute(m.idx, 1));
      geo.computeBoundingSphere();
      // Reutiliza contenedores de bloques ya liberados (solo cambia geometría y material)
      const malla = this.mallasLibres.pop() || new THREE.Mesh();
      malla.geometry = geo;
      malla.material = this.resolver(m.mat);
      malla.receiveShadow = m.sombra;
      malla.visible = true;
      grupo.add(malla);
      if (ES_DETALLE.test(m.mat)) grupo.userData.detalles.push(malla);
    }
    for (const d of datos.inst) {
      const inst = new THREE.InstancedMesh(this.resolver(d.geo), this.resolver(d.mat), d.matrices.length / 16);
      inst.instanceMatrix.array.set(d.matrices);
      inst.instanceMatrix.needsUpdate = true;
      if (d.colores) inst.instanceColor = new THREE.InstancedBufferAttribute(d.colores, 3);
      inst.castShadow = d.sombra;
      grupo.add(inst);
      if (!SIEMPRE_VISIBLE.has(d.geo)) grupo.userData.detalles.push(inst);
    }
    for (const l of datos.lineas) {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.BufferAttribute(l.pos, 3));
      geo.computeBoundingSphere();
      const cables = new THREE.LineSegments(geo, this.resolver(l.mat));
      grupo.add(cables);
      grupo.userData.detalles.push(cables);
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
