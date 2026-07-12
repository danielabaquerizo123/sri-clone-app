import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Download,
  FileText,
  Loader2,
  ReceiptText,
  Save,
  Send,
} from "lucide-react";
import { getLastAtsContribuyenteForPeriod } from "../../utils/atsSession";
import { authFetch } from "../../api/authApi";

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

type DeclaracionGuardada = {
  id: string;
  numeroAdhesion: string;
  estado: string;
  valorCancelado: string | number;
  fechaEnvio: string;
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

const formularioSections: FormSection[] = [
  {
    title: "Detalle de pagos y retención por impuesto a la renta",
    rows: [
      { concepto: "En relación de dependencia", baseCode: "302", retCode: "352" },
      { concepto: "Honorarios profesionales", baseCode: "303", retCode: "353" },
      { concepto: "Honorarios profesionales no residentes", baseCode: "3030" },
    ],
  },
  {
    title: "Derivadas del trabajo y servicios prestados",
    rows: [
      { concepto: "Servicios donde predomina el intelecto", baseCode: "304", retCode: "354" },
      { concepto: "Servicios donde predomina la mano de obra", baseCode: "307", retCode: "357" },
      { concepto: "Utilización o aprovechamiento de imagen o renombre", baseCode: "308", retCode: "358" },
      { concepto: "Publicidad y comunicación", baseCode: "309", retCode: "359" },
      { concepto: "Servicios profesionales adicionales", baseCode: "310" },
      { concepto: "Liquidaciones de compra por nivel cultural o rusticidad", baseCode: "311", retCode: "361" },
    ],
  },
  {
    title: "Por bienes y servicios",
    rows: [
      { concepto: "Transferencia de bienes muebles de naturaleza corporal", baseCode: "312", retCode: "362" },
      { concepto: "Seguros y reaseguros", baseCode: "322", retCode: "372" },
      { concepto: "Transferencias especiales de bienes", baseCode: "3120" },
      { concepto: "Transferencias especiales de bienes", baseCode: "3121" },
      { concepto: "Pagos aplicables tarifa 1%", baseCode: "3430" },
      { concepto: "Pagos aplicables tarifa 1%", baseCode: "343", retCode: "393" },
      { concepto: "Pagos aplicables tarifa 2%", baseCode: "344", retCode: "394" },
      { concepto: "Otras compras de bienes y servicios no sujetas a retención", baseCode: "332" },
    ],
  },
  {
    title: "Por regalías, comisiones, arrendamientos y otros",
    rows: [
      { concepto: "Regalías, derechos de autor, marcas y patentes", baseCode: "314", retCode: "364" },
      { concepto: "Regalías y similares", baseCode: "3140" },
      { concepto: "Arrendamientos mercantiles", baseCode: "319" },
      { concepto: "Arrendamientos de bienes inmuebles", baseCode: "320" },
      { concepto: "Rendimientos financieros", baseCode: "323", retCode: "373" },
      { concepto: "Otros rendimientos financieros", baseCode: "324" },
      { concepto: "Rendimientos financieros especiales", baseCode: "3230" },
    ],
  },
  {
    title: "Relacionadas con el capital",
    rows: [
      { concepto: "Dividendos", baseCode: "325", retCode: "375" },
      { concepto: "Dividendos anticipados", baseCode: "3250" },
      { concepto: "Ganancias de capital", baseCode: "326" },
      { concepto: "Utilidades por enajenación", baseCode: "327" },
      { concepto: "Rendimientos en fideicomisos", baseCode: "328" },
      { concepto: "Cesión de derechos", baseCode: "329" },
      { concepto: "Otros conceptos de capital", baseCode: "330" },
      { concepto: "Otros pagos relacionados con capital", baseCode: "331" },
    ],
  },
  {
    title: "Autorretenciones y otras retenciones",
    rows: [
      { concepto: "Otros pagos no sujetos", baseCode: "333" },
      { concepto: "Otros pagos locales", baseCode: "334" },
      { concepto: "Otros pagos sujetos a retención", baseCode: "335" },
      { concepto: "Concepto especial", baseCode: "3481" },
      { concepto: "Otros conceptos", baseCode: "336" },
      { concepto: "Otros conceptos especiales", baseCode: "337" },
      { concepto: "Otros conceptos especiales", baseCode: "3370" },
      { concepto: "Autorretenciones", baseCode: "350" },
      { concepto: "Pagos aplicables tarifa 2% especiales", baseCode: "3440" },
      { concepto: "Otras retenciones aplicables 8%", baseCode: "345", retCode: "395" },
      { concepto: "Otras retenciones aplicables a otros porcentajes", baseCode: "346", retCode: "396" },
      { concepto: "Otros conceptos de cierre", baseCode: "348" },
    ],
  },
  {
    title: "Pagos al exterior",
    rows: [
      ...["402", "403", "404", "405", "406", "407", "408", "409", "410", "411", "412", "413", "414", "415", "416", "417", "418", "419", "420", "421", "422", "423", "424", "425", "426", "427", "428", "429", "430", "431", "432", "433"].map((code) => ({
        concepto: `Pago al exterior casillero ${code}`,
        baseCode: code,
      })),
    ],
  },
];

const allNumericCasilleros = [
  "302",
  "352",
  "303",
  "353",
  "3030",
  "304",
  "354",
  "307",
  "357",
  "308",
  "358",
  "309",
  "359",
  "310",
  "311",
  "361",
  "312",
  "362",
  "3120",
  "3121",
  "314",
  "364",
  "3140",
  "319",
  "320",
  "322",
  "372",
  "323",
  "373",
  "3230",
  "324",
  "325",
  "375",
  "3250",
  "326",
  "327",
  "328",
  "329",
  "330",
  "331",
  "332",
  "333",
  "334",
  "335",
  "336",
  "337",
  "3370",
  "343",
  "3430",
  "393",
  "344",
  "3440",
  "394",
  "345",
  "395",
  "346",
  "396",
  "348",
  "3481",
  "349",
  "350",
  "399",
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
  "423",
  "424",
  "425",
  "426",
  "427",
  "428",
  "429",
  "430",
  "431",
  "432",
  "433",
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

const basePaisCodes = [
  "302",
  "303",
  "3030",
  "304",
  "307",
  "308",
  "309",
  "310",
  "311",
  "312",
  "3120",
  "3121",
  "314",
  "3140",
  "319",
  "320",
  "322",
  "323",
  "3230",
  "324",
  "325",
  "3250",
  "326",
  "327",
  "328",
  "329",
  "330",
  "331",
  "332",
  "333",
  "334",
  "335",
  "336",
  "337",
  "3370",
  "343",
  "3430",
  "344",
  "3440",
  "345",
  "346",
  "348",
  "3481",
  "350",
];

const retenidoPaisCodes = [
  "352",
  "353",
  "354",
  "357",
  "358",
  "359",
  "361",
  "362",
  "364",
  "372",
  "373",
  "375",
  "393",
  "394",
  "395",
  "396",
];

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
  const [confirmado, setConfirmado] = useState(false);
  const [declaracionGuardada, setDeclaracionGuardada] = useState<DeclaracionGuardada | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [mensaje, setMensaje] = useState("");

  const totals = useMemo(() => {
    const basePais = round2(
      basePaisCodes.reduce((acc, key) => acc + toNumber(form[key]), 0)
    );
    const retenidoPais = round2(
      retenidoPaisCodes.reduce((acc, key) => acc + toNumber(form[key]), 0)
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

  const atsContribuyente = getLastAtsContribuyenteForPeriod(anio, mes);
  const rucDeclaracion = atsContribuyente?.ruc || rucUsuario;
  const razonSocialDeclaracion = atsContribuyente?.razonSocial || razonSocial || "";
  const rucFinal = periodoData?.ruc || rucDeclaracion;
  const razonSocialFinal = periodoData?.razonSocial || razonSocialDeclaracion;
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

      const response = await authFetch(
        `${apiUrl}/api/declaraciones/${rucDeclaracion}/formulario103?anio=${anio}&mes=${mes}`
      );
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "No fue posible consultar la información del período seleccionado.");
      }

      const nextForm: FormState = { ...initialForm };
      allNumericCasilleros.forEach((key) => {
        nextForm[key] = inputMoney(data.casilleros?.[key] ?? 0);
      });
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
      formularioSections.flatMap((section) => section.rows).forEach((row) => {
        if (row.retCode && toNumber(form[row.retCode]) > 0 && row.baseCode && toNumber(form[row.baseCode]) <= 0) {
          nextErrors.push(`Casillero ${row.retCode}: existe retención sin base imponible.`);
        }
      });
    }

    if (step === 4) {
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

  const buildPayload = (estado: "BORRADOR" | "PRESENTADA") => {
    const casilleros = {
        ...Object.fromEntries(
          Object.entries(form)
            .filter(([key]) => /^\d+$/.test(key))
            .map(([key, value]) => [key, toNumber(value)])
        ),
        ...totals,
      };

    return {
        declaracionId: declaracionGuardada?.id,
        estado,
        tipoImpuesto: "Formulario de Retenciones en la Fuente del Impuesto a la Renta",
        formulario: "Formulario 103 - Retenciones en la Fuente",
        periodoFiscal: "Mensual",
        anio: Number(anio),
        mes: mesTexto,
        tipoDeclaracion: "Original",
        baseImponible: totals["349"],
        impuestoGenerado: 0,
        valorRetenido: totals["499"],
        valorCancelado: totals["999"],
        tipoPago: "SIN_CAPTURA_BANCARIA",
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
          confirmacion: confirmado,
        },
      };
  };

  const guardarDeclaracion = async (estado: "BORRADOR" | "PRESENTADA") => {
    const res = await authFetch(`${apiUrl}/api/declaraciones/${rucDeclaracion}/crear`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildPayload(estado)),
    });
    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.message || "Error guardando Formulario 103.");
    }

    setDeclaracionGuardada(data.declaracion);
    return data.declaracion as DeclaracionGuardada;
  };

  const saveDraft = async () => {
    try {
      setLoadingEnviar(true);
      setMensaje("");
      const declaracion = await guardarDeclaracion("BORRADOR");
      localStorage.setItem(
        `formulario103-${rucDeclaracion}`,
        JSON.stringify({ declaracionId: declaracion.id, mes, anio, form, questions, totals, periodoData })
      );
      setDraftSaved(true);
      setMensaje("Borrador guardado correctamente.");
      setTimeout(() => setDraftSaved(false), 3200);
    } catch (err) {
      setMensaje(err instanceof Error ? err.message : "Error guardando borrador.");
    } finally {
      setLoadingEnviar(false);
    }
  };

  const enviarDeclaracion = async () => {
    if (!validateStep()) return;

    if (!confirmado) {
      setErrors(["Debe confirmar que los valores declarados son correctos."]);
      return;
    }

    try {
      setLoadingEnviar(true);
      setMensaje("");

      await guardarDeclaracion("PRESENTADA");
      setMensaje("Su declaración ha sido procesada satisfactoriamente.");
      localStorage.removeItem(`formulario103-${rucDeclaracion}`);
    } catch (err) {
      setMensaje(err instanceof Error ? err.message : "Error inesperado enviando Formulario 103.");
    } finally {
      setLoadingEnviar(false);
    }
  };

  const descargarArchivo = async (tipo: "pdf" | "comprobante") => {
    if (!declaracionGuardada) return;
    const path =
      tipo === "pdf"
        ? `/api/declaraciones/${rucDeclaracion}/declaracion/${declaracionGuardada.id}/pdf`
        : `/api/declaraciones/${rucDeclaracion}/declaracion/${declaracionGuardada.id}/comprobante`;
    const response = await authFetch(`${apiUrl}${path}`);
    if (!response.ok) {
      setMensaje("No fue posible descargar el documento.");
      return;
    }
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${tipo === "pdf" ? "Formulario103" : "Comprobante103"}_${rucDeclaracion}_${anio}_${mes}.pdf`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  };

  const summarySections: FormSection[] = [
    ...formularioSections,
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
          {atsContribuyente && (
            <div className="mb-4 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
              <p className="font-black">Declaración para contribuyente detectado ATS</p>
              <p className="mt-1 font-semibold">
                RUC: {atsContribuyente.ruc} · Razón social: {atsContribuyente.razonSocial} · Lote: {atsContribuyente.loteId}
              </p>
            </div>
          )}
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
              <h3 className="mb-4 font-black text-[#003565]">Resumen de declaración</h3>
              <SummaryLine label="RUC" value={rucFinal} />
              <SummaryLine label="Período" value={`${mesTexto} / ${anio}`} />
              <SummaryLine label="Total a pagar" value={`$${money(totals["999"])}`} strong />
              <label className="mt-5 flex items-start gap-3 rounded-xl border bg-white p-4 text-sm font-bold text-slate-700">
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4"
                  checked={confirmado}
                  onChange={(event) => setConfirmado(event.target.checked)}
                />
                <span>Confirmo que los valores declarados son correctos y acepto enviar esta declaración.</span>
              </label>
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

          {declaracionGuardada && (
            <section className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-5">
              <h3 className="mb-3 font-black text-emerald-800">Declaración registrada</h3>
              <div className="grid grid-cols-1 gap-3 text-sm md:grid-cols-5">
                <ReadBox label="Adhesión" value={declaracionGuardada.numeroAdhesion} />
                <ReadBox label="RUC" value={rucFinal} />
                <ReadBox label="Período" value={`${mesTexto} / ${anio}`} />
                <ReadBox label="Valor" value={`$${money(totals["999"])}`} />
                <ReadBox label="Estado" value={declaracionGuardada.estado} />
              </div>
              <div className="mt-4 flex flex-wrap gap-3">
                <ActionButton onClick={() => descargarArchivo("pdf")}>
                  <Download size={16} />
                  Descargar PDF
                </ActionButton>
                <ActionButton onClick={() => descargarArchivo("comprobante")}>
                  <ReceiptText size={16} />
                  Descargar comprobante
                </ActionButton>
                <ActionButton onClick={() => window.dispatchEvent(new CustomEvent("sri:navigate", { detail: "declaracion_consulta" }))}>
                  <FileText size={16} />
                  Ver Consulta de Declaraciones
                </ActionButton>
              </div>
            </section>
          )}
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

function SummaryLine({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`flex items-center justify-between border-b py-3 ${strong ? "font-black text-[#003565]" : "font-bold text-slate-700"}`}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}

function ActionButton({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-black text-[#003565] ring-1 ring-blue-100 hover:bg-blue-50"
    >
      {children}
    </button>
  );
}
