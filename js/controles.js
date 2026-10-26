// Entrada: giroscopio (celular como timón), teclado y botones táctiles.
const GRADOS_GIRO_TOTAL = 28;
const ZONA_MUERTA = 1.5;

const esIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
  (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

function leerAlmacen(k) { try { return localStorage.getItem(k); } catch (_) { return null; } }
function guardarAlmacen(k, v) { try { localStorage.setItem(k, v); } catch (_) { /* sin almacenamiento */ } }

export class Controles {
  constructor() {
    this.giro = 0;
    this.freno = false;
    this.teclas = new Set();
    this.botones = { izq: false, der: false, freno: false };
    this.sensor = { activo: false, crudo: 0, base: null, filtrado: 0 };
    this.invertir = leerAlmacen("invertirGiro") === "1";
    this.alCamara = () => {};
    this.alClaxon = () => {};
    this.alPausa = () => {};

    addEventListener("keydown", (e) => {
      if (e.repeat) return;
      const k = e.key.toLowerCase();
      this.teclas.add(k);
      if (k === "c") this.alCamara();
      if (k === "h") this.alClaxon(true);
      if (k === "p" || k === "escape") this.alPausa();
      if (k === " ") e.preventDefault();
    });
    addEventListener("keyup", (e) => {
      const k = e.key.toLowerCase();
      this.teclas.delete(k);
      if (k === "h") this.alClaxon(false);
    });
    addEventListener("blur", () => this.teclas.clear());
  }

  // Conecta un botón táctil que se mantiene presionado
  botonMantener(el, alPresionar, alSoltar) {
    const on = (e) => { e.preventDefault(); el.classList.add("activo"); alPresionar(); };
    const off = (e) => { e.preventDefault(); el.classList.remove("activo"); alSoltar && alSoltar(); };
    el.addEventListener("pointerdown", on);
    el.addEventListener("pointerup", off);
    el.addEventListener("pointercancel", off);
    el.addEventListener("pointerleave", off);
  }

  async activarSensores() {
    if (typeof DeviceMotionEvent === "undefined") return false;
    try {
      if (typeof DeviceMotionEvent.requestPermission === "function") {
        if ((await DeviceMotionEvent.requestPermission()) !== "granted") return false;
      }
    } catch (_) { return false; }
    addEventListener("devicemotion", (e) => this.alMovimiento(e));
    return true;
  }

  // Gravedad proyectada en el eje horizontal de la pantalla: funciona con el
  // celular parado (como timón) o echado (inclinando un costado).
  alMovimiento(e) {
    const g = e.accelerationIncludingGravity;
    if (!g || g.x == null) return;
    const ang = ((screen.orientation && screen.orientation.angle) ?? window.orientation ?? 0) * Math.PI / 180;
    const gx = g.x * Math.cos(ang) - g.y * Math.sin(ang);
    let grados = Math.asin(Math.max(-1, Math.min(1, gx / 9.81))) * 180 / Math.PI;
    if (!esIOS) grados = -grados;
    this.sensor.crudo = grados;
    if (this.sensor.base === null) this.sensor.base = grados;
    this.sensor.activo = true;
  }

  calibrar() { this.sensor.base = this.sensor.activo ? this.sensor.crudo : null; }

  alternarInvertir() {
    this.invertir = !this.invertir;
    guardarAlmacen("invertirGiro", this.invertir ? "1" : "0");
    return this.invertir;
  }

  get usandoSensor() { return this.sensor.activo; }

  actualizar(dt) {
    const t = this.teclas;
    const izq = t.has("arrowleft") || t.has("a") || this.botones.izq;
    const der = t.has("arrowright") || t.has("d") || this.botones.der;
    this.freno = t.has("s") || t.has("arrowdown") || t.has(" ") || this.botones.freno;

    if (izq || der) {
      // Teclado: el manubrio gira progresivamente y vuelve solo al centro
      const objetivo = (der ? 1 : 0) - (izq ? 1 : 0);
      const vel = Math.sign(objetivo) !== Math.sign(this.giro) && this.giro !== 0 ? 5 : 2.2;
      this.giro += Math.max(-vel * dt, Math.min(vel * dt, objetivo - this.giro));
    } else if (this.sensor.activo) {
      let grados = this.sensor.crudo - this.sensor.base;
      if (this.invertir) grados = -grados;
      const signo = Math.sign(grados);
      grados = Math.max(0, Math.abs(grados) - ZONA_MUERTA) * signo;
      const objetivo = Math.max(-1, Math.min(1, grados / GRADOS_GIRO_TOTAL));
      this.sensor.filtrado += (objetivo - this.sensor.filtrado) * Math.min(1, dt * 12);
      this.giro = this.sensor.filtrado;
    } else {
      this.giro -= Math.sign(this.giro) * Math.min(Math.abs(this.giro), 3 * dt);
    }
    return { giro: this.giro, freno: this.freno };
  }
}
