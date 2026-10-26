// Reservas de modelos reutilizables: lo que sale de la vista vuelve aquí y se reusa más adelante,
// en vez de crear y descartar modelos nuevos todo el tiempo (menos basura, menos tirones).
export class Reserva {
  constructor(limite = 24) {
    this.limite = limite;      // máximo guardado por clave; el resto se libera
    this.cajas = new Map();
  }

  // Saca un modelo guardado con esa clave o crea uno nuevo. Quien lo recibe debe reiniciar
  // su posición, rotación y pose.
  tomar(clave, crear) {
    const caja = this.cajas.get(clave);
    const guardado = caja && caja.pop();
    if (guardado) {
      guardado.visible = true;
      return guardado;
    }
    const nuevo = crear();
    nuevo.userData.claveReserva = clave;
    return nuevo;
  }

  devolver(obj, liberar) {
    obj.removeFromParent();
    const clave = obj.userData.claveReserva;
    if (clave === undefined) { if (liberar) liberar(obj); return; }
    let caja = this.cajas.get(clave);
    if (!caja) this.cajas.set(clave, (caja = []));
    if (caja.length >= this.limite) { if (liberar) liberar(obj); return; }
    caja.push(obj);
  }

  vaciar(liberar) {
    for (const caja of this.cajas.values()) for (const obj of caja) if (liberar) liberar(obj);
    this.cajas.clear();
  }
}

// Una sola reserva compartida por los bloques de la pista y el tráfico
export const reserva = new Reserva();
