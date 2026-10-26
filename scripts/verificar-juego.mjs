// Pruebas de lógica sin navegador ni dependencias: node scripts/verificar-juego.mjs
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const leer = (ruta) => fs.readFileSync(new URL(`../${ruta}`, import.meta.url), "utf8");
function clase(ruta, nombre, contexto = {}) {
  const codigo = leer(ruta).replace(/^import .*;\r?\n/gm, "").replace(/export /g, "");
  return vm.runInNewContext(`${codigo}\n${nombre}`, contexto);
}
const Vehiculo = clase("js/vehiculo.js", "Vehiculo", { ANCHO: 7 });
const pistaLisa = (g = 0) => ({
  largo: 100000, baches: [], rompemuelles: [],
  muestra: (_s, out) => Object.assign(out, { g, k: 0 }),
  enTierra: () => false, alturaLateral: () => 0, limiteLateral: () => 5.1,
});
const entrada = (acelerador = false, freno = false) => ({ giro: 0, acelerador, freno });
function avanzar(v, segundos, e) {
  for (let i = 0; i < segundos * 120; i++) v.paso(1 / 120, e, []);
  assert.equal(v.estado, "ok");
  assert.ok(Number.isFinite(v.v) && Number.isFinite(v.s));
}
const carrera = new Vehiculo(pistaLisa(), "carrera");
assert.equal(carrera.v, 0);
avanzar(carrera, 3, entrada());
assert.equal(carrera.v, 0);
avanzar(carrera, 5, entrada(true));
assert.ok(carrera.kmh > 40, "Carrera debe superar los 40 km/h en plano");
avanzar(carrera, 5, entrada(true, true));
assert.equal(carrera.v, 0, "el freno debe dominar al acelerador");
assert.equal(carrera.freno, 100);
for (const pendiente of [0.1, 0.2, 0.3]) {
  const v = new Vehiculo(pistaLisa(pendiente), "carrera");
  v.v = 25;
  avanzar(v, 8, entrada(false, true));
  assert.equal(v.v, 0, "debe parar en pendiente");
  avanzar(v, 2, entrada(true, true));
  assert.equal(v.v, 0, "debe permanecer frenado en pendiente");
}
const original = new Vehiculo(pistaLisa(0.2));
const originalAcelerado = new Vehiculo(pistaLisa(0.2));
avanzar(original, 8, entrada());
avanzar(originalAcelerado, 8, entrada(true));
assert.equal(original.v, originalAcelerado.v, "el acelerador no afecta Sin frenos");
avanzar(original, 8, entrada(false, true));
assert.ok(original.v > 0 && original.freno < 100);

// Curvas cerradas de radio 9 m, a ambos lados y a velocidades de carrera.
for (const kmh of [45, 60, 80]) for (const lado of [-1, 1]) for (const tierra of [false, true]) {
  const pista = pistaLisa();
  const k = lado / 9;
  pista.muestra = (_s, out) => Object.assign(out, { g: 0, k });
  pista.enTierra = () => tierra;
  const v = new Vehiculo(pista, "carrera");
  v.v = kmh / 3.6;
  const angulo = Math.atan(1.95 * k / (1 - v.d * k));
  v.giro = angulo;
  const dInicial = v.d;
  avanzar(v, 4, { giro: angulo / Math.atan(1.95 / 6.5), freno: false, acelerador: true });
  assert.ok(v.kmh > 40);
  assert.ok(Math.abs(v.d - dInicial) < 0.01, "debe seguir la curva sin frenar ni salirse");
  assert.ok(v.inclinacion < 1 && Math.abs(v.balanceo) <= 0.32, "inclinación visual limitada");
  assert.equal(v.h, 0, "doblar no debe lanzar la moto al aire");
}
const vuelcoOriginal = new Vehiculo({ ...pistaLisa(), limiteLateral: () => 10000 });
vuelcoOriginal.v = 15;
for (let i = 0; i < 600 && vuelcoOriginal.estado === "ok"; i++) {
  vuelcoOriginal.paso(1 / 120, { giro: 1, freno: false }, []);
}
assert.equal(vuelcoOriginal.estado, "choque");
assert.match(vuelcoOriginal.motivo, /volcaste/, "Sin frenos conserva el vuelco original");

class Vector3 { set(x, y, z) { Object.assign(this, { x, y, z }); return this; } }
const Pista = clase("js/pista.js", "Pista", { THREE: { Vector3 } });
let muestras = 0;
for (const semilla of [1, 42, 12345, 87654]) {
  const p = new Pista(semilla);
  assert.equal(p.barrio(0), "cerro");
  assert.deepEqual([...new Set(p.casas.flat().map((c) => c.barrio))].sort(), ["avenida", "ladera", "vecindario"]);
  assert.ok(p.casas.flat().some((c) => c.muro));
  assert.ok(p.casas.flat().some((c) => c.negocio >= 0));
  assert.ok(p.casas.flat().every((c) => c.tex >= 0 && c.tex < 24));
  assert.ok(p.parches.length > 20 && p.grietas.length > 20);
  assert.equal(p.polvo, undefined, "sin manchas crema al borde de la pista");
  const tipos = new Set();
  let distintos = 0, rebajes = 0;
  for (let s = Math.ceil(p.finTierra); s < p.largo - 1; s += 0.25) {
    assert.equal(p.alturaLateral(0, s), 0);
    for (const lado of [-1, 1]) {
      const h = p.alturaLateral(lado * 4, s);
      assert.ok(Number.isFinite(h) && h >= 0.02 && h < 0.6);
      tipos.add(p.tipoVereda(s, lado));
      if (h < 0.05) rebajes++;
      muestras++;
    }
    if (p.alturaLateral(-4, s) !== p.alturaLateral(4, s)) distintos++;
  }
  assert.equal(tipos.size, 3);
  assert.ok(distintos > 100 && rebajes > 10);
  let peldaños = 0, urbanos = 0;
  for (let s = Math.ceil(p.finTierra) + 4; s < p.largo - 4; s++) {
    urbanos++;
    if (p.tipoVereda(s, 1) !== "escalera" || p.muestra(s).g <= 0.055) continue;
    const a = p.muestra(s + 0.2).y + p.alturaLateral(4, s + 0.2);
    const b = p.muestra(s + 0.7).y + p.alturaLateral(4, s + 0.7);
    if (Math.abs(a - b) < 0.00001) peldaños++;
  }
  assert.ok(peldaños / urbanos > 0.35, "las escaleras deben verse con huellas horizontales frecuentes");
  // Ejecutar la generación real de las veredas de todos los bloques.
  const codigo = leer("js/pista.js");
  const seccion = codigo.slice(codigo.indexOf("    const vereda = nuevo();"), codigo.indexOf("    // Miradores: baranda"));
  const construir = vm.runInNewContext(`(function(i0, i1) {
    const iT = Math.round(this.finTierra), v = new Vector3();
    ${seccion}
  })`, {
    Vector3, ANCHO: 7, VEREDA: 1.6, mat: { vereda: 1, tierra: 2, asfalto: 3 },
    nuevo: () => ({ pos: [], uv: [], idx: [] }),
    malla: (buf) => {
      assert.ok(buf.pos.every(Number.isFinite));
      assert.ok(buf.idx.every((i) => i >= 0 && i < buf.pos.length / 3));
    },
  });
  for (let s = 0; s < p.n - 1; s += 60) construir.call(p, s, Math.min(p.n - 1, s + 60));
}

class Elemento {
  constructor() { this.eventos = {}; this.classList = { add() {}, remove() {}, toggle() {} }; }
  addEventListener(tipo, fn) { (this.eventos[tipo] ??= []).push(fn); }
  setPointerCapture() {}
  emitir(tipo, pointerId) { for (const fn of this.eventos[tipo] || []) fn({ pointerId, preventDefault() {} }); }
}
const Controles = clase("js/controles.js", "Controles", {
  navigator: { userAgent: "test", maxTouchPoints: 0 }, localStorage: { getItem: () => null },
  addEventListener() {}, document: { addEventListener() {} }, screen: {}, window: {},
});
const controles = new Controles();
controles.teclas.add("w");
assert.equal(controles.actualizar(0.1).acelerador, true);
controles.limpiar();
assert.equal(controles.actualizar(0.1).acelerador, false);
const elementos = new Map();
const $ = (id) => { if (!elementos.has(id)) elementos.set(id, new Elemento()); return elementos.get(id); };
const main = leer("js/main.js");
const bloque = main.slice(main.indexOf("const punterosGiro ="), main.indexOf("// Escena de fondo"));
const eventosGlobales = new Map();
vm.runInNewContext(bloque, { controles, $, estado: "jugando", centrarTimon() {},
  addEventListener(tipo, fn) { if (!eventosGlobales.has(tipo)) eventosGlobales.set(tipo, []); eventosGlobales.get(tipo).push(fn); },
});
$("zona-izq").emitir("pointerdown", 1);
$("b-izq").emitir("pointerdown", 2);
$("zona-der").emitir("pointerdown", 3);
$("b-acelerador").emitir("pointerdown", 4);
assert.equal(controles.actualizar(0.1).acelerador, true);
$("zona-izq").emitir("pointerup", 1);
assert.equal(controles.botones.izq, true, "el segundo dedo sigue girando");
$("b-izq").emitir("pointercancel", 2);
assert.equal(controles.botones.izq, false);
$("zona-der").emitir("lostpointercapture", 3);
assert.equal(controles.botones.der, false);
$("b-freno-izq").emitir("pointerdown", 5);
$("b-freno").emitir("pointerdown", 6);
$("b-freno-izq").emitir("pointerup", 5);
assert.equal(controles.actualizar(0.1).freno, true, "soltar un freno no cancela el otro");
$("b-freno").emitir("pointercancel", 6);
assert.equal(controles.actualizar(0.1).freno, false);
$("b-freno-izq").emitir("pointerdown", 7);
controles.limpiar();
assert.equal(controles.actualizar(0.1).freno, false);
assert.equal(controles.actualizar(0.1).acelerador, false);
assert.equal(controles.actualizar(0.1).giro, 0);
$("zona-izq").emitir("pointerdown", 9);
controles.actualizar(0.2);
assert.ok(controles.giro < 0);
for (const fn of eventosGlobales.get("pointerup")) fn({ pointerId: 9 });
assert.equal(controles.botones.izq, false, "soltar fuera de la zona no deja el giro pegado");
$("zona-izq").emitir("pointerdown", 10);
controles.botones.acelerador = true;
controles.centrarDireccion();
assert.equal(controles.actualizar(0.1).giro, 0, "centrar elimina pulsaciones pendientes tras un choque");
assert.equal(controles.botones.acelerador, true, "centrar no suelta el acelerador");
controles.limpiar();
controles.alMovimiento({ accelerationIncludingGravity: { x: 0, y: 0 } });
controles.alMovimiento({ accelerationIncludingGravity: { x: 3, y: 0 } });
assert.ok(controles.actualizar(0.1).giro < 0);
assert.equal(controles.actualizar(0.7).giro, 0, "un sensor sin nuevas lecturas no mantiene el giro");
controles.alMovimiento({ accelerationIncludingGravity: { x: 3, y: 0 } });
controles.calibrar();
assert.equal(controles.actualizar(0.1).giro, 0);

const modeloSimple = () => ({
  userData: {}, position: { set() {} }, rotation: { x: 0, y: 0, z: 0, set() {} }, visible: true,
});
const modelosSimple = Object.fromEntries(["crearCarro", "crearTorito", "crearPersona", "crearPerro", "crearGato", "crearObra", "crearDesmonte"].map((k) => [k, modeloSimple]));
modelosSimple.animarCaminar = modelosSimple.liberarRecursos = () => {};
const azarFijo = Object.create(Math); azarFijo.random = () => 0.6;
const Trafico = clase("js/trafico.js", "Trafico", { ANCHO: 7, VEREDA: 1.6, LARGO_TORITO: 2.65, ANCHO_TORITO: 1.3, modelos: modelosSimple, Math: azarFijo });
const circuito = {
  largo: 1000, finTierra: 200, cruces: [300, 500, 700],
  muestra: (_s, out = {}) => Object.assign(out, { g: 0.15, k: 0.06, th: 0 }),
  enTierra: (s) => s < 200, alturaLateral: () => 0,
  aMundo: (s, d, h, out) => out.set(s, h, d),
};
const escenaSimple = { add() {}, remove() {} };
const carreraBots = new Trafico(escenaSimple, circuito, "carrera");
assert.equal(carreraBots.agentes.length, 3);
assert.ok(carreraBots.agentes.every((a) => a.rival && !a.peaton && !a.estatico));
const jugador = { s: 8, d: 1.75, v: 18, h: 0, estado: "ok", invulnerable: true };
for (let i = 0; i < 10000; i++) {
  jugador.s = Math.min(940, jugador.s + jugador.v / 60);
  carreraBots.actualizar(1 / 60, jugador);
  assert.equal(carreraBots.agentes.length, 3, "los rivales no desaparecen de la clasificación");
  assert.ok(carreraBots.agentes.every((a) => Number.isFinite(a.s) && Number.isFinite(a.d) && a.v >= 0 && Math.abs(a.d) <= 1.65));
}
assert.ok(carreraBots.agentes.every((a) => a.termino && a.tiempoLlegada > 0));
assert.ok(carreraBots.puesto(jugador) >= 1 && carreraBots.puesto(jugador) <= 4);
const traficoOriginal = new Trafico(escenaSimple, circuito);
assert.ok(traficoOriginal.agentes.some((a) => a.tipo === "persona"));
assert.ok(traficoOriginal.agentes.some((a) => a.tipo === "desmonte"));
console.log("OK: tres bots completan la carrera; sin peatones/desmontes en Carrera; liberación global y centrado del timón.");
console.log(`OK: Carrera, frenos en pendiente, modo original, multitouch y ${muestras} muestras de veredas; geometrías de 4 pistas sin valores inválidos.`);
