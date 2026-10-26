# ¡Sin Frenos! — Torito en bajada

Simulador 3D (Three.js) para móvil y PC: manejas un mototaxi (torito rojo) bajando un cerro de Lima. Empiezas en la trocha de tierra del cerro alto (chozas, pircas, Lima al fondo) y bajas a las calles con veredas variadas, miradores, baches, rompemuelles, obras, desmonte, tráfico, peatones, perros y gatos. En el modo original solo tienes un freno gastado que nunca detiene la moto; en Carrera controlas acelerador y freno completo. Si tomas una curva muy rápido el torito se levanta en dos ruedas y se vuelca. Tienes 3 vidas (corazones). Hay modo día y noche.

## Modos

En el inicio puedes elegir **Sin frenos** (bajada original con freno gastado) o **Carrera**: compite contra tres toritos rivales, sin peatones, animales, desmontes ni obras. Arranca detenido, acelera y usa el freno completo para controlar la bajada hasta la meta. Carrera supera los 40 km/h, conserva dirección a alta velocidad y permite tomar curvas sin volcar: la inclinación es visual y limitada. Los baches y saltos siguen presentes. Los rivales siguen la pista y adelantan con lógica local sencilla; no usan servicios externos. El HUD muestra posición y tiempo, y la llegada indica el puesto final. El modo elegido se guarda en el dispositivo.

Las veredas recuperan las escaleras características de los cerros de Lima, con peldaños, descansos y tramos de distintas longitudes. Se alternan con concreto inclinado, entradas rebajadas y tierra sin terminar. Cada lado de la calle tiene una distribución diferente.

La bajada cambia de barrio: chozas y pircas en el cerro, casas bajas de ladrillo y muros en la ladera, fachadas pintadas y negocios en la zona intermedia, y edificios más altos cerca de la avenida. El asfalto tiene reparaciones oscuras con textura, grietas y huellas en algunas curvas; son detalles visuales. Las veredas tienen canto exterior y terreno de apoyo. El fondo usa la imagen de Lima sobre una esfera cerrada, adaptada también al modo noche.

La vibración inicial es **Suave**. Si ya elegiste otro nivel, se conserva tu preferencia guardada.

Algunos muros llevan grafitis con textura, alternados con paredes de pintura gastada. Los carros, combis y buses tienen texturas laterales y frontales.

## Controles
| | Celular (horizontal) | PC |
|---|---|---|
| Dirección | tocar cualquier zona libre de la mitad izquierda/derecha, o girar el teléfono | ← → / A D |
| Acelerador (Carrera) | ACELERAR | W / ↑ |
| Freno (completo en Carrera; gastado en Sin frenos) | FRENO | S / ↓ / Espacio |
| Claxon | — | H |
| Cámara 1ª / 3ª persona | 🎥 | C |
| Pausa | ❚❚ | P / Esc |

En iPhone se pide permiso al sensor al tocar *JUGAR*. Si el giro sale al revés, usa *Invertir giro* en el inicio. El modo noche se elige en el inicio.

En celular hay un freno en cada lado y no se muestra botón de claxon. Ambos frenos admiten pulsaciones simultáneas. Los carros, combis y buses tienen texturas de carrocería generadas, guardadas en `assets/tex/*-lima-v1.jpg`; los prompts están en `scripts/texturas-vehiculos.json`. Los buses circulan en los sectores asfaltados.

El botón **centrar** permanece accesible en celular. Los choques que consumen una vida y la reaparición limpian la dirección pendiente; los sensores dejan de dirigir cuando no entregan lecturas recientes.

## Estructura
- `js/main.js`: render, cámaras, HUD y flujo de juego
- `js/pista.js`: generación procedural de la calle (tramos, escaleras, casas, baches)
- `js/ambiente.js`: letreros pintados de los negocios
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
