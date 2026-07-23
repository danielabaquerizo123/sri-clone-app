import { LibroMayorAgrupadorService } from "./libro-mayor-agrupador.service";
import { LibroMayorQueryService } from "./libro-mayor-query.service";
import { LibroMayorPreviewAdapterService } from "./libro-mayor-preview-adapter.service";
import { decimal, MONEY_ZERO, money, splitBalance, LibroMayorSaldosService } from "./libro-mayor-saldos.service";
import { LibroMayorValidacionService } from "./libro-mayor-validacion.service";
import type {
  LibroMayorEmpresa,
  LibroMayorFolio,
  LibroMayorOrigen,
  LibroMayorParams,
  LibroMayorPeriodo,
  LibroMayorResponse,
  LibroMayorValidationResponse,
  MovimientoMayorSource,
} from "./libro-mayor.types";
import type { JournalPreviewResult } from "../../04-asientos/preview-asientos.service";

export class LibroMayorService {
  constructor(
    private readonly query = new LibroMayorQueryService(),
    private readonly agrupador = new LibroMayorAgrupadorService(),
    private readonly saldos = new LibroMayorSaldosService(),
    private readonly validacion = new LibroMayorValidacionService(),
    private readonly previewAdapter = new LibroMayorPreviewAdapterService()
  ) {}

  async generar(params: LibroMayorParams): Promise<LibroMayorResponse> {
    const data = await this.query.findMovements(params);
    const groups = this.agrupador.group(data.movements);
    const previousBalances = await this.query.previousBalances(params, groups.map((group) => group.cuentaId));
    return this.generarDesdeMovimientos({
      movements: data.movements,
      previousBalances,
      origen: "PERSISTIDO",
      estadoReporte: "CONTABILIZADO",
      mensaje: data.movements.length > 0
        ? "Libro Mayor generado desde asientos contabilizados."
        : "No existen asientos contables persistidos para este período. Puede consultar la vista previa o generar definitivamente el Libro Diario.",
      empresa: {
        id: data.empresa.id,
        ruc: data.empresa.ruc,
        razonSocial: data.empresa.razonSocial,
      },
      periodo: data.periodo,
      fechaDesde: data.fechaDesde ? data.fechaDesde.toISOString().slice(0, 10) : null,
      fechaHasta: data.fechaHasta ? data.fechaHasta.toISOString().slice(0, 10) : null,
      incluirSaldoAnterior: Boolean(params.incluirSaldoAnterior),
      page: data.page,
      limit: data.limit,
    });
  }

  generarDesdePreview(preview: JournalPreviewResult, params: Omit<LibroMayorParams, "ruc"> = {}): LibroMayorResponse {
    const adapted = this.previewAdapter.adapt(preview);
    const fechaDesde = params.fechaDesde ? new Date(params.fechaDesde) : null;
    const fechaHasta = params.fechaHasta ? new Date(params.fechaHasta) : null;
    if (fechaHasta) fechaHasta.setUTCHours(23, 59, 59, 999);
    const busqueda = String(params.busqueda || "").trim().toLowerCase();
    const filteredMovements = adapted.movements
      .filter((movement) => !fechaDesde || movement.fecha >= fechaDesde)
      .filter((movement) => !fechaHasta || movement.fecha <= fechaHasta)
      .filter((movement) => !params.cuentaId || movement.cuentaId === params.cuentaId)
      .filter((movement) => !busqueda || `${movement.codigoCuenta} ${movement.nombreCuenta}`.toLowerCase().includes(busqueda));
    return this.generarDesdeMovimientos({
      movements: filteredMovements,
      previousBalances: new Map(),
      origen: "PREVIEW",
      estadoReporte: "NO_CONTABILIZADO",
      mensaje: adapted.movements.length > 0
        ? "El Libro Diario está disponible como vista previa, pero todavía no ha sido contabilizado."
        : "No existen movimientos contables para generar el Libro Mayor.",
      empresa: adapted.empresa,
      periodo: adapted.periodo,
      fechaDesde: params.fechaDesde || null,
      fechaHasta: params.fechaHasta || null,
      incluirSaldoAnterior: false,
      page: params.page || 1,
      limit: params.limit || Number.MAX_SAFE_INTEGER,
    });
  }

  private generarDesdeMovimientos(params: {
    movements: MovimientoMayorSource[];
    previousBalances: Map<string, any>;
    origen: LibroMayorOrigen;
    estadoReporte: string;
    mensaje: string;
    empresa: LibroMayorEmpresa;
    periodo: LibroMayorPeriodo;
    fechaDesde: string | null;
    fechaHasta: string | null;
    incluirSaldoAnterior: boolean;
    page: number;
    limit: number;
  }): LibroMayorResponse {
    const groups = this.agrupador.group(params.movements);

    const allFolios = groups.map((group, index): LibroMayorFolio => {
      const saldoAnterior = params.previousBalances.get(group.cuentaId) || MONEY_ZERO;
      const result = this.saldos.calculateMovements(group.movimientos, saldoAnterior, group.naturalezaCuenta);
      return {
        folio: index + 1,
        cuentaId: group.cuentaId,
        codigoCuenta: group.codigoCuenta,
        nombreCuenta: group.nombreCuenta,
        tipoCuenta: group.tipoCuenta,
        naturalezaCuenta: group.naturalezaCuenta,
        saldoAnterior: money(result.saldoAnterior),
        saldoAnteriorDeudor: result.saldoAnteriorDeudor,
        saldoAnteriorAcreedor: result.saldoAnteriorAcreedor,
        movimientos: [
          ...(params.incluirSaldoAnterior && !decimal(money(saldoAnterior)).equals(MONEY_ZERO)
            ? [{
                lineaId: "",
                asientoId: "",
                fecha: params.fechaDesde || "",
                numeroAsiento: "",
                descripcion: "Saldo anterior",
                debe: "",
                haber: "",
                saldoAcumulado: money(saldoAnterior),
                saldoDeudor: splitBalance(saldoAnterior, group.naturalezaCuenta).deudor,
                saldoAcreedor: splitBalance(saldoAnterior, group.naturalezaCuenta).acreedor,
              }]
            : []),
          ...result.movimientos,
        ],
        totalDebe: money(result.totalDebe),
        totalHaber: money(result.totalHaber),
        saldoFinal: money(result.saldoFinal),
        saldoFinalDeudor: result.saldoFinalDeudor,
        saldoFinalAcreedor: result.saldoFinalAcreedor,
      };
    });

    const validation = this.validacion.validateAgainstJournal(params.movements, allFolios);
    const offset = (params.page - 1) * params.limit;
    const folios = allFolios.slice(offset, offset + params.limit);

    return {
      origen: params.origen,
      estadoReporte: params.estadoReporte,
      mensaje: params.mensaje,
      empresa: params.empresa,
      periodo: params.periodo,
      fechaDesde: params.fechaDesde,
      fechaHasta: params.fechaHasta,
      incluirSaldoAnterior: params.incluirSaldoAnterior,
      totalCuentas: allFolios.length,
      totalFolios: allFolios.length,
      page: params.page,
      limit: params.limit,
      resumenGlobal: validation.resumenGlobal,
      folios,
    };
  }

  async generarFolio(params: LibroMayorParams & { cuentaId: string }) {
    return this.generar({ ...params, cuentaId: params.cuentaId, page: 1, limit: 1 });
  }

  async validar(params: LibroMayorParams): Promise<LibroMayorValidationResponse> {
    const data = await this.query.findMovements(params);
    const result = await this.generar({ ...params, page: 1, limit: Number.MAX_SAFE_INTEGER });
    return {
      valido: result.resumenGlobal.diferenciaDebe === "0.00" && result.resumenGlobal.diferenciaHaber === "0.00",
      issues: this.validacion.validateLines(data.movements),
      resumenGlobal: result.resumenGlobal,
    };
  }
}
