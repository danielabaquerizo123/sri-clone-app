import { useMemo, useState, type ReactNode } from "react";
import {
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  FileSpreadsheet,
  HelpCircle,
  Loader2,
  Save,
  Send,
} from "lucide-react";

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
  "401",
  "402",
  "403",
  "404",
  "405",
  "406",
  "407",
  "408",
  "421",
  "422",
  "429",
  "431",
  "480",
  "481",
  "484",
  "500",
  "501",
  "502",
  "507",
  "518",
  "531",
  "532",
  "563",
  "564",
  "601",
  "602",
  "603",
  "604",
  "605",
  "606",
  "607",
  "608",
  "609",
  "615",
  "617",
  "620",
  "699",
  "721",
  "723",
  "725",
  "727",
  "729",
  "731",
  "800",
  "890",
  "897",
  "898",
  "899",
  "902",
  "903",
  "904",
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

const ventasRows = [
  ["401", "402", "Ventas locales gravadas con tarifa diferente de cero"],
  ["403", "404", "Ventas locales tarifa 0% sin derecho a crédito tributario"],
  ["405", "406", "Ventas locales tarifa 0% con derecho a crédito tributario"],
  ["407", "", "Exportaciones de bienes"],
  ["408", "", "Exportaciones de servicios"],
  ["421", "422", "Ventas tarifa diferente de cero - casos especiales"],
  ["431", "", "Transferencias no objeto o exentas"],
  ["480", "", "Transferencias gravadas a contado este mes"],
  ["481", "", "Transferencias gravadas a crédito este mes"],
  ["484", "", "Impuesto a liquidar en este mes"],
];

const comprasRows = [
  ["500", "501", "Adquisiciones gravadas con derecho a crédito tributario"],
  ["502", "", "Adquisiciones gravadas sin derecho a crédito tributario"],
  ["507", "", "Adquisiciones tarifa 0%"],
  ["518", "", "Adquisiciones realizadas a contribuyentes RISE"],
  ["531", "", "Adquisiciones no objeto de IVA"],
  ["532", "", "Adquisiciones exentas de IVA"],
];

const resumenRows = [
  ["563", "Factor de proporcionalidad"],
  ["564", "Crédito tributario aplicable"],
  ["601", "Impuesto causado"],
  ["602", "Crédito tributario aplicable"],
  ["603", "Compensaciones"],
  ["604", "Devoluciones"],
  ["605", "Saldo crédito tributario mes anterior por adquisiciones"],
  ["606", "Saldo crédito tributario mes anterior por retenciones"],
  ["607", "Ajustes por crédito tributario"],
  ["608", "Otros créditos tributarios"],
  ["609", "Retenciones IVA recibidas"],
  ["615", "Saldo crédito tributario próximo mes por adquisiciones"],
  ["617", "Saldo crédito tributario próximo mes por retenciones"],
  ["620", "Saldo impuesto antes de imputaciones"],
  ["699", "Total impuesto a pagar antes de intereses y multas"],
  ["800", "Otros valores imputables"],
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
  const [mensaje, setMensaje] = useState("");
  const [errors, setErrors] = useState<string[]>([]);
  const [openSections, setOpenSections] = useState({
    ventas: true,
    compras: true,
    resumen: true,
    retenciones: false,
  });

  const totals = useMemo(() => {
    const impuestoGenerado =
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
    const factorProporcionalidad = totalVentas > 0 ? (ventasConDerecho / totalVentas) * 100 : 0;
    const creditoCompras = toNumber(form["501"]) * (factorProporcionalidad / 100);
    const creditoAnteriorCompras = toNumber(form["605"]);
    const creditoAnteriorRetenciones = toNumber(form["606"]);
    const retencionesRecibidas = toNumber(form["609"]);
    const pagoPrevioImpuesto = toNumber(form["898"]);
    const interes = toNumber(form["903"]);
    const multa = toNumber(form["904"]);
    const pagoPrevioInteres = toNumber(form["897"]);
    const pagoPrevioMulta = toNumber(form["899"]);

    const creditoDisponible =
      creditoCompras + creditoAnteriorCompras + creditoAnteriorRetenciones + retencionesRecibidas;
    const impuestoCausado = Math.max(impuestoGenerado - creditoCompras, 0);
    const impuestoAPagar = Math.max(impuestoGenerado - creditoDisponible - pagoPrevioImpuesto, 0);
    const saldoCompras = Math.max(creditoCompras + creditoAnteriorCompras - impuestoGenerado, 0);
    const impuestoLuegoCreditoCompras = Math.max(
      impuestoGenerado - creditoCompras - creditoAnteriorCompras,
      0
    );
    const saldoRetenciones = Math.max(
      creditoAnteriorRetenciones + retencionesRecibidas - impuestoLuegoCreditoCompras,
      0
    );

    return {
      "429": impuestoGenerado,
      "563": factorProporcionalidad,
      "564": creditoCompras,
      "601": impuestoCausado,
      "602": creditoCompras,
      "615": saldoCompras,
      "617": saldoRetenciones,
      "620": impuestoAPagar,
      "699": impuestoAPagar,
      "902": impuestoAPagar,
      "999": Math.max(impuestoAPagar + Math.max(interes - pagoPrevioInteres, 0) + Math.max(multa - pagoPrevioMulta, 0), 0),
    };
  }, [form]);

  const updateQuestion = (key: QuestionKey, value: "SI" | "NO") => {
    setQuestions((prev) => ({ ...prev, [key]: value }));
  };

  const updateForm = (key: string, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

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

      const response = await fetch(
        `${apiUrl}/api/declaraciones/${rucUsuario}/formulario104?${params}`
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
      if (form.formaPago === "CONVENIO_DEBITO" && totals["999"] > 0 && !form.numeroCuenta.trim()) {
        nextErrors.push("Debe ingresar el número de cuenta para convenio de débito.");
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

  const saveDraft = () => {
    localStorage.setItem(
      `formulario104-${rucUsuario}`,
      JSON.stringify({ periodicidad, mes, semestre, anio, questions, form, totals, periodoData })
    );
    setDraftSaved(true);
    setMensaje("Su declaración borrador ha sido guardada exitosamente.");
    setTimeout(() => setDraftSaved(false), 3500);
  };

  const enviarDeclaracion = async () => {
    if (!validateStep()) return;

    try {
      setLoadingEnviar(true);
      setMensaje("");

      const casilleros = {
        ...Object.fromEntries(
          Object.entries(form)
            .filter(([key]) => /^\d+$/.test(key))
            .map(([key, value]) => [key, toNumber(value)])
        ),
        429: totals["429"],
        563: totals["563"],
        564: totals["564"],
        601: totals["601"],
        602: totals["602"],
        615: totals["615"],
        617: totals["617"],
        620: totals["620"],
        699: totals["699"],
        902: totals["902"],
        999: totals["999"],
      };

      const payload = {
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
            ruc: periodoData?.ruc || rucUsuario,
            razonSocial: periodoData?.razonSocial || razonSocial,
          },
          preguntas: questions,
          sugerenciasATS: periodoData
            ? Object.fromEntries(
                numericCasilleros.map((key) => [key, Number(periodoData.casilleros?.[key] || 0)])
              )
            : null,
          casilleros,
          formaPago: {
            tipo: form.formaPago,
            banco: form.banco,
            tipoCuenta: form.tipoCuenta,
            numeroCuenta: form.numeroCuenta,
          },
        },
      };

      const res = await fetch(`${apiUrl}/api/declaraciones/${rucUsuario}/crear`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || "No fue posible procesar la declaración.");
      }

      setMensaje("Su declaración ha sido procesada satisfactoriamente.");
      localStorage.removeItem(`formulario104-${rucUsuario}`);
    } catch (err) {
      setMensaje(err instanceof Error ? err.message : "No fue posible procesar la declaración.");
    } finally {
      setLoadingEnviar(false);
    }
  };

  const rucFinal = periodoData?.ruc || rucUsuario;
  const razonSocialFinal = periodoData?.razonSocial || razonSocial || "";
  const hasPayment = totals["999"] > 0;

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

          <div className="rounded-2xl border">
            <AccordionTitle
              title="Resumen de ventas y otras operaciones"
              open={openSections.ventas}
              onClick={() => setOpenSections((prev) => ({ ...prev, ventas: !prev.ventas }))}
            />
            {openSections.ventas && (
              <div className="space-y-3 border-t p-4">
                {ventasRows.map(([base, iva, label]) => (
                  <CasilleroPair
                    key={`${base}-${iva || "base"}`}
                    label={label}
                    baseCode={base}
                    ivaCode={iva}
                    baseValue={base === "429" ? money(totals["429"]) : form[base]}
                    ivaValue={iva ? form[iva] : undefined}
                    onBaseChange={(value) => updateForm(base, value)}
                    onIvaChange={(value) => iva && updateForm(iva, value)}
                  />
                ))}
                <TotalBox label="429 Total impuesto generado" value={totals["429"]} strong />
              </div>
            )}

            <AccordionTitle
              title="Resumen de adquisiciones y pagos"
              open={openSections.compras}
              onClick={() => setOpenSections((prev) => ({ ...prev, compras: !prev.compras }))}
            />
            {openSections.compras && (
              <div className="space-y-3 border-t p-4">
                {comprasRows.map(([base, iva, label]) => (
                  <CasilleroPair
                    key={`${base}-${iva || "base"}`}
                    label={label}
                    baseCode={base}
                    ivaCode={iva}
                    baseValue={form[base]}
                    ivaValue={iva ? form[iva] : undefined}
                    onBaseChange={(value) => updateForm(base, value)}
                    onIvaChange={(value) => iva && updateForm(iva, value)}
                  />
                ))}
              </div>
            )}

            <AccordionTitle
              title="Resumen impositivo"
              open={openSections.resumen}
              onClick={() => setOpenSections((prev) => ({ ...prev, resumen: !prev.resumen }))}
            />
            {openSections.resumen && (
              <div className="grid grid-cols-1 gap-4 border-t p-4 md:grid-cols-2 xl:grid-cols-4">
                {resumenRows.map(([code, label]) => {
                  const calculated =
                    code === "563" ||
                    code === "564" ||
                    code === "601" ||
                    code === "602" ||
                    code === "615" ||
                    code === "617" ||
                    code === "620" ||
                    code === "699";
                  return calculated ? (
                    <TotalBox
                      key={code}
                      label={`${code} ${label}`}
                      value={totals[code as keyof typeof totals]}
                      format={code === "563" ? "percent" : "money"}
                    />
                  ) : (
                    <MoneyField
                      key={code}
                      label={`${code} ${label}`}
                      value={form[code]}
                      onChange={(value) => updateForm(code, value)}
                    />
                  );
                })}
              </div>
            )}

            <AccordionTitle
              title="Retenciones IVA"
              open={openSections.retenciones}
              onClick={() => setOpenSections((prev) => ({ ...prev, retenciones: !prev.retenciones }))}
            />
            {openSections.retenciones && (
              <div className="grid grid-cols-1 gap-4 border-t p-4 md:grid-cols-2 xl:grid-cols-3">
                {retencionesRows.map(([code, label]) => (
                  <MoneyField
                    key={code}
                    label={`${code} ${label}`}
                    value={form[code]}
                    onChange={(value) => updateForm(code, value)}
                  />
                ))}
              </div>
            )}
          </div>
        </Panel>
      )}

      {step === 4 && (
        <Panel title="4. Pago">
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <section className="rounded-2xl border bg-slate-50 p-5">
              <h3 className="mb-4 font-black text-[#003565]">Resumen de la declaración</h3>
              <SummaryRow label="Impuesto" value={totals["902"]} />
              <SummaryRow label="Interés" value={toNumber(form["903"])} />
              <SummaryRow label="Multa" value={toNumber(form["904"])} />
              <SummaryRow label="Total a pagar" value={totals["999"]} strong />

              <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
                <MoneyField label="Interés 903" value={form["903"]} onChange={(value) => updateForm("903", value)} />
                <MoneyField label="Multa 904" value={form["904"]} onChange={(value) => updateForm("904", value)} />
              </div>
            </section>

            <section className="rounded-2xl border bg-white p-5">
              <h3 className="mb-4 flex items-center gap-2 font-black text-[#003565]">
                <CreditCard size={18} />
                Forma de pago
              </h3>

              <div className="space-y-3">
                <PaymentOption active={form.formaPago === "TBC"} label="Títulos de Banco Central" onClick={() => updateForm("formaPago", "TBC")} />
                <PaymentOption active={form.formaPago === "NOTAS_CREDITO"} label="Notas de crédito desmaterializadas" onClick={() => updateForm("formaPago", "NOTAS_CREDITO")} />
                <PaymentOption active={form.formaPago === "CONVENIO_DEBITO"} label="Convenio de débito" onClick={() => updateForm("formaPago", "CONVENIO_DEBITO")} />
                <PaymentOption active={form.formaPago === "OTRAS"} label="Otras formas de pago" onClick={() => updateForm("formaPago", "OTRAS")} />
              </div>

              {form.formaPago === "CONVENIO_DEBITO" && (
                <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
                  <Field label="Banco">
                    <input className="input" value={form.banco} onChange={(e) => updateForm("banco", e.target.value)} />
                  </Field>
                  <Field label="Tipo de cuenta">
                    <select className="input" value={form.tipoCuenta} onChange={(e) => updateForm("tipoCuenta", e.target.value)}>
                      <option>Ahorros</option>
                      <option>Corriente</option>
                    </select>
                  </Field>
                  <Field label="Número de cuenta">
                    <input className="input" value={form.numeroCuenta} onChange={(e) => updateForm("numeroCuenta", e.target.value.replace(/\D/g, ""))} />
                  </Field>
                </div>
              )}

              <div className="mt-6 rounded-2xl border bg-slate-50 p-4">
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

              {!hasPayment && (
                <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-black text-emerald-700">
                  Declaración sin valor a pagar. Al aceptar, se procesará directamente.
                </div>
              )}
            </section>
          </div>
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
              disabled={loadingEnviar}
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

function AccordionTitle({
  title,
  open,
  onClick,
}: {
  title: string;
  open: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center justify-between bg-[#003565] px-5 py-4 text-left font-black text-white first:rounded-t-2xl"
    >
      <span>{title}</span>
      <ChevronRight className={`transition ${open ? "rotate-90" : ""}`} size={18} />
    </button>
  );
}

function MoneyField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <Field label={label}>
      <input
        className="input"
        type="number"
        min="0"
        step="0.01"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </Field>
  );
}

function CasilleroPair({
  label,
  baseCode,
  ivaCode,
  baseValue,
  ivaValue,
  onBaseChange,
  onIvaChange,
}: {
  label: string;
  baseCode: string;
  ivaCode?: string;
  baseValue: string;
  ivaValue?: string;
  onBaseChange: (value: string) => void;
  onIvaChange: (value: string) => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-4 rounded-2xl bg-slate-50 p-4 md:grid-cols-[1fr_180px_180px]">
      <div>
        <p className="font-black text-slate-700">{label}</p>
        <p className="text-xs font-bold text-slate-400">
          {ivaCode ? `Base ${baseCode} / Impuesto ${ivaCode}` : `Casillero ${baseCode}`}
        </p>
      </div>
      <MoneyField label={`Base ${baseCode}`} value={baseValue} onChange={onBaseChange} />
      {ivaCode ? (
        <MoneyField label={`Impuesto ${ivaCode}`} value={ivaValue || "0.00"} onChange={onIvaChange} />
      ) : (
        <div className="hidden md:block" />
      )}
    </div>
  );
}

function TotalBox({
  label,
  value,
  strong = false,
  format = "money",
}: {
  label: string;
  value: number;
  strong?: boolean;
  format?: "money" | "percent";
}) {
  return (
    <div className={`rounded-2xl border p-4 ${strong ? "bg-[#003565] text-white" : "bg-slate-50 text-slate-700"}`}>
      <p className={`text-xs font-black uppercase ${strong ? "text-white/70" : "text-slate-400"}`}>{label}</p>
      <p className="mt-1 text-2xl font-black">
        {format === "percent" ? `${money(value)}%` : `$${money(value)}`}
      </p>
    </div>
  );
}

function SummaryRow({ label, value, strong = false }: { label: string; value: number; strong?: boolean }) {
  return (
    <div className={`flex items-center justify-between border-b py-3 ${strong ? "font-black text-[#003565]" : "font-bold text-slate-700"}`}>
      <span>{label}</span>
      <span>${money(value)}</span>
    </div>
  );
}

function PaymentOption({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full rounded-xl border px-4 py-3 text-left text-sm font-black ${
        active ? "border-[#003565] bg-blue-50 text-[#003565]" : "bg-white text-slate-600 hover:bg-slate-50"
      }`}
    >
      {label}
    </button>
  );
}
