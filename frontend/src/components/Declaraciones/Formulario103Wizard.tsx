import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  FileText,
  Loader2,
  Save,
  Send,
} from "lucide-react";

type Props = {
  rucUsuario: string;
  razonSocial?: string;
};

type FormState = Record<string, string>;

type QuestionKey =
  | "informaValores"
  | "retencionesResidentes"
  | "obligadoContabilidad";

type Formulario103Response = {
  ruc: string;
  razonSocial: string;
  anio: number;
  mes: string;
  mesTexto: string;
  resumen: {
    atsLoteId?: string;
    comprasLeidas: number;
    comprasConRetencion: number;
    comprasSinRetencion: number;
    retencionesLeidas: number;
    codigosNoMapeados?: string[];
  };
  casilleros: Record<string, number>;
};

type FormRow = {
  concepto: string;
  baseCode?: string;
  retCode?: string;
  readOnly?: boolean;
};

type FormSection = {
  title: string;
  rows: FormRow[];
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

const editableRows: FormSection[] = [
  {
    title: "Derivadas del trabajo y servicios prestados",
    rows: [
      {
        concepto: "Publicidad y comunicación",
        baseCode: "309",
        retCode: "359",
      },
    ],
  },
  {
    title: "Por bienes y servicios",
    rows: [
      {
        concepto: "Transferencia de bienes muebles de naturaleza corporal",
        baseCode: "312",
        retCode: "362",
      },
      {
        concepto: "Otras compras de bienes y servicios no sujetas a retención",
        baseCode: "332",
      },
    ],
  },
];

const allNumericCasilleros = [
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
  "314",
  "364",
  "322",
  "372",
  "323",
  "373",
  "325",
  "375",
  "332",
  "343",
  "393",
  "344",
  "394",
  "345",
  "395",
  "346",
  "396",
  "349",
  "399",
  "497",
  "498",
  "499",
  "890",
  "897",
  "898",
  "899",
  "902",
  "903",
  "904",
  "905",
  "907",
  "999",
];

const zeroCasilleros: FormState = Object.fromEntries(
  allNumericCasilleros.map((key) => [key, "0.00"])
);

const initialQuestions: Record<QuestionKey, "SI" | "NO"> = {
  informaValores: "SI",
  retencionesResidentes: "SI",
  obligadoContabilidad: "NO",
};

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

function toNumber(value: string | number | undefined) {
  if (value === undefined || value === null) return 0;
  const num = Number(String(value).replace(",", ".").trim());
  return Number.isFinite(num) ? num : 0;
}

function round2(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function money(value: number) {
  return value.toFixed(2);
}

function inputMoney(value: unknown) {
  return money(Number(value || 0));
}

export default function Formulario103Wizard({ rucUsuario, razonSocial }: Props) {
  const [step, setStep] = useState(1);
  const [mes, setMes] = useState("04");
  const [anio, setAnio] = useState(new Date().getFullYear());
  const [form, setForm] = useState<FormState>(initialForm);
  const [questions, setQuestions] = useState(initialQuestions);
  const [periodoData, setPeriodoData] = useState<Formulario103Response | null>(null);
  const [datosCargados, setDatosCargados] = useState(false);
  const [loadingDatos, setLoadingDatos] = useState(false);
  const [loadingEnviar, setLoadingEnviar] = useState(false);
  const [draftSaved, setDraftSaved] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [mensaje, setMensaje] = useState("");

  const totals = useMemo(() => {
    const basePais = round2(
      allNumericCasilleros
        .filter((key) => ["302", "303", "304", "307", "308", "309", "311", "312", "314", "322", "323", "325", "332", "343", "344", "345", "346"].includes(key))
        .reduce((acc, key) => acc + toNumber(form[key]), 0)
    );
    const retenidoPais = round2(
      ["352", "353", "354", "357", "358", "359", "361", "362", "364", "372", "373", "375", "393", "394", "395", "396"].reduce(
        (acc, key) => acc + toNumber(form[key]),
        0
      )
    );
    const totalRetencion = round2(retenidoPais + toNumber(form["498"]));
    const impuestoPagar = Math.max(round2(totalRetencion - toNumber(form["898"])), 0);
    const totalPagado = Math.max(
      round2(impuestoPagar + toNumber(form["903"]) + toNumber(form["904"]) - toNumber(form["907"])),
      0
    );

    return {
      "349": basePais,
      "399": retenidoPais,
      "499": totalRetencion,
      "902": impuestoPagar,
      "905": totalPagado,
      "999": totalPagado,
    };
  }, [form]);

  const rucFinal = periodoData?.ruc || rucUsuario;
  const razonSocialFinal = periodoData?.razonSocial || razonSocial || "";
  const mesTexto = meses.find((item) => item.value === mes)?.label || mes;

  const updateForm = (key: string, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const updateQuestion = (key: QuestionKey, value: "SI" | "NO") => {
    setQuestions((prev) => ({ ...prev, [key]: value }));
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

      const nextForm: FormState = { ...initialForm };
      allNumericCasilleros.forEach((key) => {
        nextForm[key] = inputMoney(data.casilleros?.[key] ?? 0);
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
      setQuestions((prev) => ({
        ...prev,
        informaValores: Number(data.casilleros?.["499"] || 0) > 0 ? "SI" : "NO",
        retencionesResidentes: Number(data.casilleros?.["399"] || 0) > 0 ? "SI" : "NO",
      }));
      setMensaje("Se encontró información ATS para el período seleccionado.");
    } catch (err) {
      setMensaje(err instanceof Error ? err.message : "No fue posible consultar la información.");
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

    if (step === 2 && questions.informaValores === "NO" && totals["499"] > 0) {
      nextErrors.push("Respondió que no informa valores, pero existen retenciones registradas.");
    }

    if (step === 3) {
      editableRows.flatMap((section) => section.rows).forEach((row) => {
        if (row.retCode && toNumber(form[row.retCode]) > 0 && row.baseCode && toNumber(form[row.baseCode]) <= 0) {
          nextErrors.push(`Casillero ${row.retCode}: existe retención sin base imponible.`);
        }
      });
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
    if (step === 1) await cargarDatosReales();
    setStep((prev) => Math.min(prev + 1, 4));
  };

  const prevStep = () => {
    setErrors([]);
    setStep((prev) => Math.max(prev - 1, 1));
  };

  const saveDraft = () => {
    localStorage.setItem(
      `formulario103-${rucUsuario}`,
      JSON.stringify({ mes, anio, form, questions, totals, periodoData })
    );
    setDraftSaved(true);
    setMensaje("Su declaración borrador ha sido guardada exitosamente.");
    setTimeout(() => setDraftSaved(false), 3200);
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
        ...totals,
      };

      const payload = {
        tipoImpuesto: "Formulario de Retenciones en la Fuente del Impuesto a la Renta",
        formulario: "Formulario 103 - Retenciones en la Fuente",
        periodoFiscal: "Mensual",
        anio: Number(anio),
        mes: mesTexto,
        tipoDeclaracion: "Original",
        valorCancelado: totals["999"],
        tipoPago: form.formaPago,
        banco: form.banco,
        tipoCuenta: form.tipoCuenta,
        numeroCuenta: form.numeroCuenta,
        datosJSON: {
          paso: "Formulario 103 Wizard",
          resumen: periodoData?.resumen || null,
          sugerenciasATS: periodoData?.casilleros || null,
          identificacion: {
            mes,
            anio,
            ruc: rucFinal,
            razonSocial: razonSocialFinal,
          },
          preguntas: questions,
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

  const summarySections: FormSection[] = [
    ...editableRows,
    {
      title: "Subtotal operaciones efectuadas en el país",
      rows: [
        {
          concepto: "Subtotal operaciones efectuadas en el país",
          baseCode: "349",
          retCode: "399",
          readOnly: true,
        },
      ],
    },
    {
      title: "Total retención impuesto a la renta",
      rows: [
        {
          concepto: "Total retención de impuesto a la renta",
          retCode: "499",
          readOnly: true,
        },
      ],
    },
    {
      title: "Valores a pagar",
      rows: [
        { concepto: "Total impuesto a pagar", retCode: "902", readOnly: true },
        {
          concepto: "Mediante cheque, débito bancario, efectivo u otras formas de pago",
          retCode: "905",
          readOnly: true,
        },
        { concepto: "Total pagado", retCode: "999", readOnly: true },
      ],
    },
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <Header />
      <StepBar step={step} />

      {mensaje && (
        <div
          className={`rounded-xl border p-4 text-sm font-black ${
            mensaje.toLowerCase().includes("error") || mensaje.includes("No fue posible")
              ? "border-red-200 bg-red-50 text-red-700"
              : "border-emerald-200 bg-emerald-50 text-emerald-700"
          }`}
        >
          {mensaje}
        </div>
      )}

      {errors.length > 0 && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">
          <div className="mb-2 flex items-center gap-2 font-black">
            <AlertCircle size={18} />
            Revise {errors.length} validación(es).
          </div>
          <ul className="list-disc space-y-1 pl-6 text-sm font-semibold">
            {errors.map((error, index) => (
              <li key={index}>{error}</li>
            ))}
          </ul>
        </div>
      )}

      {draftSaved && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-black text-emerald-700">
          Borrador guardado.
        </div>
      )}

      {step === 1 && (
        <Panel title="1. Período fiscal">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <Field label="Obligación">
              <input className="input" value="DECLARACIÓN DE RETENCIONES EN LA FUENTE" disabled />
            </Field>
            <Field label="Mes">
              <select className="input" value={mes} onChange={(e) => setMes(e.target.value)}>
                {meses.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.value} - {item.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Año">
              <select className="input" value={anio} onChange={(e) => setAnio(Number(e.target.value))}>
                {years.map((year) => (
                  <option key={year}>{year}</option>
                ))}
              </select>
            </Field>
          </div>
        </Panel>
      )}

      {step === 2 && (
        <Panel title="2. Identificación y preguntas">
          <div className="mb-5 grid grid-cols-1 gap-3 md:grid-cols-4">
            <ReadBox label="201 RUC" value={rucFinal} />
            <ReadBox label="202 Razón social" value={razonSocialFinal || "-"} />
            <ReadBox label="Período" value={`${mesTexto} / ${anio}`} />
            <ReadBox label="Lote ATS" value={periodoData?.resumen?.atsLoteId || "-"} />
          </div>

          {periodoData?.resumen && (
            <div className="mb-5 grid grid-cols-1 gap-3 md:grid-cols-4">
              <InfoBox label="Compras leídas" value={periodoData.resumen.comprasLeidas} />
              <InfoBox label="Con retención" value={periodoData.resumen.comprasConRetencion} />
              <InfoBox label="Sin retención" value={periodoData.resumen.comprasSinRetencion} />
              <InfoBox label="Retenciones" value={periodoData.resumen.retencionesLeidas} />
            </div>
          )}

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <QuestionRow
              text="¿Requiere informar valores en este período?"
              value={questions.informaValores}
              onChange={(value) => updateQuestion("informaValores", value)}
            />
            <QuestionRow
              text="¿Ha efectuado retenciones por compras o pagos a residentes?"
              value={questions.retencionesResidentes}
              onChange={(value) => updateQuestion("retencionesResidentes", value)}
            />
          </div>

          <div className="mt-5">
            <GhostButton onClick={cargarDatosReales}>
              {loadingDatos ? <Loader2 className="animate-spin" size={16} /> : <CheckCircle2 size={16} />}
              Consultar ATS nuevamente
            </GhostButton>
          </div>
        </Panel>
      )}

      {step === 3 && (
        <Panel title="3. Formulario 103">
          {!datosCargados && (
            <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm font-black text-amber-800">
              Todavía no se ha consultado información para este período.
            </div>
          )}

          {periodoData?.resumen?.codigosNoMapeados?.length ? (
            <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-800">
              Códigos no mapeados clasificados en 346/396: {periodoData.resumen.codigosNoMapeados.join(", ")}
            </div>
          ) : null}

          <HorizontalFormularioTable
            sections={summarySections}
            form={form}
            totals={totals}
            onChange={updateForm}
          />
        </Panel>
      )}

      {step === 4 && (
        <Panel title="4. Valores a pagar">
          <HorizontalFormularioTable
            sections={[
              {
                title: "Valores a pagar",
                rows: [
                  { concepto: "Total impuesto a pagar", retCode: "902", readOnly: true },
                  { concepto: "Interés", retCode: "903" },
                  { concepto: "Multa", retCode: "904" },
                  { concepto: "Notas de crédito", retCode: "907" },
                  {
                    concepto: "Mediante cheque, débito bancario, efectivo u otras formas de pago",
                    retCode: "905",
                    readOnly: true,
                  },
                  { concepto: "Total pagado", retCode: "999", readOnly: true },
                ],
              },
            ]}
            form={form}
            totals={totals}
            onChange={updateForm}
          />

          <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-2">
            <section className="rounded-xl border bg-slate-50 p-5">
              <h3 className="mb-4 flex items-center gap-2 font-black text-[#003565]">
                <CreditCard size={18} />
                Forma de pago
              </h3>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {[
                  ["CONVENIO_DEBITO", "Convenio de débito"],
                  ["TBC", "Títulos de Banco Central"],
                  ["NOTAS_CREDITO", "Notas de crédito"],
                  ["OTRAS", "Otras formas de pago"],
                ].map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => updateForm("formaPago", value)}
                    className={`rounded-xl border px-4 py-3 text-left text-sm font-black ${
                      form.formaPago === value
                        ? "border-[#003565] bg-blue-50 text-[#003565]"
                        : "bg-white text-slate-600"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {form.formaPago === "CONVENIO_DEBITO" && (
                <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
                  <Field label="Banco">
                    <input className="input" value={form.banco} onChange={(e) => updateForm("banco", e.target.value)} />
                  </Field>
                  <Field label="Tipo cuenta">
                    <select className="input" value={form.tipoCuenta} onChange={(e) => updateForm("tipoCuenta", e.target.value)}>
                      <option>Ahorros</option>
                      <option>Corriente</option>
                    </select>
                  </Field>
                  <Field label="Número cuenta">
                    <input
                      className="input"
                      value={form.numeroCuenta}
                      onChange={(e) => updateForm("numeroCuenta", e.target.value.replace(/\D/g, ""))}
                    />
                  </Field>
                </div>
              )}
            </section>

            <section className="rounded-xl border bg-white p-5">
              <h3 className="mb-4 font-black text-[#003565]">Contador</h3>
              <QuestionRow
                text="¿Requiere firma de contador para esta declaración?"
                value={questions.obligadoContabilidad}
                onChange={(value) => updateQuestion("obligadoContabilidad", value)}
              />
              {questions.obligadoContabilidad === "SI" && (
                <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                  <Field label="RUC contador 199">
                    <input className="input" value={form["199"]} onChange={(e) => updateForm("199", e.target.value.replace(/\D/g, ""))} />
                  </Field>
                  <Field label="Clave contador">
                    <input className="input" type="password" value={form.contadorClave} onChange={(e) => updateForm("contadorClave", e.target.value)} />
                  </Field>
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
          margin-top: 0.35rem;
          width: 100%;
          border-radius: 0.7rem;
          border: 1px solid #cbd5e1;
          background: #f8fafc;
          padding: 0.62rem 0.75rem;
          font-size: 0.82rem;
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
    <section className="rounded-xl border bg-white p-6 shadow-sm">
      <div className="flex items-center gap-4">
        <div className="rounded-xl bg-slate-100 p-3 text-slate-700">
          <FileText size={26} />
        </div>
        <div>
          <h1 className="text-2xl font-black text-[#003565]">Formulario 103</h1>
          <p className="text-sm text-slate-500">
            Declaración de Retenciones en la Fuente del Impuesto a la Renta.
          </p>
        </div>
      </div>
    </section>
  );
}

function StepBar({ step }: { step: number }) {
  const items = ["Período", "Identificación", "Formulario", "Pago"];

  return (
    <div className="rounded-xl border bg-white p-4 shadow-sm">
      <div className="grid grid-cols-1 gap-2 md:grid-cols-4">
        {items.map((item, index) => {
          const active = step === index + 1;
          const done = step > index + 1;
          return (
            <div
              key={item}
              className={`rounded-xl border p-3 text-sm font-black ${
                active
                  ? "border-[#003565] bg-blue-50 text-[#003565]"
                  : done
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : "bg-slate-50 text-slate-500"
              }`}
            >
              <span className="mr-2 inline-flex h-7 w-7 items-center justify-center rounded-full bg-white">
                {done ? <CheckCircle2 size={16} /> : index + 1}
              </span>
              {item}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border bg-white p-5 shadow-sm">
      <h2 className="mb-4 text-lg font-black text-[#003565]">{title}</h2>
      {children}
    </section>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="text-[11px] font-black uppercase text-slate-500">{label}</span>
      {children}
    </label>
  );
}

function ReadBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border bg-slate-50 p-4">
      <p className="text-[10px] font-black uppercase text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-black text-slate-700">{value}</p>
    </div>
  );
}

function InfoBox({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border bg-slate-50 p-4">
      <p className="text-[10px] font-black uppercase text-slate-500">{label}</p>
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
    <div className="grid grid-cols-1 gap-3 rounded-xl border bg-slate-50 p-4 md:grid-cols-[1fr_130px] md:items-center">
      <span className="text-sm font-bold text-slate-700">{text}</span>
      <div className="grid grid-cols-2 gap-2">
        {(["SI", "NO"] as const).map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => onChange(item)}
            className={`rounded-lg px-3 py-2 text-xs font-black ${
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

function HorizontalFormularioTable({
  sections,
  form,
  totals,
  onChange,
}: {
  sections: FormSection[];
  form: FormState;
  totals: Record<string, number>;
  onChange: (key: string, value: string) => void;
}) {
  const readValue = (key?: string) => {
    if (!key) return "";
    if (Object.prototype.hasOwnProperty.call(totals, key)) return money(totals[key]);
    return form[key] || "0.00";
  };

  return (
    <div className="overflow-x-auto rounded-xl border">
      <table className="min-w-[920px] w-full border-collapse text-sm">
        <thead>
          <tr className="bg-[#003565] text-left text-xs uppercase text-white">
            <th className="w-[42%] px-3 py-3">Concepto</th>
            <th className="w-[12%] px-3 py-3 text-center">Código base imponible</th>
            <th className="w-[16%] px-3 py-3 text-right">Base imponible</th>
            <th className="w-[12%] px-3 py-3 text-center">Código valor retenido</th>
            <th className="w-[18%] px-3 py-3 text-right">Valor retenido</th>
          </tr>
        </thead>
        <tbody>
          {sections.map((section) => (
            <>
              <tr key={`${section.title}-title`} className="bg-slate-100">
                <td colSpan={5} className="px-3 py-2 text-xs font-black uppercase text-[#003565]">
                  {section.title}
                </td>
              </tr>
              {section.rows.map((row) => (
                <tr key={`${section.title}-${row.concepto}-${row.baseCode}-${row.retCode}`} className="border-t">
                  <td className="px-3 py-2 font-bold text-slate-700">{row.concepto}</td>
                  <td className="px-3 py-2 text-center font-black text-slate-600">{row.baseCode || ""}</td>
                  <td className="px-3 py-2">
                    {row.baseCode ? (
                      row.readOnly || Object.prototype.hasOwnProperty.call(totals, row.baseCode) ? (
                        <ReadMoney value={readValue(row.baseCode)} />
                      ) : (
                        <MoneyInput value={form[row.baseCode]} onChange={(value) => onChange(row.baseCode!, value)} />
                      )
                    ) : null}
                  </td>
                  <td className="px-3 py-2 text-center font-black text-slate-600">{row.retCode || ""}</td>
                  <td className="px-3 py-2">
                    {row.retCode ? (
                      row.readOnly || Object.prototype.hasOwnProperty.call(totals, row.retCode) ? (
                        <ReadMoney value={readValue(row.retCode)} />
                      ) : (
                        <MoneyInput value={form[row.retCode]} onChange={(value) => onChange(row.retCode!, value)} />
                      )
                    ) : null}
                  </td>
                </tr>
              ))}
            </>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MoneyInput({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <input
      type="number"
      min="0"
      step="0.01"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-right text-sm font-bold text-slate-700 outline-none focus:border-[#003565]"
    />
  );
}

function ReadMoney({ value }: { value: string }) {
  return (
    <div className="rounded-lg bg-slate-50 px-2 py-1.5 text-right font-black text-slate-700">
      {value}
    </div>
  );
}
