// Datos de cada nivel: solo números y textos, sin Three.js, para que también los lea el worker.
// El nivel 1 no tiene `tramos`: su calle la arma el trazado aleatorio del cerro en pista.js.
export const NIVELES = {
  1: {
    id: 1, ancho: 7, vereda: 1.6, fondo: 7, carril: 1.65, terreno: "cerro",
    deterioro: 1, rugosidad: 1, rocePlaya: 1,
    textoArco: "AV. PRINCIPAL",
    mensajeMeta: "¡Llegaste a la avenida con vida!",
  },
  2: {
    id: 2, ancho: 10.5, vereda: 2.4, fondo: 10, carril: 2.6, terreno: "llano", costa: true,
    deterioro: 0.3, rugosidad: 1, rocePlaya: 3, veredaLisa: true,
    textoArco: "PLAYA AGUA DULCE",
    avisoInicio: "¡Oh no, ahora el acelerador se trabó!",
    velocidadTrabada: 60 / 3.6, // m/s: el motor recupera 60 km/h después de frenar
    mensajeMeta: "¡Llegaste a la playa con vida!",
    // g: lo que se ve. gFis: lo que empuja a la moto (el acelerador trabado). Sin gFis, empuja la bajada real.
    // La suma de los largos es 2.800 m; la meta cae donde empieza el tramo con arena.
    tramos: [
      { barrio: "ciudad", largo: 600, g: 0.03, gFis: 0.12, curvas: 0.72, rMin: 42, rMax: 72, angMax: 1.1, rectaMax: 70, rectaBoca: 120 },
      { barrio: "sanIsidro", largo: 900, g: 0.015, gFis: 0.165, curvas: 0.68, rMin: 42, rMax: 78, angMax: 1.05, rectaMax: 75, rectaBoca: 130 },
      { barrio: "chorrillos", largo: 200, g: 0.04, gFis: 0.165, curvas: 0.8, rMin: 42, rMax: 62, angMax: 1.05, rectaMax: 50 },
      { barrio: "bajada", largo: 450, g: 0.18, gVar: 0.06, curvas: 0.85, rMin: 60, rMax: 84, angMax: 1.15, rectaMax: 45, mirador: "tramos" },
      { barrio: "malecon", largo: 500, g: 0.01, gFis: 0.14, curvas: 0.65, rMin: 50, rMax: 90, angMax: 0.95, rectaMax: 70, mirador: "corrido" },
      { barrio: "playa", largo: 150, g: 0.03, gFis: 0.03, curvas: 0, arena: true },
    ],
    // Reglas de lote por barrio: rangos [mínimo, máximo] y probabilidades
    barrios: {
      ciudad: { ancho: [10, 16], pisos: [4, 7], negocio: 0.7, jardin: 0, muro: 0.02, parque: 0.02, fachadas: [0, 1, 2, 3], letrero: true, sinCables: true },
      sanIsidro: { ancho: [12, 20], pisos: [6, 10], negocio: 0.55, jardin: 0.2, muro: 0, parque: 0.1, parqueLargo: [40, 70], fachadas: [4, 5, 6, 7], sinCables: true },
      chorrillos: { ancho: [7, 11], pisos: [2, 3], negocio: 0.3, jardin: 0.15, muro: 0.08, parque: 0.02, fachadas: [8, 9, 10], letrero: true },
      bajada: { ancho: [8, 12], pisos: [1, 3], negocio: 0.1, jardin: 0.1, muro: 0.25, parque: 0, fachadas: [8, 9, 10] },
      malecon: { ancho: [10, 14], pisos: [3, 5], negocio: 0.4, jardin: 0.15, muro: 0, parque: 0.03, fachadas: [1, 3, 5, 8, 9], letrero: true, sinCables: true },
      playa: { sinCasas: true, sinCables: true },
    },
    // Pesos del tráfico por lista de [tipo, peso]; sin toritos, animales ni obras.
    // El Corredor Azul solo anda por ciudad y San Isidro: de la bajada en adelante no hay buses.
    trafico: {
      estacionados: [["carro", 1]],
      suben: [["carro", 0.85], ["combi", 0.15]],
      bajan: [["carro", 0.85], ["combi", 0.15]],
      porBarrio: {
        ciudad: { suben: [["carro", 0.72], ["combi", 0.1], ["busAzul", 0.18]], bajan: [["carro", 0.68], ["combi", 0.1], ["busAzul", 0.22]] },
        sanIsidro: { suben: [["carro", 0.82], ["busAzul", 0.18]], bajan: [["carro", 0.78], ["busAzul", 0.22]] },
      },
      animales: false, obras: false,
    },
  },
};

export function nivelDe(id) { return NIVELES[id] || NIVELES[1]; }
