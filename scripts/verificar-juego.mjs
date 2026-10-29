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
const entrada = (freno = false) => ({ giro: 0, freno });
function avanzar(v, segundos, e) {
  for (let i = 0; i < segundos * 120; i++) v.paso(1 / 120, e, []);
  assert.equal(v.estado, "ok");
  assert.ok(Number.isFinite(v.v) && Number.isFinite(v.s));
}
const original = new Vehiculo(pistaLisa(0.2));
avanzar(original, 8, entrada());
avanzar(original, 8, entrada(true));
assert.ok(original.v > 0 && original.freno < 100);
// Carrera usa la misma bajada sin frenos: los rivales llegan a la misma velocidad final que el jugador.
const aceleracionBajada = clase("js/vehiculo.js", "aceleracionBajada", { ANCHO: 7 });
for (const pendiente of [0.1, 0.2]) {
  const jugadorLibre = new Vehiculo(pistaLisa(pendiente));
  avanzar(jugadorLibre, 60, entrada());
  let vRival = 4;
  for (let i = 0; i < 60 * 120; i++) vRival += aceleracionBajada(vRival, pendiente) / 120;
  assert.ok(Math.abs(jugadorLibre.v - vRival) < 0.05, `misma velocidad final (${jugadorLibre.v.toFixed(2)} vs ${vRival.toFixed(2)})`);
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
  assert.ok(p.casas.flat().some((c) => c.parque), "hay parques de barrio");
  assert.ok(p.casas.flat().some((c) => c.retiro > 0 && !c.muro && c.negocio < 0), "hay casas con jardín");
  assert.ok(p.casas.flat().every((c) => !c.retiro || (c.negocio < 0 && !c.muro)), "tiendas y muros siguen al borde de la vereda");
  assert.ok(p.losas.length > 20, "el terreno se arma en losas");
  for (let k = p.numBloques; k < p.numPiezas; k += 7) {
    const losa = p.datosBloque(k, new Proxy({}, { get: (_, clave) => clave }));
    assert.ok(losa.mallas[0].pos.every(Number.isFinite), "altura del terreno válida");
  }
  // Junto a la calle el terreno queda bajo la calzada (no tapa la pista ni las casas)
  for (let s = 5; s < p.largo - 5; s += 37) {
    for (const d of [-5, 0, 5]) assert.ok(p.alturaTerreno(s, d) < 0, `terreno bajo la calle en s=${s}`);
  }
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
const elementos = new Map();
const $ = (id) => { if (!elementos.has(id)) elementos.set(id, new Elemento()); return elementos.get(id); };
const main = leer("js/main.js");
const bloque = main.slice(main.indexOf("const punterosGiro ="), main.indexOf("// Escena de fondo"));
const eventosGlobales = new Map();
vm.runInNewContext(bloque, { controles, $, estado: "jugando",
  addEventListener(tipo, fn) { if (!eventosGlobales.has(tipo)) eventosGlobales.set(tipo, []); eventosGlobales.get(tipo).push(fn); },
});
$("zona-izq").emitir("pointerdown", 1);
$("b-izq").emitir("pointerdown", 2);
$("zona-der").emitir("pointerdown", 3);
$("zona-freno").emitir("pointerdown", 4);
assert.equal(controles.actualizar(0.1).freno, true, "la franja de abajo frena");
$("zona-freno").emitir("pointerup", 4);
assert.equal(controles.actualizar(0.1).freno, false);
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
assert.equal(controles.actualizar(0.1).giro, 0);
$("zona-izq").emitir("pointerdown", 9);
controles.actualizar(0.2);
assert.ok(controles.giro < 0);
for (const fn of eventosGlobales.get("pointerup")) fn({ pointerId: 9 });
assert.equal(controles.botones.izq, false, "soltar fuera de la zona no deja el giro pegado");
$("zona-izq").emitir("pointerdown", 10);
controles.botones.freno = true;
controles.centrarDireccion();
assert.equal(controles.actualizar(0.1).giro, 0, "centrar elimina pulsaciones pendientes tras un choque");
assert.equal(controles.botones.freno, true, "centrar no suelta el freno");
controles.limpiar();

const modeloSimple = () => ({
  userData: {}, position: { set() {} }, rotation: { x: 0, y: 0, z: 0, set() {} }, visible: true,
});
const modelosSimple = Object.fromEntries(["crearCarro", "crearTorito", "crearPersona", "crearPerro", "crearGato", "crearObra", "crearDesmonte"].map((k) => [k, modeloSimple]));
modelosSimple.animarCaminar = modelosSimple.liberarRecursos = () => {};
const azarFijo = Object.create(Math); azarFijo.random = () => 0.6;
const reservaSimple = { tomar: (_clave, crear) => crear(), devolver() {} };
const Trafico = clase("js/trafico.js", "Trafico", { ANCHO: 7, VEREDA: 1.6, LARGO_TORITO: 2.65, ANCHO_TORITO: 1.3, ROCE_MOTOR: 0.06, aceleracionBajada, modelos: modelosSimple, reserva: reservaSimple, Math: azarFijo });
const circuito = {
  largo: 1000, finTierra: 200, cruces: [300, 500, 700],
  muestra: (_s, out = {}) => Object.assign(out, { g: 0.15, k: 0.06, th: 0 }),
  enTierra: (s) => s < 200, alturaLateral: () => 0,
  aMundo: (s, d, h, out) => out.set(s, h, d),
};
const escenaSimple = { add() {}, remove() {} };
const carreraBots = new Trafico(escenaSimple, circuito, "carrera");
const rivalesDe = (t) => t.agentes.filter((a) => a.rival);
assert.equal(rivalesDe(carreraBots).length, 3);
assert.ok(carreraBots.agentes.every((a) => a.rival || (a.peaton && a.tipo === "persona")), "en Carrera solo cruzan personas");
assert.ok(!carreraBots.agentes.some((a) => a.estatico || a.estacionado), "sin obras, desmonte ni estacionados");
const jugador = { s: 8, d: 1.75, v: 18, h: 0, estado: "ok", invulnerable: true };
let subieron = 0, caminantes = 0;
for (let i = 0; i < 10000; i++) {
  jugador.s = Math.min(940, jugador.s + jugador.v / 60);
  carreraBots.actualizar(1 / 60, jugador);
  subieron = Math.max(subieron, carreraBots.agentes.filter((a) => !a.rival && a.v <= -5).length);
  caminantes = Math.max(caminantes, carreraBots.agentes.filter((a) => a.caminante).length);
  assert.equal(rivalesDe(carreraBots).length, 3, "los rivales no desaparecen de la clasificación");
  assert.ok(rivalesDe(carreraBots).every((a) => Number.isFinite(a.s) && Number.isFinite(a.d) && a.v >= 0 && Math.abs(a.d) <= 1.65));
}
assert.ok(subieron > 0 && caminantes > 0, "en Carrera suben autos y personas");
assert.ok(rivalesDe(carreraBots).every((a) => a.termino && a.tiempoLlegada > 0));
assert.ok(carreraBots.puesto(jugador) >= 1 && carreraBots.puesto(jugador) <= 4);
// Un rival que choca con un auto se queda parado y pierde tiempo
const choqueBots = new Trafico(escenaSimple, { ...circuito, cruces: [] }, "carrera");
const [rival] = rivalesDe(choqueBots);
const auto = choqueBots.agregar("carro", rival.s + 3, rival.d, -6, { sentido: -1 });
const lejos = { s: -500, d: 0, v: 0, h: 0, estado: "ok", invulnerable: true };
choqueBots.tSubida = choqueBots.tLento = 1e9;
choqueBots.actualizar(1 / 60, lejos);
assert.ok(rival.tRetraso > 0 && auto.v === 0, "el rival choca y el auto queda parado");
const sRetraso = rival.s;
for (let i = 0; i < 60; i++) choqueBots.actualizar(1 / 60, lejos);
assert.ok(rival.s - sRetraso < 1, "durante el retraso el rival no avanza");
const traficoOriginal = new Trafico(escenaSimple, circuito);
assert.ok(traficoOriginal.agentes.some((a) => a.tipo === "persona"));
assert.ok(traficoOriginal.agentes.some((a) => a.tipo === "desmonte"));
console.log("OK: tres bots completan la carrera sin frenos; suben autos y personas; los rivales se retrasan al chocar; sin desmontes en Carrera; liberación global y centrado del timón.");
console.log(`OK: Carrera con la física de Sin frenos, freno gastado, modo original, multitouch y ${muestras} muestras de veredas; geometrías de 4 pistas sin valores inválidos.`);
