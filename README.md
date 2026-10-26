# ¡Sin Frenos! — Torito en bajada

## Estado para retomar — 25/10/2026

**Versión actual: v1.1.0**, commit `496cdae`, publicada en GitHub (`main`). Falta probarla en un celular real.

### Novedades de v1.0.1 y v1.1.0

- **Carga por tramos:** `pista.js` describe cada bloque de 60 m solo con datos (arreglos de números y claves de material). `tramos.js` mantiene armados unos 100 m atrás y 420 m adelante, y libera el resto. JUGAR arranca en unos 40 ms.
- **Web Worker** (`obrero-pista.js`): calcula los bloques de adelante con la misma semilla que el hilo principal. Si un bloque está a menos de 70 m y no llegó, o si no hay soporte de workers, se calcula en el hilo principal. `js/three.js` hace de puente porque los workers no usan el importmap.
- **Reciclaje** (`reciclaje.js`): reserva compartida por clave (`torito|i`, `persona|tipo`, `choza|v`…) para el tráfico, las chozas y los contenedores de mallas.
- **Shaders precompilados al cargar.** La calidad automática ya no apaga las sombras (eso recompilaba todo y congelaba unos 7 s): solo achica el mapa de sombra y lo actualiza cuadro por medio.
- **Celular en vertical u horizontal**, sin bloqueo de orientación. En vertical: botones chicos, resaltado solo en la flecha, primera persona con el mundo grande y el manubrio a escala (valores en el objeto `VERTICAL` de `main.js`), y tercera persona más alejada.
- Veredas de tierra izquierdas sin huecos (material de tierra a doble cara). Barra de freno con borde amarillo mientras se gasta. Toritos del tráfico azules, verdes o amarillos, solos o con blanco.

Verificado: `node scripts/verificar-juego.mjs`, la sintaxis de todos los JS y una sonda de rayos en Firefox (0 huecos en veredas). En Firefox también se comprobó la carga por tramos sin errores, 50 FPS tras saltar 300 m, la ausencia del congelamiento de 7 s y los modos vertical y horizontal simulados.

**Próximo paso:** probar v1.1.0 en un celular real (primera persona vertical, botones, tirones al avanzar, timón tras chocar). Pendiente como idea: alargar la vía o agregar una zona nueva; la carga por tramos ya lo permite sin costo por cuadro. Límite conocido en vertical: los puños quedan fuera de cuadro y el techo ocupa cerca de un 20% en subidas.

**Preferencias del usuario:**
- Probar en Firefox, nunca en Chrome, y sin descargar navegadores ni Playwright. Para pruebas automáticas se usa Firefox con `--remote-debugging-port` y WebDriver BiDi desde Node.
- El código lo escribe Claude; el plugin de imágenes solo genera texturas e ilustraciones.

### Implementado en v1.0.0

- Carrera con acelerador, freno completo, tres bots, posición y puesto final. Sin peatones, animales, desmontes ni obras. Puede superar 40 km/h; no hay un límite de 40. Doblar produce inclinación visual sin vuelco.
- Controles de celular: zonas de dirección en ambas mitades, flechas grandes a media altura, freno en ambos lados, sin botón de claxon y centrado siempre accesible.
- Vibración inicial Suave, respetando una selección guardada. En Carrera se redujeron un 10 % los máximos de vibración, conservando las vibraciones suaves.
- Barrios diferenciados, escaleras y veredas variadas, muros pintados, grafitis, comercios, y texturas laterales y frontales para carros, combis y buses. Los originales generados se conservaron; los JPG que usa el juego y los prompts están en el repositorio.
- Últimas correcciones solicitadas: quitar manchas crema del asfalto; corregir las coordenadas de textura de las reparaciones oscuras; retirar los edificios lejanos que parecían bloques blancos; restaurar la imagen de Lima sobre una esfera cerrada; cerrar los cantos exteriores de las veredas y agregar terreno de apoyo.
- Para el timón pegado hacia la izquierda tras chocar: liberar punteros también fuera del botón, descartar lecturas antiguas del sensor y limpiar la dirección al perder una vida/reaparecer. No se cambia automáticamente la calibración del sensor al chocar; el jugador puede usar Centrar.

Verificado: sintaxis JS, pruebas de `scripts/verificar-juego.mjs`, simulación de tres bots hasta la meta, construcción de geometrías completas con una copia local de Three.js 0.160.0, superficies frontales de los tres vehículos, cobertura del fondo en 648 direcciones y entrega de las siete texturas por HTTP. Los cambios finales todavía requieren revisión visual y de sensores en un celular real; no se midió su rendimiento en dispositivo.

Para retomar, ejecutar desde la raíz:

```sh
python -m http.server 8080 --bind 0.0.0.0
```

Abrir `http://localhost:8080`. En celular, usar la IP actual de la PC y el mismo Wi-Fi; durante esta sesión fue `http://192.168.100.80:8080`. El servidor local se apaga al cerrar esta sesión. Para los sensores en un teléfono remoto se necesita HTTPS; por HTTP en la red local se pueden probar los botones táctiles. Ejecutar `node scripts/verificar-juego.mjs` para repetir las pruebas sin dependencias. Al cambiar la versión, usar `node scripts/version.mjs X.Y.Z`.

## Descripción

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
- `js/pista.js`: generación procedural de la calle (trazado, escaleras, casas, baches); cada bloque se describe como datos
- `js/tramos.js`: carga por tramos (arma y libera bloques, monta los datos como mallas)
- `js/obrero-pista.js`: Web Worker que calcula los bloques; `js/three.js`: puente a Three.js por URL
- `js/reciclaje.js`: reserva de modelos reutilizables
- `js/ambiente.js`: letreros pintados de los negocios
- `js/vehiculo.js`: física (pendiente, freno, vuelco, saltos, choques)
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
