# ¡Sin Frenos! — Torito en bajada

Simulador 3D (Three.js) para móvil y PC: manejas un mototaxi (torito rojo) que se quedó sin frenos bajando un cerro de Lima. Empiezas en la trocha de tierra del cerro alto (chozas, pircas, Lima al fondo) y bajas a las calles con veredas en escalera, miradores, baches, rompemuelles, obras, desmonte, tráfico, peatones, perros y gatos. Solo tienes un freno gastado que nunca detiene la moto; si tomas una curva muy rápido el torito se levanta en dos ruedas y se vuelca. Tienes 3 vidas (corazones). Hay modo día y noche.

## Controles
| | Celular (horizontal) | PC |
|---|---|---|
| Dirección | girar el teléfono como timón | ← → / A D |
| Freno (se gasta, no detiene) | FRENO | S / ↓ / Espacio |
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

## Publicar en GitHub Pages
Sube el repo y activa *Settings → Pages → Deploy from a branch → `main` / root*.
