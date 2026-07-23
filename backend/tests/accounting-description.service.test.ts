import { strict as assert } from "assert";
import { generarGlosaOperacion } from "../src/services/contabilidad/accounting-description.service";

function assertClean(value: string) {
  assert.equal(value.includes("undefined"), false);
  assert.equal(value.includes("null"), false);
  assert.equal(value.includes(" - - "), false);
  assert.equal(value.endsWith(" -"), false);
  assert.equal(value.includes("  "), false);
}

{
  const glosa = generarGlosaOperacion({ evento: "DEVENGO_COMPRA", tipoDocumento: "01", numeroDocumento: "001-001-000458", razonSocial: "Ferretería Central" });
  assert.equal(glosa, "Compra factura 001-001-000458 - Ferretería Central");
}

{
  const glosa = generarGlosaOperacion({ evento: "PAGO_PROVEEDOR", tipoDocumento: "01", numeroDocumento: "001-001-000458", razonSocial: "Ferretería Central" });
  assert.equal(glosa, "Pago factura 001-001-000458 - Ferretería Central");
}

{
  const glosa = generarGlosaOperacion({ evento: "DEVENGO_VENTA", tipoDocumento: "18", numeroDocumento: "002-001-000985", razonSocial: "Comercial López" });
  assert.equal(glosa, "Venta factura 002-001-000985 - Comercial López");
}

{
  const glosa = generarGlosaOperacion({ evento: "COBRO_CLIENTE", tipoDocumento: "18", numeroDocumento: "002-001-000985", razonSocial: "Comercial López" });
  assert.equal(glosa, "Cobro factura 002-001-000985 - Comercial López");
}

{
  const glosa = generarGlosaOperacion({ evento: "NOTA_CREDITO_COMPRA", tipoDocumento: "04", numeroDocumento: "001-001-000045", razonSocial: "Proveedor Real" });
  assert.equal(glosa, "Nota de crédito compra nota de crédito 001-001-000045 - Proveedor Real");
}

{
  const glosa = generarGlosaOperacion({ evento: "NOTA_CREDITO_VENTA", tipoDocumento: "04", numeroDocumento: "002-001-000046", razonSocial: "Cliente Real" });
  assert.equal(glosa, "Nota de crédito venta nota de crédito 002-001-000046 - Cliente Real");
}

{
  const glosa = generarGlosaOperacion({ evento: "RETENCION_RECIBIDA", tipoDocumento: "07", numeroDocumento: "001-001-000123", razonSocial: "Cliente Retenedor" });
  assert.equal(glosa, "Retención comp. retención 001-001-000123 - Cliente Retenedor");
}

{
  const glosa = generarGlosaOperacion({ evento: "DEVENGO_COMPRA", tipoDocumento: "01", numeroDocumento: "001-001-000458" });
  assert.equal(glosa, "Compra factura 001-001-000458");
}

{
  const glosa = generarGlosaOperacion({ evento: "DEVENGO_COMPRA", tipoDocumento: "01", razonSocial: "Ferretería Central" });
  assert.equal(glosa, "Compra factura - Ferretería Central");
}

{
  const glosa = generarGlosaOperacion({ evento: "DEVENGO_COMPRA", tipoDocumento: null, numeroDocumento: "", razonSocial: "  ", identificacion: null });
  assert.equal(glosa, "Compra");
  assertClean(glosa);
}

{
  const glosa = generarGlosaOperacion({ evento: "DEVENGO_VENTA", tipoDocumento: "01", numeroDocumento: "003-002-000777", establecimiento: "999", puntoEmision: "888", secuencial: "000001", razonSocial: "Cliente" });
  assert.equal(glosa, "Venta factura 003-002-000777 - Cliente");
}

{
  const glosa = generarGlosaOperacion({ evento: "DEVENGO_VENTA", tipoDocumento: "01", establecimiento: "003", puntoEmision: "002", secuencial: "000777", razonSocial: "Cliente" });
  assert.equal(glosa, "Venta factura 003-002-000777 - Cliente");
}

{
  const glosa = generarGlosaOperacion({ evento: "EVENTO_DESCONOCIDO", tipoDocumento: "01", numeroDocumento: "001-001-000001", razonSocial: "Tercero" });
  assert.equal(glosa, "evento desconocido factura 001-001-000001 - Tercero");
}

{
  const glosa = generarGlosaOperacion({ evento: "DEVENGO_COMPRA", tipoDocumento: "01", numeroDocumento: "001-001-000458", razonSocial: "  Ferretería   Central  " });
  assert.equal(glosa, "Compra factura 001-001-000458 - Ferretería Central");
}

{
  const glosa = generarGlosaOperacion({ evento: "DEVENGO_VENTA", tipoDocumento: "18", numeroDocumento: "001-93", razonSocial: "GAVILANEZ COQUI LUIS ABEL--GIM" });
  assert.equal(glosa, "Venta factura 001-93 - GAVILANEZ COQUI LUIS ABEL - GIM");
  assertClean(glosa);
}

{
  const glosa = generarGlosaOperacion({ evento: "DEVENGO_COMPRA", tipoDocumento: undefined, numeroDocumento: undefined, razonSocial: null, identificacion: "" });
  assert.equal(glosa, "Compra");
  assertClean(glosa);
}

console.log("accounting-description.service tests passed");
