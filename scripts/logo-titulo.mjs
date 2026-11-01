// Genera el logo "¡Torito sin control!": letras de chapa vieja con remaches, óxido y bisagras.
// Uso: node scripts/logo-titulo.mjs  → assets/img/titulo.svg (dos líneas) y titulo-ancho.svg (una línea)
import fs from "node:fs";

const ALTO = 130;
const P = (...listas) => listas.map((l) => "M" + l.map((n, i) => n + (i % 2 ? " " : ",")).join("").trim() + "Z").join("");
const O_HUECO = [38, 30, 62, 30, 70, 38, 70, 92, 62, 100, 38, 100, 30, 92, 30, 38];
const LETRAS = {
  T: { w: 100, d: P([0, 0, 100, 0, 100, 30, 65, 30, 65, 130, 35, 130, 35, 30, 0, 30]), r: [[11, 15], [89, 15], [50, 117]] },
  O: { w: 100, d: P([20, 0, 80, 0, 100, 20, 100, 110, 80, 130, 20, 130, 0, 110, 0, 20], O_HUECO), r: [[15, 65], [85, 65], [50, 15], [50, 115]] },
  R: { w: 100, d: P([0, 0, 80, 0, 100, 20, 100, 60, 84, 74, 100, 130, 68, 130, 54, 80, 30, 80, 30, 130, 0, 130], [30, 30, 66, 30, 70, 34, 70, 46, 66, 50, 30, 50]), r: [[15, 15], [15, 115], [85, 40], [85, 117]] },
  I: { w: 34, d: P([0, 0, 34, 0, 34, 130, 0, 130]), r: [[17, 15], [17, 115]] },
  S: { w: 100, d: P([20, 0, 80, 0, 100, 20, 100, 40, 70, 40, 70, 30, 34, 30, 30, 34, 30, 46, 34, 50, 80, 50, 100, 70, 100, 110, 80, 130, 20, 130, 0, 110, 0, 90, 30, 90, 30, 100, 66, 100, 70, 96, 70, 84, 66, 80, 20, 80, 0, 60, 0, 20]), r: [[50, 15], [50, 115], [15, 38], [85, 92]] },
  N: { w: 104, d: P([0, 0, 30, 0, 74, 78, 74, 0, 104, 0, 104, 130, 74, 130, 30, 52, 30, 130, 0, 130]), r: [[15, 15], [15, 115], [89, 15], [89, 115]] },
  C: { w: 100, d: P([20, 0, 80, 0, 100, 20, 100, 42, 70, 42, 70, 38, 62, 30, 38, 30, 30, 38, 30, 92, 38, 100, 62, 100, 70, 92, 70, 88, 100, 88, 100, 110, 80, 130, 20, 130, 0, 110, 0, 20]), r: [[15, 65], [50, 15], [50, 115]] },
  L: { w: 90, d: P([0, 0, 30, 0, 30, 100, 90, 100, 90, 130, 0, 130]), r: [[15, 15], [15, 115], [78, 115]] },
  "!": { w: 34, d: P([0, 0, 34, 0, 28, 92, 6, 92], [3, 102, 31, 102, 31, 130, 3, 130]), r: [[17, 15]] },
  "¡": { w: 34, d: P([3, 0, 31, 0, 31, 28, 3, 28], [6, 38, 28, 38, 34, 130, 0, 130]), r: [[17, 115]] },
};

let semilla = 2026;
const azar = (a = 0, b = 1) => { semilla = (semilla * 16807) % 2147483647; return a + (semilla / 2147483647) * (b - a); };
const n1 = (x) => Math.round(x * 10) / 10;

let idClip = 0;
function chapa(l, x, y, gira, escala) {
  const L = LETRAS[l], id = `c${idClip++}`;
  let capas = "";
  for (let i = 9; i > 0; i -= 2) capas += `<path d="${L.d}" transform="translate(${i * 0.6} ${i})" fill="#8c0a1e" stroke="#4a0610" stroke-width="5" stroke-linejoin="round"/>`;
  capas += `<path d="${L.d}" fill="url(#pintura)" stroke="#5a0410" stroke-width="6" stroke-linejoin="round"/>`;
  let dentro = `<path d="${L.d}" transform="translate(2.5 3)" fill="none" stroke="#fff4b0" stroke-width="3" opacity=".75"/>`;
  dentro += `<path d="${L.d}" transform="translate(-2.5 -3)" fill="none" stroke="#b06a00" stroke-width="3" opacity=".7"/>`;
  for (let i = 0; i < 7; i++) {
    const cx = n1(azar(0, L.w)), cy = n1(azar(0, ALTO)), rx = n1(azar(6, 19)), ry = n1(azar(4, 12));
    dentro += `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" transform="rotate(${n1(azar(0, 180))} ${cx} ${cy})" fill="#b8631f" opacity="${n1(azar(0.2, 0.42))}"/>`;
    dentro += `<ellipse cx="${n1(cx + azar(-3, 3))}" cy="${n1(cy + azar(-2, 2))}" rx="${n1(rx * 0.4)}" ry="${n1(ry * 0.4)}" fill="#6e3410" opacity=".32"/>`;
  }
  for (let i = 0; i < 4; i++) {
    const x1 = n1(azar(0, L.w)), y1 = n1(azar(0, ALTO));
    dentro += `<path d="M${x1},${y1}l${n1(azar(-30, 30))},${n1(azar(-14, 14))}" stroke="#fffbe0" stroke-width="1.6" opacity=".7"/>`;
  }
  // Chorreado de óxido que baja de cada remache
  for (const [rx, ry] of L.r) dentro += `<path d="M${rx - 2},${ry}l-1,${n1(azar(12, 26))}l6,0l-1,-${n1(azar(10, 20))}Z" fill="#7a3a12" opacity=".6"/>`;
  const remaches = L.r.map(([rx, ry]) => `<circle cx="${rx}" cy="${ry}" r="6" fill="url(#remache)" stroke="#3a2a1c" stroke-width="1.6"/>`).join("");
  return `<g transform="translate(${n1(x)} ${n1(y)}) rotate(${gira} ${L.w / 2} 65) scale(${escala})"><clipPath id="${id}"><path d="${L.d}"/></clipPath>${capas}<g clip-path="url(#${id})">${dentro}</g>${remaches}</g>`;
}

// Bisagra: dos hojas de acero y un cañón con nudillos. (x, y) es el pasador.
function bisagra(x, y, largo = 58, ancho = 30, gira = 0) {
  const hoja = (lado) => `<path d="M0,${-largo / 2}L${lado * ancho},${-largo / 2 + 9}L${lado * ancho},${largo / 2 - 9}L0,${largo / 2}Z" fill="url(#acero)" stroke="#23262a" stroke-width="2.5" stroke-linejoin="round"/>`
    + `<circle cx="${lado * ancho * 0.62}" cy="${-largo / 4}" r="3.8" fill="#d9dde0" stroke="#23262a" stroke-width="1.5"/><path d="M${lado * ancho * 0.62 - 3},${-largo / 4 - 1}l6,2" stroke="#23262a" stroke-width="1.3"/>`
    + `<circle cx="${lado * ancho * 0.62}" cy="${largo / 4}" r="3.8" fill="#d9dde0" stroke="#23262a" stroke-width="1.5"/><path d="M${lado * ancho * 0.62 - 3},${largo / 4 + 1}l6,-2" stroke="#23262a" stroke-width="1.3"/>`
    + `<ellipse cx="${lado * ancho * 0.45}" cy="${n1(azar(-6, 6))}" rx="7" ry="11" fill="#9a4c1c" opacity=".6"/>`;
  const trozo = (largo - 8) / 3;
  let canon = "";
  for (let i = 0; i < 3; i++) canon += `<rect x="-6.5" y="${n1(-largo / 2 + 4 + i * trozo)}" width="13" height="${n1(trozo - 2)}" rx="4" fill="url(#canon)" stroke="#23262a" stroke-width="2"/>`;
  return `<g transform="translate(${n1(x)} ${n1(y)}) rotate(${gira})">${hoja(-1)}${hoja(1)}${canon}</g>`;
}

const DEFS = `<defs>
<linearGradient id="pintura" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffe45c"/><stop offset=".55" stop-color="#ffd200"/><stop offset="1" stop-color="#f09a00"/></linearGradient>
<linearGradient id="acero" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#c8ced2"/><stop offset=".5" stop-color="#858c92"/><stop offset="1" stop-color="#565c62"/></linearGradient>
<linearGradient id="canon" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#5a6066"/><stop offset=".4" stop-color="#eef1f3"/><stop offset="1" stop-color="#4a4f55"/></linearGradient>
<radialGradient id="remache" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#f4f4ec"/><stop offset=".5" stop-color="#a8a69c"/><stop offset="1" stop-color="#4c463c"/></radialGradient>
</defs>`;
const CSS = `<style>
.cuelga { animation: cuelga 3.6s ease-in-out infinite; }
@keyframes cuelga { 0%, 100% { transform: rotate(11deg); } 50% { transform: rotate(17deg); } }
@media (prefers-reduced-motion: reduce) { .cuelga { animation: none; transform: rotate(13deg); } }
</style>`;

const ESPACIO = 18;
function medir(texto, escala) {
  let w = 0;
  for (const c of texto) w += c === " " ? 46 * escala : (LETRAS[c].w + ESPACIO) * escala;
  return w - ESPACIO * escala;
}
// Devuelve las letras colocadas; `abrir` guarda dónde va la bisagra entre dos letras seguidas.
function linea(texto, x0, y, escala, inclinadas) {
  const fuera = [], pos = [];
  let x = x0, i = 0;
  for (const c of texto) {
    if (c === " ") { x += 46 * escala; pos.push(null); i++; continue; }
    const L = LETRAS[c], gira = inclinadas[i] ?? n1(azar(-1.6, 1.6));
    fuera.push(chapa(c, x, y + (i % 2 ? 2 : -2) * escala, gira, escala));
    pos.push({ x, w: L.w * escala });
    x += (L.w + ESPACIO) * escala;
    i++;
  }
  return { fuera, pos };
}
const entre = (pos, i) => pos[i].x + pos[i].w + (pos[i + 1].x - pos[i].x - pos[i].w) / 2;

function salida(ancho, alto, cuerpo) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${Math.ceil(ancho)} ${Math.ceil(alto)}" role="img" aria-label="¡Torito sin control!"><title>¡Torito sin control!</title>${DEFS}${CSS}${cuerpo}</svg>\n`;
}
// El "!" queda aparte: sujeto por abajo con una bisagra en la punta de la L, a punto de caerse
function exclamacion(xL, y, escala) {
  const px = xL + 24 * escala, py = y + 8 * escala;
  return `<g class="cuelga" style="transform-origin:${n1(px)}px ${n1(py)}px">${chapa("!", px - 17 * escala, py - 124 * escala, 0, escala)}</g>`
    + bisagra(px, py, 34 * escala, 24 * escala);
}

function dosLineas() {
  semilla = 2026;
  const eArriba = 1.4, eAbajo = 1, y1 = 22, y2 = y1 + ALTO * eArriba + 46;
  const w2 = medir("SIN CONTROL", eAbajo), ancho = w2 + 130, x2 = 30;
  const x1 = x2 + (w2 - medir("¡TORITO", eArriba)) / 2;
  const a = linea("¡TORITO", x1, y1, eArriba, { 0: -7, 4: 3, 6: -3 });
  const b = linea("SIN CONTROL", x2, y2, eAbajo, { 1: -3, 5: 2.5, 8: -2.5 });
  const hs = [
    bisagra(entre(a.pos, 1), y1 + 64, 66, 26),
    bisagra(entre(a.pos, 4), y1 + 124, 66, 26),
    bisagra(entre(b.pos, 0), y2 + 90, 54, 22),
    bisagra(entre(b.pos, 6), y2 + 36, 54, 22),
    bisagra(a.pos[2].x + 70, y2 - 13, 52, 25, 90),
    bisagra(a.pos[5].x + 70, y2 - 13, 52, 25, 90),
  ];
  const ult = b.pos[10];
  return salida(ancho, y2 + ALTO + 34, a.fuera.join("") + b.fuera.join("") + hs.join("") + exclamacion(ult.x + ult.w, y2 + 96, eAbajo));
}
function unaLinea() {
  semilla = 2026;
  const y = 18, x0 = 26;
  const c = linea("¡TORITO SIN CONTROL", x0, y, 1, { 0: -7, 4: 3, 9: -3, 13: 2.5, 16: -2.5 });
  const hs = [bisagra(entre(c.pos, 1), y + 58, 54, 22), bisagra(entre(c.pos, 8), y + 90, 54, 22), bisagra(entre(c.pos, 14), y + 40, 54, 22)];
  const ult = c.pos[18];
  return salida(x0 + medir("¡TORITO SIN CONTROL", 1) + 120, y + ALTO + 40, c.fuera.join("") + hs.join("") + exclamacion(ult.x + ult.w, y + 96, 1));
}

fs.writeFileSync(new URL("../assets/img/titulo.svg", import.meta.url), dosLineas());
fs.writeFileSync(new URL("../assets/img/titulo-ancho.svg", import.meta.url), unaLinea());
console.log("Logo generado");
