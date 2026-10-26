import * as THREE from "three";
import * as modelos from "./modelos.js?v=1.0.1";

// Calle en bajada generada por tramos. Se recorre en coordenadas de Frenet:
// s = metros a lo largo de la calle, d = desplazamiento lateral (+ derecha).
export const ANCHO = 7;          // calzada
export const VEREDA = 1.6;
export const ALTO_VEREDA = 0.15;
const PASO = 1;                  // metros entre muestras
const CHUNK = 60;                // metros por bloque de malla
const FONDO_TECHO = 7;
const BERMA = 2;                 // franja de tierra entre la trocha y la pirca
const LARGO_TIERRA = 450;        // primera parte: cerro alto sin pista

function rng(semilla) {
  return () => {
    semilla = (semilla + 0x6d2b79f5) | 0;
    let t = Math.imul(semilla ^ (semilla >>> 15), 1 | semilla);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Marco local de un objeto apoyado junto a la calle: x a lo ancho (d), z a lo largo (s)
function marcoLocal(pista, s, d, y0, rumbo) {
  const c = pista.aMundo(s, d, 0);
  const cs = Math.cos(rumbo), sn = Math.sin(rumbo);
  return (x, y, z) => [c.x + x * cs + z * sn, y0 + y, c.z - x * sn + z * cs];
}

function suavizar(arr, ventana) {
  const out = new Float32Array(arr.length);
  const m = Math.floor(ventana / 2);
  let suma = 0;
  for (let i = -m; i <= m; i++) suma += arr[Math.min(arr.length - 1, Math.max(0, i))];
  for (let i = 0; i < arr.length; i++) {
    out[i] = suma / (2 * m + 1);
    suma += arr[Math.min(arr.length - 1, i + m + 1)] - arr[Math.max(0, i - m)];
  }
  return out;
}

export class Pista {
  constructor(semilla = (Math.random() * 1e9) | 0) {
    this.rand = rng(semilla);
    this._muestraMundo = {};
    this._muestraAltura = {};
    this.generarTrazado();
    this.generarDetalles();
  }

  // ---------- Trazado ----------
  generarTrazado() {
    const r = this.rand;
    const segs = [];
    let rumbo = 0, total = 0;
    const add = (largo, k, grado, tipo = "") => { segs.push({ largo, k, grado, tipo }); total += largo; };
    const signo = (ang) => {
      if (rumbo + ang > 1.7) return -1;
      if (rumbo - ang < -1.7) return 1;
      if (Math.abs(rumbo) > 0.6 && r() < 0.75) return -Math.sign(rumbo);
      return r() < 0.5 ? -1 : 1;
    };

    // Cerro alto: un tramito plano y enseguida trocha de tierra en bajada
    add(12, 0, 0.01, "inicio");
    while (total < LARGO_TIERRA) {
      if (r() < 0.5) add(30 + r() * 40, 0, 0.13 + r() * 0.09, "tierra");
      else {
        const R = 20 + r() * 25, ang = 0.3 + r() * 0.5, sg = signo(ang);
        add(R * ang, sg / R, 0.1 + r() * 0.08, "tierra");
        rumbo += sg * ang;
      }
    }
    this.finTierra = total;
    add(60, 0, 0.15);
    const LARGO = 1850;
    while (total < LARGO - 130) {
      const t = r();
      if (t < 0.14) {                             // quiebre: la calle "se cae" de golpe
        add(25, 0, 0.07);
        add(40 + r() * 50, 0, 0.22 + r() * 0.08, "quiebre");
      } else if (t < 0.36) {
        add(50 + r() * 110, 0, 0.12 + r() * 0.14);
      } else if (t < 0.66) {                      // curva abierta
        const R = 24 + r() * 40, ang = 0.35 + r() * 0.6, sg = signo(ang);
        add(R * ang, sg / R, 0.06 + r() * 0.08, "curva");
        rumbo += sg * ang;
      } else if (t < 0.95) {                      // esquina de 90°
        add(20, 0, 0.07, "antesEsquina");
        const R = 9 + r() * 4, ang = Math.PI / 2, sg = signo(ang);
        add(R * ang, sg / R, 0.06, "esquina");
        rumbo += sg * ang;
        add(15, 0, 0.1);
      } else {
        add(30 + r() * 30, 0, 0.09 + r() * 0.04);
      }
    }
    add(40, 0, 0.08);
    add(90, 0, 0.02, "avenida");
    this.segmentos = segs;

    const n = Math.ceil(total / PASO) + 1;
    const kRaw = new Float32Array(n), gRaw = new Float32Array(n);
    this.tipo = new Array(n);
    let i = 0;
    for (const sg of segs) {
      const m = Math.round(sg.largo / PASO);
      for (let j = 0; j < m && i < n; j++, i++) { kRaw[i] = sg.k; gRaw[i] = sg.grado; this.tipo[i] = sg.tipo; }
    }
    for (; i < n; i++) { kRaw[i] = 0; gRaw[i] = 0; this.tipo[i] = "avenida"; }

    this.k = suavizar(kRaw, 9);
    this.g = suavizar(gRaw, 11);
    this.x = new Float32Array(n); this.y = new Float32Array(n); this.z = new Float32Array(n);
    this.th = new Float32Array(n);
    for (let j = 1; j < n; j++) {
      this.th[j] = this.th[j - 1] + this.k[j - 1] * PASO;
      const a = (this.th[j] + this.th[j - 1]) / 2;
      this.x[j] = this.x[j - 1] + Math.sin(a) * PASO;
      this.z[j] = this.z[j - 1] - Math.cos(a) * PASO;
      this.y[j] = this.y[j - 1] - this.g[j - 1] * PASO;
    }
    this.n = n;
    this.largo = (n - 1) * PASO;
  }

  // ---------- Consultas ----------
  muestra(s, out = {}) {
    const f = Math.max(0, Math.min(this.n - 1.001, s / PASO));
    const i = Math.floor(f), t = f - i;
    out.x = this.x[i] + (this.x[i + 1] - this.x[i]) * t;
    out.y = this.y[i] + (this.y[i + 1] - this.y[i]) * t;
    out.z = this.z[i] + (this.z[i + 1] - this.z[i]) * t;
    out.th = this.th[i] + (this.th[i + 1] - this.th[i]) * t;
    out.k = this.k[i] + (this.k[i + 1] - this.k[i]) * t;
    out.g = this.g[i] + (this.g[i + 1] - this.g[i]) * t;
    out.tipo = this.tipo[i];
    return out;
  }

  tipoVereda(s, lado) {
    const bloque = Math.floor((s - this.finTierra + (lado < 0 ? 17 : 0)) / 36);
    const tipo = ((bloque % 9) + 9) % 9;
    // Escaleras frecuentes entre casas; cada costado cambia en otro punto.
    return tipo === 5 ? "tierra" : [0, 1, 3, 6, 8].includes(tipo) ? "escalera" : "concreto";
  }

  barrio(s) {
    if (s < this.finTierra) return "cerro";
    const avance = (s - this.finTierra) / (this.largo - this.finTierra);
    return avance < 0.34 ? "ladera" : avance < 0.72 ? "vecindario" : "avenida";
  }

  // Perfil compartido por la malla y las consultas de suelo.
  alturaVereda(s, lado) {
    const m = this.muestra(s, this._muestraAltura);
    const tipo = this.tipoVereda(s, lado);
    const tramo = s - this.finTierra + (lado < 0 ? 17 : 0);
    const local = ((tramo % 36) + 36) % 36;
    const mezcla = Math.min(1, local / 3, (36 - local) / 3);
    if (tipo === "escalera" && m.g > 0.055) {
      const i = Math.max(0, Math.min(this.n - 1, Math.floor(s / PASO)));
      const perfil = this.perfilesEscalera[lado < 0 ? 0 : 1];
      const escalon = perfil[i] - m.y;
      return ALTO_VEREDA + (escalon - ALTO_VEREDA) * mezcla;
    }
    if (tipo === "tierra") return ALTO_VEREDA - 0.09 * mezcla;
    const acceso = ((s + (lado < 0 ? 9 : 0)) % 23 + 23) % 23;
    const rampa = Math.max(0, 1 - Math.abs(acceso - 11.5) / 1.5);
    return ALTO_VEREDA - 0.125 * rampa;
  }

  // Altura sobre la calzada: sardinel, rampas y escaleras puntuales.
  alturaLateral(d, s) {
    if (Math.abs(d) <= ANCHO / 2) return 0;
    if (s < this.finTierra) return 0.05;
    return this.alturaVereda(s, Math.sign(d));
  }

  // Pista en mal estado: ondulaciones que el torito sin amortiguador siente todo el rato
  rugosidad(s, d, pico = 1) {
    const amp = Math.min(0.041 * pico, 0.014 + 0.027 * (0.5 + 0.5 * Math.sin(s * 0.013 + 1.7))) * 0.9;
    const r = Math.sin(s * 1.9 + d * 1.1) * 0.45 + Math.sin(s * 4.7 - d * 2.3) * 0.35 + Math.sin(s * 9.1 + d * 5.7) * 0.2;
    const zona = s < this.finTierra ? 2.2 : 1;   // la trocha es peor
    return amp * r * zona * (Math.abs(d) > ANCHO / 2 && s >= this.finTierra ? 0.3 : 1);
  }

  enTierra(s) { return s < this.finTierra; }
  mirador(s) { return this.miradores.find((m) => s >= m.s0 && s < m.s1); }
  enMirador(s) { return !!this.mirador(s); }
  // Mirador sin baranda: pasarse del borde es caer al barranco
  esBarranco(s, lado) { const m = lado > 0 && this.mirador(s); return !!m && m.tipo === "nada"; }

  // Distancia lateral máxima antes de chocar: pirca en el cerro, fachadas en la ciudad
  limiteLateral(s, lado = 1) {
    if (s < this.finTierra) return ANCHO / 2 + BERMA - 0.25;
    return ANCHO / 2 + VEREDA + (this.esBarranco(s, lado) ? 0.6 : 0);
  }

  // Ladera fuera de la trocha: un lado sube (cerro) y el otro baja (se ve Lima)
  alturaTerreno(s, d) {
    const fuera = Math.max(0, Math.abs(d) - (ANCHO / 2 + BERMA));
    const ondula = Math.sin(s * 0.07 + d * 0.15) * 0.8 + Math.sin(s * 0.023 - d * 0.05) * 1.5;
    return d < 0 ? fuera * 0.42 + ondula * Math.min(1, fuera / 6) : -fuera * 0.55 + ondula * 0.5 * Math.min(1, fuera / 6);
  }

  aMundo(s, d, h = 0, out = new THREE.Vector3(), muestra = null) {
    const m = muestra || this.muestra(s, this._muestraMundo);
    const c = Math.cos(m.th), sn = Math.sin(m.th);
    return out.set(m.x + c * d, m.y + h, m.z + sn * d);
  }

  // ---------- Detalles: casas, postes, rompemuelles, cruces ----------
  generarDetalles() {
    const r = this.rand;
    // Peldaños cortos o anchos y descansos de 2–3 m, según el sector.
    // El perfil se guarda una vez y se usa tanto para dibujar como para pisar.
    this.perfilesEscalera = [-1, 1].map((lado) => {
      const alturas = new Float32Array(this.n);
      for (let i = 0; i < this.n;) {
        const sector = Math.floor((i + (lado < 0 ? 17 : 0)) / 36);
        const estilo = ((sector % 3) + 3) % 3;
        const descanso = (i + (lado < 0 ? 3 : 0)) % 13 < 2;
        const huella = descanso ? Math.max(1, Math.min(2 + (estilo === 2 ? 1 : 0), Math.floor(0.38 / Math.max(0.06, this.g[i]))))
          : Math.max(1, Math.min(3, Math.round((estilo === 0 ? 0.15 : 0.21) / Math.max(0.06, this.g[i]))));
        const fin = Math.min(this.n, i + huella);
        for (let j = i; j < fin; j++) alturas[j] = this.y[i] + ALTO_VEREDA;
        i = fin;
      }
      return alturas;
    });

    this.baches = [];
    for (let s = 30; s < this.largo - 70; s += 12 + r() * 30) {
      this.baches.push({ s, d: (r() - 0.5) * (ANCHO - 1.2), r: 0.3 + r() * 0.4 });
    }

    this.casas = [[], []]; // [izquierda, derecha]
    this.miradores = [];
    for (let s = this.finTierra + 120 + r() * 80; s < this.largo - 250; s += 280 + r() * 220) {
      const tipo = ["concreto", "guardavia", "valla", "nada"][(r() * 4) | 0];
      this.miradores.push({ s0: s, s1: s + 60 + r() * 60, tipo });
    }
    for (const lado of [0, 1]) {
      let s = this.finTierra;
      while (s < this.largo + 5) {
        const mir = lado === 1 && this.miradores.find((m) => s + 10 > m.s0 && s < m.s1);
        if (mir) { s = mir.s1; continue; }
        const barrio = this.barrio(s);
        const ancho = barrio === "avenida" ? 7 + r() * 5 : 5 + r() * 5;
        const pisos = barrio === "ladera" ? 1 + (r() < 0.5 ? 1 : 0)
          : barrio === "vecindario" ? 2 + (r() < 0.4 ? 1 : 0) : 2 + ((r() * 3) | 0);
        const muro = r() < (barrio === "ladera" ? 0.25 : barrio === "vecindario" ? 0.14 : 0.07);
        const baseTex = barrio === "ladera" && r() < 0.7 ? 0 : 1 + ((r() * 3) | 0);
        this.casas[lado].push({
          s0: s, s1: s + ancho, alto: muro ? 1.7 + r() * 0.6 : pisos * 2.8 + 0.2 + r() * 0.3,
          tex: baseTex + 4 * ((r() * (barrio === "ladera" ? 3 : 6)) | 0),
          barrio, muro, pintura: (r() * 6) | 0,
          negocio: !muro && barrio !== "ladera" && r() < (barrio === "avenida" ? 0.6 : 0.3) ? (r() * 4) | 0 : -1,
          tanque: !muro && r() < 0.45, fierros: !muro && r() < (barrio === "ladera" ? 0.7 : 0.25),
        });
        s += ancho;
      }
    }
    this.postes = [];
    for (let s = 10; s < this.largo; s += 30 + r() * 10) this.postes.push({ s, lado: r() < 0.5 ? -1 : 1 });

    this.rompemuelles = [];
    for (let s = 120; s < this.largo - 150; s += 160 + r() * 200) {
      const i = Math.round(s / PASO);
      if (Math.abs(this.k[i]) < 0.01 && this.g[i] < 0.17 && s > this.finTierra + 20) this.rompemuelles.push(s);
    }

    // Chozas de triplay, madera y estera en el cerro alto
    this.chozas = [];
    for (const lado of [-1, 1]) {
      for (let s = 6 + r() * 8; s < this.finTierra - 6;) {
        const avance = s / this.finTierra;              // 0 arriba, 1 donde empieza la pista
        const nueva = () => ({
          s, lado, retiro: 1 + r() * 3,
          // Arriba solo chozas; abajo aparecen casitas de ladrillo
          variante: r() < (avance - 0.35) * 1.4 ? "ladrillo" : (r() * 3) | 0,
          escala: 0.85 + r() * 0.35, giro: (r() - 0.5) * 0.25, pisos: r() < 0.3 ? 2 : 1, tex: (r() * 4) | 0,
        });
        this.chozas.push(nueva());
        // Segunda y tercera fila detrás, más probables mientras bajamos
        if (r() < avance * 0.9) { const c = nueva(); c.retiro += 7 + r() * 3; this.chozas.push(c); }
        if (r() < (avance - 0.5) * 1.2) { const c = nueva(); c.retiro += 15 + r() * 4; this.chozas.push(c); }
        s += 24 - avance * 16 + r() * 6;
      }
    }

    // Llantas pintadas semienterradas marcando la orilla, cruz en la cima, ropa tendida
    this.llantas = [];
    for (let s = 20; s < this.finTierra - 30; s += 50 + r() * 60) {
      this.llantas.push({ s0: s, s1: s + 15 + r() * 20, lado: r() < 0.5 ? -1 : 1 });
    }
    this.cruz = { s: Math.min(this.finTierra * 0.45, 200), d: -48 };
    this.tendederos = this.chozas.filter((c) => c.lado < 0 && c.retiro < 4 && r() < 0.4).map((c) => ({ s: c.s + 4, lado: c.lado }));

    this.cruces = [];
    for (let i = 1; i < this.n; i++) {
      if (this.tipo[i] === "esquina" && this.tipo[i - 1] === "antesEsquina") this.cruces.push(i * PASO - 6);
    }
    for (let s = 90; s < this.largo - 100; s += 90 + r() * 120) this.cruces.push(s);
    this.cruces.sort((a, b) => a - b);

    // Desgaste visual separado de los obstáculos: no modifica la conducción.
    this.parches = []; this.grietas = []; this.huellas = [];
    for (let s = this.finTierra + 8; s < this.largo - 12; s += 11 + r() * 17) {
      this.parches.push({ s, d: (r() - 0.5) * 4.7, largo: 1 + r() * 2.7, ancho: 0.45 + r() * 1.2 });
      const puntos = [];
      let d = (r() - 0.5) * 5;
      for (let j = 0; j < 5; j++) {
        d = Math.max(-3.1, Math.min(3.1, d + (r() - 0.5) * 0.65));
        puntos.push({ s: s + j * 0.55, d });
      }
      this.grietas.push(puntos);
      const lado = r() < 0.5 ? -1 : 1;
      if (Math.abs(this.muestra(s).k) > 0.012 && r() < 0.6) {
        this.huellas.push({ s, d: lado * 1.5, largo: 3 + r() * 3 });
      }
    }
  }

  // ---------- Mallas ----------
  construir(escena, mat) {
    this.bloques = [];
    this.lamparas = [];   // posiciones de los focos (para las luces dinámicas de noche)
    for (let s0 = 0; s0 < this.largo; s0 += CHUNK) {
      const g = new THREE.Group();
      g.userData.s0 = s0;
      g.userData.s1 = Math.min(this.largo, s0 + CHUNK);
      this.construirBloque(g, s0, g.userData.s1, mat);
      escena.add(g);
      this.bloques.push(g);
    }
    this.construirFinal(escena);
    this.actualizarVisibles(8);
  }

  actualizarVisibles(s) {
    for (const b of this.bloques) b.visible = b.userData.s1 > s - 80 && b.userData.s0 < s + 340;
  }

  construirBloque(grupo, s0, s1, mat) {
    const i0 = Math.max(0, Math.floor(s0 / PASO)), i1 = Math.min(this.n - 1, Math.ceil(s1 / PASO));
    const v = new THREE.Vector3();

    // Tira: une dos puntos de sección (d,h) muestra a muestra
    const tira = (buf, a, b, perfil) => {
      for (let i = a; i < b; i++) {
        const base = buf.pos.length / 3;
        for (const ii of [i, i + 1]) {
          for (const p of perfil(ii)) {
            this.aMundo(ii * PASO, p.d, p.h, v);
            buf.pos.push(v.x, v.y, v.z);
            buf.uv.push(p.u, p.v);
          }
        }
        buf.idx.push(base, base + 1, base + 2, base + 1, base + 3, base + 2);
      }
    };
    const nuevo = () => ({ pos: [], uv: [], idx: [] });
    const malla = (buf, material, sombra = true) => {
      if (!buf.idx.length) return;
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.Float32BufferAttribute(buf.pos, 3));
      geo.setAttribute("uv", new THREE.Float32BufferAttribute(buf.uv, 2));
      geo.setIndex(buf.idx);
      geo.computeVertexNormals();
      const m = new THREE.Mesh(geo, material);
      m.receiveShadow = sombra;
      grupo.add(m);
    };

    // Calzada
    const iT = Math.round(this.finTierra / PASO);
    const calzada = (a, b, material, escalaTex) => {
      if (b <= a) return;
      const buf = nuevo();
      tira(buf, a, b, (i) => [
        { d: -ANCHO / 2, h: 0, u: 0, v: i * PASO / escalaTex },
        { d: ANCHO / 2, h: 0, u: ANCHO / escalaTex, v: i * PASO / escalaTex },
      ]);
      malla(buf, material);
    };
    calzada(i0, Math.min(i1, iT), mat.tierra, 5);
    calzada(Math.max(i0, iT), i1, mat.asfalto, 4);
    if (i0 < iT) this.construirCerro(grupo, i0, Math.min(i1, iT), mat, tira, nuevo, malla);

    // Veredas mixtas con sardinel, rebajes y escaleras puntuales.
    const vereda = nuevo();
    const cuad = (buf, pts) => {     // pts: [s, d, yAbs, u, v] x4 en orden de tira
      const base = buf.pos.length / 3;
      for (const [ps, pd, py, u, w] of pts) {
        this.aMundo(ps, pd, 0, v);
        buf.pos.push(v.x, py, v.z);
        buf.uv.push(u, w);
      }
      buf.idx.push(base, base + 1, base + 2, base + 1, base + 3, base + 2);
    };
    const tierraVereda = nuevo(), juntas = nuevo(), cimientos = nuevo(), bordeTerreno = nuevo();
    for (let i = Math.max(i0, iT); i < i1; i++) {
      for (const sg of [-1, 1]) {
        const dIn = sg * ANCHO / 2, dOut = sg * (ANCHO / 2 + VEREDA);
        const buf = this.tipoVereda(i + 0.5, sg) === "tierra" ? tierraVereda : vereda;
        // Medios metros permiten seguir curvas y rebajes sin caras largas torcidas.
        for (let j = 0; j < 2; j++) {
          const sa = i + j * 0.5, sb = sa + 0.5;
          const ya = this.muestra(sa).y + this.alturaVereda(sa, sg);
          const yb = this.muestra(sb).y + this.alturaVereda(sb - 0.00001, sg);
          cuad(buf, [[sa, dIn, ya, 0, sa / 2], [sa, dOut, ya, VEREDA / 2, sa / 2],
                     [sb, dIn, yb, 0, sb / 2], [sb, dOut, yb, VEREDA / 2, sb / 2]]);
          cuad(vereda, [[sa, dIn, this.muestra(sa).y, 0, 0], [sa, dIn, ya, 0, 0.1],
                        [sb, dIn, this.muestra(sb).y, 0.5, 0], [sb, dIn, yb, 0.5, 0.1]]);
          // Cerrar el canto exterior: la vereda no queda como una lámina flotante.
          const sueloA = this.muestra(sa).y, sueloB = this.muestra(sb).y;
          cuad(cimientos, [[sa, dOut, ya, sa / 2, 1], [sa, dOut, sueloA - 2.4, sa / 2, 0],
                            [sb, dOut, yb, sb / 2, 1], [sb, dOut, sueloB - 2.4, sb / 2, 0]]);
          const extension = Math.min(2.2, Math.max(0.5, 0.8 / Math.max(0.001, Math.abs(this.k[i])) - Math.abs(dOut)));
          const dExt = dOut + sg * extension;
          cuad(bordeTerreno, [[sa, dOut, sueloA - 0.03, 0, sa / 3],
                              [sa, dExt, sueloA + this.alturaTerreno(sa, dExt) - 0.08, extension / 3, sa / 3],
                              [sb, dOut, sueloB - 0.03, 0, sb / 3],
                              [sb, dExt, sueloB + this.alturaTerreno(sb, dExt) - 0.08, extension / 3, sb / 3]]);
          const siguiente = this.muestra(sb).y + this.alturaVereda(sb, sg);
          if (Math.abs(siguiente - yb) > 0.005) {
            cuad(buf, [[sb, dIn, siguiente, 0, 0], [sb, dOut, siguiente, 1, 0],
                       [sb, dIn, yb, 0, 0.1], [sb, dOut, yb, 1, 0.1]]);
          }
          if (j === 0 && i % 3 === 0 && buf === vereda && this.tipoVereda(i, sg) !== "escalera") {
            const yj = this.muestra(sa + 0.025).y + this.alturaVereda(sa + 0.025, sg);
            cuad(juntas, [[sa, dIn, ya + 0.002, 0, 0], [sa, dOut, ya + 0.002, 1, 0],
                          [sa + 0.025, dIn, yj + 0.002, 0, 1], [sa + 0.025, dOut, yj + 0.002, 1, 1]]);
          }
        }
      }
    }
    malla(vereda, mat.vereda);
    malla(tierraVereda, mat.tierra);
    malla(juntas, mat.asfalto);
    malla(cimientos, mat.muroLateral);
    malla(bordeTerreno, mat.cerro);

    // Miradores: baranda de concreto y la ladera cayendo hacia Lima
    for (const mir of this.miradores) {
      const a = Math.max(i0, Math.round(mir.s0 / PASO)), b = Math.min(i1, Math.round(mir.s1 / PASO));
      if (b <= a) continue;
      const baranda = nuevo(), ladera = nuevo();
      const dB = ANCHO / 2 + VEREDA, G = 0.25, H = 1.15;
      // Borde exterior de la vereda (cara que mira al barranco)
      tira(baranda, a, b, (i) => [{ d: dB, h: this.alturaTerreno(i * PASO, dB) - 0.6, u: i / 2, v: 0 }, { d: dB, h: 0.3, u: i / 2, v: 0.1 }]);
      if (mir.tipo === "concreto") {
        tira(baranda, a, b, (i) => [{ d: dB, h: 0, u: i / 2, v: 0 }, { d: dB, h: H, u: i / 2, v: 0.3 }]);
        tira(baranda, a, b, (i) => [{ d: dB, h: H, u: i / 2, v: 0.3 }, { d: dB + G, h: H, u: i / 2, v: 0.35 }]);
        tira(baranda, a, b, (i) => [{ d: dB + G, h: this.alturaTerreno(i * PASO, dB + G) - 0.5, u: i / 2, v: 0 }, { d: dB + G, h: H, u: i / 2, v: 0.3 }]);
      } else if (mir.tipo === "guardavia") {
        const viga = nuevo();
        tira(viga, a, b, (i) => [{ d: dB - 0.1, h: 0.65, u: i / 4, v: 0 }, { d: dB - 0.1, h: 1.0, u: i / 4, v: 1 }]);
        malla(viga, mat.guardavia);
        this.postesBarrera(grupo, a, b, dB, 2, mat.geoPosteGuardavia, mat.poste, 0.55);
      } else if (mir.tipo === "valla") {
        const tablas = nuevo();
        for (const [h0, h1] of [[0.45, 0.62], [0.78, 0.95], [1.1, 1.27]]) {
          tira(tablas, a, b, (i) => [{ d: dB - 0.12, h: h0, u: i / 3, v: 0 }, { d: dB - 0.12, h: h1, u: i / 3, v: 0.35 }]);
        }
        malla(tablas, mat.madera);
        this.postesBarrera(grupo, a, b, dB - 0.05, 2.5, mat.geoPosteValla, mat.madera, 0.75);
      }
      const cortes = [G, 4, 10, 20, 35, 60];
      for (let c = 0; c < cortes.length - 1; c++) {
        const d0 = dB + cortes[c], d1 = dB + cortes[c + 1];
        tira(ladera, a, b, (i) => [
          { d: d0, h: this.alturaTerreno(i * PASO, d0) - 0.5, u: d0 / 6, v: i / 6 },
          { d: d1, h: this.alturaTerreno(i * PASO, d1) - 0.5, u: d1 / 6, v: i / 6 }]);
      }
      malla(baranda, mat.baranda);
      malla(ladera, mat.cerro);
    }

    // Baches: manchas oscuras hundidas en la calzada
    const baches = nuevo();
    for (const b of this.baches) {
      if (b.s < s0 || b.s >= s1 || b.s < this.finTierra) continue;
      const base = baches.pos.length / 3;
      this.aMundo(b.s, b.d, 0.012, v);
      baches.pos.push(v.x, v.y, v.z); baches.uv.push(0.5, 0.5);
      const lados = 9;
      for (let k = 0; k <= lados; k++) {
        const a = (k / lados) * Math.PI * 2, irregular = 0.8 + 0.35 * Math.sin(k * 2.7 + b.s);
        this.aMundo(b.s + Math.cos(a) * b.r * 1.4 * irregular, b.d + Math.sin(a) * b.r * irregular, 0.012, v);
        baches.pos.push(v.x, v.y, v.z); baches.uv.push(0.5 + Math.cos(a) / 2, 0.5 + Math.sin(a) / 2);
        if (k > 0) baches.idx.push(base, base + k, base + k + 1);
      }
    }
    malla(baches, mat.bache);
    this.construirHistoria(s0, s1, mat, nuevo, malla);

    // Fachadas y techos
    const fachadas = mat.fachadas.map(() => nuevo());
    const techoDetalles = [];   // tanques y fierros sobre los techos
    const techos = nuevo(), muros = nuevo(), relleno = nuevo();
    const paredes = mat.paredes.map(() => nuevo()), letreros = mat.letreros.map(() => nuevo());
    const portones = nuevo(), grafitis = nuevo();
    [-1, 1].forEach((sg, lado) => {
      const dPared = sg * (ANCHO / 2 + VEREDA);
      const dFondo = sg * (ANCHO / 2 + VEREDA + FONDO_TECHO);
      const casas = this.casas[lado];
      for (let c = 0; c < casas.length; c++) {
        const casa = casas[c];
        const a = Math.max(i0, Math.round(casa.s0 / PASO)), b = Math.min(i1, Math.round(casa.s1 / PASO));
        if (b <= a) continue;
        const iBase = Math.max(0, Math.min(this.n - 1, Math.round(casa.s0 / PASO)));
        const yTecho = this.y[iBase] + casa.alto;
        // La textura representa 8 m x 8.6 m de fachada (3 pisos); las casas bajas muestran solo los de abajo
        const anchoTex = 8, altoTex = 8.6;
        const yPiso = yTecho - casa.alto;
        const frente = casa.muro ? paredes[casa.pintura] : fachadas[casa.tex];
        tira(frente, a, b, (i) => {
          const u = (i * PASO - casa.s0) / anchoTex;
          return [
            { d: dPared, h: -0.6, u, v: Math.max(0, (this.y[i] - 0.6 - yPiso) / altoTex) },
            { d: dPared, h: yTecho - this.y[i], u, v: casa.alto / altoTex },
          ];
        });
        if (casa.muro) tira(frente, a, b, (i) => [
          { d: dPared, h: yTecho - this.y[i], u: i / 4, v: 0 },
          { d: dPared + sg * 0.2, h: yTecho - this.y[i], u: i / 4, v: 0.1 },
        ]);
        if (casa.muro && (c % 3 !== 1)) {
          tira(grafitis, a, b, (i) => [
            { d: dPared - sg * 0.02, h: yPiso + 0.08 - this.y[i],
              u: sg < 0 ? (i - casa.s0) / (casa.s1 - casa.s0) : 1 - (i - casa.s0) / (casa.s1 - casa.s0), v: 0 },
            { d: dPared - sg * 0.02, h: yTecho - this.y[i] - 0.05,
              u: sg < 0 ? (i - casa.s0) / (casa.s1 - casa.s0) : 1 - (i - casa.s0) / (casa.s1 - casa.s0), v: 1 },
          ]);
        }
        tira(techos, a, b, (i) => [
          { d: dPared, h: (casa.muro ? yPiso + ALTO_VEREDA : yTecho) - this.y[i], u: 0, v: i / 4 },
          { d: dFondo, h: (casa.muro ? yPiso + ALTO_VEREDA : yTecho) - this.y[i], u: FONDO_TECHO / 4, v: i / 4 },
        ]);
        // Zócalos pintados y portones dan escala humana a la calle.
        const pintado = paredes[casa.pintura];
        tira(pintado, a, b, (i) => [
          { d: dPared - sg * 0.012, h: 0.02, u: i / 4, v: 0 },
          { d: dPared - sg * 0.012, h: this.alturaVereda(i, sg) + (casa.muro ? 0.45 : 0.65), u: i / 4, v: 0.35 },
        ]);
        const centro = (casa.s0 + casa.s1) / 2;
        const ga = Math.max(a, Math.ceil(centro - (casa.muro ? 1.5 : 1.2)));
        const gb = Math.min(b, Math.floor(centro + (casa.muro ? 1.5 : 1.2)));
        if ((casa.muro || casa.negocio >= 0) && gb > ga) {
          tira(portones, ga, gb, (i) => [
            { d: dPared - sg * 0.025, h: yPiso + 0.18 - this.y[i], u: (i - ga) / 0.6, v: 0 },
            { d: dPared - sg * 0.025, h: yPiso + (casa.muro ? 1.55 : 2.15) - this.y[i], u: (i - ga) / 0.6, v: 1 },
          ]);
          if (casa.negocio >= 0) tira(letreros[casa.negocio], ga, gb, (i) => [
            { d: dPared - sg * 0.035, h: yPiso + 2.25 - this.y[i], u: sg < 0 ? (i - ga) / (gb - ga) : 1 - (i - ga) / (gb - ga), v: 0 },
            { d: dPared - sg * 0.035, h: yPiso + 2.9 - this.y[i], u: sg < 0 ? (i - ga) / (gb - ga) : 1 - (i - ga) / (gb - ga), v: 1 },
          ]);
        }
        const sMedio = (casa.s0 + casa.s1) / 2;
        if (sMedio >= s0 && sMedio < s1) {
          if (casa.tanque) techoDetalles.push({ tipo: "tanque", s: sMedio + 1, d: sg * (ANCHO / 2 + VEREDA + 4.5), y: yTecho });
          if (casa.fierros) techoDetalles.push({ tipo: "fierros", s: casa.s0 + 0.4, d: dPared + sg * 0.3, y: yTecho });
        }
        // Pared trasera (se ve desde el cerro y desde los miradores)
        tira(muros, a, b, (i) => [
          { d: dFondo, h: Math.min(-3, this.alturaTerreno(i * PASO, dFondo) - 1), u: i / 8, v: 0 },
          { d: dFondo, h: yTecho - this.y[i], u: i / 8, v: casa.alto / altoTex },
        ]);
        // Muros laterales: donde no hay vecina pegada, hay un hueco (mirador) o la vecina es más baja
        const techoDe = (k) => this.y[Math.max(0, Math.min(this.n - 1, Math.round(k.s0 / PASO)))] + k.alto;
        const cerrar = (iBorde, vecina, pegada) => {
          if (iBorde < i0 || iBorde > i1) return;
          const desde = pegada ? Math.min(yTecho, techoDe(vecina)) : this.y[iBorde] - 3;
          if (desde >= yTecho - 0.05) return;
          const base = muros.pos.length / 3;
          for (const [d, y, u] of [[dPared, desde, 0], [dFondo, desde, FONDO_TECHO / 8], [dPared, yTecho, 0], [dFondo, yTecho, FONDO_TECHO / 8]]) {
            this.aMundo(iBorde * PASO, d, y - this.y[iBorde], v);
            muros.pos.push(v.x, v.y, v.z);
            muros.uv.push(u, (y - yPiso) / altoTex);
          }
          muros.idx.push(base, base + 1, base + 2, base + 1, base + 3, base + 2);
        };
        const ant = casas[c - 1], sig = casas[c + 1];
        if (a === Math.round(casa.s0 / PASO)) cerrar(a, ant, ant && Math.abs(ant.s1 - casa.s0) < 0.5);
        if (b === Math.round(casa.s1 / PASO)) cerrar(b, sig, sig && Math.abs(sig.s0 - casa.s1) < 0.5);
        // Ladera detrás de las casas: el cerro sube a la izquierda y baja hacia Lima a la derecha
        // (corta y solo en tramos casi rectos: en curvas cerradas la franja se dobla sobre sí misma)
        let curvaMax = 0;
        for (let i = a; i <= b; i++) curvaMax = Math.max(curvaMax, Math.abs(this.k[i]));
        const dMax = Math.min(50, 0.45 / Math.max(curvaMax, 1e-3) - FONDO_TECHO - 6);
        const corte = [0, 6, 14, 28, 50].filter((x) => x <= dMax);
        // Misma ladera que en el cerro: así el empalme cerro → pista no deja huecos
        const hT = (i, d) => this.alturaTerreno(i * PASO, d);
        for (let k = 0; k < corte.length - 1; k++) {
          const d0 = dFondo + sg * corte[k], d1 = dFondo + sg * corte[k + 1];
          tira(relleno, a, b, (i) => sg < 0
            ? [{ d: d1, h: hT(i, d1), u: d1 / 6, v: i / 6 }, { d: d0, h: hT(i, d0), u: d0 / 6, v: i / 6 }]
            : [{ d: d0, h: hT(i, d0), u: d0 / 6, v: i / 6 }, { d: d1, h: hT(i, d1), u: d1 / 6, v: i / 6 }]);
        }
      }
    });
    fachadas.forEach((f, i) => malla(f, mat.fachadas[i]));
    paredes.forEach((f, i) => malla(f, mat.paredes[i]));
    letreros.forEach((f, i) => malla(f, mat.letreros[i]));
    malla(portones, mat.porton);
    malla(grafitis, mat.grafiti);
    this.instancias(grupo, techoDetalles.filter((t) => t.tipo === "tanque"), mat.geoTanque, mat.tanque, (t) => [t.s, t.d, t.y + 0.55, true]);
    this.instancias(grupo, techoDetalles.filter((t) => t.tipo === "fierros"), mat.geoFierros, mat.fierro, (t) => [t.s, t.d, t.y + 0.5, true]);
    malla(techos, mat.techo);
    malla(muros, mat.muroLateral);
    malla(relleno, mat.cerro);

    // Postes y cables
    const lineas = [], postesMadera = [], postesMetal = [];
    const postes = this.postes.filter((p) => p.s >= s0 - 40 && p.s < s1);
    for (let j = 0; j < postes.length; j++) {
      const p = postes[j];
      const d = p.lado * (ANCHO / 2 + 0.35);
      if (p.s >= s0) (p.s < this.finTierra ? postesMadera : postesMetal).push(p);
      const q = postes[j + 1];
      if (q) {
        const a = this.aMundo(p.s, d, 7.6), b = this.aMundo(q.s, q.lado * (ANCHO / 2 + 0.35), 7.6);
        for (const off of [0, 0.35, -0.4]) {
          let prev = null;
          for (let t = 0; t <= 1.0001; t += 1 / 6) {
            const pt = new THREE.Vector3().lerpVectors(a, b, t);
            pt.y += off * 0.6 - Math.sin(t * Math.PI) * (0.9 + Math.abs(off));
            if (prev) lineas.push(prev.x, prev.y, prev.z, pt.x, pt.y, pt.z);
            prev = pt;
          }
        }
      }
    }
    const enPoste = (alto) => (p) => [p.s, p.lado * (ANCHO / 2 + 0.35), (p.s < this.finTierra ? 0.05 : ALTO_VEREDA) + alto];
    this.instancias(grupo, postesMadera, mat.geoPoste, mat.posteMadera, enPoste(4));
    this.instancias(grupo, postesMetal, mat.geoPoste, mat.poste, enPoste(4));
    // Brazo con lámpara de sodio que cuelga hacia la pista + charco de luz (solo se ve de noche)
    const todos = [...postesMadera, ...postesMetal];
    const hacia = (p) => (p.lado > 0 ? Math.PI : 0);
    this.instancias(grupo, todos, mat.geoBrazo, mat.poste, (p) => [p.s, p.lado * (ANCHO / 2 - 0.5), enPoste(7.7)(p)[2]], hacia);
    this.instancias(grupo, todos, mat.geoFoco, mat.foco, (p) => [p.s, p.lado * (ANCHO / 2 - 1.3), enPoste(7.55)(p)[2]], hacia, false);
    this.instancias(grupo, todos, mat.geoCharco, mat.charco, (p) => [p.s, p.lado * (ANCHO / 2 - 1.3), 0.03], null, false);
    for (const p of todos) this.lamparas.push(this.aMundo(p.s, p.lado * (ANCHO / 2 - 1.3), enPoste(7.3)(p)[2]));
    if (lineas.length) {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.Float32BufferAttribute(lineas, 3));
      grupo.add(new THREE.LineSegments(geo, mat.cable));
    }

    // Rompemuelles
    for (const s of this.rompemuelles) {
      if (s < s0 || s >= s1) continue;
      const rm = new THREE.Mesh(mat.geoRompemuelle, mat.rompemuelle);
      this.aMundo(s, 0, 0.04, rm.position);
      const m = this.muestra(s);
      rm.rotation.set(0, -m.th, 0, "YXZ");
      rm.rotation.x = -Math.atan(m.g);
      grupo.add(rm);
    }
  }

  // Cerro alto: berma de tierra, pircas, ladera y chozas
  construirHistoria(s0, s1, mat, nuevo, malla) {
    const reparaciones = nuevo(), grietas = nuevo(), huellas = nuevo();
    const v = new THREE.Vector3();
    const punto = (buf, s, d, u = 0, w = 0) => {
      this.aMundo(s, d, 0.016, v);
      buf.pos.push(v.x, v.y, v.z); buf.uv.push(u, w);
    };
    const mancha = (buf, p) => {
      const base = buf.pos.length / 3;
      punto(buf, p.s, p.d, p.s / 0.8, p.d / 0.8);
      for (let j = 0; j <= 10; j++) {
        const angulo = (j % 10) / 10 * Math.PI * 2;
        const irregular = 0.85 + 0.15 * Math.sin((j % 10) * 2.3 + p.s);
        const s = p.s + Math.cos(angulo) * p.largo * 0.5 * irregular;
        const d = Math.max(-3.47, Math.min(3.47, p.d + Math.sin(angulo) * p.ancho * irregular));
        punto(buf, s, d, s / 0.8, d / 0.8);
        if (j > 0) buf.idx.push(base, base + j, base + j + 1);
      }
    };
    const raya = (buf, a, b, ancho) => {
      const base = buf.pos.length / 3;
      punto(buf, a.s, a.d - ancho, a.s / 0.8, (a.d - ancho) / 0.8);
      punto(buf, a.s, a.d + ancho, a.s / 0.8, (a.d + ancho) / 0.8);
      punto(buf, b.s, b.d - ancho, b.s / 0.8, (b.d - ancho) / 0.8);
      punto(buf, b.s, b.d + ancho, b.s / 0.8, (b.d + ancho) / 0.8);
      buf.idx.push(base, base + 1, base + 2, base + 1, base + 3, base + 2);
    };
    for (const p of this.parches) if (p.s >= s0 && p.s < s1) mancha(reparaciones, p);
    for (const camino of this.grietas) {
      if (camino[0].s < s0 || camino[0].s >= s1) continue;
      for (let i = 1; i < camino.length; i++) raya(grietas, camino[i - 1], camino[i], 0.018);
    }
    for (const h of this.huellas) {
      if (h.s < s0 || h.s >= s1) continue;
      for (const lado of [-1, 1]) for (let s = h.s; s < h.s + h.largo; s += 0.5) {
        raya(huellas, { s, d: h.d + lado * 0.45 }, { s: s + 0.5, d: h.d + lado * 0.45 }, 0.045);
      }
    }
    malla(reparaciones, mat.reparacion);
    malla(grietas, mat.grieta);
    malla(huellas, mat.huella, false);
  }

  construirCerro(grupo, a, b, mat, tira, nuevo, malla) {
    const berma = nuevo(), pirca = nuevo(), ladera = nuevo();
    const dP = ANCHO / 2 + BERMA, GROSOR = 0.5, ALTO = 0.9;
    // Terrazas de pirca de este bloque: se juntan en dos mallas (lados de piedra y tope de tierra)
    this._terrazas = { lados: nuevo(), tope: nuevo(), muros: nuevo(), techos: nuevo(), fachadas: mat.fachadas.map(() => nuevo()) };
    for (const sg of [-1, 1]) {
      const ord = (p, q) => (sg < 0 ? [q, p] : [p, q]);
      tira(berma, a, b, (i) => ord({ d: sg * ANCHO / 2, h: 0, u: 0, v: i / 5 }, { d: sg * dP, h: 0.05, u: BERMA / 5, v: i / 5 }));
      // Pirca: cara interior, tope y cara exterior
      tira(pirca, a, b, (i) => [{ d: sg * dP, h: 0, u: i / 4, v: 0 }, { d: sg * dP, h: ALTO, u: i / 4, v: 0.45 }]);
      tira(pirca, a, b, (i) => ord({ d: sg * dP, h: ALTO, u: i / 4, v: 0.45 }, { d: sg * (dP + GROSOR), h: ALTO, u: i / 4, v: 0.7 }));
      tira(pirca, a, b, (i) => [{ d: sg * (dP + GROSOR), h: this.alturaTerreno(i * PASO, sg * (dP + GROSOR)) - 0.2, u: i / 4, v: 0 },
                                 { d: sg * (dP + GROSOR), h: ALTO, u: i / 4, v: 0.45 }]);
      // Ladera en franjas hasta 60 m
      const cortes = [GROSOR, 3, 8, 16, 30, 60];
      for (let c = 0; c < cortes.length - 1; c++) {
        const d0 = sg * (dP + cortes[c]), d1 = sg * (dP + cortes[c + 1]);
        tira(ladera, a, b, (i) => ord(
          { d: d0, h: this.alturaTerreno(i * PASO, d0), u: d0 / 6, v: i / 6 },
          { d: d1, h: this.alturaTerreno(i * PASO, d1), u: d1 / 6, v: i / 6 }));
      }
    }
    malla(berma, mat.tierra);
    malla(pirca, mat.pircaLisa);
    malla(ladera, mat.cerro);
    this.construirDetallesCerro(grupo, a, b, mat);

    for (const c of this.chozas) {
      if (c.s < a * PASO || c.s >= b * PASO) continue;
      const m = this.muestra(c.s);
      const rumbo = -m.th + c.giro;
      if (c.variante === "ladrillo") {
        // Casita de material: el lado que da a la trocha lleva fachada
        const frente = 4.5 * c.escala + 1, fondo = 4 * c.escala;
        const d = c.lado * (dP + GROSOR + c.retiro + fondo / 2);
        const base = this.plataforma(c.s, d, frente + 0.5, fondo + 0.5, rumbo);
        this.casita(c.s, d, base, rumbo, frente, fondo, c.pisos * 2.7 + 0.2, c.tex, c.lado);
        continue;
      }
      if (typeof modelos.crearChoza !== "function") continue;
      const choza = modelos.crearChoza({ variante: c.variante });
      // El frente del modelo mira a +X: ese lado da a la trocha, así que su "ancho" va a lo largo de d
      const fondo = (choza.userData.ancho || 3.5) * c.escala, frente = (choza.userData.largo || 4.5) * c.escala;
      const d = c.lado * (dP + GROSOR + c.retiro + fondo / 2);
      const base = this.plataforma(c.s, d, frente + 0.6, fondo + 0.6, rumbo);
      this.aMundo(c.s, d, base, choza.position);
      choza.rotation.y = rumbo + (c.lado > 0 ? Math.PI : 0);
      choza.scale.set(c.escala, 0.92 + (c.escala - 0.85) * 0.4, c.escala);
      grupo.add(choza);
    }
    const t = this._terrazas;
    malla(t.lados, mat.pircaLisa);
    malla(t.tope, mat.tierra);
    malla(t.muros, mat.muroLateral);
    malla(t.techos, mat.techo);
    t.fachadas.forEach((f, i) => malla(f, mat.fachadas[i]));
    this._terrazas = null;
  }

  // Cuadrilátero en coordenadas locales (4 esquinas [x,y,z,u,v] en orden de tira)
  cuadLocal(buf, f, pts) {
    const base = buf.pos.length / 3;
    for (const [x, y, z, u, v] of pts) { buf.pos.push(...f(x, y, z)); buf.uv.push(u, v); }
    buf.idx.push(base, base + 1, base + 2, base + 1, base + 3, base + 2);
  }

  // Casita de ladrillo de 1–2 pisos sobre su terraza (se agrega a las mallas del bloque)
  casita(s, d, base, rumbo, frente, fondo, alto, tex, lado) {
    const t = this._terrazas, f = marcoLocal(this, s, d, this.muestra(s).y + base, rumbo);
    const x0 = -fondo / 2, x1 = fondo / 2, z0 = -frente / 2, z1 = frente / 2;
    const xFrente = lado < 0 ? x1 : x0, xAtras = lado < 0 ? x0 : x1;   // el frente mira a la trocha
    const vT = alto / 8.6;
    this.cuadLocal(t.fachadas[tex], f, [[xFrente, 0, z0, 0, 0], [xFrente, 0, z1, frente / 8, 0], [xFrente, alto, z0, 0, vT], [xFrente, alto, z1, frente / 8, vT]]);
    this.cuadLocal(t.muros, f, [[xAtras, 0, z0, 0, 0], [xAtras, 0, z1, frente / 8, 0], [xAtras, alto, z0, 0, vT], [xAtras, alto, z1, frente / 8, vT]]);
    for (const z of [z0, z1]) this.cuadLocal(t.muros, f, [[x0, 0, z, 0, 0], [x1, 0, z, fondo / 8, 0], [x0, alto, z, 0, vT], [x1, alto, z, fondo / 8, vT]]);
    this.cuadLocal(t.techos, f, [[x0, alto, z0, 0, 0], [x1, alto, z0, 1, 0], [x0, alto, z1, 0, 1], [x1, alto, z1, 1, 1]]);
  }

  // Terraza de pirca bajo algo apoyado en la ladera: nivela al punto más alto del terreno
  // y baja hasta el más bajo, para que nada quede flotando. Devuelve la altura de apoyo.
  // Forma: rectángulo de esquinas redondeadas con bordes irregulares y paredes en talud.
  plataforma(s, d, largoS, anchoD, rumbo) {
    let alto = -Infinity, bajo = Infinity;
    for (const fs of [-0.5, 0, 0.5]) for (const fd of [-0.5, 0, 0.5]) {
      const h = this.alturaTerreno(s + fs * largoS, d + fd * anchoD);
      alto = Math.max(alto, h); bajo = Math.min(bajo, h);
    }
    const base = alto + 0.15, fondoY = bajo - 0.4 - base;   // relativo a la base (negativo)
    const t = this._terrazas;
    if (!t) return base;
    const azar = rng(Math.round(s * 977 + d * 131));
    const f = marcoLocal(this, s, d, this.muestra(s).y + base, rumbo);
    const N = 14, contorno = [];
    for (let k = 0; k < N; k++) {
      const a = (k / N) * Math.PI * 2;
      // superelipse: casi rectangular pero sin aristas vivas
      const cx = Math.sign(Math.cos(a)) * Math.pow(Math.abs(Math.cos(a)), 0.35);
      const cz = Math.sign(Math.sin(a)) * Math.pow(Math.abs(Math.sin(a)), 0.35);
      const j = 0.92 + azar() * 0.14;
      contorno.push([cx * anchoD / 2 * j, cz * largoS / 2 * j]);
    }
    let dist = 0;
    for (let k = 0; k < N; k++) {
      const [ax, az] = contorno[k], [bx, bz] = contorno[(k + 1) % N];
      const largo = Math.hypot(bx - ax, bz - az);
      const talud = (fondoY / -2) * 0.25 + 0.15;          // más ancha abajo
      const ex = (x, z) => { const l = Math.hypot(x, z) || 1; return [x + (x / l) * talud, z + (z / l) * talud]; };
      const [aex, aez] = ex(ax, az), [bex, bez] = ex(bx, bz);
      this.cuadLocal(t.lados, f, [
        [aex, fondoY, aez, dist / 4, fondoY / 2], [bex, fondoY, bez, (dist + largo) / 4, fondoY / 2],
        [ax, 0, az, dist / 4, 0], [bx, 0, bz, (dist + largo) / 4, 0]]);
      dist += largo;
    }
    // Tope de tierra (abanico desde el centro)
    const b0 = t.tope.pos.length / 3;
    t.tope.pos.push(...f(0, 0.01, 0)); t.tope.uv.push(0, 0);
    for (const [x, z] of contorno) { t.tope.pos.push(...f(x, 0.01, z)); t.tope.uv.push(x / 4, z / 4); }
    for (let k = 0; k < N; k++) t.tope.idx.push(b0, b0 + 1 + ((k + 1) % N), b0 + 1 + k);
    return base;
  }

  // Un InstancedMesh por tipo de objeto repetido en el bloque (postes, focos, tanques…)
  instancias(grupo, lista, geo, material, posicion, giroExtra = null, sombra = true) {
    if (!lista.length) return;
    const inst = new THREE.InstancedMesh(geo, material, lista.length);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), esc = new THREE.Vector3(1, 1, 1), v = new THREE.Vector3();
    lista.forEach((o, k) => {
      // posicion(o) → [s, d, altura, absoluta]: altura sobre la calzada, o cota del mundo si absoluta
      const [s, d, y, absoluta] = posicion(o);
      const m = this.muestra(s);
      this.aMundo(s, d, 0, v);
      v.y = absoluta ? y : m.y + y;
      m4.compose(v, q.setFromEuler(e.set(0, -m.th + (giroExtra ? giroExtra(o) : 0), 0)), esc);
      inst.setMatrixAt(k, m4);
    });
    inst.castShadow = sombra;
    grupo.add(inst);
  }

  // Postes a lo largo del borde del mirador (un InstancedMesh por bloque)
  postesBarrera(grupo, a, b, d, cada, geo, material, alto) {
    const puestos = [];
    for (let s = Math.ceil((a * PASO) / cada) * cada; s < b * PASO; s += cada) puestos.push(s);
    if (!puestos.length) return;
    const inst = new THREE.InstancedMesh(geo, material, puestos.length);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), esc = new THREE.Vector3(1, 1, 1), v = new THREE.Vector3();
    puestos.forEach((s, k) => {
      this.aMundo(s, d, this.alturaLateral(d - 0.01, s) + alto, v);
      m4.compose(v, q.setFromEuler(e.set(0, -this.muestra(s).th, 0)), esc);
      inst.setMatrixAt(k, m4);
    });
    inst.castShadow = true;
    grupo.add(inst);
  }

  construirDetallesCerro(grupo, a, b, mat) {
    const s0 = a * PASO, s1 = b * PASO;
    const v = new THREE.Vector3();
    // Llantas pintadas (blanco / rojo) semienterradas en la berma
    const puestos = [];
    for (const t of this.llantas) {
      for (let s = Math.max(t.s0, s0); s < Math.min(t.s1, s1); s += 0.75) puestos.push([s, t.lado]);
    }
    if (puestos.length) {
      const inst = new THREE.InstancedMesh(mat.geoLlanta, mat.llantaPintada, puestos.length);
      const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), esc = new THREE.Vector3(1, 1, 1);
      const blanco = new THREE.Color(0xf2f2f2), rojo = new THREE.Color(0xc8102e);
      puestos.forEach(([s, lado], k) => {
        const m = this.muestra(s);
        this.aMundo(s, lado * (ANCHO / 2 + BERMA - 0.45), 0.05, v);
        e.set(0, -m.th + Math.PI / 2, 0, "YXZ");   // el aro mira hacia la trocha
        m4.compose(v, q.setFromEuler(e), esc);
        inst.setMatrixAt(k, m4);
        inst.setColorAt(k, k % 2 ? rojo : blanco);
      });
      inst.castShadow = true;
      grupo.add(inst);
    }
    // Cruz blanca en la cima del cerro
    if (this.cruz.s >= s0 && this.cruz.s < s1) {
      const cruz = new THREE.Group();
      const palo = new THREE.Mesh(new THREE.BoxGeometry(0.6, 9, 0.6), mat.cruz);
      palo.position.y = 4.5;
      const brazo = new THREE.Mesh(new THREE.BoxGeometry(4.5, 0.6, 0.6), mat.cruz);
      brazo.position.y = 6.6;
      cruz.add(palo, brazo);
      const rumbo = -this.muestra(this.cruz.s).th;
      const base = this.plataforma(this.cruz.s, this.cruz.d, 2.4, 2.4, rumbo);
      this.aMundo(this.cruz.s, this.cruz.d, base, cruz.position);
      cruz.rotation.y = rumbo;
      grupo.add(cruz);
    }
    // Ropa tendida entre dos palos junto a las chozas
    for (const t of this.tendederos) {
      if (t.s < s0 || t.s >= s1) continue;
      const d = t.lado * (ANCHO / 2 + BERMA + 1.5);
      const pA = this.aMundo(t.s - 3, d, this.alturaTerreno(t.s - 3, d));
      const pB = this.aMundo(t.s + 3, d, this.alturaTerreno(t.s + 3, d));
      for (const p of [pA, pB]) {
        const palo = new THREE.Mesh(mat.geoPalo, mat.posteMadera);
        palo.position.copy(p).add(v.set(0, 0.9, 0));
        grupo.add(palo);
      }
      // Ropa y alguna frazada (la de tigre no puede faltar)
      const sem = Math.round(t.s);
      for (let k = 1; k < 7; k++) {
        const frazada = k === 2 + (sem % 3);
        const geo = frazada ? mat.geoFrazadas[sem % 4] : mat.geoPrendas[(k + sem) % mat.geoPrendas.length];
        const prenda = new THREE.Mesh(geo, frazada ? mat.frazada : mat.ropa);
        prenda.position.lerpVectors(pA, pB, k / 7);
        prenda.position.y += 2.05 - Math.sin((k / 7) * Math.PI) * 0.2;
        prenda.rotation.y = -this.muestra(t.s).th + Math.PI / 2;
        grupo.add(prenda);
      }
    }
    // Cilindros azules de agua junto a algunas chozas de la primera fila
    const bidones = [];
    for (const c of this.chozas) {
      if (c.s < s0 || c.s >= s1 || c.variante === 2 || c.retiro > 4) continue;
      const d = c.lado * (ANCHO / 2 + BERMA + 0.9);
      const base = this.plataforma(c.s - 2.5, d, 1, 1, -this.muestra(c.s).th);
      bidones.push([c.s - 2.5, d, this.muestra(c.s - 2.5).y + base + 0.45]);
    }
    this.instancias(grupo, bidones, mat.geoCilindro, mat.cilindro, (b) => [b[0], b[1], b[2], true]);
  }

  construirFinal(escena) {
    // Arco de llegada en la avenida
    const s = this.largo - 60;
    const m = this.muestra(s);
    const g = new THREE.Group();
    const matPoste = new THREE.MeshStandardMaterial({ color: 0x333333 });
    for (const d of [-ANCHO / 2 - 0.5, ANCHO / 2 + 0.5]) {
      const p = new THREE.Mesh(new THREE.BoxGeometry(0.3, 6, 0.3), matPoste);
      p.position.set(d, 3, 0);
      g.add(p);
    }
    const lienzo = document.createElement("canvas");
    lienzo.width = 512; lienzo.height = 96;
    const c = lienzo.getContext("2d");
    c.fillStyle = "#c8102e"; c.fillRect(0, 0, 512, 96);
    c.fillStyle = "#ffd200"; c.font = "bold 54px sans-serif"; c.textAlign = "center"; c.textBaseline = "middle";
    c.fillText("AV. PRINCIPAL", 256, 50);
    const tex = new THREE.CanvasTexture(lienzo);
    tex.colorSpace = THREE.SRGBColorSpace;
    const cartel = new THREE.Mesh(new THREE.PlaneGeometry(ANCHO + 1.5, 1.4), new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide }));
    cartel.position.set(0, 5.6, 0);
    g.add(cartel);
    this.aMundo(s, 0, 0, g.position);
    g.rotation.y = -m.th;
    escena.add(g);
    this.final = g;
  }
}
