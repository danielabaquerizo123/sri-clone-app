import { useMemo, useState, type ReactNode } from "react";
import {
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  FileSpreadsheet,
  HelpCircle,
  Loader2,
  Save,
  Send,
} from "lucide-react";
import { getLastAtsContribuyenteForPeriod } from "../../utils/atsSession";
import { authFetch } from "../../api/authApi";

type Props = {
  rucUsuario: string;
  razonSocial?: string;
};

type QuestionKey =
  | "informaValores"
  | "realizoVentas"
  | "realizoCompras"
  | "recibioRetenciones"
  | "efectuoRetenciones"
  | "obligadoContabilidad";

type FormState = Record<string, string>;

type Formulario104Response = {
  ruc: string;
  razonSocial: string;
  anio: number;
  mes: string | null;
  mesTexto: string | null;
  semestre: string | null;
  resumen: {
    ventasLeidas: number;
    comprasLeidas: number;
    requiereRevision?: string[];
  };
  casilleros: Record<string, number>;
};

const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:3001";

const meses = [
  { value: "01", label: "Enero" },
  { value: "02", label: "Febrero" },
  { value: "03", label: "Marzo" },
  { value: "04", label: "Abril" },
  { value: "05", label: "Mayo" },
  { value: "06", label: "Junio" },
  { value: "07", label: "Julio" },
  { value: "08", label: "Agosto" },
  { value: "09", label: "Septiembre" },
  { value: "10", label: "Octubre" },
  { value: "11", label: "Noviembre" },
  { value: "12", label: "Diciembre" },
];

const years = Array.from({ length: 7 }, (_, i) => new Date().getFullYear() - i);

const numericCasilleros = [
  "111",
  "113",
  "115",
  "117",
  "119",
  "401",
  "402",
  "403",
  "404",
  "405",
  "406",
  "407",
  "408",
  "409",
  "410",
  "411",
  "412",
  "413",
  "414",
  "415",
  "416",
  "417",
  "418",
  "419",
  "420",
  "421",
  "422",
  "425",
  "429",
  "430",
  "431",
  "434",
  "435",
  "441",
  "442",
  "443",
  "444",
  "445",
  "453",
  "454",
  "480",
  "481",
  "482",
  "483",
  "484",
  "485",
  "499",
  "500",
  "501",
  "502",
  "503",
  "504",
  "505",
  "506",
  "507",
  "508",
  "509",
  "510",
  "511",
  "512",
  "513",
  "514",
  "515",
  "516",
  "517",
  "518",
  "519",
  "520",
  "521",
  "522",
  "523",
  "524",
  "525",
  "526",
  "527",
  "529",
  "530",
  "531",
  "532",
  "533",
  "534",
  "535",
  "540",
  "541",
  "542",
  "543",
  "544",
  "545",
  "550",
  "554",
  "555",
  "560",
  "563",
  "564",
  "565",
  "601",
  "602",
  "603",
  "604",
  "605",
  "606",
  "607",
  "608",
  "609",
  "622",
  "610",
  "611",
  "612",
  "613",
  "614",
  "615",
  "617",
  "618",
  "619",
  "620",
  "621",
  "625",
  "699",
  "721",
  "723",
  "725",
  "727",
  "729",
  "731",
  "799",
  "801",
  "800",
  "802",
  "859",
  "890",
  "880",
  "897",
  "898",
  "899",
  "902",
  "903",
  "904",
  "905",
  "906",
  "907",
  "925",
  "999",
];

const zeroCasilleros: FormState = Object.fromEntries(
  numericCasilleros.map((key) => [key, "0.00"])
);

const initialForm: FormState = {
  ...zeroCasilleros,
  formaPago: "CONVENIO_DEBITO",
  banco: "Banco Pichincha",
  tipoCuenta: "Ahorros",
  numeroCuenta: "",
  rucContador: "",
  claveContador: "",
};

const initialQuestions: Record<QuestionKey, "SI" | "NO"> = {
  informaValores: "SI",
  realizoVentas: "SI",
  realizoCompras: "SI",
  recibioRetenciones: "NO",
  efectuoRetenciones: "NO",
  obligadoContabilidad: "NO",
};

const resumenRows = [
  ["563", "Factor de proporcionalidad"],
  ["564", "Crédito tributario aplicable"],
  ["565", "IVA no considerado como crédito tributario"],
  ["601", "Impuesto causado"],
  ["602", "Crédito tributario aplicable"],
  ["603", "Compensaciones"],
  ["604", "Devoluciones"],
  ["605", "Saldo crédito tributario mes anterior por adquisiciones"],
  ["606", "Saldo crédito tributario mes anterior por retenciones"],
  ["607", "Ajustes por crédito tributario"],
  ["608", "Otros créditos tributarios"],
  ["609", "Retenciones IVA recibidas"],
  ["610", "Ajuste por IVA devuelto"],
  ["611", "Ajuste por IVA devuelto"],
  ["612", "Ajuste por IVA devuelto"],
  ["613", "Ajuste por IVA devuelto"],
  ["614", "Ajuste por IVA devuelto"],
  ["615", "Saldo crédito tributario próximo mes por adquisiciones"],
  ["617", "Saldo crédito tributario próximo mes por retenciones"],
  ["618", "Saldo crédito tributario próximo mes por compensación"],
  ["619", "Saldo crédito tributario próximo mes por compensación"],
  ["620", "Saldo impuesto antes de imputaciones"],
  ["621", "IVA presuntivo"],
  ["699", "Total impuesto a pagar antes de intereses y multas"],
  ["890", "Pago previo informativo"],
  ["897", "Pago previo imputado a intereses"],
  ["898", "Pago previo imputado a impuesto"],
  ["899", "Pago previo imputado a multas"],
];

const retencionesRows = [
  ["721", "Retenciones IVA efectuadas 30%"],
  ["723", "Retenciones IVA efectuadas 50%"],
  ["725", "Retenciones IVA efectuadas 70%"],
  ["727", "Retenciones IVA efectuadas 100%"],
  ["729", "Retenciones IVA 100% sector público"],
  ["731", "Total retenciones IVA efectuadas"],
  ["799", "Total impuesto retenido"],
  ["800", "Otros valores imputables"],
  ["801", "Total impuesto a pagar por retención"],
  ["859", "Total consolidado de impuesto a pagar"],
];

type TripletRow = {
  concepto: string;
  bruto?: string;
  neto?: string;
  impuesto?: string;
};

type SimpleRow = {
  code: string;
  label: string;
  format?: "money" | "factor" | "integer";
  editable?: boolean;
};

const ventasHorizontalRows: TripletRow[] = [
  { concepto: "Ventas locales gravadas tarifa diferente de cero", bruto: "401", neto: "411", impuesto: "421" },
  { concepto: "Ventas locales gravadas tarifa diferente de cero no objeto de retención", bruto: "402", neto: "412", impuesto: "422" },
  { concepto: "Ventas tarifa diferente de cero especiales", bruto: "410", neto: "420", impuesto: "430" },
  { concepto: "Ventas con liquidación posterior", bruto: "425", neto: "435", impuesto: "445" },
  { concepto: "Ventas locales tarifa 0% sin derecho a crédito tributario", bruto: "403", neto: "413" },
  { concepto: "Ventas locales tarifa 0% con derecho a crédito tributario", bruto: "404", neto: "414" },
  { concepto: "Exportaciones de bienes", bruto: "405", neto: "415" },
  { concepto: "Exportaciones de servicios", bruto: "406", neto: "416" },
  { concepto: "Transferencias no objeto de IVA", bruto: "407", neto: "417" },
  { concepto: "Transferencias exentas de IVA", bruto: "408", neto: "418" },
  { concepto: "Total ventas y otras operaciones", bruto: "409", neto: "419", impuesto: "429" },
  { concepto: "Transferencias no objeto o exentas", bruto: "431", neto: "441" },
  { concepto: "IVA diferenciado", bruto: "442" },
  { concepto: "Notas de crédito emitidas", bruto: "443", neto: "453" },
  { concepto: "Ajustes de ventas", bruto: "434", neto: "444", impuesto: "454" },
];

const comprasHorizontalRows: TripletRow[] = [
  { concepto: "Adquisiciones gravadas con derecho a crédito tributario", bruto: "500", neto: "510", impuesto: "520" },
  { concepto: "Adquisiciones gravadas sin derecho a crédito tributario", bruto: "501", neto: "511", impuesto: "521" },
  { concepto: "Adquisiciones especiales", bruto: "530", neto: "533", impuesto: "534" },
  { concepto: "Importaciones", bruto: "540", neto: "550", impuesto: "560" },
  { concepto: "Adquisiciones tarifa 0%", bruto: "502", neto: "512", impuesto: "522" },
  { concepto: "Adquisiciones no objeto de IVA", bruto: "503", neto: "513", impuesto: "523" },
  { concepto: "Adquisiciones exentas", bruto: "504", neto: "514", impuesto: "524" },
  { concepto: "Adquisiciones a contribuyentes RISE", bruto: "505", neto: "515", impuesto: "525" },
  { concepto: "IVA generado en importaciones de servicios", bruto: "526" },
  { concepto: "IVA generado en adquisiciones especiales", bruto: "527" },
  { concepto: "Adquisiciones locales", bruto: "506", neto: "516" },
  { concepto: "Adquisiciones tarifa 0%", bruto: "507", neto: "517" },
  { concepto: "Adquisiciones no objeto/exentas", bruto: "508", neto: "518" },
  { concepto: "Total adquisiciones y pagos", bruto: "509", neto: "519", impuesto: "529" },
  { concepto: "Notas de crédito recibidas", bruto: "531", impuesto: "541" },
  { concepto: "Ajustes por notas de crédito", bruto: "532", impuesto: "542" },
  { concepto: "IVA diferenciado en adquisiciones", bruto: "543" },
  { concepto: "Importaciones y ajustes", bruto: "544", neto: "554" },
  { concepto: "Otras adquisiciones", bruto: "535", neto: "545", impuesto: "555" },
];

const liquidacionIvaRows: SimpleRow[] = [
  { code: "480", label: "Total transferencias" },
  { code: "481", label: "Transferencias a crédito" },
  { code: "482", label: "Total impuesto generado" },
  { code: "483", label: "Impuesto diferido anterior" },
  { code: "484", label: "Impuesto a liquidar este mes" },
  { code: "485", label: "Ajuste próximo mes" },
  { code: "499", label: "Total impuesto a liquidar" },
];

const comprobantesEmitidosRows: SimpleRow[] = [
  { code: "111", label: "Comprobantes de venta", format: "integer" },
  { code: "113", label: "Notas de crédito emitidas", format: "integer" },
];

const creditoTributarioRows: SimpleRow[] = [
  { code: "563", label: "Factor de proporcionalidad", format: "factor" },
  { code: "564", label: "Crédito tributario aplicable" },
  { code: "565", label: "IVA no usado como crédito tributario" },
];

const comprobantesRecibidosRows: SimpleRow[] = [
  { code: "115", label: "Comprobantes de compra", format: "integer" },
  { code: "117", label: "Notas de crédito recibidas", format: "integer" },
  { code: "119", label: "Comprobantes anulados", format: "integer" },
];

const resumenImpositivoHorizontalRows: SimpleRow[] = [
  "601", "602", "603", "604", "605", "606", "607", "608", "609", "622", "610", "611", "612", "613", "614", "615", "617", "618", "619", "625", "620", "621", "699",
].map((code) => ({ code, label: resumenRows.find(([key]) => key === code)?.[1] || "Casillero" }));

const agenteRetencionRows: SimpleRow[] = [
  "721", "723", "725", "727", "729", "731", "799", "800", "802", "801", "859",
].map((code) => ({ code, label: retencionesRows.find(([key]) => key === code)?.[1] || "Casillero" }));

const valoresPagarRows: SimpleRow[] = [
  { code: "890", label: "Pago previo" },
  { code: "897", label: "Interés pago previo" },
  { code: "898", label: "Impuesto pago previo" },
  { code: "899", label: "Multa pago previo" },
  { code: "880", label: "Total valores imputables" },
  { code: "902", label: "Total impuesto a pagar" },
  { code: "903", label: "Interés" },
  { code: "904", label: "Multa" },
  { code: "999", label: "Total pagado" },
  { code: "905", label: "Pago en efectivo/débito" },
  { code: "906", label: "Pago con notas de crédito" },
  { code: "907", label: "Pago con compensación" },
  { code: "925", label: "Pago en exceso" },
];

function toNumber(value: string | number | undefined) {
  if (value === undefined || value === null) return 0;
  const num = Number(String(value).replace(",", ".").trim());
  return Number.isFinite(num) ? num : 0;
}

function money(value: number) {
  return value.toFixed(2);
}

function numberToInput(value: unknown) {
  return money(Number(value || 0));
}

export default function Formulario104Wizard({ rucUsuario, razonSocial }: Props) {
  const [step, setStep] = useState(1);
  const [periodicidad, setPeriodicidad] = useState<"Mensual" | "Semestral">("Mensual");
  const [mes, setMes] = useState("04");
  const [semestre, setSemestre] = useState("Primer Semestre");
  const [anio, setAnio] = useState(new Date().getFullYear());
  const [questions, setQuestions] = useState(initialQuestions);
  const [form, setForm] = useState<FormState>(initialForm);
  const [periodoData, setPeriodoData] = useState<Formulario104Response | null>(null);
  const [datosCargados, setDatosCargados] = useState(false);
  const [loadingDatos, setLoadingDatos] = useState(false);
  const [loadingEnviar, setLoadingEnviar] = useState(false);
  const [draftSaved, setDraftSaved] = useState(false);
  const [confirmado, setConfirmado] = useState(false);
  const [mensaje, setMensaje] = useState("");
  const [errors, setErrors] = useState<string[]>([]);

  const totals = useMemo(() => {
    const impuestoGenerado =
      toNumber(form["421"]) ||
      toNumber(form["402"]) + toNumber(form["404"]) + toNumber(form["406"]) + toNumber(form["422"]);
    const totalVentas =
      toNumber(form["401"]) +
      toNumber(form["403"]) +
      toNumber(form["405"]) +
      toNumber(form["407"]) +
      toNumber(form["408"]) +
      toNumber(form["431"]);
    const ventasConDerecho =
      toNumber(form["401"]) + toNumber(form["405"]) + toNumber(form["407"]) + toNumber(form["408"]);
    const factorProporcionalidad = toNumber(form["563"]) || (totalVentas > 0 ? ventasConDerecho / totalVentas : 0);
    const creditoCompras = (toNumber(form["529"]) || toNumber(form["501"])) * factorProporcionalidad;
    const creditoAnteriorCompras = toNumber(form["605"]);
    const creditoAnteriorRetenciones = toNumber(form["606"]);
    const retencionesRecibidas = toNumber(form["609"]);
    const pagoPrevioImpuesto = toNumber(form["898"]);
    const impuestoLiquidar = toNumber(form["499"]) || impuestoGenerado;
    const impuestoRetenido = toNumber(form["799"]);
    const otrosValoresRetencion = toNumber(form["800"]);
    const interes = toNumber(form["903"]);
    const multa = toNumber(form["904"]);
    const pagoPrevioInteres = toNumber(form["897"]);
    const pagoPrevioMulta = toNumber(form["899"]);

    const impuestoCausado = Math.max(impuestoLiquidar - creditoCompras, 0);
    const saldoCompras = Math.max(creditoCompras + creditoAnteriorCompras - impuestoLiquidar, 0);
    const impuestoLuegoCreditoCompras = Math.max(
      impuestoLiquidar - creditoCompras - creditoAnteriorCompras,
      0
    );
    const saldoRetenciones = Math.max(
      creditoAnteriorRetenciones + retencionesRecibidas - impuestoLuegoCreditoCompras,
      0
    );
    const subtotalPercepcion = Math.max(
      impuestoCausado -
        saldoCompras -
        toNumber(form["603"]) -
        toNumber(form["604"]) -
        creditoAnteriorRetenciones -
        toNumber(form["607"]) -
        toNumber(form["608"]) -
        retencionesRecibidas +
        toNumber(form["610"]) +
        toNumber(form["611"]) +
        toNumber(form["612"]) +
        toNumber(form["613"]) +
        toNumber(form["614"]),
      0
    );
    const impuestoPercepcion = subtotalPercepcion + toNumber(form["621"]);
    const impuestoRetencion = toNumber(form["801"]) || Math.max(impuestoRetenido - otrosValoresRetencion, 0);
    const totalConsolidado = toNumber(form["859"]) || impuestoPercepcion + impuestoRetencion;
    const impuestoAPagar = Math.max(totalConsolidado - pagoPrevioImpuesto, 0);

    return {
      "429": impuestoGenerado,
      "499": impuestoLiquidar,
      "563": factorProporcionalidad,
      "564": creditoCompras,
      "601": impuestoCausado,
      "602": saldoCompras,
      "615": saldoCompras,
      "617": saldoRetenciones,
      "620": subtotalPercepcion,
      "699": impuestoPercepcion,
      "799": impuestoRetenido,
      "801": impuestoRetencion,
      "859": totalConsolidado,
      "902": impuestoAPagar,
      "905": toNumber(form["905"]) || Math.max(impuestoAPagar + Math.max(interes - pagoPrevioInteres, 0) + Math.max(multa - pagoPrevioMulta, 0), 0),
      "999": toNumber(form["905"]) || Math.max(impuestoAPagar + Math.max(interes - pagoPrevioInteres, 0) + Math.max(multa - pagoPrevioMulta, 0), 0),
    };
  }, [form]);

  const updateQuestion = (key: QuestionKey, value: "SI" | "NO") => {
    setQuestions((prev) => ({ ...prev, [key]: value }));
  };

  const updateForm = (key: string, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const atsContribuyente = periodicidad === "Mensual" ? getLastAtsContribuyenteForPeriod(anio, mes) : null;
  const rucDeclaracion = atsContribuyente?.ruc || rucUsuario;
  const razonSocialDeclaracion = atsContribuyente?.razonSocial || razonSocial || "";

  const setFormularioEnCero = () => {
    setForm((prev) => ({
      ...initialForm,
      formaPago: prev.formaPago,
      banco: prev.banco,
      tipoCuenta: prev.tipoCuenta,
      numeroCuenta: prev.numeroCuenta,
      rucContador: prev.rucContador,
      claveContador: prev.claveContador,
    }));
    setDatosCargados(true);
    setMensaje("No existen valores para declarar.");
  };

  const cargarInformacionPeriodo = async () => {
    try {
      setLoadingDatos(true);
      setMensaje("");
      setErrors([]);

      const params = new URLSearchParams({
        anio: String(anio),
      });

      if (periodicidad === "Mensual") {
        params.set("mes", mes);
      } else {
        params.set("semestre", semestre);
      }

      const response = await authFetch(
        `${apiUrl}/api/declaraciones/${rucDeclaracion}/formulario104?${params}`
      );
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "No fue posible consultar la información del período seleccionado.");
      }

      const casilleros = data.casilleros || {};
      const nextForm: FormState = { ...initialForm };

      numericCasilleros.forEach((key) => {
        nextForm[key] = numberToInput(casilleros[key] ?? 0);
      });

      nextForm.formaPago = form.formaPago || "CONVENIO_DEBITO";
      nextForm.banco = form.banco || "Banco Pichincha";
      nextForm.tipoCuenta = form.tipoCuenta || "Ahorros";
      nextForm.numeroCuenta = form.numeroCuenta || "";
      nextForm.rucContador = form.rucContador || "";
      nextForm.claveContador = form.claveContador || "";

      setForm(nextForm);
      setPeriodoData(data);
      setDatosCargados(true);

      const existenValores = Object.values(casilleros).some((value) => Number(value || 0) > 0);
      setQuestions((prev) => ({
        ...prev,
        informaValores: existenValores ? "SI" : "NO",
        realizoVentas: Number(casilleros["401"] || 0) + Number(casilleros["403"] || 0) + Number(casilleros["431"] || 0) > 0 ? "SI" : prev.realizoVentas,
        realizoCompras: Number(casilleros["500"] || 0) + Number(casilleros["507"] || 0) > 0 ? "SI" : prev.realizoCompras,
        recibioRetenciones: Number(casilleros["609"] || 0) > 0 ? "SI" : prev.recibioRetenciones,
        efectuoRetenciones: Number(casilleros["731"] || 0) > 0 ? "SI" : prev.efectuoRetenciones,
      }));

      setMensaje(
        existenValores
          ? "Se encontró información para el período seleccionado. Revise los valores sugeridos antes de continuar."
          : "No existen valores para declarar."
      );
    } catch (err) {
      setMensaje(err instanceof Error ? err.message : "No fue posible consultar la información del período seleccionado.");
      setDatosCargados(false);
    } finally {
      setLoadingDatos(false);
    }
  };

  const validateStep = () => {
    const nextErrors: string[] = [];

    if (step === 1) {
      if (!anio) nextErrors.push("Debe seleccionar el año fiscal.");
      if (periodicidad === "Mensual" && !mes) nextErrors.push("Debe seleccionar el mes.");
      if (periodicidad === "Semestral" && !semestre) nextErrors.push("Debe seleccionar el semestre.");
    }

    if (step === 3) {
      if (toNumber(form["402"]) > 0 && toNumber(form["401"]) <= 0) {
        nextErrors.push("Revise ventas gravadas: existe impuesto generado sin base imponible.");
      }

      if (toNumber(form["501"]) > 0 && toNumber(form["500"]) <= 0) {
        nextErrors.push("Revise adquisiciones gravadas: existe crédito tributario sin base imponible.");
      }

      if (questions.informaValores === "NO" && totals["902"] > 0) {
        nextErrors.push("Respondió que no informa valores, pero la declaración registra impuesto a pagar.");
      }
    }

    if (step === 4) {
      if (!confirmado) {
        nextErrors.push("Debe confirmar que los datos proporcionados son exactos y verdaderos.");
      }

      if (questions.obligadoContabilidad === "SI") {
        if (!form.rucContador.trim()) nextErrors.push("Debe ingresar el RUC del contador.");
        if (!form.claveContador.trim()) nextErrors.push("Debe ingresar la clave del contador.");
      }
    }

    setErrors(nextErrors);
    return nextErrors.length === 0;
  };

  const nextStep = async () => {
    if (!validateStep()) return;

    if (step === 1) {
      await cargarInformacionPeriodo();
    }

    if (step === 2 && questions.informaValores === "NO") {
      setFormularioEnCero();
    }

    setStep((prev) => Math.min(prev + 1, 4));
  };

  const prevStep = () => {
    setErrors([]);
    setStep((prev) => Math.max(prev - 1, 1));
  };

  const buildCasilleros = () => ({
    ...Object.fromEntries(
      Object.entries(form)
        .filter(([key]) => /^\d+$/.test(key))
        .map(([key, value]) => [key, toNumber(value)])
    ),
    429: totals["429"],
    499: totals["499"],
    563: totals["563"],
    564: totals["564"],
    601: totals["601"],
    602: totals["602"],
    615: totals["615"],
    617: totals["617"],
    620: totals["620"],
    699: totals["699"],
    799: totals["799"],
    801: totals["801"],
    859: totals["859"],
    902: totals["902"],
    905: totals["905"],
    999: totals["999"],
  });

  const buildPayload = (estado?: "BORRADOR" | "PRESENTADA") => {
    const casilleros = buildCasilleros();

    return {
      ...(estado ? { estado } : {}),
      tipoImpuesto: "Impuesto al Valor Agregado",
      formulario: "Formulario 104 - IVA",
      periodoFiscal: periodicidad,
      anio: Number(anio),
      mes: periodicidad === "Mensual" ? meses.find((item) => item.value === mes)?.label || mes : null,
      semestre: periodicidad === "Semestral" ? semestre : null,
      tipoDeclaracion: "Original",
      ventasPeriodo: questions.realizoVentas === "SI",
      emitioRetenciones: questions.efectuoRetenciones === "SI",
      valorCancelado: totals["999"],
      baseImponible: toNumber(form["401"]) + toNumber(form["403"]) + toNumber(form["405"]) + toNumber(form["431"]),
      impuestoGenerado: totals["429"],
      valorRetenido: toNumber(form["609"]),
      tipoPago: form.formaPago,
      banco: form.banco,
      tipoCuenta: form.tipoCuenta,
      numeroCuenta: form.numeroCuenta,
      datosJSON: {
        resumen: periodoData?.resumen || null,
        identificacion: {
          periodicidad,
          mes,
          semestre,
          anio,
          ruc: periodoData?.ruc || rucDeclaracion,
          razonSocial: periodoData?.razonSocial || razonSocialDeclaracion,
        },
        preguntas: questions,
        sugerenciasATS: periodoData
          ? Object.fromEntries(
              numericCasilleros.map((key) => [key, Number(periodoData.casilleros?.[key] || 0)])
            )
          : null,
        casilleros,
        confirmacion: confirmado,
      },
    };
  };

  const saveDraft = async () => {
    try {
      setLoadingEnviar(true);
      setMensaje("");
      const res = await authFetch(`${apiUrl}/api/declaraciones/${rucDeclaracion}/crear`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildPayload("BORRADOR")),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "No fue posible guardar el borrador.");

      localStorage.setItem(
        `formulario104-${rucDeclaracion}`,
        JSON.stringify({ periodicidad, mes, semestre, anio, questions, form, totals, periodoData })
      );
      setDraftSaved(true);
      setMensaje("Borrador guardado correctamente.");
      setTimeout(() => setDraftSaved(false), 3500);
    } catch (err) {
      setMensaje(err instanceof Error ? err.message : "Error guardando borrador.");
    } finally {
      setLoadingEnviar(false);
    }
  };

  const enviarDeclaracion = async () => {
    if (!validateStep()) return;

    try {
      setLoadingEnviar(true);
      setMensaje("");

      const res = await authFetch(`${apiUrl}/api/declaraciones/${rucDeclaracion}/crear`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildPayload("PRESENTADA")),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || "No fue posible procesar la declaración.");
      }

      setMensaje("Su declaración ha sido procesada satisfactoriamente.");
      localStorage.removeItem(`formulario104-${rucDeclaracion}`);
    } catch (err) {
      setMensaje(err instanceof Error ? err.message : "No fue posible procesar la declaración.");
    } finally {
      setLoadingEnviar(false);
    }
  };

  const rucFinal = periodoData?.ruc || rucDeclaracion;
  const razonSocialFinal = periodoData?.razonSocial || razonSocialDeclaracion;

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <Header />
      <StepBar step={step} />

      {mensaje && (
        <div
          className={`rounded-2xl border p-4 text-sm font-black ${
            mensaje.toLowerCase().includes("no fue posible") || mensaje.toLowerCase().includes("error")
              ? "border-red-200 bg-red-50 text-red-700"
              : "border-emerald-200 bg-emerald-50 text-emerald-700"
          }`}
        >
          {mensaje}
        </div>
      )}

      {errors.length > 0 && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-red-700">
          <div className="mb-3 flex items-center gap-2 font-black">
            <AlertCircle size={18} />
            Usted tiene {errors.length} observación(es) por revisar.
          </div>
          <ul className="list-disc space-y-1 pl-6 text-sm font-semibold">
            {errors.map((item, index) => (
              <li key={index}>{item}</li>
            ))}
          </ul>
        </div>
      )}

      {draftSaved && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-black text-emerald-700">
          Su declaración borrador ha sido guardada exitosamente.
        </div>
      )}

      {step === 1 && (
        <Panel title="1. Período fiscal">
          {atsContribuyente && (
            <div className="mb-4 rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
              <p className="font-black">Declaración para contribuyente detectado ATS</p>
              <p className="mt-1 font-semibold">
                RUC: {atsContribuyente.ruc} · Razón social: {atsContribuyente.razonSocial} · Lote: {atsContribuyente.loteId}
              </p>
            </div>
          )}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Field label="Obligación">
              <select
                className="input"
                value={periodicidad}
                onChange={(e) => setPeriodicidad(e.target.value as "Mensual" | "Semestral")}
              >
                <option value="Mensual">IVA mensual</option>
                <option value="Semestral">IVA semestral</option>
              </select>
            </Field>

            <Field label="Año">
              <select className="input" value={anio} onChange={(e) => setAnio(Number(e.target.value))}>
                {years.map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
            </Field>

            {periodicidad === "Mensual" ? (
              <Field label="Mes">
                <select className="input" value={mes} onChange={(e) => setMes(e.target.value)}>
                  {meses.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.value} - {item.label}
                    </option>
                  ))}
                </select>
              </Field>
            ) : (
              <Field label="Semestre">
                <select className="input" value={semestre} onChange={(e) => setSemestre(e.target.value)}>
                  <option>Primer Semestre</option>
                  <option>Segundo Semestre</option>
                </select>
              </Field>
            )}
          </div>

          <div className="mt-5 rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm font-bold text-blue-700">
            Al continuar, el sistema consultará la información disponible para el período seleccionado.
          </div>
        </Panel>
      )}

      {step === 2 && (
        <Panel title="2. Preguntas">
          {periodoData?.resumen && (
            <div className="mb-5 grid grid-cols-1 gap-3 md:grid-cols-2">
              <InfoBox label="Comprobantes de venta" value={String(periodoData.resumen.ventasLeidas)} />
              <InfoBox label="Comprobantes de compra" value={String(periodoData.resumen.comprasLeidas)} />
            </div>
          )}

          <div className="space-y-3">
            <QuestionRow
              text="¿Requiere informar valores en su declaración de este período?"
              value={questions.informaValores}
              onChange={(value) => updateQuestion("informaValores", value)}
            />
            <QuestionRow
              text="¿Realizó ventas u otras operaciones durante el período?"
              value={questions.realizoVentas}
              onChange={(value) => updateQuestion("realizoVentas", value)}
            />
            <QuestionRow
              text="¿Realizó adquisiciones o pagos durante el período?"
              value={questions.realizoCompras}
              onChange={(value) => updateQuestion("realizoCompras", value)}
            />
            <QuestionRow
              text="¿Recibió retenciones de IVA?"
              value={questions.recibioRetenciones}
              onChange={(value) => updateQuestion("recibioRetenciones", value)}
            />
            <QuestionRow
              text="¿Efectuó retenciones de IVA?"
              value={questions.efectuoRetenciones}
              onChange={(value) => updateQuestion("efectuoRetenciones", value)}
            />
          </div>

          <div className="mt-6">
            <GhostButton onClick={cargarInformacionPeriodo}>
              {loadingDatos ? <Loader2 className="animate-spin" size={16} /> : <CheckCircle2 size={16} />}
              Consultar nuevamente
            </GhostButton>
          </div>
        </Panel>
      )}

      {step === 3 && (
        <Panel title="3. Formulario">
          {!datosCargados && (
            <div className="mb-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-black text-amber-800">
              Todavía no se ha consultado información para este período. Regrese al paso 1 o pulse “Consultar nuevamente”.
            </div>
          )}

          <div className="mb-5 grid grid-cols-1 gap-4 md:grid-cols-2">
            <ReadBox label="RUC 201" value={rucFinal} />
            <ReadBox label="Razón social 202" value={razonSocialFinal || "-"} />
          </div>

          {periodoData?.resumen?.requiereRevision?.length ? (
            <div className="mb-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-800">
              Revise los valores sugeridos antes de continuar. Algunos casilleros requieren validación porque la información disponible no permite clasificarlos automáticamente.
            </div>
          ) : null}

          <div className="space-y-5">
            <Identificacion104
              periodicidad={periodicidad}
              mes={mes}
              mesTexto={meses.find((item) => item.value === mes)?.label || mes}
              anio={anio}
              ruc={rucFinal}
              razonSocial={razonSocialFinal || "-"}
            />
            <TripletTable title="Resumen de ventas y otras operaciones" rows={ventasHorizontalRows} form={form} totals={totals} onChange={updateForm} />
            <SimpleTable title="Liquidación del IVA en el mes" rows={liquidacionIvaRows} form={form} totals={totals} onChange={updateForm} />
            <SimpleTable title="Comprobantes emitidos" rows={comprobantesEmitidosRows} form={form} totals={totals} onChange={updateForm} />
            <TripletTable title="Resumen de adquisiciones y pagos" rows={comprasHorizontalRows} form={form} totals={totals} onChange={updateForm} />
            <SimpleTable title="Crédito tributario" rows={creditoTributarioRows} form={form} totals={totals} onChange={updateForm} />
            <SimpleTable title="Comprobantes recibidos" rows={comprobantesRecibidosRows} form={form} totals={totals} onChange={updateForm} />
            <SimpleTable title="Resumen impositivo" rows={resumenImpositivoHorizontalRows} form={form} totals={totals} onChange={updateForm} />
            <SimpleTable title="Agente de retención IVA" rows={agenteRetencionRows} form={form} totals={totals} onChange={updateForm} />
            <SimpleTable title="Valores a pagar" rows={valoresPagarRows} form={form} totals={totals} onChange={updateForm} />
          </div>
        </Panel>
      )}

      {step === 4 && (
        <Panel title="Confirmación de declaración">
          <section className="rounded-2xl border bg-slate-50 p-5">
            <h3 className="mb-4 font-black text-[#003565]">Resumen de la declaración</h3>
            <SummaryText label="Formulario" value="Formulario 104" />
            <SummaryText label="RUC" value={rucFinal} />
            <SummaryText label="Razón social" value={razonSocialFinal || "-"} />
            <SummaryText label="Período" value={`${periodicidad === "Mensual" ? meses.find((item) => item.value === mes)?.label || mes : semestre} / ${anio}`} />
            <SummaryText label="Total impuesto a pagar" value={`$${money(totals["902"])}`} strong />
            <SummaryText label="Total pagado" value={`$${money(totals["999"])}`} strong />

            <label className="mt-5 flex items-start gap-3 rounded-2xl border bg-white p-4 text-sm font-bold text-slate-700">
              <input
                type="checkbox"
                className="mt-1 h-4 w-4"
                checked={confirmado}
                onChange={(event) => setConfirmado(event.target.checked)}
              />
              <span>Declaro que los datos proporcionados son exactos y verdaderos.</span>
            </label>

            <div className="mt-5 rounded-2xl border bg-white p-4">
              <QuestionRow
                text="¿Requiere firma de contador para esta declaración?"
                value={questions.obligadoContabilidad}
                onChange={(value) => updateQuestion("obligadoContabilidad", value)}
              />

              {questions.obligadoContabilidad === "SI" && (
                <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                  <Field label="RUC contador">
                    <input className="input" value={form.rucContador} onChange={(e) => updateForm("rucContador", e.target.value.replace(/\D/g, ""))} />
                  </Field>
                  <Field label="Clave contador">
                    <input className="input" type="password" value={form.claveContador} onChange={(e) => updateForm("claveContador", e.target.value)} />
                  </Field>
                </div>
              )}
            </div>
          </section>
        </Panel>
      )}

      <div className="flex flex-wrap justify-between gap-3">
        <button
          onClick={prevStep}
          disabled={step === 1 || loadingDatos}
          className="inline-flex items-center gap-2 rounded-xl bg-slate-100 px-5 py-3 font-black text-slate-700 disabled:opacity-50"
        >
          <ChevronLeft size={18} />
          Anterior
        </button>

        <div className="flex flex-wrap gap-3">
          <button
            onClick={saveDraft}
            disabled={loadingDatos}
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-5 py-3 font-black text-white disabled:opacity-60"
          >
            <Save size={18} />
            Guardar borrador
          </button>

          {step < 4 ? (
            <button
              onClick={nextStep}
              disabled={loadingDatos}
              className="inline-flex items-center gap-2 rounded-xl bg-[#003565] px-5 py-3 font-black text-white disabled:opacity-60"
            >
              {loadingDatos ? <Loader2 className="animate-spin" size={18} /> : "Siguiente"}
              {!loadingDatos && <ChevronRight size={18} />}
            </button>
          ) : (
            <button
              onClick={enviarDeclaracion}
              disabled={loadingEnviar || !confirmado}
              className="inline-flex items-center gap-2 rounded-xl bg-[#003565] px-5 py-3 font-black text-white disabled:opacity-60"
            >
              {loadingEnviar ? <Loader2 className="animate-spin" size={18} /> : <Send size={18} />}
              Aceptar y enviar
            </button>
          )}
        </div>
      </div>

      <style>{`
        .input {
          margin-top: 0.5rem;
          width: 100%;
          border-radius: 0.85rem;
          border: 1px solid #e2e8f0;
          background: #f8fafc;
          padding: 0.75rem 0.9rem;
          font-size: 0.875rem;
          font-weight: 700;
          outline: none;
        }
      `}</style>
    </div>
  );
}

function Header() {
  return (
    <section className="rounded-[2rem] border bg-white p-7 shadow-sm">
      <div className="flex items-center gap-4">
        <div className="rounded-2xl bg-slate-100 p-4 text-slate-700">
          <FileSpreadsheet size={28} />
        </div>
        <div>
          <h1 className="text-2xl font-black text-[#003565]">Formulario 104</h1>
          <p className="text-sm text-slate-500">Elaboración y envío de la declaración de IVA.</p>
        </div>
      </div>
    </section>
  );
}

function StepBar({ step }: { step: number }) {
  const items = ["Período fiscal", "Preguntas", "Formulario", "Pago"];

  return (
    <div className="rounded-[2rem] border bg-white p-5 shadow-sm">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
        {items.map((item, index) => {
          const active = step === index + 1;
          const done = step > index + 1;

          return (
            <div
              key={item}
              className={`rounded-2xl border p-4 ${
                active
                  ? "border-[#003565] bg-blue-50 text-[#003565]"
                  : done
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : "bg-slate-50 text-slate-500"
              }`}
            >
              <div className="flex items-center gap-3">
                <span
                  className={`flex h-9 w-9 items-center justify-center rounded-full font-black ${
                    active
                      ? "bg-[#003565] text-white"
                      : done
                      ? "bg-emerald-600 text-white"
                      : "bg-white text-slate-500"
                  }`}
                >
                  {done ? <CheckCircle2 size={18} /> : index + 1}
                </span>
                <span className="font-black">{item}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-[2rem] border bg-white p-7 shadow-sm">
      <h2 className="mb-5 text-xl font-black text-[#003565]">{title}</h2>
      {children}
    </section>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="text-[11px] font-black uppercase text-slate-400">{label}</span>
      {children}
    </label>
  );
}

function InfoBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border bg-slate-50 p-4">
      <p className="text-[10px] font-black uppercase text-slate-400">{label}</p>
      <p className="text-xl font-black text-[#003565]">{value}</p>
    </div>
  );
}

function ReadBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border bg-slate-50 p-4">
      <p className="text-[11px] font-black uppercase text-slate-400">{label}</p>
      <p className="mt-1 font-black text-slate-700">{value}</p>
    </div>
  );
}

function Identificacion104({
  periodicidad,
  mes,
  mesTexto,
  anio,
  ruc,
  razonSocial,
}: {
  periodicidad: string;
  mes: string;
  mesTexto: string;
  anio: number;
  ruc: string;
  razonSocial: string;
}) {
  return (
    <div className="overflow-x-auto rounded-2xl border">
      <table className="min-w-[760px] w-full text-sm">
        <thead>
          <tr className="bg-[#003565] text-left text-xs uppercase text-white">
            <th className="px-3 py-3">Sección</th>
            <th className="px-3 py-3 text-center">Código</th>
            <th className="px-3 py-3">Valor</th>
          </tr>
        </thead>
        <tbody>
          {[
            ["Identificación de la declaración", "101", periodicidad === "Mensual" ? `${mes} - ${mesTexto}` : periodicidad],
            ["Identificación de la declaración", "102", String(anio)],
            ["Identificación del sujeto pasivo", "201", ruc],
            ["Identificación del sujeto pasivo", "202", razonSocial],
          ].map(([section, code, value]) => (
            <tr key={code} className="border-t">
              <td className="px-3 py-2 font-bold text-slate-700">{section}</td>
              <td className="px-3 py-2 text-center font-black text-slate-600">{code}</td>
              <td className="px-3 py-2 font-black text-slate-700">{value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function displayCasilleroValue(code: string, form: FormState, totals: Record<string, number>) {
  const raw = Object.prototype.hasOwnProperty.call(totals, code) ? totals[code] : toNumber(form[code]);
  return code === "563" ? raw.toFixed(4) : money(raw);
}

function CasilleroInput({
  code,
  form,
  totals,
  onChange,
}: {
  code?: string;
  form: FormState;
  totals: Record<string, number>;
  onChange: (key: string, value: string) => void;
}) {
  if (!code) return <span />;
  const calculated = Object.prototype.hasOwnProperty.call(totals, code);
  if (calculated) {
    return <span className="block rounded-lg bg-slate-50 px-2 py-1.5 text-right font-black text-slate-700">{displayCasilleroValue(code, form, totals)}</span>;
  }

  return (
    <input
      type="number"
      min="0"
      step="0.01"
      value={form[code] || "0.00"}
      onChange={(event) => onChange(code, event.target.value)}
      className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-right text-sm font-bold text-slate-700 outline-none focus:border-[#003565]"
    />
  );
}

function TripletTable({
  title,
  rows,
  form,
  totals,
  onChange,
}: {
  title: string;
  rows: TripletRow[];
  form: FormState;
  totals: Record<string, number>;
  onChange: (key: string, value: string) => void;
}) {
  return (
    <div className="overflow-x-auto rounded-2xl border">
      <table className="min-w-[920px] w-full text-sm">
        <thead>
          <tr className="bg-[#003565] text-left text-xs uppercase text-white">
            <th colSpan={4} className="px-3 py-2">{title}</th>
          </tr>
          <tr className="bg-slate-100 text-xs uppercase text-slate-600">
            <th className="w-[46%] px-3 py-2">Concepto</th>
            <th className="w-[18%] px-3 py-2 text-right">Valor bruto</th>
            <th className="w-[18%] px-3 py-2 text-right">Valor neto</th>
            <th className="w-[18%] px-3 py-2 text-right">Impuesto generado</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={`${title}-${row.concepto}`} className="border-t">
              <td className="px-3 py-2 font-bold text-slate-700">{row.concepto}</td>
              <td className="px-3 py-2"><CodeValue code={row.bruto} form={form} totals={totals} onChange={onChange} /></td>
              <td className="px-3 py-2"><CodeValue code={row.neto} form={form} totals={totals} onChange={onChange} /></td>
              <td className="px-3 py-2"><CodeValue code={row.impuesto} form={form} totals={totals} onChange={onChange} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CodeValue({
  code,
  form,
  totals,
  onChange,
}: {
  code?: string;
  form: FormState;
  totals: Record<string, number>;
  onChange: (key: string, value: string) => void;
}) {
  if (!code) return <span className="block text-right text-slate-300">-</span>;
  return (
    <div>
      <div className="mb-1 text-right text-[10px] font-black text-slate-400">{code}</div>
      <CasilleroInput code={code} form={form} totals={totals} onChange={onChange} />
    </div>
  );
}

function SimpleTable({
  title,
  rows,
  form,
  totals,
  onChange,
}: {
  title: string;
  rows: SimpleRow[];
  form: FormState;
  totals: Record<string, number>;
  onChange: (key: string, value: string) => void;
}) {
  return (
    <div className="overflow-x-auto rounded-2xl border">
      <table className="min-w-[760px] w-full text-sm">
        <thead>
          <tr className="bg-[#003565] text-left text-xs uppercase text-white">
            <th colSpan={3} className="px-3 py-2">{title}</th>
          </tr>
          <tr className="bg-slate-100 text-xs uppercase text-slate-600">
            <th className="w-[14%] px-3 py-2 text-center">Casillero</th>
            <th className="px-3 py-2">Concepto</th>
            <th className="w-[24%] px-3 py-2 text-right">Valor</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={`${title}-${row.code}`} className="border-t">
              <td className="px-3 py-2 text-center font-black text-slate-600">{row.code}</td>
              <td className="px-3 py-2 font-bold text-slate-700">{row.label}</td>
              <td className="px-3 py-2"><CasilleroInput code={row.code} form={form} totals={totals} onChange={onChange} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function QuestionRow({
  text,
  value,
  onChange,
}: {
  text: string;
  value: "SI" | "NO";
  onChange: (value: "SI" | "NO") => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-4 rounded-2xl border bg-slate-50 p-4 md:grid-cols-[1fr_180px] md:items-center">
      <div className="flex items-start gap-2">
        <span className="font-bold text-slate-700">{text}</span>
        <HelpCircle className="mt-0.5 text-blue-600" size={16} />
      </div>
      <div className="flex gap-2">
        {(["SI", "NO"] as const).map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => onChange(item)}
            className={`rounded-xl px-4 py-2 text-sm font-black ${
              value === item ? "bg-[#003565] text-white" : "border bg-white text-slate-600"
            }`}
          >
            {item === "SI" ? "Sí" : "No"}
          </button>
        ))}
      </div>
    </div>
  );
}

function GhostButton({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-2 rounded-xl border bg-white px-4 py-3 text-sm font-black text-[#003565] hover:bg-slate-50"
    >
      {children}
    </button>
  );
}

function SummaryText({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`flex items-center justify-between border-b py-3 ${strong ? "font-black text-[#003565]" : "font-bold text-slate-700"}`}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}
