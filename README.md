# ¡Torito sin control!

Te cortaron el cable del freno. Baja en mototaxi desde un cerro de Lima hasta la playa, esquiva lo que venga y llega entero. Simulador 3D para navegador, en celular o PC.

**[▶ Jugar ahora](https://bryanlizana.github.io/test-game-004/)** — no requiere instalación.

![Pantalla de inicio de ¡Torito sin control!](assets/capturas/inicio.jpg)

| Primera persona | Tercera persona |
|---|---|
| ![Vista desde la cabina del torito en un barrio de calles pintadas](assets/capturas/primera-persona.jpg) | ![Torito bajando por la trocha de tierra con Lima al fondo](assets/capturas/tercera-persona.jpg) |

| Carrera | Noche |
|---|---|
| ![Carrera contra toritos rivales en la trocha](assets/capturas/carrera.jpg) | ![Bajada de noche con las luces de Lima al fondo](assets/capturas/noche.jpg) |

## De qué se trata

Empiezas en la trocha de tierra del cerro alto y sigues en una sola partida por la avenida, la ciudad, San Isidro, Chorrillos y el malecón hasta la playa. Los primeros 90 m de tierra no tienen muros; después vuelven las pircas. Por el camino cambian los barrios y aparecen baches, rompemuelles, obras, desmonte, tráfico, peatones, perros y gatos.

Un túnel conecta el cerro con la ciudad, sin pantalla de carga: conservas vidas, daño, freno y tiempo. Al entrar aparece «¡Oh no, ahora el acelerador se trabó!» y el motor empuja hasta 60 km/h, aunque las bajadas fuertes pueden superar esa velocidad.

La ciudad tiene curvas cerradas, cruces con semáforos donde salen autos de las calles laterales, buses azules parados en sus paraderos, bicicletas por toda la calle y deportivos que vienen de frente. La llegada se celebra en la playa: la moto sigue rodando sola sobre la arena hasta pararse, con los resultados en pantalla.

El freno nunca detiene la moto y solo aguanta 5 segundos: mientras frenas se corta el acelerador, se recarga despacio al soltarlo y, si lo vacías, queda bloqueado 5 segundos. Si tomas una curva muy rápido, el torito se levanta en dos ruedas y se vuelca.

### Pirañitas

Por la calle flotan botellitas de gaseosa amarilla con tapa azul. Cada una da medio corazón, hasta un corazón extra. Un choque siempre quita un corazón entero.

### Rutas

Cada partida sale de un número de ruta. Al terminar puedes repetirla o guardarla, y en el menú puedes escribir un número o elegir una guardada para volver a jugarla. También sirve en la dirección: `?ruta=123456`. La ruta repite la calle y las pirañitas; el tráfico cambia cada vez.

### Cómicos de barrio

En la versión web, por las veredas bailan monigotes con disfraces caseros, como homenaje a los imitadores de la comedia peruana. Son figuras inventadas, y se apartan a tiempo: no se les puede atropellar.

## Modos

| Modo | Vidas | En qué consiste |
|---|---|---|
| **Sin frenos** | 4 | La ruta completa, con todos los obstáculos. |
| **Carrera** | 8 | La misma ruta y la misma física contra tres toritos rivales. Hay autos que suben por el carril contrario y personas que cruzan, pero no animales ni obras. |

Se puede jugar de día o de noche, y en primera o tercera persona. OTRA VEZ empieza una ruta nueva desde el cerro.

## Controles

| Acción | Celular | PC |
|---|---|---|
| Dirección | Tocar la mitad izquierda o derecha de la pantalla | ← → / A D |
| Freno | Tocar el cuarto inferior de la pantalla | S / ↓ / Espacio |
| Claxon | — | H |
| Cambiar de cámara | 🎥 | C |
| Pausa | ❚❚ | P / Esc |

En celular funciona en vertical y en horizontal.

## Ejecutar en local

El juego no tiene compilación ni dependencias que instalar, pero necesita un servidor HTTP porque usa módulos ES y un Web Worker. Desde la raíz del repositorio:

```sh
python -m http.server 8080
```

Luego abre <http://localhost:8080>. También sirve `npx serve .`. Se necesita conexión a internet, porque Three.js se carga desde jsDelivr.

Para repetir las pruebas de física, controles y geometría (requiere Node.js, sin dependencias):

```sh
node scripts/verificar-juego.mjs
```

## Cómo está hecho

- **Tecnología:** JavaScript en módulos ES y [Three.js](https://threejs.org/) 0.160. El sonido es sintetizado.
- **Mundo procedural:** la calle se genera por bloques a partir de una semilla. Un Web Worker los calcula y se cargan y liberan según avanzas.
- **Texturas e ilustraciones:** generadas con IA. Los prompts están en [`assets/imagegen-prompts.txt`](assets/imagegen-prompts.txt) y [`scripts/texturas-vehiculos.json`](scripts/texturas-vehiculos.json).

| Ruta | Contenido |
|---|---|
| `js/main.js` | Render, cámaras, HUD y flujo de juego |
| `js/pista.js` | Generación de la calle, el terreno y los barrios |
| `js/tramos.js` | Carga y liberación de bloques |
| `js/obrero-pista.js` | Web Worker que calcula los bloques |
| `js/vehiculo.js` | Física: pendiente, freno, vuelco, saltos y choques |
| `js/trafico.js` | Vehículos, rivales, peatones y animales |
| `js/niveles.js` | Datos de cada zona: tramos, barrios y tráfico |
| `js/paso-urbano.js` | Túnel entre el cerro y la ciudad |
| `js/kolas.js` | Pirañitas flotantes |
| `js/imitadores.js` | Cómicos de barrio en las veredas |
| `js/modelos.js`, `js/modelos-nivel2.js` | Modelos 3D procedurales (los primeros se ven en `pruebas/modelos.html`) |
| `js/controles.js`, `js/audio.js` | Entrada y sonido |
| `scripts/version.mjs` | Actualiza la versión en todos los archivos: `node scripts/version.mjs X.Y.Z` |
| `scripts/logo-titulo.mjs` | Genera el logo del título en `assets/img/` |

## Licencia

Este proyecto se distribuye bajo la [GNU General Public License v3.0](LICENSE). Three.js, que se carga desde jsDelivr, tiene su propia licencia MIT.
