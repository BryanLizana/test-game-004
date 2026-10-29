# ¡Sin Frenos! — Torito en bajada

## Estado para retomar — 27/10/2026

**Versión actual: v1.4.1** (sin publicar). Falta probarla en un celular real.

### Novedades de v1.4.1

- **Terreno único sin huecos:** el cerro ya no son franjas que salen de cada tramo de calle (en curvas cerradas dejaban grietas y paredones). Ahora es una cuadrícula de losas de 120 m (`datosLosa` en `pista.js`) con una sola altura para todo el mapa (`alturaMundo`): un plano inclinado hacia la montaña, corregido cerca de la calle por lo que la calle realmente baja, y un rellano bajo la calzada hasta el fondo de las casas o la pirca. Las losas vecinas empalman sin rendijas.
- **Carga por distancia real:** `tramos.js` carga y muestra los bloques de calle y las losas cuya caja quede a menos de 300 m del torito, además de lo que toca por metros de calle. Antes, en las curvas, el cerro de un tramo ya pasado desaparecía delante.
- **Niebla del color del cielo** (`niebla.js`): lo lejano se funde con la foto del cielo en esa dirección, no con un gris parejo (eso se veía como trozos blancos sobre Lima).
- **Parques con texturas** (generadas con Codex): `follaje.jpg` en copas y arbustos, `corteza.jpg` en troncos, `banca.jpg` en bancas y `camino-parque.jpg` en el caminito.
- **Toritos gastados:** carrocería, techo, guardabarros y barandas amarillas usan `pintura-gastada.jpg` (generada con Codex) con `mPinturaGastada` en `modelos.js`. La lata toma el color del torito un poco desteñido, con rayones, polvo y chorreados; el óxido y la base al descubierto (píxeles saturados de la foto) quedan sin teñir. El cromo ya no brilla como espejo.

### Novedades de v1.4.0

- **Cielo 360° sin costura** (`cielo-v2.jpg`, generado con Codex; `cielo.jpg` queda de respaldo): ya no se ve el corte entre el mar y los cerros al girar.
- **Cerro continuo:** la ladera ya no se arma por casa (dejaba pedazos sueltos y huecos). Ahora es una sola franja a cada lado de la pista, hasta 150 m, desde la pirca, la baranda del mirador o el fondo de las casas (`construirLadera`). `calcularAlcanceLadera` corta cada franja antes de que tape otro tramo de la calle o se doble en el lado de adentro de las curvas, y un faldón de 25 m en el borde tapa lo que queda debajo.
- **Jardines y parques:** algunas casas (no las tiendas ni los muros) se retiran 2,4–3,6 m de la vereda y dejan un jardín elevado con murete, reja verde (`reja.png`), pasto (`pasto.jpg`), arbustos y a veces un árbol. También hay parques de barrio (lotes de 14–22 m) con pasto, caminito, bancas, árboles y muro de contención contra el cerro. Texturas generadas con Codex.

### Novedades de v1.3.2

- **Toritos con frente y parte trasera fotográficos** (`torito-frente-lima-v1.jpg` y `torito-atras-lima-v1.jpg`, generados con Codex; prompts en `scripts/texturas-vehiculos.json`). El panel negro, la franja reflectiva, las direccionales, los stops, la placa y la ventanita vienen en la imagen; se quitaron las cajitas que los imitaban. Vale para el torito del jugador y los de tráfico.
- La pintura toma el color del torito según `torito-*-lima-v1-mascara.png`: rojo = carrocería, verde = pared trasera de la cabina (blanca en los toritos de dos tonos). `mFotoPintada` ahora acepta un segundo color.
- El lente 3D del faro usa el vidrio de la foto y sigue encendiéndose de noche.

### Novedades de v1.3.1

- **Frente y parte trasera fotográficos** para sedán, combi y bus (`*-frente-lima-v2.jpg` y `*-atras-lima-v2.jpg`, generados con Codex; prompts en `scripts/texturas-vehiculos.json`). Faros, stops, parrilla, placas y parachoques vienen en la imagen; se quitaron las cajitas que los imitaban.
- En el sedán solo la pintura toma el color del auto, según la máscara `carro-*-lima-v2-mascara.png` (`mFotoPintada` en `modelos.js`); luces y placa quedan como en la foto.
- **Tercera persona más alta** (3,6 m) y mirando 16 m adelante, a la altura real de la pista: el torito queda abajo y se ve la calle para esquivar.
- Pendiente: de noche los faros y stops de los autos ya no brillan.

### Novedades de v1.3.0

- **Carrera = Sin frenos con rivales:** misma física que el modo original (sin aceleración automática, freno gastado, vuelco en curvas y el manubrio limitado por la velocidad). Se quitaron el agarre arcade y la aceleración de v1.2.0. Arranca a 4 m/s, igual que Sin frenos.
- **Rivales con la misma bajada:** usan `aceleracionBajada` de `vehiculo.js` (la misma que el jugador) con un roce del motor un 4 % mayor, igual o un 4 % menor. Solo usan el freno gastado en curvas cerradas o cuando no pueden adelantar.
- **Tráfico en Carrera:** autos, toritos, combis y buses que suben por el carril contrario (más seguido que en Sin frenos); gente que sube caminando por el borde de la calzada; personas que cruzan en las esquinas cuando se acerca el jugador o un rival. Sin animales, obras, desmonte ni autos estacionados.
- **Los rivales chocan y se retrasan:** con un auto quedan 3 s parados y el auto 3 s detenido; con una persona, 2 s. Mientras esperan se corren al otro carril. Si pasa cerca aparece el aviso «¡Rival N chocó!».
- **8 corazones en Carrera** (3 en Sin frenos).

Verificado: `node scripts/verificar-juego.mjs` (velocidad final igual a la del jugador, autos y personas que suben, retraso tras chocar) y una simulación en 5 pistas reales: con un jugador que no frena, los rivales llegan entre 2 y 10 s después (≈150–175 s). Falta probarlo en el navegador.

### Novedades de v1.2.1

- Toritos del tráfico y rivales solo en azul, verde, amarillo y rojo, con cabina blanca (costados, pared trasera y techo) y carenado, faldón, guardabarro y barandas del techo de color. Los rivales de Carrera salen azul, verde y amarillo.
- Corregido: el caché del modelo bajo no distinguía el color del techo.

### Novedades de v1.2.0

- **Carrera sin acelerador:** el torito acelera solo; el freno corta la aceleración.
- **Choques con los rivales:** de costado se empujan hacia afuera; por detrás, el de atrás frena y empuja al de adelante. Hay daño, pero no se pierde vida.
- **Agarre en curvas (solo Carrera):** la moto sigue el 80 % de la curva y, sin timón, se alinea con la calle (`ASISTE_CURVA` y `AGARRE_CARRERA` en `vehiculo.js`).
- **Celular:** el cuarto inferior de la pantalla es zona de freno; los botones FRENO se ven igual y se iluminan. Se quitaron el giroscopio, *centrar*, *Recentrar timón* e *Invertir giro*.
- **Vibración Suave más fuerte:** `0.2 + 0.4 · v/25` (antes `0.15 + 0.35`), cerca del 60 % de Normal a toda velocidad.

### Novedades de v1.0.1 y v1.1.0

- **Carga por tramos:** `pista.js` describe cada bloque de 60 m solo con datos (arreglos de números y claves de material). `tramos.js` mantiene armados unos 100 m atrás y 420 m adelante, y libera el resto. JUGAR arranca en unos 40 ms.
- **Web Worker** (`obrero-pista.js`): calcula los bloques de adelante con la misma semilla que el hilo principal. Si un bloque está a menos de 70 m y no llegó, o si no hay soporte de workers, se calcula en el hilo principal. `js/three.js` hace de puente porque los workers no usan el importmap.
- **Reciclaje** (`reciclaje.js`): reserva compartida por clave (`torito|i`, `persona|tipo`, `choza|v`…) para el tráfico, las chozas y los contenedores de mallas.
- **Shaders precompilados al cargar.** La calidad automática ya no apaga las sombras (eso recompilaba todo y congelaba unos 7 s): solo achica el mapa de sombra y lo actualiza cuadro por medio.
- **Celular en vertical u horizontal**, sin bloqueo de orientación. En vertical: botones chicos, resaltado solo en la flecha, primera persona con el mundo grande y el manubrio a escala (valores en el objeto `VERTICAL` de `main.js`), y tercera persona más alejada.
- Veredas de tierra izquierdas sin huecos (material de tierra a doble cara). Barra de freno con borde amarillo mientras se gasta. Toritos del tráfico de colores (ver v1.2.1).

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

Simulador 3D (Three.js) para móvil y PC: manejas un mototaxi (torito rojo) bajando un cerro de Lima. Empiezas en la trocha de tierra del cerro alto (chozas, pircas, Lima al fondo) y bajas a las calles con veredas variadas, miradores, baches, rompemuelles, obras, desmonte, tráfico, peatones, perros y gatos. En los dos modos solo tienes un freno gastado que nunca detiene la moto. Si tomas una curva muy rápido el torito se levanta en dos ruedas y se vuelca. Tienes 3 vidas (corazones) en Sin frenos y 8 en Carrera. Hay modo día y noche.

## Modos

En el inicio puedes elegir **Sin frenos** (bajada original con freno gastado) o **Carrera**: la misma bajada sin frenos, con la misma física y velocidad, contra tres toritos rivales. Suben autos, toritos, combis y buses por el carril contrario, sube gente caminando por el borde y cruzan personas en las esquinas; no hay animales, obras, desmonte ni autos estacionados. Tienes 8 vidas. Los rivales bajan con la misma física que el jugador (`aceleracionBajada` en `vehiculo.js`), frenan con el freno gastado en curvas cerradas y adelantan con lógica local sencilla. Si chocan con un auto o una persona se quedan parados unos segundos. Puedes chocar a los rivales: se empujan de costado o por detrás y se reparten la velocidad, sin perder vida. El HUD muestra posición y tiempo, y la llegada indica el puesto final. El modo elegido se guarda en el dispositivo.

Las veredas recuperan las escaleras características de los cerros de Lima, con peldaños, descansos y tramos de distintas longitudes. Se alternan con concreto inclinado, entradas rebajadas y tierra sin terminar. Cada lado de la calle tiene una distribución diferente.

La bajada cambia de barrio: chozas y pircas en el cerro, casas bajas de ladrillo y muros en la ladera, fachadas pintadas y negocios en la zona intermedia, y edificios más altos cerca de la avenida. El asfalto tiene reparaciones oscuras con textura, grietas y huellas en algunas curvas; son detalles visuales. Las veredas tienen canto exterior y terreno de apoyo. El fondo usa la imagen de Lima sobre una esfera cerrada, adaptada también al modo noche.

La vibración inicial es **Suave**. Si ya elegiste otro nivel, se conserva tu preferencia guardada.

Algunos muros llevan grafitis con textura, alternados con paredes de pintura gastada. Los carros, combis y buses tienen texturas laterales y frontales.

## Controles
| | Celular (horizontal) | PC |
|---|---|---|
| Dirección | tocar los 3/4 de arriba de la mitad izquierda/derecha | ← → / A D |
| Freno gastado | tocar cualquier punto del cuarto de abajo de la pantalla (los botones FRENO lo indican) | S / ↓ / Espacio |
| Claxon | — | H |
| Cámara 1ª / 3ª persona | 🎥 | C |
| Pausa | ❚❚ | P / Esc |

El modo noche se elige en el inicio. El giroscopio (dirigir inclinando el teléfono), el botón *centrar*, *Recentrar timón* e *Invertir giro* se quitaron por ahora: en celular solo se dirige con las zonas táctiles.

En celular hay un freno en cada lado y no se muestra botón de claxon. Ambos frenos admiten pulsaciones simultáneas. Los carros, combis y buses tienen texturas de carrocería generadas, guardadas en `assets/tex/*-lima-v1.jpg`; los prompts están en `scripts/texturas-vehiculos.json`. Los buses circulan en los sectores asfaltados.

Los choques que consumen una vida y la reaparición limpian la dirección pendiente.

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

Para verificar la física de los modos, los controles multitáctiles y las geometrías de vereda sin instalar dependencias: `node scripts/verificar-juego.mjs`. Estas pruebas no reemplazan la revisión visual y de sensores en un celular real.

## Publicar en GitHub Pages
Sube el repo y activa *Settings → Pages → Deploy from a branch → `main` / root*.
