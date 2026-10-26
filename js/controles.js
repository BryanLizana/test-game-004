// Entrada: teclado y zonas/botones táctiles.

export class Controles {
  constructor() {
    this.giro = 0;
    this.freno = false;
    this.teclas = new Set();
    this.botones = { izq: false, der: false, freno: false };
    this.soltadores = [];
    this.soltadoresDireccion = [];
    this.entrada = { giro: 0, freno: false };
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
    addEventListener("blur", () => this.limpiar());
    document.addEventListener("visibilitychange", () => { if (document.hidden) this.limpiar(); });
  }

  // Conecta un botón táctil que se mantiene presionado
  botonMantener(el, alPresionar, alSoltar) {
    let puntero = null;
    const soltar = () => {
      if (puntero === null) return;
      const id = puntero;
      puntero = null;
      el.classList.remove("activo");
      alSoltar && alSoltar();
      if (el.hasPointerCapture?.(id)) el.releasePointerCapture(id);
    };
    this.soltadores.push(soltar);
    const on = (e) => {
      e.preventDefault();
      if (puntero !== null) return;
      puntero = e.pointerId;
      el.setPointerCapture(e.pointerId);
      el.classList.add("activo"); alPresionar();
    };
    const off = (e) => { if (e.pointerId === puntero) { e.preventDefault(); soltar(); } };
    el.addEventListener("pointerdown", on);
    el.addEventListener("pointerup", off);
    el.addEventListener("pointercancel", off);
    el.addEventListener("lostpointercapture", off);
    addEventListener("pointerup", off);
    addEventListener("pointercancel", off);
  }

  limpiar() {
    this.teclas.clear();
    for (const soltar of this.soltadores) soltar();
    this.botones.izq = this.botones.der = this.botones.freno = false;
    this.giro = 0; this.freno = false;
    this.alClaxon(false);
  }

  centrarDireccion() {
    for (const soltar of this.soltadoresDireccion) soltar();
    for (const k of ["a", "d", "arrowleft", "arrowright"]) this.teclas.delete(k);
    this.botones.izq = this.botones.der = false;
    this.giro = this.entrada.giro = 0;
  }

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
    } else {
      this.giro -= Math.sign(this.giro) * Math.min(Math.abs(this.giro), 3 * dt);
    }
    this.entrada.giro = this.giro; this.entrada.freno = this.freno;
    return this.entrada;
  }
}
