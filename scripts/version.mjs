// Cambia la versión del juego en todos los archivos (evita que el navegador use JS/CSS viejos de la caché).
// Uso: node scripts/version.mjs 0.6.0
import fs from "node:fs";

const nueva = process.argv[2];
if (!/^\d+\.\d+\.\d+$/.test(nueva || "")) {
  console.error("Uso: node scripts/version.mjs X.Y.Z");
  process.exit(1);
}
const archivos = ["index.html", ...fs.readdirSync("js").filter((f) => f.endsWith(".js")).map((f) => `js/${f}`)];
for (const ruta of archivos) {
  const antes = fs.readFileSync(ruta, "utf8");
  const despues = antes
    .replace(/\.(js|css)\?v=[\d.]+/g, `.$1?v=${nueva}`)
    .replace(/(<span id="version"[^>]*>)v[\d.]+(<\/span>)/g, `$1v${nueva}$2`);
  if (despues !== antes) fs.writeFileSync(ruta, despues);
}
console.log(`Versión ${nueva} aplicada`);
