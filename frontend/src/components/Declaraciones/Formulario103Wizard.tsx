import { useMemo, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  FileText,
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
  | "retencionesResidentes"
  | "pagoDividendos"
  | "pagosExterior"
  | "convenioDobleTributacion"
  | "paraisosFiscales"
  | "obligadoContabilidad";

type FormState = Record<string, string>;

type Formulario103Response = {
  ruc: string;
  razonSocial: string;
  anio: number;
  mes: string;
  mesTexto: string;
  resumen: {
    comprasLeidas: number;
    comprasConRetencion: number;
    comprasSinRetencion: number;
    comprasSinRetencionExcluidas?: number;
    retencionesLeidas: number;
    codigosNoMapeados?: string[];
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

const initialQuestions: Record<QuestionKey, "SI" | "NO"> = {
  informaValores: "SI",
  retencionesResidentes: "SI",
  pagoDividendos: "NO",
  pagosExterior: "NO",
  convenioDobleTributacion: "NO",
  paraisosFiscales: "NO",
  obligadoContabilidad: "NO",
};

const numericCasilleros = [
  "302",
  "352",
  "303",
  "353",
  "304",
  "354",
  "307",
  "357",
  "308",
  "358",
  "309",
  "359",
  "311",
  "361",
  "312",
  "362",
  "322",
  "372",
  "332",
  "343",
  "393",
  "344",
  "394",
  "345",
  "395",
  "346",
  "396",
  "402",
  "452",
  "413",
  "463",
  "414",
  "464",
  "416",
  "466",
  "424",
  "474",
  "425",
  "475",
  "497",
  "498",
  "897",
  "898",
  "899",
  "902",
  "903",
  "904",
  "907",
  "999",
];

const zeroCasilleros: FormState = Object.fromEntries(
  numericCasilleros.map((key) => [key, "0.00"])
);

const initialForm: FormState = {
  ...zeroCasilleros,
  "198": "",
  "199": "",
  contadorClave: "",
  formaPago: "CONVENIO_DEBITO",
  banco: "Banco Pichincha",
  tipoCuenta: "Ahorros",
  numeroCuenta: "",
};

const residentRows = [
  ["302", "352", "En relación de dependencia que supera o no la base gravada"],
  ["303", "353", "Honorarios profesionales"],
  ["304", "354", "Servicios donde predomina el intelecto"],
  ["307", "357", "Servicios donde predomina la mano de obra"],
  ["308", "358", "Utilización o aprovechamiento de imagen o renombre"],
  ["309", "359", "Publicidad y comunicación"],
  ["311", "361", "Liquidaciones de compra por nivel cultural o rusticidad"],
  ["312", "362", "Transferencia de bienes muebles de naturaleza corporal"],
  ["322", "372", "Seguros y reaseguros"],
  ["343", "393", "Pagos aplicables 1%"],
  ["344", "394", "Pagos aplicables 2%"],
  ["345", "395", "Otras retenciones aplicables 8%"],
  ["346", "396", "Otras retenciones aplicables a otros porcentajes"],
];

const exteriorRows = [
  ["402", "452", "Con convenio: intereses por financiamiento"],
  ["413", "463", "Sin convenio: intereses por financiamiento"],
  ["414", "464", "Sin convenio: intereses de créditos"],
  ["416", "466", "Dividendos a personas naturales no residentes"],
  ["424", "474", "Paraísos fiscales: intereses"],
  ["425", "475", "Paraísos fiscales: dividendos"],
];

function toNumber(value: string | number | undefined) {
  if (value === undefined || value === null) return 0;
  const clean = String(value).replace(",", ".").trim();
  const num = Number(clean);
  return Number.isFinite(num) ? num : 0;
}

function money(value: number) {
  return value.toFixed(2);
}

function numberToInput(value: unknown) {
  return money(Number(value || 0));
}

export default function Formulario103Wizard({ rucUsuario, razonSocial }: Props) {
  const [step, setStep] = useState(1);
  const [mes, setMes] = useState("04");
  const [anio, setAnio] = useState(new Date().getFullYear());
  const [questions, setQuestions] = useState(initialQuestions);
  const [form, setForm] = useState<FormState>(initialForm);
  const [openSections, setOpenSections] = useState({
    residentes: true,
    noResidentes: false,
    totales: true,
  });

  const [errors, setErrors] = useState<string[]>([]);
  const [mensaje, setMensaje] = useState("");
  const [loadingDatos, setLoadingDatos] = useState(false);
  const [loadingEnviar, setLoadingEnviar] = useState(false);
  const [draftSaved, setDraftSaved] = useState(false);
  const [periodoData, setPeriodoData] = useState<Formulario103Response | null>(null);
  const [datosCargados, setDatosCargados] = useState(false);

  const totals = useMemo(() => {
    const basesPais =
      residentRows.reduce((acc, [base]) => acc + toNumber(form[base]), 0) +
      toNumber(form["332"]);

    const retenidoPais = residentRows.reduce(
      (acc, [, ret]) => acc + toNumber(form[ret]),
      0
    );

    const basesExterior = exteriorRows.reduce(
      (acc, [base]) => acc + toNumber(form[base]),
      0
    );

    const retenidoExterior = exteriorRows.reduce(
      (acc, [, ret]) => acc + toNumber(form[ret]),
      0
    );

    const pagoPrevio = toNumber(form["898"]);
    const interes = toNumber(form["903"]);
    const multa = toNumber(form["904"]);
    const notasCredito = toNumber(form["907"]);

    const impuesto = retenidoPais + retenidoExterior;
    const impuestoAPagar = Math.max(impuesto - pagoPrevio, 0);
    const totalPagado = Math.max(impuestoAPagar + interes + multa - notasCredito, 0);

    return {
      "349": basesPais,
      "399": retenidoPais,
      "497": basesExterior,
      "498": retenidoExterior,
      "499": impuesto,
      "902": impuestoAPagar,
      "999": totalPagado,
    };
  }, [form]);

  const updateQuestion = (key: QuestionKey, value: "SI" | "NO") => {
    setQuestions((prev) => ({ ...prev, [key]: value }));
  };

  const updateForm = (key: string, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const cargarDatosReales = async () => {
    try {
      setLoadingDatos(true);
      setMensaje("");
      setErrors([]);

      const response = await fetch(
        `${apiUrl}/api/declaraciones/${rucUsuario}/formulario103?anio=${anio}&mes=${mes}`
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
      nextForm["198"] = form["198"] || "";
      nextForm["199"] = form["199"] || "";
      nextForm.contadorClave = form.contadorClave || "";

      setForm(nextForm);
      setPeriodoData(data);
      setDatosCargados(true);

      const existenValores = Object.values(casilleros).some((value) => Number(value || 0) > 0);

      setQuestions((prev) => ({
        ...prev,
        informaValores: existenValores ? "SI" : "NO",
        retencionesResidentes: Number(casilleros["399"] || 0) > 0 ? "SI" : prev.retencionesResidentes,
        pagosExterior: Number(casilleros["498"] || 0) > 0 ? "SI" : prev.pagosExterior,
      }));

      setMensaje(
        existenValores
          ? "Se encontró información para el período seleccionado."
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
      if (!mes) nextErrors.push("Debe seleccionar el período fiscal.");
      if (!anio) nextErrors.push("Debe seleccionar el año.");
    }

    if (step === 2) {
      if (!questions.informaValores) {
        nextErrors.push("Debe responder si requiere informar valores.");
      }
    }

    if (step === 3) {
      residentRows.forEach(([base, ret, label]) => {
        if (toNumber(form[ret]) > 0 && toNumber(form[base]) <= 0) {
          nextErrors.push(`Campo ${ret}: ${label} tiene retención sin base imponible.`);
        }
      });

      exteriorRows.forEach(([base, ret, label]) => {
        if (toNumber(form[ret]) > 0 && toNumber(form[base]) <= 0) {
          nextErrors.push(`Campo ${ret}: ${label} tiene retención sin base imponible.`);
        }
      });

      if (questions.informaValores === "NO" && totals["499"] > 0) {
        nextErrors.push("Respondió que no informa valores, pero existen retenciones registradas.");
      }
    }

    if (step === 4) {
      if (form.formaPago === "CONVENIO_DEBITO" && totals["999"] > 0 && !form.numeroCuenta.trim()) {
        nextErrors.push("Debe ingresar el número de cuenta para convenio de débito.");
      }

      if (questions.obligadoContabilidad === "SI") {
        if (!form["199"].trim()) nextErrors.push("Debe ingresar el RUC del contador.");
        if (!form.contadorClave.trim()) nextErrors.push("Debe ingresar la clave del contador.");
      }
    }

    setErrors(nextErrors);
    return nextErrors.length === 0;
  };

  const nextStep = async () => {
    if (!validateStep()) return;

    if (step === 1) {
      await cargarDatosReales();
    }

    setStep((prev) => Math.min(prev + 1, 4));
  };

  const prevStep = () => {
    setErrors([]);
    setStep((prev) => Math.max(prev - 1, 1));
  };

  const saveDraft = () => {
    localStorage.setItem(
      `formulario103-${rucUsuario}`,
      JSON.stringify({ mes, anio, questions, form, totals, periodoData })
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

      const payload = {
        tipoImpuesto: "Formulario de Retenciones en la Fuente del Impuesto a la Renta",
        formulario: "Formulario 103 - Retenciones en la Fuente",
        periodoFiscal: "Mensual",
        anio: Number(anio),
        mes: meses.find((m) => m.value === mes)?.label || mes,
        tipoDeclaracion: "Original",
        valorCancelado: totals["999"],
        tipoPago: form.formaPago,
        banco: form.banco,
        tipoCuenta: form.tipoCuenta,
        numeroCuenta: form.numeroCuenta,
        datosJSON: {
          paso: "Formulario 103 Wizard",
          resumen: periodoData?.resumen || null,
          identificacion: {
            mes,
            anio,
            ruc: rucUsuario,
            razonSocial: periodoData?.razonSocial || razonSocial,
          },
          preguntas: questions,
          casilleros: {
            ...Object.fromEntries(
              Object.entries(form)
                .filter(([key]) => /^\d+$/.test(key))
                .map(([key, value]) => [key, toNumber(value)])
            ),
            349: totals["349"],
            399: totals["399"],
            497: totals["497"],
            498: totals["498"],
            499: totals["499"],
            902: totals["902"],
            999: totals["999"],
          },
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
        throw new Error(data.message || "Error enviando Formulario 103.");
      }

      setMensaje("Su declaración ha sido procesada satisfactoriamente.");
      localStorage.removeItem(`formulario103-${rucUsuario}`);
    } catch (err) {
      setMensaje(err instanceof Error ? err.message : "Error inesperado enviando Formulario 103.");
    } finally {
      setLoadingEnviar(false);
    }
  };

  const hasPayment = totals["999"] > 0;
  const razonSocialFinal = periodoData?.razonSocial || razonSocial || "";

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <Header />

      <StepBar step={step} />

      {mensaje && (
        <div
          className={`rounded-2xl border p-4 text-sm font-black ${
            mensaje.includes("error") || mensaje.includes("Error")
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
            Usted tiene {errors.length} error(es) en su declaración.
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
              <select className="input" value="DECLARACIÓN DE RETENCIONES EN LA FUENTE" disabled>
                <option>DECLARACIÓN DE RETENCIONES EN LA FUENTE</option>
              </select>
            </Field>

            <Field label="Período">
              <div className="grid grid-cols-2 gap-3">
                <select className="input" value={mes} onChange={(e) => setMes(e.target.value)}>
                  {meses.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.value} - {item.label}
                    </option>
                  ))}
                </select>

                <select
                  className="input"
                  value={anio}
                  onChange={(e) => setAnio(Number(e.target.value))}
                >
                  {years.map((item) => (
                    <option key={item}>{item}</option>
                  ))}
                </select>
              </div>
            </Field>
          </div>

          <div className="mt-5 rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm font-bold text-blue-700">
            Al continuar, el sistema consultará la información disponible para el período seleccionado.
          </div>
        </Panel>
      )}

      {step === 2 && (
        <Panel title="2. Preguntas">
          <div className="mb-5 rounded-2xl bg-slate-50 p-4 text-sm font-semibold text-slate-600">
            Algunas preguntas pueden estar respondidas automáticamente porque el sistema cuenta con
            información propia del contribuyente o de terceros.
          </div>

          {periodoData?.resumen && (
            <div className="mb-5 grid grid-cols-1 gap-3 md:grid-cols-4">
              <InfoBox label="Comprobantes revisados" value={String(periodoData.resumen.comprasLeidas)} />
              <InfoBox label="Con retención" value={String(periodoData.resumen.comprasConRetencion)} />
              <InfoBox label="Sin retención" value={String(periodoData.resumen.comprasSinRetencion)} />
              <InfoBox label="Retenciones" value={String(periodoData.resumen.retencionesLeidas)} />
            </div>
          )}

          <div className="space-y-3">
            <QuestionRow
              text="¿Requiere informar valores en su declaración de este período?"
              value={questions.informaValores}
              onChange={(value) => updateQuestion("informaValores", value)}
            />
            <QuestionRow
              text="¿Ha efectuado retenciones por compras o pagos a residentes y/o establecimientos permanentes?"
              value={questions.retencionesResidentes}
              onChange={(value) => updateQuestion("retencionesResidentes", value)}
            />
            <QuestionRow
              text="¿Realizó pagos por dividendos?"
              value={questions.pagoDividendos}
              onChange={(value) => updateQuestion("pagoDividendos", value)}
            />
            <QuestionRow
              text="¿Ha efectuado retenciones por compras o pagos a no residentes?"
              value={questions.pagosExterior}
              onChange={(value) => updateQuestion("pagosExterior", value)}
            />
            <QuestionRow
              text="¿Con convenio de doble tributación?"
              value={questions.convenioDobleTributacion}
              onChange={(value) => updateQuestion("convenioDobleTributacion", value)}
            />
            <QuestionRow
              text="¿En paraísos fiscales o regímenes fiscales preferentes?"
              value={questions.paraisosFiscales}
              onChange={(value) => updateQuestion("paraisosFiscales", value)}
            />
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <GhostButton onClick={() => setStep(3)}>
              <FileText size={16} />
              Ver formulario completo
            </GhostButton>

            <GhostButton onClick={cargarDatosReales}>
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
            <ReadBox label="RUC 201" value={rucUsuario} />
            <ReadBox label="Razón social 202" value={razonSocialFinal || "-"} />
          </div>

          {periodoData?.resumen?.codigosNoMapeados?.length ? (
            <div className="mb-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-800">
              Existen conceptos de retención que requieren validación tributaria antes del envío. Se clasificaron provisionalmente en 346/396:{" "}
              {periodoData.resumen.codigosNoMapeados.join(", ")}
            </div>
          ) : null}

          <div className="rounded-2xl border">
            <AccordionTitle
              title="Por pagos efectuados a residentes y establecimientos permanentes"
              open={openSections.residentes}
              onClick={() =>
                setOpenSections((prev) => ({ ...prev, residentes: !prev.residentes }))
              }
            />

            {openSections.residentes && (
              <div className="space-y-3 border-t p-4">
                {questions.retencionesResidentes === "SI" &&
                  residentRows.map(([base, ret, label]) => (
                    <CasilleroRow
                      key={`${base}-${ret}`}
                      label={label}
                      baseCode={base}
                      retCode={ret}
                      baseValue={form[base]}
                      retValue={form[ret]}
                      onBaseChange={(value) => updateForm(base, value)}
                      onRetChange={(value) => updateForm(ret, value)}
                    />
                  ))}

                <div className="grid grid-cols-1 gap-4 rounded-2xl bg-slate-50 p-4 md:grid-cols-[1fr_180px]">
                  <div>
                    <p className="font-black text-slate-700">
                      Pagos de bienes y servicios no sujetos a retención o con 0%
                    </p>
                    <p className="text-xs font-bold text-slate-400">Casillero 332</p>
                  </div>
                  <MoneyField
                    label="Base 332"
                    value={form["332"]}
                    onChange={(value) => updateForm("332", value)}
                  />
                </div>
              </div>
            )}

            <AccordionTitle
              title="Por pagos a no residentes"
              open={openSections.noResidentes}
              onClick={() =>
                setOpenSections((prev) => ({ ...prev, noResidentes: !prev.noResidentes }))
              }
            />

            {openSections.noResidentes && (
              <div className="space-y-3 border-t p-4">
                {questions.pagosExterior === "SI" ? (
                  exteriorRows.map(([base, ret, label]) => (
                    <CasilleroRow
                      key={`${base}-${ret}`}
                      label={label}
                      baseCode={base}
                      retCode={ret}
                      baseValue={form[base]}
                      retValue={form[ret]}
                      onBaseChange={(value) => updateForm(base, value)}
                      onRetChange={(value) => updateForm(ret, value)}
                    />
                  ))
                ) : (
                  <p className="rounded-2xl bg-slate-50 p-4 text-sm font-semibold text-slate-500">
                    Según sus respuestas, no registra pagos al exterior.
                  </p>
                )}
              </div>
            )}

            <AccordionTitle
              title="Totales"
              open={openSections.totales}
              onClick={() =>
                setOpenSections((prev) => ({ ...prev, totales: !prev.totales }))
              }
            />

            {openSections.totales && (
              <div className="grid grid-cols-1 gap-4 border-t p-4 md:grid-cols-5">
                <TotalBox label="349 Base país" value={totals["349"]} />
                <TotalBox label="399 Retenido país" value={totals["399"]} />
                <TotalBox label="497 Base exterior" value={totals["497"]} />
                <TotalBox label="498 Retenido exterior" value={totals["498"]} />
                <TotalBox label="499 Total retención" value={totals["499"]} strong />
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
                <MoneyField
                  label="Interés 903"
                  value={form["903"]}
                  onChange={(value) => updateForm("903", value)}
                />
                <MoneyField
                  label="Multa 904"
                  value={form["904"]}
                  onChange={(value) => updateForm("904", value)}
                />
                <MoneyField
                  label="Notas de crédito 907"
                  value={form["907"]}
                  onChange={(value) => updateForm("907", value)}
                />
              </div>
            </section>

            <section className="rounded-2xl border bg-white p-5">
              <h3 className="mb-4 flex items-center gap-2 font-black text-[#003565]">
                <CreditCard size={18} />
                Forma de pago
              </h3>

              <div className="space-y-3">
                <PaymentOption
                  active={form.formaPago === "TBC"}
                  label="Títulos de Banco Central (TBC)"
                  onClick={() => updateForm("formaPago", "TBC")}
                />
                <PaymentOption
                  active={form.formaPago === "NOTAS_CREDITO"}
                  label="Notas de crédito desmaterializadas"
                  onClick={() => updateForm("formaPago", "NOTAS_CREDITO")}
                />
                <PaymentOption
                  active={form.formaPago === "OTRAS"}
                  label="Otras formas de pago"
                  onClick={() => updateForm("formaPago", "OTRAS")}
                />
                <PaymentOption
                  active={form.formaPago === "CONVENIO_DEBITO"}
                  label="Convenio de débito"
                  onClick={() => updateForm("formaPago", "CONVENIO_DEBITO")}
                />
              </div>

              {form.formaPago === "CONVENIO_DEBITO" && (
                <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
                  <Field label="Banco">
                    <input
                      className="input"
                      value={form.banco}
                      onChange={(e) => updateForm("banco", e.target.value)}
                    />
                  </Field>

                  <Field label="Tipo de cuenta">
                    <select
                      className="input"
                      value={form.tipoCuenta}
                      onChange={(e) => updateForm("tipoCuenta", e.target.value)}
                    >
                      <option>Ahorros</option>
                      <option>Corriente</option>
                    </select>
                  </Field>

                  <Field label="Número de cuenta">
                    <input
                      className="input"
                      value={form.numeroCuenta}
                      onChange={(e) => updateForm("numeroCuenta", e.target.value.replace(/\D/g, ""))}
                    />
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
                    <Field label="RUC contador 199">
                      <input
                        className="input"
                        value={form["199"]}
                        onChange={(e) => updateForm("199", e.target.value.replace(/\D/g, ""))}
                      />
                    </Field>

                    <Field label="Clave contador">
                      <input
                        className="input"
                        type="password"
                        value={form.contadorClave}
                        onChange={(e) => updateForm("contadorClave", e.target.value)}
                      />
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

        .input:disabled {
          color: #64748b;
          background: #f1f5f9;
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
          <FileText size={28} />
        </div>
        <div>
          <h1 className="text-2xl font-black text-[#003565]">
            Formulario 103
          </h1>
          <p className="text-sm text-slate-500">
            Elaboración y envío de la declaración de Retenciones en la Fuente.
          </p>
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

function Panel({ title, children }: any) {
  return (
    <section className="rounded-[2rem] border bg-white p-7 shadow-sm">
      <h2 className="mb-5 text-xl font-black text-[#003565]">{title}</h2>
      {children}
    </section>
  );
}

function Field({ label, children }: any) {
  return (
    <label className="block">
      <span className="text-[11px] font-black uppercase text-slate-400">
        {label}
      </span>
      {children}
    </label>
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

function InfoBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border bg-slate-50 p-4">
      <p className="text-[10px] font-black uppercase text-slate-400">{label}</p>
      <p className="text-xl font-black text-[#003565]">{value}</p>
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
              value === item
                ? "bg-[#003565] text-white"
                : "border bg-white text-slate-600"
            }`}
          >
            {item === "SI" ? "Sí" : "No"}
          </button>
        ))}
      </div>
    </div>
  );
}

function GhostButton({ onClick, children }: any) {
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

function AccordionTitle({ title, open, onClick }: any) {
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

function CasilleroRow({
  label,
  baseCode,
  retCode,
  baseValue,
  retValue,
  onBaseChange,
  onRetChange,
}: {
  label: string;
  baseCode: string;
  retCode: string;
  baseValue: string;
  retValue: string;
  onBaseChange: (value: string) => void;
  onRetChange: (value: string) => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-4 rounded-2xl bg-slate-50 p-4 md:grid-cols-[1fr_180px_180px]">
      <div>
        <p className="font-black text-slate-700">{label}</p>
        <p className="text-xs font-bold text-slate-400">
          Base {baseCode} / Retención {retCode}
        </p>
      </div>

      <MoneyField label={`Base ${baseCode}`} value={baseValue} onChange={onBaseChange} />
      <MoneyField label={`Retención ${retCode}`} value={retValue} onChange={onRetChange} />
    </div>
  );
}

function TotalBox({ label, value, strong = false }: any) {
  return (
    <div
      className={`rounded-2xl border p-4 ${
        strong ? "bg-[#003565] text-white" : "bg-slate-50 text-slate-700"
      }`}
    >
      <p className={`text-xs font-black uppercase ${strong ? "text-white/70" : "text-slate-400"}`}>
        {label}
      </p>
      <p className="mt-1 text-2xl font-black">${money(value)}</p>
    </div>
  );
}

function SummaryRow({ label, value, strong = false }: any) {
  return (
    <div
      className={`flex items-center justify-between border-b py-3 ${
        strong ? "font-black text-[#003565]" : "font-bold text-slate-700"
      }`}
    >
      <span>{label}</span>
      <span>${money(value)}</span>
    </div>
  );
}

function PaymentOption({ active, label, onClick }: any) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full rounded-xl border px-4 py-3 text-left text-sm font-black ${
        active
          ? "border-[#003565] bg-blue-50 text-[#003565]"
          : "bg-white text-slate-600 hover:bg-slate-50"
      }`}
    >
      {label}
    </button>
  );
}
