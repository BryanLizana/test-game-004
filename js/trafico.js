import * as THREE from "three";
import { ANCHO, VEREDA } from "./pista.js?v=1.2.0";
import { LARGO_TORITO, ANCHO_TORITO } from "./vehiculo.js?v=1.2.0";
import * as modelos from "./modelos.js?v=1.2.0";
import { reserva } from "./reciclaje.js?v=1.2.0";
const { crearCarro, crearTorito, crearPersona, crearPerro, animarCaminar } = modelos;

// Lo que grita el chofer cuando alguien se le cruza
const GRITOS = {
  senora: ["¡Quita señora!"],
  viejo: ["¡Quita viejo!"],
  joven: ["¡Cuidao!"],
  perro: ["¡Quita perro!"],
  gato: ["¡Michi quita!"],
};
const elegir = (lista) => lista[(Math.random() * lista.length) | 0];

// Mototaxis de la zona: azul, verde o amarillo, solos o combinados con blanco [carrocería, techo]
const BLANCO = 0xf2f2ee;
const COLORES_TORITO = [
  [0x1f4fbf, 0x1f4fbf], [0x2f6fd6, BLANCO], [BLANCO, 0x1f4fbf], [0x16388f, BLANCO],
  [0x1f8a3c, 0x1f8a3c], [0x34a853, BLANCO], [BLANCO, 0x1f8a3c], [0x146b2e, BLANCO],
  [0xf2c200, 0xf2c200], [0xffd84d, BLANCO], [BLANCO, 0xe0b000], [0xe0a800, BLANCO],
];
const MEDIDAS = {
  carro: { largo: 4.2, ancho: 1.7 },
  combi: { largo: 5.0, ancho: 1.9 },
  bus: { largo: 7.0, ancho: 2.22 },
  torito: { largo: LARGO_TORITO, ancho: ANCHO_TORITO },
  persona: { largo: 0.5, ancho: 0.5 },
  perro: { largo: 0.7, ancho: 0.35 },
  gato: { largo: 0.45, ancho: 0.25 },
  obra: { largo: 3, ancho: 2 },
  desmonte: { largo: 2.5, ancho: 2 },
};

// Respaldo si modelos.js todavía no tiene los obstáculos estáticos
function cajaRespaldo(color, largo, ancho, alto) {
  const g = new THREE.Group();
  const m = new THREE.Mesh(new THREE.BoxGeometry(ancho, alto, largo), new THREE.MeshStandardMaterial({ color, roughness: 1 }));
  m.position.y = alto / 2; m.castShadow = true;
  g.add(m);
  g.userData = { largo, ancho };
  return g;
}

export class Trafico {
  constructor(escena, pista, modo = "sinFrenos") {
    this.escena = escena;
    this.pista = pista;
    this.modo = modo;
    this.agentes = [];
    this.tSubida = 2;
    this.tLento = 8;
    this.tiempo = 0;
    this.gritos = [];
    this.muestra = {};
    this.sembrar();
  }

  crearModelo(tipo, extra = {}) {
    switch (tipo) {
      case "gato": {
        if (modelos.crearGato) return modelos.crearGato();
        const g = crearPerro(); g.scale.setScalar(0.65); return g;
      }
      case "carro": return crearCarro();
      case "combi": return crearCarro({ tipo: "combi" });
      case "bus": return crearCarro({ tipo: "bus" });
      case "torito": {
        const [color, techo] = COLORES_TORITO[extra.colorTorito ?? 0];
        return crearTorito({ color, techo, detalle: "bajo" });
      }
      case "persona": return crearPersona({ tipo: extra.tipoPersona });
      case "perro": return crearPerro();
      case "obra": return modelos.crearObra ? modelos.crearObra({ variante: extra.varianteObra ?? 0 }) : cajaRespaldo(0xb5653d, 3, 2, 1.2);
      case "desmonte": return modelos.crearDesmonte ? modelos.crearDesmonte({ tamano: 0.8 + Math.random() * 0.5 }) : cajaRespaldo(0x8b7d6b, 2.5, 2, 0.9);
    }
  }

  // Clave de reciclaje: mismo tipo y variante se pueden reusar tal cual
  claveModelo(tipo, extra) {
    if (tipo === "torito") {
      extra.colorTorito ??= (Math.random() * COLORES_TORITO.length) | 0;
      return `torito|${extra.colorTorito}`;
    }
    if (tipo === "persona") {
      extra.tipoPersona ??= elegir(["senora", "senora", "viejo", "joven"]);
      return `persona|${extra.tipoPersona}`;
    }
    if (tipo === "obra") {
      extra.varianteObra ??= (Math.random() * 3) | 0;
      return `obra|${extra.varianteObra}`;
    }
    return tipo;
  }

  agregar(tipo, s, d, v, extra = {}) {
    const modelo = reserva.tomar(this.claveModelo(tipo, extra), () => this.crearModelo(tipo, extra));
    // Un modelo reciclado llega con la pose del anterior: se deja derecho y quieto
    modelo.rotation.set(0, 0, 0);
    if (modelo.userData.piernas || modelo.userData.patas) animarCaminar(modelo, 0);
    this.escena.add(modelo);
    const medidas = { ...MEDIDAS[tipo] };
    if (modelo.userData.largo) { medidas.largo = modelo.userData.largo; medidas.ancho = modelo.userData.ancho; }
    const a = { tipo, s, d, v, vd: 0, modelo, ...medidas, chocado: false, ...extra };
    this.agentes.push(a);
    this.colocar(a);
    return a;
  }

  // Autos estacionados y peatones esperando en los cruces
  sembrar() {
    const p = this.pista;
    if (this.modo === "carrera") {
      for (let i = 0; i < 3; i++) {
        this.agregar("torito", i === 0 ? 8 : 14, i === 1 ? 1.65 : -1.65, 0, {
          rival: true, nombre: `Rival ${i + 1}`, carril: i === 1 ? 1.65 : -1.65,
          ritmo: 18.5 + i * 0.9, termino: false, tiempoLlegada: null, tImpacto: 0,
        });
      }
      return;
    }
    for (let s = p.finTierra + 30; s < p.largo - 120; s += 70 + Math.random() * 110) {
      const m = p.muestra(s);
      if (Math.abs(m.k) > 0.02) continue;
      const lado = Math.random() < 0.5 ? -1 : 1;
      this.agregar(Math.random() < 0.8 ? "carro" : "torito", s, lado * (ANCHO / 2 - 1.0), 0, { estacionado: true, sentido: lado });
    }
    // Obras inconclusas y desmonte botado en la calle (ocupan un costado)
    for (let s = 70; s < p.largo - 100; s += 60 + Math.random() * 90) {
      const tipo = p.enTierra(s) || Math.random() < 0.45 ? "desmonte" : "obra";
      const lado = Math.random() < 0.5 ? -1 : 1;
      const a = this.agregar(tipo, s, 0, 0, { estatico: true, sentido: 1 });
      a.d = lado * (ANCHO / 2 - a.ancho / 2 + (tipo === "obra" ? 0.6 : 0.2));
      a.giroExtra = (Math.random() - 0.5) * 0.4;
      this.colocar(a);
    }
    // En el cerro hay más perros y gatos sueltos
    const cruces = [...p.cruces];
    for (let s = 40; s < p.finTierra - 20; s += 35 + Math.random() * 40) cruces.push(s);
    for (const s of cruces) {
      const r = Math.random(), tierra = p.enTierra(s);
      const tipo = r < (tierra ? 0.3 : 0.18) ? "perro" : r < (tierra ? 0.5 : 0.28) ? "gato" : "persona";
      const tipoPersona = tipo === "persona" ? elegir(["senora", "senora", "viejo", "joven"]) : undefined;
      const lado = Math.random() < 0.5 ? -1 : 1;
      const dVereda = tierra ? ANCHO / 2 + 1.2 : ANCHO / 2 + 0.8;
      this.agregar(tipo, s, lado * dVereda, 0, {
        peaton: true, lado, esperando: true, tipoPersona,
        disparo: 25 + Math.random() * 35,
        velCruce: tipo === "persona" ? 1.1 + Math.random() * 0.7 : 2.4 + Math.random() * 1.2,
      });
    }
  }

  colocar(a) {
    if ((a.estatico || a.estacionado) && a.colocado) return;
    a.colocado = (a.estatico || a.estacionado) && a.d !== 0;
    const m = this.pista.muestra(a.s, this.muestra);
    const h = this.pista.alturaLateral(a.d, a.s);
    this.pista.aMundo(a.s, a.d, h, a.modelo.position, m);
    let rumbo = m.th;
    if (a.peaton) rumbo += a.vd !== 0 ? Math.sign(a.vd) * Math.PI / 2 : (a.lado > 0 ? -Math.PI / 2 : Math.PI / 2);
    else if (a.v < 0 || a.sentido < 0) rumbo += Math.PI;
    a.modelo.rotation.set(0, -rumbo + (a.giroExtra || 0), 0, "YXZ");
    if (!a.peaton) a.modelo.rotation.x = -Math.atan(m.g) * (a.v < 0 || a.sentido < 0 ? -1 : 1);
  }

  // Devuelve todos los modelos a la reserva (al reiniciar o al cambiar de partida)
  liberarTodo() {
    for (const a of this.agentes) reserva.devolver(a.modelo, modelos.liberarRecursos);
    this.agentes = [];
  }

  reiniciar() {
    this.liberarTodo();
    this.tSubida = 2; this.tLento = 8;
    this.tiempo = 0; this.gritos.length = 0;
    this.sembrar();
  }

  claxon(veh) {
    // Los peatones que están cruzando delante corren a la vereda más cercana
    for (const a of this.agentes) {
      if (!a.peaton || a.vd === 0 || a.asustado) continue;
      const delante = a.s - veh.s;
      if (delante > 0 && delante < 35) {
        a.asustado = true;
        const dir = Math.abs(a.d) > 0.3 ? Math.sign(a.d) : Math.sign(a.vd);
        a.vd = dir * a.velCruce * 1.8;
      }
    }
  }

  actualizar(dt, veh) {
    if (this.modo === "carrera") return this.actualizarCarrera(dt, veh);
    this.tiempo += dt;
    const p = this.pista;

    // Vehículos que suben por el carril contrario
    this.tSubida -= dt;
    if (this.tSubida <= 0) {
      this.tSubida = 4 + Math.random() * 7;
      const s = veh.s + 180 + Math.random() * 60;
      if (s < p.largo - 80) {
        const r = Math.random();
        const tipo = p.enTierra(s) ? "torito" : r < 0.4 ? "carro" : r < 0.65 ? "torito" : r < 0.9 ? "combi" : "bus";
        this.agregar(tipo, s, -ANCHO / 4, -(5 + Math.random() * 5));
      }
    }
    // Choferes prudentes que bajan despacio por tu carril (hay que pasarlos)
    this.tLento -= dt;
    if (this.tLento <= 0) {
      this.tLento = 14 + Math.random() * 14;
      const s = veh.s + 140;
      if (s < p.largo - 120) {
        const r = Math.random();
        const tipo = p.enTierra(s) ? "torito" : r < 0.45 ? "torito" : r < 0.85 ? "combi" : "bus";
        this.agregar(tipo, s, ANCHO / 4, 3 + Math.random() * 3);
      }
    }

    let choque = null;
    for (const a of this.agentes) {
      if (a.peaton) {
        if (a.esperando && a.s - veh.s < a.disparo && a.s > veh.s) {
          a.esperando = false;
          a.vd = -a.lado * a.velCruce;
          const clave = a.tipo === "persona" ? (a.modelo.userData.tipo || a.tipoPersona || "joven") : a.tipo;
          this.gritos.push(elegir(GRITOS[clave] || GRITOS.joven));
        }
        a.d += a.vd * dt;
        if (a.vd * a.d > 0 && Math.abs(a.d) > ANCHO / 2 + VEREDA * 0.6) { a.vd = 0; a.d = Math.sign(a.d) * (ANCHO / 2 + VEREDA * 0.6); a.lado = Math.sign(a.d); }
        if (a.vd !== 0 && !a.chocado) animarCaminar(a.modelo, this.tiempo * (a.tipo === "persona" ? 1.3 : 2));
      } else if (!a.chocado) {
        a.s += a.v * dt;
        // Los que bajan despacio frenan si tienen a alguien delante
        const giroRueda = (a.v * dt) / 0.3;
        for (const r of a.modelo.userData.ruedas || []) r.rotation.x -= giroRueda;
        if (a.modelo.userData.ruedaDelantera) a.modelo.userData.ruedaDelantera.rotation.x -= giroRueda;
        for (const r of a.modelo.userData.ruedasTraseras || []) r.rotation.x -= giroRueda;
      }
      this.colocar(a);

      // Colisión con el jugador (cajas en s/d)
      if (!choque && !a.chocado && veh.estado === "ok" && veh.h < 0.8 && !veh.invulnerable) {
        const ds = Math.abs(a.s - veh.s), dd = Math.abs(a.d - veh.d);
        if (ds < (a.largo + LARGO_TORITO) * 0.45 && dd < (a.ancho + ANCHO_TORITO) * 0.45) {
          a.chocado = true;
          choque = { agente: a, vRel: Math.abs(veh.v - a.v) };
        }
      }
    }

    // Retirar lo que quedó muy atrás
    let restantes = 0;
    for (const a of this.agentes) {
      const fuera = a.s < veh.s - 60 || a.s > p.largo;
      if (fuera) reserva.devolver(a.modelo, modelos.liberarRecursos);
      else this.agentes[restantes++] = a;
    }
    this.agentes.length = restantes;
    return choque;
  }

  puesto(veh) {
    return 1 + this.agentes.reduce((n, a) => n + (a.rival && (a.termino || a.s > veh.s) ? 1 : 0), 0);
  }

  actualizarCarrera(dt, veh) {
    this.tiempo += dt;
    const meta = this.pista.largo - 60;
    let choque = null;
    for (const a of this.agentes) {
      a.tImpacto = Math.max(0, a.tImpacto - dt);
      if (!a.termino) {
        const m = this.pista.muestra(Math.min(meta, a.s + 8), this.muestra);
        let objetivo = Math.min(a.ritmo + m.g * 8, Math.sqrt(35 / Math.max(0.015, Math.abs(m.k))));
        // Adelantamiento entre dos carriles: a lo sumo 3 rivales, sin búsquedas costosas.
        let delante = null;
        for (const otro of this.agentes) {
          if (otro === a || otro.termino || otro.s <= a.s || otro.s - a.s > 12 || Math.abs(otro.d - a.d) > 1.5) continue;
          if (!delante || otro.s < delante.s) delante = otro;
        }
        if (veh.estado === "ok" && veh.s > a.s && veh.s - a.s < 12 && Math.abs(veh.d - a.d) < 1.5
          && (!delante || veh.s < delante.s)) delante = veh;
        if (delante) {
          const alterno = a.d >= 0 ? -1.65 : 1.65;
          const ocupado = (Math.abs(veh.s - a.s) < 8 && Math.abs(veh.d - alterno) < 1.5)
            || this.agentes.some((otro) => otro !== a && !otro.termino && Math.abs(otro.s - a.s) < 8 && Math.abs(otro.d - alterno) < 1.5);
          if (!ocupado) a.carril = alterno;
          else objetivo = Math.min(objetivo, Math.max(0, delante.v - (delante.s - a.s < 5 ? 2 : 0)));
        }
        a.v += Math.max(-7 * dt, Math.min(5.6 * dt, objetivo - a.v));
        const dAnterior = a.d;
        a.d += Math.max(-1.4 * dt, Math.min(1.4 * dt, a.carril - a.d));
        a.s = Math.min(meta, a.s + a.v * dt);
        this.colocar(a);
        a.modelo.rotation.y -= Math.atan2((a.d - dAnterior) / Math.max(dt, 0.001), Math.max(1, a.v));
        a.modelo.rotation.z = Math.max(-0.18, Math.min(0.18, m.k * a.v * a.v * 0.008));
        for (const r of a.modelo.userData.ruedas || []) r.rotation.x -= a.v * dt / 0.3;
        if (a.modelo.userData.ruedaDelantera) a.modelo.userData.ruedaDelantera.rotation.x -= a.v * dt / 0.2;
        for (const r of a.modelo.userData.ruedasTraseras || []) r.rotation.x -= a.v * dt / 0.2;
        if (a.s >= meta) { a.termino = true; a.tiempoLlegada = this.tiempo; a.v = 0; a.modelo.visible = false; }
      }
      // Choque físico con el jugador: se separan por el eje que menos se encaja y se reparten el golpe.
      const encajeS = (a.largo + LARGO_TORITO) * 0.45 - Math.abs(veh.s - a.s);
      const encajeD = (a.ancho + ANCHO_TORITO) * 0.45 - Math.abs(veh.d - a.d);
      if (!a.termino && !veh.invulnerable && veh.estado === "ok" && veh.h < 0.8 && encajeS > 0 && encajeD > 0) {
        let vRel;
        if (encajeD < encajeS) {
          // De costado: cada uno sale empujado hacia su lado y el jugador rebota un poco
          const lado = Math.sign(veh.d - a.d) || 1;
          veh.d += lado * encajeD * 0.6;
          a.d = Math.max(-2.4, Math.min(2.4, a.d - lado * encajeD * 0.4));
          vRel = Math.abs(veh.v * Math.sin(veh.psi)) + Math.abs(veh.v - a.v) * 0.3;
          veh.psi = lado * Math.min(0.25, Math.abs(veh.psi) * 0.5 + 0.06);
          veh.v *= 0.97; a.v *= 0.97;
        } else {
          // Por detrás: el de atrás frena y empuja al de adelante (choque poco elástico)
          const lado = Math.sign(veh.s - a.s) || 1;
          veh.s += lado * encajeS * 0.5;
          a.s = Math.min(meta, a.s - lado * encajeS * 0.5);
          const dv = veh.v - a.v;
          vRel = Math.abs(dv);
          if (dv * lado < 0) {
            const media = (veh.v + a.v) / 2;
            veh.v = Math.max(0, media - dv * 0.15);
            a.v = Math.max(0, media + dv * 0.15);
          }
        }
        if (!choque && a.tImpacto === 0) {
          a.tImpacto = 0.4;
          choque = { agente: a, vRel };
        }
      }
      // Permanecen en la clasificación aunque salgan del alcance visible.
      if (!a.termino) a.modelo.visible = Math.abs(a.s - veh.s) < 340;
    }
    return choque;
  }
}
