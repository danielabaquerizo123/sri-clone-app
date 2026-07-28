import assert from "node:assert/strict";
import {
  calcularDiasRestantes,
  calcularEstadoAcceso,
  construirResumenAcceso,
  fechaInicioDiaEcuador,
} from "../src/lib/acceso";

const atEcuador = (isoUtc: string) => new Date(isoUtc);
const expiration = (year: number, month: number, day: number) =>
  fechaInicioDiaEcuador(year, month, day);

const july27Noon = atEcuador("2026-07-27T17:00:00.000Z");

assert.equal(
  calcularDiasRestantes(expiration(2026, 8, 11), july27Noon),
  15,
  "usuario con 15 dias restantes"
);

assert.equal(
  calcularDiasRestantes(expiration(2026, 7, 28), july27Noon),
  1,
  "usuario con 1 dia restante"
);

assert.equal(
  calcularEstadoAcceso(true, expiration(2026, 7, 27), july27Noon),
  "expira_hoy",
  "usuario que expira hoy"
);

assert.equal(
  calcularEstadoAcceso(true, expiration(2026, 7, 26), july27Noon),
  "vencido",
  "usuario vencido desde ayer"
);

assert.equal(
  calcularEstadoAcceso(false, expiration(2026, 8, 11), july27Noon),
  "desactivado",
  "usuario desactivado manualmente"
);

assert.equal(
  calcularDiasRestantes(expiration(2026, 8, 11), atEcuador("2026-07-28T04:59:00.000Z")),
  15,
  "antes de medianoche Ecuador aun conserva el dia"
);

assert.equal(
  calcularDiasRestantes(expiration(2026, 8, 11), atEcuador("2026-07-28T05:00:00.000Z")),
  14,
  "al llegar medianoche Ecuador baja un dia"
);

assert.equal(
  calcularDiasRestantes(expiration(2026, 8, 11), atEcuador("2026-07-27T23:30:00.000Z")),
  15,
  "UTC no adelanta indebidamente el cambio de dia de Ecuador"
);

assert.deepEqual(
  construirResumenAcceso(
    {
      activo: true,
      fechaExpiracion: expiration(2026, 7, 28),
      createdAt: expiration(2026, 7, 1),
    },
    july27Noon
  ).diasRestantes,
  1,
  "actualizar vencimiento a manana se refleja inmediatamente"
);

console.log("acceso.service.test.ts OK");
