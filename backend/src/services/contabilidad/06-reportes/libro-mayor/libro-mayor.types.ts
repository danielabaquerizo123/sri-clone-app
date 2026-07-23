export type MoneyString = string;

export type LibroMayorParams = {
  ruc: string;
  periodoId?: string;
  fechaDesde?: string;
  fechaHasta?: string;
  cuentaDesde?: string;
  cuentaHasta?: string;
  cuentaId?: string;
  busqueda?: string;
  incluirSaldoAnterior?: boolean;
  incluirCuentasSinMovimiento?: boolean;
  page?: number;
  limit?: number;
};

export type LibroMayorOrigen = "PREVIEW" | "PERSISTIDO";

export type LibroMayorEmpresa = {
  id: string;
  ruc: string;
  razonSocial: string;
};

export type LibroMayorPeriodo = {
  id: string | null;
  anio: number | null;
  mes: string | null;
  estado: string | null;
};

export type MovimientoMayorSource = {
  lineaId: string;
  asientoId: string;
  cuentaId: string;
  codigoCuenta: string;
  nombreCuenta: string;
  tipoCuenta: string;
  naturalezaCuenta: string;
  fecha: Date;
  numeroAsiento: number;
  descripcion: string;
  orden: number;
  debe: unknown;
  haber: unknown;
  estadoAsiento: string;
  periodoId: string;
  periodoAnio: number;
  periodoMes: string;
  empresaId: string;
  asientoCreatedAt: Date;
};

export type LibroMayorRawMovement = MovimientoMayorSource;

export type LibroMayorMovimiento = {
  lineaId: string;
  asientoId: string;
  fecha: string;
  numeroAsiento: string;
  descripcion: string;
  debe: MoneyString;
  haber: MoneyString;
  saldoAcumulado: MoneyString;
  saldoDeudor: MoneyString | null;
  saldoAcreedor: MoneyString | null;
};

export type LibroMayorFolio = {
  folio: number;
  cuentaId: string;
  codigoCuenta: string;
  nombreCuenta: string;
  tipoCuenta: string;
  naturalezaCuenta: string;
  saldoAnterior: MoneyString;
  saldoAnteriorDeudor: MoneyString | null;
  saldoAnteriorAcreedor: MoneyString | null;
  movimientos: LibroMayorMovimiento[];
  totalDebe: MoneyString;
  totalHaber: MoneyString;
  saldoFinal: MoneyString;
  saldoFinalDeudor: MoneyString | null;
  saldoFinalAcreedor: MoneyString | null;
};

export type LibroMayorResumenGlobal = {
  totalDebeDiario: MoneyString;
  totalHaberDiario: MoneyString;
  totalDebeMayor: MoneyString;
  totalHaberMayor: MoneyString;
  diferenciaDebe: MoneyString;
  diferenciaHaber: MoneyString;
  totalMovimientos: number;
};

export type LibroMayorResponse = {
  origen: LibroMayorOrigen;
  estadoReporte: string;
  mensaje: string;
  empresa: LibroMayorEmpresa;
  periodo: LibroMayorPeriodo;
  fechaDesde: string | null;
  fechaHasta: string | null;
  incluirSaldoAnterior: boolean;
  totalCuentas: number;
  totalFolios: number;
  page: number;
  limit: number;
  resumenGlobal: LibroMayorResumenGlobal;
  folios: LibroMayorFolio[];
};

export type LibroMayorValidationIssue = {
  tipo: "ERROR" | "WARNING";
  mensaje: string;
  cuentaId?: string;
  lineaId?: string;
};

export type LibroMayorValidationResponse = {
  valido: boolean;
  issues: LibroMayorValidationIssue[];
  resumenGlobal: LibroMayorResumenGlobal;
};
