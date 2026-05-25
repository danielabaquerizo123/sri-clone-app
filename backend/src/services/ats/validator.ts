export type AtsValidationIssue = {
  tipo: "ERROR" | "WARNING";
  hoja: string;
  fila: number;
  campo: string;
  mensaje: string;
};

type AtsValidationInput = {
  rucInformante: string;
  razonSocial: string;
  anio: number;
  mes: string;
  compras: any[];
  ventas: any[];
  anulados: any[];
};

function clean(value: any): string {
  return String(value ?? "").trim();
}

function onlyDigits(value: any): string {
  return clean(value).replace(/\D/g, "");
}

function moneyNumber(value: any): number {
  const num = Number(value ?? 0);
  return Number.isFinite(num) ? num : 0;
}

function isValidMonth(value: any): boolean {
  const mes = clean(value);
  return /^(0[1-9]|1[0-2])$/.test(mes);
}

function isValidYear(value: any): boolean {
  const anio = Number(value);
  return Number.isInteger(anio) && anio >= 2000 && anio <= 2100;
}

function isValidRuc(value: any): boolean {
  const digits = onlyDigits(value);
  return digits.length === 13;
}

function isValidCedulaOrRucOrFinal(value: any): boolean {
  const digits = onlyDigits(value);
  return (
    digits.length === 10 ||
    digits.length === 13 ||
    digits === "9999999999999"
  );
}

function isValidComprobante(value: any): boolean {
  const code = clean(value);
  return /^\d{2}$/.test(code);
}

function isValidEstabOrPto(value: any): boolean {
  return /^\d{3}$/.test(clean(value));
}

function isValidSecuencial(value: any): boolean {
  return /^\d{9}$/.test(clean(value));
}

function isValidAutorizacion(value: any): boolean {
  const digits = onlyDigits(value);

  /**
   * En comprobantes electrónicos suele venir clave de acceso de 49 dígitos.
   * En físicos/autorizaciones antiguas puede variar, por eso dejamos mínimo 10.
   */
  return digits.length >= 10 && digits.length <= 49;
}

function hasCompraMoney(c: any): boolean {
  return (
    moneyNumber(c.baseNoObjetoIva) > 0 ||
    moneyNumber(c.baseExenta) > 0 ||
    moneyNumber(c.baseTarifa0) > 0 ||
    moneyNumber(c.baseGravableIva1) > 0 ||
    moneyNumber(c.baseGravableIva2) > 0 ||
    moneyNumber(c.baseGravableIva3) > 0 ||
    moneyNumber(c.montoIva1) > 0 ||
    moneyNumber(c.montoIva2) > 0 ||
    moneyNumber(c.montoIva3) > 0 ||
    moneyNumber(c.totalDocumento) > 0
  );
}

function hasVentaMoney(v: any): boolean {
  return (
    moneyNumber(v.baseNoObjetoIva) > 0 ||
    moneyNumber(v.baseExenta) > 0 ||
    moneyNumber(v.baseTarifa0) > 0 ||
    moneyNumber(v.baseGravableIva1) > 0 ||
    moneyNumber(v.baseGravableIva2) > 0 ||
    moneyNumber(v.baseGravableIva3) > 0 ||
    moneyNumber(v.montoIva1) > 0 ||
    moneyNumber(v.montoIva2) > 0 ||
    moneyNumber(v.montoIva3) > 0 ||
    moneyNumber(v.totalDocumento) > 0
  );
}

function pushIssue(
  issues: AtsValidationIssue[],
  tipo: AtsValidationIssue["tipo"],
  hoja: string,
  fila: number,
  campo: string,
  mensaje: string
) {
  issues.push({
    tipo,
    hoja,
    fila,
    campo,
    mensaje,
  });
}

function rowNumber(item: any, fallback: number): number {
  const value = Number(item?.filaExcel);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function validateCabecera(data: AtsValidationInput, issues: AtsValidationIssue[]) {
  if (!isValidRuc(data.rucInformante)) {
    pushIssue(
      issues,
      "ERROR",
      "CABECERA",
      0,
      "IdInformante",
      `RUC informante inválido: ${data.rucInformante}`
    );
  }

  if (!clean(data.razonSocial)) {
    pushIssue(
      issues,
      "ERROR",
      "CABECERA",
      0,
      "razonSocial",
      "La razón social del informante está vacía."
    );
  }

  if (!isValidYear(data.anio)) {
    pushIssue(
      issues,
      "ERROR",
      "CABECERA",
      0,
      "Anio",
      `Año inválido: ${data.anio}`
    );
  }

  if (!isValidMonth(data.mes)) {
    pushIssue(
      issues,
      "ERROR",
      "CABECERA",
      0,
      "Mes",
      `Mes inválido: ${data.mes}. Debe estar entre 01 y 12.`
    );
  }
}

function validateCompras(compras: any[], issues: AtsValidationIssue[]) {
  compras.forEach((c, index) => {
    const fila = rowNumber(c, index + 1);

    if (!isValidCedulaOrRucOrFinal(c.noIdentificacion)) {
      pushIssue(
        issues,
        "ERROR",
        "COMPRAS",
        fila,
        "noIdentificacion",
        `Identificación de proveedor inválida: ${c.noIdentificacion}`
      );
    }

    if (!clean(c.razonSocialProveedor)) {
      pushIssue(
        issues,
        "WARNING",
        "COMPRAS",
        fila,
        "razonSocialProveedor",
        "Proveedor sin razón social."
      );
    }

    if (!isValidComprobante(c.comprobante)) {
      pushIssue(
        issues,
        "ERROR",
        "COMPRAS",
        fila,
        "comprobante",
        `Tipo de comprobante inválido: ${c.comprobante}`
      );
    }

    if (!isValidEstabOrPto(c.establecimiento)) {
      pushIssue(
        issues,
        "ERROR",
        "COMPRAS",
        fila,
        "establecimiento",
        `Establecimiento inválido: ${c.establecimiento}`
      );
    }

    if (!isValidEstabOrPto(c.puntoEmision)) {
      pushIssue(
        issues,
        "ERROR",
        "COMPRAS",
        fila,
        "puntoEmision",
        `Punto de emisión inválido: ${c.puntoEmision}`
      );
    }

    if (!isValidSecuencial(c.numeroSecuencial)) {
      pushIssue(
        issues,
        "ERROR",
        "COMPRAS",
        fila,
        "numeroSecuencial",
        `Secuencial inválido: ${c.numeroSecuencial}`
      );
    }

    if (!isValidAutorizacion(c.numeroAutorizacionSri)) {
      pushIssue(
        issues,
        "ERROR",
        "COMPRAS",
        fila,
        "numeroAutorizacionSri",
        `Autorización inválida: ${c.numeroAutorizacionSri}`
      );
    }

    if (!hasCompraMoney(c)) {
      pushIssue(
        issues,
        "WARNING",
        "COMPRAS",
        fila,
        "montos",
        "Compra sin bases, IVA ni total. Revisar si debe excluirse."
      );
    }

    const baseGravada =
      moneyNumber(c.baseGravableIva1) +
      moneyNumber(c.baseGravableIva2) +
      moneyNumber(c.baseGravableIva3);

    const iva =
      moneyNumber(c.montoIva1) +
      moneyNumber(c.montoIva2) +
      moneyNumber(c.montoIva3);

    if (baseGravada > 0 && iva <= 0) {
      pushIssue(
        issues,
        "WARNING",
        "COMPRAS",
        fila,
        "montoIva",
        "Compra con base gravada mayor a cero pero sin IVA."
      );
    }

    if (iva > 0 && baseGravada <= 0) {
      pushIssue(
        issues,
        "WARNING",
        "COMPRAS",
        fila,
        "baseGravableIva",
        "Compra con IVA mayor a cero pero sin base gravada."
      );
    }

    const tieneRetencion =
      clean(c.establecimientoRet) ||
      clean(c.puntoEmisionRet) ||
      clean(c.numeroSecuencialRet) ||
      clean(c.numeroAutorizacionSriRet);

    if (tieneRetencion) {
      if (!isValidEstabOrPto(c.establecimientoRet)) {
        pushIssue(
          issues,
          "WARNING",
          "COMPRAS",
          fila,
          "establecimientoRet",
          `Establecimiento de retención inválido: ${c.establecimientoRet}`
        );
      }

      if (!isValidEstabOrPto(c.puntoEmisionRet)) {
        pushIssue(
          issues,
          "WARNING",
          "COMPRAS",
          fila,
          "puntoEmisionRet",
          `Punto de emisión de retención inválido: ${c.puntoEmisionRet}`
        );
      }

      if (!isValidSecuencial(c.numeroSecuencialRet)) {
        pushIssue(
          issues,
          "WARNING",
          "COMPRAS",
          fila,
          "numeroSecuencialRet",
          `Secuencial de retención inválido: ${c.numeroSecuencialRet}`
        );
      }

      if (!isValidAutorizacion(c.numeroAutorizacionSriRet)) {
        pushIssue(
          issues,
          "WARNING",
          "COMPRAS",
          fila,
          "numeroAutorizacionSriRet",
          `Autorización de retención inválida: ${c.numeroAutorizacionSriRet}`
        );
      }
    }
  });
}

function validateVentas(ventas: any[], issues: AtsValidationIssue[]) {
  ventas.forEach((v, index) => {
    const fila = rowNumber(v, index + 1);

    if (!isValidCedulaOrRucOrFinal(v.noIdentificacion)) {
      pushIssue(
        issues,
        "ERROR",
        "VENTAS",
        fila,
        "noIdentificacion",
        `Identificación de cliente inválida: ${v.noIdentificacion}`
      );
    }

    if (!isValidComprobante(v.tipoComprobante)) {
      pushIssue(
        issues,
        "ERROR",
        "VENTAS",
        fila,
        "tipoComprobante",
        `Tipo de comprobante inválido: ${v.tipoComprobante}`
      );
    }

    if (!isValidEstabOrPto(v.codigoEstablecimiento)) {
      pushIssue(
        issues,
        "WARNING",
        "VENTAS",
        fila,
        "codigoEstablecimiento",
        `Establecimiento inválido: ${v.codigoEstablecimiento}`
      );
    }

    if (!hasVentaMoney(v)) {
      pushIssue(
        issues,
        "WARNING",
        "VENTAS",
        fila,
        "montos",
        "Venta sin bases, IVA ni total. Revisar si debe excluirse."
      );
    }

    const baseGravada =
      moneyNumber(v.baseGravableIva1) +
      moneyNumber(v.baseGravableIva2) +
      moneyNumber(v.baseGravableIva3);

    const iva =
      moneyNumber(v.montoIva1) +
      moneyNumber(v.montoIva2) +
      moneyNumber(v.montoIva3);

    if (baseGravada > 0 && iva <= 0) {
      pushIssue(
        issues,
        "WARNING",
        "VENTAS",
        fila,
        "montoIva",
        "Venta con base gravada mayor a cero pero sin IVA."
      );
    }

    if (iva > 0 && baseGravada <= 0) {
      pushIssue(
        issues,
        "WARNING",
        "VENTAS",
        fila,
        "baseGravableIva",
        "Venta con IVA mayor a cero pero sin base gravada."
      );
    }
  });
}

function validateAnulados(anulados: any[], issues: AtsValidationIssue[]) {
  anulados.forEach((a, index) => {
    const fila = rowNumber(a, index + 1);

    if (!isValidComprobante(a.tipoComprobante)) {
      pushIssue(
        issues,
        "ERROR",
        "ANULADOS",
        fila,
        "tipoComprobante",
        `Tipo de comprobante anulado inválido: ${a.tipoComprobante}`
      );
    }

    if (!isValidEstabOrPto(a.establecimiento)) {
      pushIssue(
        issues,
        "ERROR",
        "ANULADOS",
        fila,
        "establecimiento",
        `Establecimiento inválido: ${a.establecimiento}`
      );
    }

    if (!isValidEstabOrPto(a.puntoEmision)) {
      pushIssue(
        issues,
        "ERROR",
        "ANULADOS",
        fila,
        "puntoEmision",
        `Punto de emisión inválido: ${a.puntoEmision}`
      );
    }

    if (!isValidSecuencial(a.secuencialDesde)) {
      pushIssue(
        issues,
        "ERROR",
        "ANULADOS",
        fila,
        "secuencialDesde",
        `Secuencial desde inválido: ${a.secuencialDesde}`
      );
    }

    if (!isValidSecuencial(a.secuencialHasta)) {
      pushIssue(
        issues,
        "ERROR",
        "ANULADOS",
        fila,
        "secuencialHasta",
        `Secuencial hasta inválido: ${a.secuencialHasta}`
      );
    }

    if (!isValidAutorizacion(a.numeroAutorizacionSri)) {
      pushIssue(
        issues,
        "WARNING",
        "ANULADOS",
        fila,
        "numeroAutorizacionSri",
        `Autorización de anulado inválida: ${a.numeroAutorizacionSri}`
      );
    }
  });
}

export function validateAtsForXml(data: AtsValidationInput) {
  const issues: AtsValidationIssue[] = [];

  validateCabecera(data, issues);
  validateCompras(data.compras || [], issues);
  validateVentas(data.ventas || [], issues);
  validateAnulados(data.anulados || [], issues);

  const errores = issues.filter((issue) => issue.tipo === "ERROR");
  const advertencias = issues.filter((issue) => issue.tipo === "WARNING");

  return {
    valido: errores.length === 0,
    errores,
    advertencias,
    issues,
  };
}