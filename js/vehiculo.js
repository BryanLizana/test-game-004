import { ANCHO } from "./pista.js?v=1.7.1";

// Física simplificada de un torito en coordenadas de Frenet (s, d, psi).
// Sin frenos: solo queda un freno gastado que baja la velocidad pero nunca detiene la moto.
const G = 9.81;
const DIST_EJES = 1.95;
const MEDIO_ANCHO = 0.65;
const RUEDAS = [[1.1, 0], [-0.85, -0.53], [-0.85, 0.53]];
export const LARGO_TORITO = 2.65;
export const ANCHO_TORITO = 1.3;
const ACEL_VUELCO = 5.4;          // m/s² laterales a los que se levanta una rueda
const ACEL_MAX_GIRO = 7.5;        // giro máximo del manubrio expresado en aceleración lateral
const PSI_MAX = 0.9;              // en una calle angosta no se puede dar media vuelta
const FRENO = 1.5;                 // m/s² mientras dura (suave: solo ayuda)
const VEL_MIN_FRENO = 4.5;         // por debajo de esto el freno ya no agarra (no se detiene)
const DESGASTE_FRENO = 4;          // % por segundo de uso
const ENFRIA_FRENO = 1.2;          // % por segundo que recupera cuando no se usa
export const FRENO_TANQUE = 5;     // s de freno disponibles
const FRENO_RECARGA = 1 / 3.375;   // s de tanque que recupera por segundo sin frenar
export const FRENO_ESPERA = 5;     // s bloqueado si se vacía
const RODAR_ROCE = 0.7;            // m/s² al rodar sin motor tras la meta
const RODAR_AIRE = 0.09;           // y lo que suma por cada m/s
export const ROCE_MOTOR = 0.06;    // el motor engranado frena un poco (proporcional a v)

// Aceleración a lo largo de la calle sin freno: pendiente, rodadura, aire y motor engranado.
// La comparten el jugador y los rivales de Carrera para que bajen igual de rápido.
export function aceleracionBajada(v, g, roce = ROCE_MOTOR, cosPsi = 1) {
  return G * Math.sin(Math.atan(g)) * cosPsi - 0.018 * G - 0.0016 * v * v - roce * v + (v < 2 ? 0.8 : 0);
}

// Carrera y Sin frenos comparten la misma física: solo cambia lo que hay en la calle.
export class Vehiculo {
  constructor(pista) {
    this.pista = pista;
    this.muestra = {};
    this.reiniciar();
  }

  reiniciar() {
    this.s = 8;
    this.d = (this.pista.ancho ?? ANCHO) / 4;     // en Perú se maneja por la derecha
    this.psi = 0;           // rumbo relativo a la calle
    this.v = 4;
    this.giro = 0;          // ángulo del manubrio (rad)
    this.rpm = 1500;
    this.h = 0; this.vy = 0; // altura sobre la pista (saltos)
    this.inclinacion = 0;   // vuelco acumulado 0..1
    this.ladoVuelco = 0;
    this.acelLat = 0;
    this.balanceo = 0;      // rad visuales de la carrocería
    this.dano = 0;          // carrocería %
    this.freno = 100;       // vida del freno %
    this.frenoPulso = false; // freno por tanque de segundos, ver frenaEsteTurno
    this.tFrenoTanque = FRENO_TANQUE;
    this.tFrenoEspera = 0;
    this.frenoSoltar = false;
    this.frenando = false;  // el freno está actuando en este paso (suena)
    this.estado = "ok";
    this.motivo = "";
    this.tiempo = 0;        // reloj de la física (s), comparable con el de Trafico
    this.tiempoLlegada = null;
    this.raspando = false;
    this.derrapando = false;
    this.sacudida = 0;
    this.sigRompemuelle = 0;
    this.sigBache = 0;
    this.suelo = 0;
  }

  get kmh() { return this.v * 3.6; }

  // El freno es un tanque de segundos. Se gasta mientras se aprieta y se recarga más lento al soltar.
  // Si se vacía, queda bloqueado (recargando al mismo ritmo) y hay que soltar y volver a pulsar al terminar.
  frenaEsteTurno(dt, pulsado) {
    if (!this.frenoPulso) return pulsado;
    if (this.tFrenoEspera > 0) {
      const espera = Math.min(dt, this.tFrenoEspera);
      this.tFrenoEspera -= espera;
      this.tFrenoTanque = Math.min(FRENO_TANQUE, this.tFrenoTanque + FRENO_RECARGA * espera);
      if (!pulsado) this.frenoSoltar = false;
      return false;
    }
    if (!pulsado) {
      this.frenoSoltar = false;
      this.tFrenoTanque = Math.min(FRENO_TANQUE, this.tFrenoTanque + FRENO_RECARGA * dt);
      return false;
    }
    if (this.frenoSoltar) return false;
    if (this.v > VEL_MIN_FRENO) this.tFrenoTanque -= dt;   // sin velocidad el freno no agarra: no gasta
    if (this.tFrenoTanque <= 0) {
      this.tFrenoTanque = 0;
      this.tFrenoEspera = FRENO_ESPERA;
      this.frenoSoltar = true;
      return false;
    }
    return true;
  }

  paso(dt, entrada, eventos) {
    this.tiempo += dt;
    const frena = this.frenaEsteTurno(dt, entrada.freno);
    this.frenando = false;
    if (this.estado === "llegada") return this.rodarHastaParar(dt);
    if (this.estado !== "ok") { this.v *= Math.max(0, 1 - dt * 2); return; }
    const p = this.pista;
    const sAntes = this.s;
    const m = p.muestra(this.s, this.muestra);

    // --- Dirección (límite dependiente de la velocidad, como un manubrio real) ---
    const giroMax = Math.min(0.5, Math.atan(ACEL_MAX_GIRO * DIST_EJES / Math.max(this.v * this.v, 1)));
    const objetivo = entrada.giro * giroMax;
    this.giro += Math.max(-dt * 2.2, Math.min(dt * 2.2, objetivo - this.giro));

    // --- Longitudinal ---
    let a = aceleracionBajada(this.v, m.gFis ?? m.g, ROCE_MOTOR, Math.cos(this.psi));
    if (frena && this.freno > 0 && this.h <= 0 && this.v > VEL_MIN_FRENO) {
      a -= FRENO * Math.min(1, (this.v - VEL_MIN_FRENO) / 2);
      this.frenando = true;
      if (!this.frenoPulso) this.freno = Math.max(0, this.freno - DESGASTE_FRENO * dt);
      if (this.freno === 0) eventos.push({ tipo: "aviso", texto: "¡Se acabó el freno!" });
    } else if (!frena) {
      this.freno = Math.min(100, this.freno + ENFRIA_FRENO * dt);
    }
    // Revoluciones solo para el sonido: caja automática imaginaria de 4 cambios
    const cambio = Math.min(3, Math.floor(this.kmh / 22));
    this.rpm = 1800 + Math.min(1, (this.kmh - cambio * 22) / 22) * 4800 + cambio * 300;
    this.v = Math.max(0, this.v + a * dt);

    // --- Lateral: modelo bicicleta + límite de vuelco ---
    const ds = (this.v * Math.cos(this.psi)) / Math.max(0.2, 1 - this.d * m.k);
    let guiñada = this.h > 0 ? 0 : (this.v * Math.tan(this.giro)) / DIST_EJES;
    this.acelLat = this.v * guiñada;
    const agarre = (p.enTierra(this.s) ? 0.62 : 0.85) * G;   // en la tierra patina más
    this.derrapando = Math.abs(this.acelLat) > agarre;
    if (this.derrapando) {
      guiñada = Math.sign(guiñada) * agarre / Math.max(this.v, 0.1);
      this.acelLat = Math.sign(this.acelLat) * agarre;
    }
    const exceso = Math.abs(this.acelLat) - ACEL_VUELCO;
    if (exceso > 0) {
      this.ladoVuelco = Math.sign(this.acelLat);
      this.inclinacion += exceso * 0.32 * dt;
    } else {
      this.inclinacion = Math.max(0, this.inclinacion - 1.4 * dt);
    }
    if (this.inclinacion >= 1) return this.chocar("¡Te volcaste en la curva!", eventos);

    this.s += ds * dt;
    this.d += this.v * Math.sin(this.psi) * dt;
    this.psi += (guiñada - m.k * ds) * dt;
    if (Math.abs(this.psi) > PSI_MAX) this.psi = Math.sign(this.psi) * PSI_MAX;

    // --- Vertical: sardinel, rompemuelles, saltos ---
    // Suelo bajo el torito: al bajar un escalón queda en el aire, al subir un sardinel rebota
    const suelo = p.alturaLateral(this.d, this.s);
    if (suelo < this.suelo - 0.02) this.h += this.suelo - suelo;
    else if (suelo > this.suelo + 0.05 && this.h < suelo - this.suelo) {
      this.h = 0;
      this.vy = Math.max(this.vy, 0.8 + this.v * 0.04);
      this.v *= 0.97;
      this.sacudida = Math.max(this.sacudida, 0.54);
      eventos.push({ tipo: "golpe", fuerza: 0.3 });
    }
    this.suelo = suelo;

    // Baches: se revisa cada rueda (delantera al centro, traseras a los lados)
    while (this.sigBache < p.baches.length && p.baches[this.sigBache].s < this.s - 3) this.sigBache++;
    for (let j = this.sigBache; j < p.baches.length && p.baches[j].s < this.s + 3; j++) {
      const b = p.baches[j];
      for (const [os, od] of RUEDAS) {
        const sr = this.s + os;
        if (sr >= b.s && sr - ds * dt < b.s && Math.abs(this.d + od - b.d) < b.r && this.h <= 0.02) {
          this.vy = Math.max(this.vy, 0.35 + this.v * 0.05);
          this.sacudida = Math.max(this.sacudida, 0.63);
          if (this.v > 13) this.dano += (this.v - 13) * 0.6;
          eventos.push({ tipo: "golpe", fuerza: Math.min(0.7, this.v / 25) });
        }
      }
    }
    while (this.sigRompemuelle < p.rompemuelles.length && p.rompemuelles[this.sigRompemuelle] < this.s - 1) this.sigRompemuelle++;
    const rm = p.rompemuelles[this.sigRompemuelle];
    if (rm !== undefined && this.s >= rm && this.s - ds * dt < rm && this.h <= 0.05) {
      this.vy = 0.5 + this.v * 0.18;
      this.sacudida = 0.9;
      eventos.push({ tipo: "golpe", fuerza: Math.min(1, this.v / 15) });
      if (this.v > 12) this.dano += (this.v - 12) * 2;
    }
    if (this.h > 0 || this.vy > 0) {
      this.vy -= G * dt;
      this.h += this.vy * dt;
      if (this.h <= 0) {
        if (this.vy < -3.5) {
          this.dano += (-this.vy - 3.5) * 8;
          eventos.push({ tipo: "golpe", fuerza: Math.min(1, -this.vy / 8) });
          this.sacudida = 0.9;
        }
        this.h = 0; this.vy = 0;
      }
    }

    // --- Paredes de las casas ---
    const ladoD = Math.sign(this.d) || 1;
    const limite = p.limiteLateral(this.s, ladoD) - MEDIO_ANCHO;
    this.raspando = false;
    if (Math.abs(this.d) > limite && p.esBarranco(this.s, ladoD)) return this.chocar("¡Te fuiste al barranco!", eventos);
    if (Math.abs(this.d) > limite) {
      const lado = ladoD;
      const vNormal = this.v * Math.sin(this.psi) * lado;   // velocidad hacia la pared
      this.d = lado * limite;
      if (vNormal > 0.5) {
        if (vNormal > 7.5) {
          const motivo = p.enTierra(this.s) ? "¡Te saliste de la trocha!"
            : lado > 0 && p.enMirador(this.s)
              ? { concreto: "¡Te chocaste contra la baranda!", malecon: "¡Te chocaste contra la baranda!", guardavia: "¡Te chocaste con el guardavía!", valla: "¡Rompiste la valla!" }[p.mirador(this.s).tipo]
              : "¡Te estrellaste contra una casa!";
          return this.chocar(motivo, eventos);
        }
        this.dano += vNormal * 9;
        this.v *= 1 - Math.min(0.6, vNormal / 12);
        this.psi *= -0.25;
        this.sacudida = 0.9;
        eventos.push({ tipo: "golpe", fuerza: Math.min(1, vNormal / 7) });
      } else {
        this.psi = lado > 0 ? Math.min(this.psi, 0) : Math.max(this.psi, 0);
      }
      this.raspando = this.v > 1;
      this.dano += this.v * 0.5 * dt;
    }

    if (this.dano >= 100) return this.chocar("El torito quedó hecho chatarra", eventos);
    const meta = p.meta;
    if (this.s >= meta) {
      // Instante exacto del cruce dentro del paso: decide el puesto contra los rivales
      this.tiempoLlegada = this.tiempo - dt * (this.s - meta) / Math.max(this.s - sAntes, 1e-6);
      this.estado = "llegada";
      eventos.push({ tipo: "llegada" });
    }

    // Balanceo visual: inclinación por fuerza centrífuga + rueda levantada
    const objetivoBalanceo = this.acelLat * 0.012 + this.ladoVuelco * this.inclinacion * 0.5;
    this.balanceo += (objetivoBalanceo - this.balanceo) * Math.min(1, dt * 8);
    this.sacudida = Math.max(0, this.sacudida - dt * 2.5);
  }

  // Pasada la meta el torito sigue solo por el plano, centrándose en su carril hasta quedar parado
  rodarHastaParar(dt) {
    const p = this.pista, m = p.muestra(this.s, this.muestra);
    this.v = Math.max(0, this.v - (RODAR_ROCE + RODAR_AIRE * this.v) * p.roceRodar(this.s) * dt);
    const suave = Math.min(1, dt * 1.5);
    this.giro -= this.giro * suave;
    this.psi -= this.psi * suave;
    const calzada = p.ancho / 2 - 0.9;   // vuelve a la pista si venía por la vereda
    this.d += (Math.max(-calzada, Math.min(calzada, this.d)) - this.d) * suave;
    this.s = Math.min(p.largo - 5, this.s + (this.v * Math.cos(this.psi)) / Math.max(0.2, 1 - this.d * m.k) * dt);
    this.rpm = 900 + this.v * 120;
    this.acelLat = 0;
    this.derrapando = this.raspando = false;
    this.inclinacion = Math.max(0, this.inclinacion - 1.4 * dt);
    this.suelo += (p.alturaLateral(this.d, this.s) - this.suelo) * Math.min(1, dt * 6);
    if (this.h > 0 || this.vy > 0) {
      this.vy -= G * dt;
      this.h += this.vy * dt;
      if (this.h <= 0) this.h = this.vy = 0;
    }
    this.balanceo -= this.balanceo * Math.min(1, dt * 8);
    this.sacudida = Math.max(0, this.sacudida - dt * 2.5);
  }

  chocar(motivo, eventos) {
    this.estado = "choque";
    this.motivo = motivo;
    this.sacudida = 1.35;
    eventos.push({ tipo: "choque", motivo, fuerza: 1 });
  }

  // Altura del suelo bajo el torito (vereda incluida)
  get alturaSuelo() { return this.suelo + this.h; }
}

