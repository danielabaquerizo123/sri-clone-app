-- CreateEnum
CREATE TYPE "Rol" AS ENUM ('ADMIN', 'CONTADOR');

-- CreateEnum
CREATE TYPE "TipoContribuyente" AS ENUM ('PERSONA_NATURAL', 'SOCIEDAD');

-- CreateEnum
CREATE TYPE "EstadoContribuyente" AS ENUM ('ACTIVO', 'SUSPENDIDO', 'CANCELADO');

-- CreateEnum
CREATE TYPE "TipoIdentificacion" AS ENUM ('RUC', 'CEDULA', 'PASAPORTE', 'EXTERIOR');

-- CreateEnum
CREATE TYPE "TipoComprobante" AS ENUM ('FACTURA', 'NOTA_CREDITO', 'NOTA_DEBITO', 'LIQUIDACION_COMPRA', 'COMPROBANTE_RETENCION', 'GUIA_REMISION');

-- CreateEnum
CREATE TYPE "EstadoComprobante" AS ENUM ('VIGENTE', 'ANULADO');

-- CreateEnum
CREATE TYPE "PorcentajeRetencionIva" AS ENUM ('IVA_0', 'IVA_10', 'IVA_20', 'IVA_30', 'IVA_50', 'IVA_70', 'IVA_100');

-- CreateEnum
CREATE TYPE "TarifaIva" AS ENUM ('TARIFA_0', 'TARIFA_5', 'TARIFA_12', 'TARIFA_15', 'EXENTO', 'NO_OBJETO');

-- CreateTable
CREATE TABLE "Contribuyente" (
    "id" TEXT NOT NULL,
    "ruc" TEXT NOT NULL,
    "ciAdicional" TEXT,
    "clave" TEXT NOT NULL,
    "razonSocial" TEXT NOT NULL,
    "tipoContribuyente" "TipoContribuyente" NOT NULL DEFAULT 'PERSONA_NATURAL',
    "estadoTributario" TEXT NOT NULL DEFAULT 'AL DÍA',
    "rol" "Rol" NOT NULL DEFAULT 'CONTADOR',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Contribuyente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Declaracion" (
    "id" TEXT NOT NULL,
    "formulario" TEXT NOT NULL,
    "periodoFiscal" TEXT NOT NULL,
    "anio" INTEGER NOT NULL,
    "mes" TEXT,
    "datosJSON" JSONB NOT NULL,
    "fechaEnvio" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "contribuyenteId" TEXT NOT NULL,

    CONSTRAINT "Declaracion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Proveedor" (
    "id" TEXT NOT NULL,
    "ruc" TEXT NOT NULL,
    "razonSocial" TEXT NOT NULL,
    "tipoProveedor" TEXT,
    "contribuyenteId" TEXT NOT NULL,

    CONSTRAINT "Proveedor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Venta" (
    "id" TEXT NOT NULL,
    "noIdentificacion" TEXT NOT NULL,
    "codigoIdentif" TEXT NOT NULL,
    "razonSocialCliente" TEXT NOT NULL,
    "tipoCliente" TEXT,
    "parteRelacionada" TEXT NOT NULL DEFAULT 'NO',
    "cantidadComprobantes" INTEGER NOT NULL DEFAULT 1,
    "tipoEmisionComprobante" TEXT NOT NULL,
    "tipoComprobante" TEXT NOT NULL,
    "fechaEmision" TIMESTAMP(3) NOT NULL,
    "codigoEstablecimiento" TEXT NOT NULL,
    "noDocumento" TEXT,
    "conceptoVenta" TEXT,
    "baseNoObjetoIva" DECIMAL(12,2) NOT NULL DEFAULT 0.0,
    "baseExenta" DECIMAL(12,2) NOT NULL DEFAULT 0.0,
    "baseTarifa0" DECIMAL(12,2) NOT NULL DEFAULT 0.0,
    "baseGravableIva1" DECIMAL(12,2) NOT NULL DEFAULT 0.0,
    "tarifaIva1Aplicada" DECIMAL(12,2) NOT NULL DEFAULT 0.0,
    "montoIva1" DECIMAL(12,2) NOT NULL DEFAULT 0.0,
    "baseGravableIva2" DECIMAL(12,2) NOT NULL DEFAULT 0.0,
    "tarifaIva2Aplicada" DECIMAL(12,2) NOT NULL DEFAULT 0.0,
    "montoIva2" DECIMAL(12,2) NOT NULL DEFAULT 0.0,
    "baseGravableIva3" DECIMAL(12,2) NOT NULL DEFAULT 0.0,
    "tarifaIva3Aplicada" DECIMAL(12,2) NOT NULL DEFAULT 0.0,
    "montoIva3" DECIMAL(12,2) NOT NULL DEFAULT 0.0,
    "montoIceNoIncluido" DECIMAL(12,2) NOT NULL DEFAULT 0.0,
    "montoIceIncluido" DECIMAL(12,2) NOT NULL DEFAULT 0.0,
    "montoPropina" DECIMAL(12,2) NOT NULL DEFAULT 0.0,
    "montoIrbpnrOtros" DECIMAL(12,2) NOT NULL DEFAULT 0.0,
    "totalDocumento" DECIMAL(12,2) NOT NULL DEFAULT 0.0,
    "valorDescuentos" DECIMAL(12,2) NOT NULL DEFAULT 0.0,
    "totalSubsidios" DECIMAL(12,2) NOT NULL DEFAULT 0.0,
    "sumaDevoluciones" DECIMAL(12,2) NOT NULL DEFAULT 0.0,
    "autocodigoVentas" TEXT,
    "conceptoContableVenta" TEXT,
    "numeroAsientoVenta" TEXT,
    "estadoContableVenta" TEXT,
    "tipoActividad" TEXT,
    "codigoForm104_1" DECIMAL(12,2) NOT NULL DEFAULT 0.0,
    "codigoForm104_2" DECIMAL(12,2) NOT NULL DEFAULT 0.0,
    "codigoForm104_3" DECIMAL(12,2) NOT NULL DEFAULT 0.0,
    "mesDeclarado" TEXT,
    "periodoDeclaradoForm104" TEXT,
    "form104_a" TEXT,
    "form104_b" TEXT,
    "form104_c" TEXT,
    "baseForm104_NoGravExenta" DECIMAL(12,2) NOT NULL DEFAULT 0.0,
    "ivaForm104_Base444" DECIMAL(12,2) NOT NULL DEFAULT 0.0,
    "ivaForm104_411_412_420_435" DECIMAL(12,2) NOT NULL DEFAULT 0.0,
    "ivaForm104_413_414" DECIMAL(12,2) NOT NULL DEFAULT 0.0,
    "tipoEmisionRetencion" TEXT,
    "valorRetenidoIva" DECIMAL(12,2) NOT NULL DEFAULT 0.0,
    "valorRetenidoFuente" DECIMAL(12,2) NOT NULL DEFAULT 0.0,
    "valorRetenidoIsd" DECIMAL(12,2) NOT NULL DEFAULT 0.0,
    "noDocumentoRetencion" TEXT,
    "fechaRetencion" TIMESTAMP(3),
    "noAutorizacionRetencion" TEXT,
    "retFuenteBaseImponible1" DECIMAL(12,2) NOT NULL DEFAULT 0.0,
    "retFuenteValorRetenido1" DECIMAL(12,2) NOT NULL DEFAULT 0.0,
    "retFuenteBaseImponible2" DECIMAL(12,2) NOT NULL DEFAULT 0.0,
    "retFuenteValorRetenido2" DECIMAL(12,2) NOT NULL DEFAULT 0.0,
    "retFuenteBaseImponible3" DECIMAL(12,2) NOT NULL DEFAULT 0.0,
    "retFuenteValorRetenido3" DECIMAL(12,2) NOT NULL DEFAULT 0.0,
    "retIvaBase10" DECIMAL(12,2) NOT NULL DEFAULT 0.0,
    "retIvaValor10" DECIMAL(12,2) NOT NULL DEFAULT 0.0,
    "retIvaBase20" DECIMAL(12,2) NOT NULL DEFAULT 0.0,
    "retIvaValor20" DECIMAL(12,2) NOT NULL DEFAULT 0.0,
    "retIvaBase30" DECIMAL(12,2) NOT NULL DEFAULT 0.0,
    "retIvaValor30" DECIMAL(12,2) NOT NULL DEFAULT 0.0,
    "retIvaBase50" DECIMAL(12,2) NOT NULL DEFAULT 0.0,
    "retIvaValor50" DECIMAL(12,2) NOT NULL DEFAULT 0.0,
    "retIvaBase70" DECIMAL(12,2) NOT NULL DEFAULT 0.0,
    "retIvaValor70" DECIMAL(12,2) NOT NULL DEFAULT 0.0,
    "retIvaBase100" DECIMAL(12,2) NOT NULL DEFAULT 0.0,
    "retIvaValor100" DECIMAL(12,2) NOT NULL DEFAULT 0.0,
    "conceptoContableRetencion" TEXT,
    "numeroAsientoRetencion" TEXT,
    "estadoContableRetencion" TEXT,
    "codigoDocto" TEXT,
    "claseDoctoElectronico" TEXT,
    "estadoDoctoElectronico" TEXT,
    "campoBusqueda" TEXT,
    "observaciones" TEXT,
    "contribuyenteId" TEXT NOT NULL,

    CONSTRAINT "Venta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Compra" (
    "id" TEXT NOT NULL,
    "noIdentificacion" TEXT NOT NULL,
    "razonSocialProveedor" TEXT NOT NULL,
    "tipoProveedor" TEXT,
    "parteRelacionada" TEXT NOT NULL DEFAULT 'NO',
    "validacionIdentificacion" TEXT,
    "tipoEmisionComprobante" TEXT,
    "comprobante" TEXT NOT NULL,
    "establecimiento" TEXT NOT NULL,
    "puntoEmision" TEXT NOT NULL,
    "numeroSecuencial" TEXT NOT NULL,
    "numeroAutorizacionSri" TEXT NOT NULL,
    "fechaEmision" TIMESTAMP(3) NOT NULL,
    "fechaRegistro" TIMESTAMP(3) NOT NULL,
    "codigoSustento" TEXT,
    "conceptoCompra" TEXT,
    "comprobanteModificado" TEXT,
    "establecimientoModificado" TEXT,
    "puntoEmisionModificado" TEXT,
    "numeroSecuencialModificado" TEXT,
    "numeroAutorizacionSriModificado" TEXT,
    "baseNoObjetoIva" DECIMAL(12,2) NOT NULL DEFAULT 0.0,
    "baseExenta" DECIMAL(12,2) NOT NULL DEFAULT 0.0,
    "baseTarifa0" DECIMAL(12,2) NOT NULL DEFAULT 0.0,
    "baseGravableIva1" DECIMAL(12,2) NOT NULL DEFAULT 0.0,
    "tarifaIva1Aplicada" DECIMAL(12,2) NOT NULL DEFAULT 0.0,
    "montoIva1" DECIMAL(12,2) NOT NULL DEFAULT 0.0,
    "baseGravableIva2" DECIMAL(12,2) NOT NULL DEFAULT 0.0,
    "tarifaIva2Aplicada" DECIMAL(12,2) NOT NULL DEFAULT 0.0,
    "montoIva2" DECIMAL(12,2) NOT NULL DEFAULT 0.0,
    "baseGravableIva3" DECIMAL(12,2) NOT NULL DEFAULT 0.0,
    "tarifaIva3Aplicada" DECIMAL(12,2) NOT NULL DEFAULT 0.0,
    "montoIva3" DECIMAL(12,2) NOT NULL DEFAULT 0.0,
    "montoIceNoIncluido" DECIMAL(12,2) NOT NULL DEFAULT 0.0,
    "montoPropina" DECIMAL(12,2) NOT NULL DEFAULT 0.0,
    "montoIrbpnr" DECIMAL(12,2) NOT NULL DEFAULT 0.0,
    "montoOtros" DECIMAL(12,2) NOT NULL DEFAULT 0.0,
    "totalDocumento" DECIMAL(12,2) NOT NULL DEFAULT 0.0,
    "montoIceIncluido" DECIMAL(12,2) NOT NULL DEFAULT 0.0,
    "valorDescuentos2" DECIMAL(12,2) NOT NULL DEFAULT 0.0,
    "otrosValores" DECIMAL(12,2) NOT NULL DEFAULT 0.0,
    "sumaDevoluciones" DECIMAL(12,2) NOT NULL DEFAULT 0.0,
    "autocodigoCompras" TEXT,
    "conceptoContableCompra" TEXT,
    "numeroAsientoCompra" TEXT,
    "estadoContableCompra" TEXT,
    "tipoActividad" TEXT,
    "codigoForm104_1" DECIMAL(12,2) NOT NULL DEFAULT 0.0,
    "codigoForm104_2" DECIMAL(12,2) NOT NULL DEFAULT 0.0,
    "codigoForm104_3" DECIMAL(12,2) NOT NULL DEFAULT 0.0,
    "mesDeclarado" TEXT,
    "periodoDeclaradoForm104" TEXT,
    "periodoDeclaradoEn103" TEXT,
    "form104_a" TEXT,
    "form104_b" TEXT,
    "form104_c" TEXT,
    "liqImpBaseNoGravExenta" DECIMAL(12,2) NOT NULL DEFAULT 0.0,
    "liqImpIvaReembolso545" DECIMAL(12,2) NOT NULL DEFAULT 0.0,
    "liqImpIvaGastos512" DECIMAL(12,2) NOT NULL DEFAULT 0.0,
    "liqImpIvaCreditoTributario" DECIMAL(12,2) NOT NULL DEFAULT 0.0,
    "liqImpSumatoriaRetIva" DECIMAL(12,2) NOT NULL DEFAULT 0.0,
    "liqImpRetIva100SectorPublico" DECIMAL(12,2) NOT NULL DEFAULT 0.0,
    "liqImpRetFte" DECIMAL(12,2) NOT NULL DEFAULT 0.0,
    "tipoEmisionRetencion" TEXT,
    "establecimientoRet" TEXT,
    "puntoEmisionRet" TEXT,
    "numeroSecuencialRet" TEXT,
    "numeroAutorizacionSriRet" TEXT,
    "fechaEmisionRet1" TIMESTAMP(3),
    "codigoRetencion1" TEXT,
    "baseImponibleRet1" DECIMAL(12,2) NOT NULL DEFAULT 0.0,
    "porcentajeRetencion1" DECIMAL(12,2) NOT NULL DEFAULT 0.0,
    "valorRetenido1" DECIMAL(12,2) NOT NULL DEFAULT 0.0,
    "codigoRetencion2" TEXT,
    "baseImponibleRet2" DECIMAL(12,2) NOT NULL DEFAULT 0.0,
    "porcentajeRetencion2" DECIMAL(12,2) NOT NULL DEFAULT 0.0,
    "valorRetenido2" DECIMAL(12,2) NOT NULL DEFAULT 0.0,
    "codigoRetencion3" TEXT,
    "baseImponibleRet3" DECIMAL(12,2) NOT NULL DEFAULT 0.0,
    "porcentajeRetencion3" DECIMAL(12,2) NOT NULL DEFAULT 0.0,
    "valorRetenido3" DECIMAL(12,2) NOT NULL DEFAULT 0.0,
    "valorRetencionIva30" DECIMAL(12,2) NOT NULL DEFAULT 0.0,
    "valorRetencionIva50" DECIMAL(12,2) NOT NULL DEFAULT 0.0,
    "valorRetencionIva70" DECIMAL(12,2) NOT NULL DEFAULT 0.0,
    "valorRetencionIva100" DECIMAL(12,2) NOT NULL DEFAULT 0.0,
    "valorRetencionIva100SectorPublico" DECIMAL(12,2) NOT NULL DEFAULT 0.0,
    "valorRetencionIvaEnNc" DECIMAL(12,2) NOT NULL DEFAULT 0.0,
    "totalRetencionIvaFte" DECIMAL(12,2) NOT NULL DEFAULT 0.0,
    "conceptoContableRetencion" TEXT,
    "numeroAsientoRetencion" TEXT,
    "estadoContableRetencion" TEXT,
    "tipoPago" TEXT,
    "formaPago1" TEXT,
    "formaPago2" TEXT,
    "tipoRegimenFiscalExterior" TEXT,
    "paisesResidenciaPago01" TEXT,
    "paisesResidenciaPagoParaiso02" TEXT,
    "denominacionRegimenPreferente03" TEXT,
    "paisResidenciaExterior" TEXT,
    "aplicaConvenioDobleTributacion" TEXT NOT NULL DEFAULT 'NO',
    "pagoExteriorSujetoRetencion" TEXT NOT NULL DEFAULT 'NO',
    "pagoExteriorRegimenMenorImposicion" TEXT NOT NULL DEFAULT 'NO',
    "codigoDocto1" TEXT,
    "estadoDocumentoElectronico1" TEXT,
    "codigoDocumento2" TEXT,
    "claseDocumento2" TEXT,
    "estadoDocumentoElectronico2" TEXT,
    "campoBusqueda" TEXT,
    "observaciones" TEXT,
    "contribuyenteId" TEXT NOT NULL,

    CONSTRAINT "Compra_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ComprobanteAnulado" (
    "id" TEXT NOT NULL,
    "tipoComprobante" TEXT NOT NULL,
    "establecimiento" TEXT NOT NULL,
    "puntoEmision" TEXT NOT NULL,
    "secuencialDesde" TEXT NOT NULL,
    "secuencialHasta" TEXT NOT NULL,
    "numeroAutorizacionSri" TEXT NOT NULL,
    "tipoEmisionComprobante" TEXT NOT NULL,
    "fechaRegistroAnulacion" TIMESTAMP(3) NOT NULL,
    "periodoDeclaradoForm104" TEXT,
    "observaciones" TEXT,
    "contribuyenteId" TEXT NOT NULL,

    CONSTRAINT "ComprobanteAnulado_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GuiaRemision" (
    "id" TEXT NOT NULL,
    "noIdentificacionEmisor" TEXT NOT NULL,
    "razonSocialEmisor" TEXT NOT NULL,
    "tipoDocumento" TEXT NOT NULL,
    "comprobante" TEXT NOT NULL,
    "establecimiento" TEXT NOT NULL,
    "puntoEmision" TEXT NOT NULL,
    "numeroSecuencial" TEXT NOT NULL,
    "numeroAutorizacionSri" TEXT NOT NULL,
    "noIdentificacionTransportista" TEXT NOT NULL,
    "razonSocialTransportista" TEXT NOT NULL,
    "noPlaca" TEXT NOT NULL,
    "fechaInicioTransporte" TIMESTAMP(3) NOT NULL,
    "fechaFinTransporte" TIMESTAMP(3) NOT NULL,
    "direccionPartida" TEXT NOT NULL,
    "noIdentificacionDestinatario" TEXT NOT NULL,
    "razonSocialDestinatario" TEXT NOT NULL,
    "noDocumentoAduaneroUnico" TEXT,
    "direccionDestinatario" TEXT NOT NULL,
    "ruta" TEXT NOT NULL,
    "motivoTraslado" TEXT NOT NULL,
    "comprobanteSustento" TEXT,
    "numeroDocumentoSustento" TEXT,
    "fechaEmisionDocumentoSustento" TIMESTAMP(3),
    "numeroAutorizacionSriSustento" TEXT,
    "observaciones" TEXT,
    "codigoAutomatico" TEXT,
    "contribuyenteId" TEXT NOT NULL,

    CONSTRAINT "GuiaRemision_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Contribuyente_ruc_key" ON "Contribuyente"("ruc");

-- CreateIndex
CREATE UNIQUE INDEX "Proveedor_ruc_contribuyenteId_key" ON "Proveedor"("ruc", "contribuyenteId");

-- AddForeignKey
ALTER TABLE "Declaracion" ADD CONSTRAINT "Declaracion_contribuyenteId_fkey" FOREIGN KEY ("contribuyenteId") REFERENCES "Contribuyente"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Proveedor" ADD CONSTRAINT "Proveedor_contribuyenteId_fkey" FOREIGN KEY ("contribuyenteId") REFERENCES "Contribuyente"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Venta" ADD CONSTRAINT "Venta_contribuyenteId_fkey" FOREIGN KEY ("contribuyenteId") REFERENCES "Contribuyente"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Compra" ADD CONSTRAINT "Compra_contribuyenteId_fkey" FOREIGN KEY ("contribuyenteId") REFERENCES "Contribuyente"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComprobanteAnulado" ADD CONSTRAINT "ComprobanteAnulado_contribuyenteId_fkey" FOREIGN KEY ("contribuyenteId") REFERENCES "Contribuyente"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuiaRemision" ADD CONSTRAINT "GuiaRemision_contribuyenteId_fkey" FOREIGN KEY ("contribuyenteId") REFERENCES "Contribuyente"("id") ON DELETE CASCADE ON UPDATE CASCADE;
