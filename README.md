# ¡Sin Frenos! — Torito en bajada

Simulador 3D (Three.js) para móvil y PC: manejas un mototaxi (torito rojo) bajando un cerro de Lima. Empiezas en la trocha de tierra del cerro alto (chozas, pircas, Lima al fondo) y bajas a las calles con veredas variadas, miradores, baches, rompemuelles, obras, desmonte, tráfico, peatones, perros y gatos. En el modo original solo tienes un freno gastado que nunca detiene la moto; en Carrera controlas acelerador y freno completo. Si tomas una curva muy rápido el torito se levanta en dos ruedas y se vuelca. Tienes 3 vidas (corazones). Hay modo día y noche.

## Modos

En el inicio puedes elegir **Sin frenos** (bajada original con freno gastado) o **Carrera**: arranca detenido, acelera y usa el freno completo para controlar la bajada hasta la meta. Carrera supera los 40 km/h, conserva dirección a alta velocidad y permite tomar curvas sin volcar: la inclinación es visual y limitada. Los choques, baches y saltos siguen presentes. Carrera muestra el tiempo durante la partida. El modo elegido se guarda en el dispositivo.

Las veredas combinan concreto inclinado con juntas, entradas rebajadas, tramos de tierra sin terminar y escaleras en algunos sectores empinados. Cada lado de la calle tiene una distribución diferente.

## Controles
| | Celular (horizontal) | PC |
|---|---|---|
| Dirección | tocar cualquier zona libre de la mitad izquierda/derecha, o girar el teléfono | ← → / A D |
| Acelerador (Carrera) | ACELERAR | W / ↑ |
| Freno (completo en Carrera; gastado en Sin frenos) | FRENO | S / ↓ / Espacio |
| Claxon | 📯 | H |
| Cámara 1ª / 3ª persona | 🎥 | C |
| Pausa | ❚❚ | P / Esc |

En iPhone se pide permiso al sensor al tocar *JUGAR*. Si el giro sale al revés, usa *Invertir giro* en el inicio. El modo noche se elige en el inicio.

## Estructura
- `js/main.js`: render, cámaras, HUD y flujo de juego
- `js/pista.js`: generación procedural de la calle (tramos, escaleras, casas, baches)
- `js/vehiculo.js`: física (pendiente, cambios, vuelco, saltos, choques)
- `js/trafico.js`: vehículos, peatones y perros
- `js/modelos.js`: modelos 3D procedurales (`pruebas/modelos.html` para verlos)
- `js/controles.js` y `js/audio.js`: entrada y sonido sintetizado
- `assets/tex/`: texturas generadas con Codex

## Jugar en local
```sh
npx serve .
```
El giroscopio solo funciona con HTTPS (GitHub Pages lo cumple) o en `localhost`.

Para verificar la física de los modos, los controles multitáctiles y las geometrías de vereda sin instalar dependencias: `node scripts/verificar-juego.mjs`. Estas pruebas no reemplazan la revisión visual y de sensores en un celular real.

## Publicar en GitHub Pages
Sube el repo y activa *Settings → Pages → Deploy from a branch → `main` / root*.
