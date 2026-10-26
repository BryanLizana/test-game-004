// Sonido sintetizado con WebAudio: motor, viento, llantas, claxon y golpes.
export class Sonido {
  iniciar() {
    if (this.ctx) { this.ctx.resume().catch(() => {}); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = this.ctx = new AC();
    this.maestro = ctx.createGain();
    this.maestro.gain.value = 0.8;
    this.maestro.connect(ctx.destination);

    const ruido = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const datos = ruido.getChannelData(0);
    for (let i = 0; i < datos.length; i++) datos[i] = Math.random() * 2 - 1;
    this.bufRuido = ruido;
    const fuenteRuido = () => {
      const f = ctx.createBufferSource();
      f.buffer = ruido; f.loop = true; f.start();
      return f;
    };

    // Motor monocilíndrico: diente de sierra + cuadrada sub-armónica, filtrados
    this.motorFiltro = ctx.createBiquadFilter();
    this.motorFiltro.type = "lowpass";
    this.motorFiltro.frequency.value = 600;
    this.motorGain = ctx.createGain();
    this.motorGain.gain.value = 0.18;
    this.osc1 = ctx.createOscillator(); this.osc1.type = "sawtooth";
    this.osc2 = ctx.createOscillator(); this.osc2.type = "square";
    const g2 = ctx.createGain(); g2.gain.value = 0.5;
    this.osc1.connect(this.motorFiltro);
    this.osc2.connect(g2).connect(this.motorFiltro);
    this.motorFiltro.connect(this.motorGain).connect(this.maestro);
    this.osc1.start(); this.osc2.start();

    // Viento
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass"; bp.frequency.value = 500; bp.Q.value = 0.6;
    this.vientoGain = ctx.createGain(); this.vientoGain.gain.value = 0;
    this.vientoFiltro = bp;
    fuenteRuido().connect(bp).connect(this.vientoGain).connect(this.maestro);

    // Llantas / raspar pared
    const hp = ctx.createBiquadFilter();
    hp.type = "bandpass"; hp.frequency.value = 1800; hp.Q.value = 4;
    this.llantaGain = ctx.createGain(); this.llantaGain.gain.value = 0;
    fuenteRuido().connect(hp).connect(this.llantaGain).connect(this.maestro);

    // Claxon: dos tonos
    this.claxonGain = ctx.createGain(); this.claxonGain.gain.value = 0;
    for (const f of [415, 520]) {
      const o = ctx.createOscillator(); o.type = "square"; o.frequency.value = f; o.start();
      o.connect(this.claxonGain);
    }
    const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 2200;
    this.claxonGain.connect(lp).connect(this.maestro);
    ctx.resume().catch(() => {});
  }

  actualizar({ rpm, v, chirrido, motorVivo }) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const f = rpm / 60;
    this.osc1.frequency.setTargetAtTime(f, t, 0.05);
    this.osc2.frequency.setTargetAtTime(f / 2, t, 0.05);
    this.motorFiltro.frequency.setTargetAtTime(300 + rpm / 9, t, 0.1);
    this.motorGain.gain.setTargetAtTime(motorVivo ? 0.1 + Math.min(0.12, rpm / 70000) : 0, t, 0.1);
    this.vientoGain.gain.setTargetAtTime(Math.min(0.5, v * v / 1500), t, 0.1);
    this.vientoFiltro.frequency.setTargetAtTime(300 + v * 25, t, 0.2);
    this.llantaGain.gain.setTargetAtTime(Math.min(0.25, chirrido), t, 0.05);
  }

  claxon(on) {
    if (!this.ctx) return;
    this.claxonGain.gain.setTargetAtTime(on ? 0.12 : 0, this.ctx.currentTime, 0.02);
  }

  golpe(fuerza = 1) {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const f = ctx.createBufferSource(); f.buffer = this.bufRuido;
    const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 400 + fuerza * 900;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.4 + fuerza * 0.6, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.25 + fuerza * 0.5);
    f.connect(lp).connect(g).connect(this.maestro);
    f.onended = () => { f.disconnect(); lp.disconnect(); g.disconnect(); };
    f.start(t); f.stop(t + 1);
  }

  silenciar(si) {
    if (!this.maestro) return;
    this.maestro.gain.value = si ? 0 : 0.8;
    if (!si) this.ctx.resume().catch(() => {});
  }
}
