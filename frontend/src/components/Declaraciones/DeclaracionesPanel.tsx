import { useMemo, useState } from "react";
import {
  FileSpreadsheet,
  Search,
  Printer,
  Send,
  Loader2,
} from "lucide-react";
import Formulario103Wizard from "./Formulario103Wizard";
import Formulario104Wizard from "./Formulario104Wizard";
import { authFetch } from "../../api/authApi";

interface Props {
  rucUsuario: string;
  activeView: string;
  razonSocial?: string;
}

interface Declaracion {
  id: string;
  formulario: string;
  tipoImpuesto: string;
  periodoFiscal: string;
  anio: number;
  mes?: string | null;
  semestre?: string | null;
  numeroAdhesion: string;
  tipoDeclaracion: string;
  estado: string;
  valorCancelado: string | number;
  createdAt?: string;
  fechaEnvio: string;
  linkFormulario?: string | null;
  linkTalonResumen?: string | null;
}

const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:3001";

const meses = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];

const years = Array.from({ length: 7 }, (_, i) => new Date().getFullYear() - i);

export default function DeclaracionesPanel({ rucUsuario, activeView, razonSocial }: Props) {
  const active =
    activeView === "declaracion_consulta"
      ? "consulta"
      : activeView === "declaracion_107"
      ? "rdep"
      : "envio";
  const [loading, setLoading] = useState(false);
  const [mensaje, setMensaje] = useState("");
  const [declaraciones, setDeclaraciones] = useState<Declaracion[]>([]);
  const [busquedaEjecutada, setBusquedaEjecutada] = useState(false);

  const [form, setForm] = useState({
    tipoImpuesto: "Formulario de Impuesto al Valor Agregado (IVA)",
    formulario: "Formulario 104 - IVA",
    periodoFiscal: "Mensual",
    anio: new Date().getFullYear(),
    mes: "Enero",
    semestre: "",
    ventasPeriodo: "SI",
    emitioRetenciones: "NO",
    tieneEmpleados: "NO",
    baseImponible: "0.00",
    impuestoGenerado: "0.00",
    valorRetenido: "0.00",
    valorCancelado: "0.00",
    tipoPago: "Convenio de Débito Bancario",
    banco: "Banco Pichincha",
    tipoCuenta: "Ahorros",
    numeroCuenta: "",
  });

  const [filtros, setFiltros] = useState({
    tipoImpuesto: "Todos",
    anioDesde: new Date().getFullYear() - 1,
    mesDesde: "Enero",
    anioHasta: new Date().getFullYear(),
    mesHasta: "Diciembre",
    numeroAdhesion: "",
    estado: "Todas",
  });

  const [form107, setForm107] = useState({
    anio: new Date().getFullYear(),
    empleador: "",
  });

  const isMensual =
    form.tipoImpuesto.includes("IVA") ||
    form.tipoImpuesto.includes("Retenciones");

  const isSemestral = form.periodoFiscal === "Semestral";

  const cargarDeclaraciones = async () => {
    try {
      setLoading(true);
      setMensaje("");

      const params = new URLSearchParams({
        tipoImpuesto: filtros.tipoImpuesto,
        anioDesde: String(filtros.anioDesde),
        anioHasta: String(filtros.anioHasta),
        estado: filtros.estado,
      });

      const res = await authFetch(`${apiUrl}/api/declaraciones/${rucUsuario}/consultar?${params}`);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || "No fue posible consultar declaraciones.");
      }

      setDeclaraciones(Array.isArray(data) ? data : []);
      setBusquedaEjecutada(true);
    } catch (err) {
      setDeclaraciones([]);
      setBusquedaEjecutada(true);
      setMensaje(err instanceof Error ? err.message : "Error consultando declaraciones.");
    } finally {
      setLoading(false);
    }
  };

  const mesIndex = (value?: string | null) => {
    if (!value) return -1;
    const normalized = value.toLowerCase();
    return meses.findIndex((mes) => mes.toLowerCase() === normalized);
  };

  const declaracionesFiltradas = useMemo(() => {
    return declaraciones.filter((d) => {
      if (filtros.numeroAdhesion && !d.numeroAdhesion.includes(filtros.numeroAdhesion)) {
        return false;
      }
      const declaracionMes = mesIndex(d.mes);
      const desde = mesIndex(filtros.mesDesde);
      const hasta = mesIndex(filtros.mesHasta);

      if (declaracionMes >= 0 && desde >= 0 && hasta >= 0) {
        return declaracionMes >= desde && declaracionMes <= hasta;
      }

      return true;
    });
  }, [declaraciones, filtros.numeroAdhesion, filtros.mesDesde, filtros.mesHasta]);

  const formatDateTime = (value?: string | null) => {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "-";
    const pad = (num: number) => String(num).padStart(2, "0");
    return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
  };

  const estadoLabel = (estado?: string | null) => {
    const value = String(estado || "SIN ESTADO").trim();
    return value ? value.toUpperCase() : "SIN ESTADO";
  };

  const updateForm = (key: string, value: any) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const enviarDeclaracion = async () => {
    try {
      setLoading(true);
      setMensaje("");

      const res = await authFetch(`${apiUrl}/api/declaraciones/${rucUsuario}/crear`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          ventasPeriodo: form.ventasPeriodo === "SI",
          emitioRetenciones: form.emitioRetenciones === "SI",
          tieneEmpleados: form.tieneEmpleados === "SI",
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Error registrando declaración.");

      setMensaje("Declaración procesada correctamente. Puede consultarla en la opción Consulta declaraciones.");
      await cargarDeclaraciones();
    } catch (err) {
      setMensaje(err instanceof Error ? err.message : "Error inesperado.");
    } finally {
      setLoading(false);
    }
  };

  const consultar107 = async () => {
    try {
      setLoading(true);
      setMensaje("");

      const res = await authFetch(
        `${apiUrl}/api/declaraciones/${rucUsuario}/formulario107?anio=${form107.anio}`
      );

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Error consultando formulario 107.");

      setMensaje("Consulta realizada. Seleccione empleador para imprimir.");
      if (data.empleadores?.[0]) {
        setForm107((prev) => ({
          ...prev,
          empleador: `${data.empleadores[0].ruc} - ${data.empleadores[0].razonSocial}`,
        }));
      }
    } catch (err) {
      setMensaje(err instanceof Error ? err.message : "Error consultando 107.");
    } finally {
      setLoading(false);
    }
  };

  const descargarDeclaracionPdf = async (declaracion: Declaracion, tipo: "formulario" | "resumen" | "comprobante" = "formulario") => {
    try {
      setMensaje("");
      const suffix = tipo === "comprobante" ? "comprobante" : "pdf";
      const query = tipo === "resumen" ? "?tipo=resumen" : "";
      const response = await authFetch(
        `${apiUrl}/api/declaraciones/${rucUsuario}/declaracion/${declaracion.id}/${suffix}${query}`
      );

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.message || "No fue posible descargar el PDF.");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      const prefijo = tipo === "resumen" ? "Resumen" : tipo === "comprobante" ? "Comprobante" : "Formulario";
      link.download = `${prefijo}_${declaracion.formulario.replace(/[^\w.-]+/g, "_")}_${declaracion.anio}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setMensaje(err instanceof Error ? err.message : "Error descargando PDF.");
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <section className="bg-white rounded-[2rem] border shadow-sm p-7">
        <div className="flex items-center gap-4">
          <div className="p-4 bg-slate-100 text-slate-700 rounded-2xl">
            <FileSpreadsheet size={28} />
          </div>
          <div>
            <h1 className="text-2xl font-black text-[#003565]">DECLARACIONES</h1>
            <p className="text-sm text-slate-500">
              Elaboración, envío y consulta de declaraciones tributarias.
            </p>
          </div>
        </div>
      </section>

      {mensaje && (
        <div className="bg-blue-50 border border-blue-200 text-blue-700 rounded-2xl p-4 font-bold">
          {mensaje}
        </div>
      )}

      {activeView === "declaracion_103" && (
        <Formulario103Wizard rucUsuario={rucUsuario} razonSocial={razonSocial} />
      )}

      {activeView === "declaracion_104" && (
        <Formulario104Wizard rucUsuario={rucUsuario} razonSocial={razonSocial} />
      )}

                {active === "envio" && activeView !== "declaracion_103" && activeView !== "declaracion_104" && (
            <Card title="Elaboración y envío de declaraciones" subtitle="Complete los componentes obligatorios para procesar la declaración.">
              <SectionTitle text="A. Filtro inicial de obligación" />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label="Tipo de impuesto">
                  <select
                    className="input"
                    value={form.tipoImpuesto}
                    onChange={(e) => {
                      const value = e.target.value;
                      updateForm("tipoImpuesto", value);
                      updateForm(
                        "formulario",
                        value.includes("IVA")
                          ? "Formulario 104 - IVA"
                          : value.includes("Retenciones")
                          ? "Formulario 103 - Retenciones"
                          : "Formulario 102 - Renta Personas Naturales"
                      );
                    }}
                  >
                    <option>Formulario de Impuesto al Valor Agregado (IVA)</option>
                    <option>Formulario de Retenciones en la Fuente del Impuesto a la Renta</option>
                    <option>Formulario de Impuesto a la Renta Personas Naturales</option>
                  </select>
                </Field>

                <Field label="Año / Período fiscal">
                  <select className="input" value={form.anio} onChange={(e) => updateForm("anio", Number(e.target.value))}>
                    {years.map((y) => <option key={y}>{y}</option>)}
                  </select>
                </Field>

                {isMensual && !isSemestral && (
                  <Field label="Mes">
                    <select className="input" value={form.mes} onChange={(e) => updateForm("mes", e.target.value)}>
                      {meses.map((m) => <option key={m}>{m}</option>)}
                    </select>
                  </Field>
                )}

                {form.tipoImpuesto.includes("IVA") && (
                  <Field label="Periodicidad IVA">
                    <select className="input" value={form.periodoFiscal} onChange={(e) => updateForm("periodoFiscal", e.target.value)}>
                      <option>Mensual</option>
                      <option>Semestral</option>
                    </select>
                  </Field>
                )}

                {isSemestral && (
                  <Field label="Semestre">
                    <select className="input" value={form.semestre} onChange={(e) => updateForm("semestre", e.target.value)}>
                      <option>Primer Semestre</option>
                      <option>Segundo Semestre</option>
                    </select>
                  </Field>
                )}
              </div>

              <SectionTitle text="B. Preguntas de perfilamiento" />
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <RadioField label="¿Realizó ventas en el período?" value={form.ventasPeriodo} onChange={(v) => updateForm("ventasPeriodo", v)} />
                <RadioField label="¿Emitió comprobantes de retención?" value={form.emitioRetenciones} onChange={(v) => updateForm("emitioRetenciones", v)} />
                <RadioField label="¿Tiene empleados bajo relación de dependencia?" value={form.tieneEmpleados} onChange={(v) => updateForm("tieneEmpleados", v)} />
              </div>

              <SectionTitle text="C. Valores de la declaración" />
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <MoneyField label="Base imponible" value={form.baseImponible} onChange={(v) => updateForm("baseImponible", v)} />
                <MoneyField label="Impuesto generado" value={form.impuestoGenerado} onChange={(v) => updateForm("impuestoGenerado", v)} />
                <MoneyField label="Valor retenido" value={form.valorRetenido} onChange={(v) => updateForm("valorRetenido", v)} />
              </div>

              <SectionTitle text="D. Formas de pago" />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label="Tipo de pago">
                  <select className="input" value={form.tipoPago} onChange={(e) => updateForm("tipoPago", e.target.value)}>
                    <option>Convenio de Débito Bancario</option>
                    <option>Otras Formas de Pago (CEP / Tarjeta de Crédito)</option>
                  </select>
                </Field>

                <MoneyField label="Valor cancelado" value={form.valorCancelado} onChange={(v) => updateForm("valorCancelado", v)} />

                {form.tipoPago === "Convenio de Débito Bancario" && (
                  <>
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
                  </>
                )}
              </div>

              <button onClick={enviarDeclaracion} disabled={loading} className="btn-main mt-6">
                {loading ? <Loader2 className="animate-spin" size={18} /> : <Send size={18} />}
                Enviar declaración
              </button>
            </Card>
          )}

          {active === "consulta" && (
            <Card title="Consulta de declaraciones y comprobantes de pago" subtitle="Filtre las declaraciones registradas.">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Field label="Impuesto">
                  <select className="input" value={filtros.tipoImpuesto} onChange={(e) => setFiltros({ ...filtros, tipoImpuesto: e.target.value })}>
                    <option>Todos</option>
                    <option>Impuesto al Valor Agregado</option>
                    <option>Impuesto a la Renta</option>
                    <option>Retenciones en la Fuente</option>
                  </select>
                </Field>

                <Field label="Año desde">
                  <select className="input" value={filtros.anioDesde} onChange={(e) => setFiltros({ ...filtros, anioDesde: Number(e.target.value) })}>
                    {years.map((y) => <option key={y}>{y}</option>)}
                  </select>
                </Field>

                <Field label="Mes desde">
                  <select className="input" value={filtros.mesDesde} onChange={(e) => setFiltros({ ...filtros, mesDesde: e.target.value })}>
                    {meses.map((m) => <option key={m}>{m}</option>)}
                  </select>
                </Field>

                <Field label="Año hasta">
                  <select className="input" value={filtros.anioHasta} onChange={(e) => setFiltros({ ...filtros, anioHasta: Number(e.target.value) })}>
                    {years.map((y) => <option key={y}>{y}</option>)}
                  </select>
                </Field>

                <Field label="Mes hasta">
                  <select className="input" value={filtros.mesHasta} onChange={(e) => setFiltros({ ...filtros, mesHasta: e.target.value })}>
                    {meses.map((m) => <option key={m}>{m}</option>)}
                  </select>
                </Field>

                <Field label="Número de adhesión">
                  <input
                    className="input"
                    maxLength={15}
                    value={filtros.numeroAdhesion}
                    onChange={(e) => setFiltros({ ...filtros, numeroAdhesion: e.target.value.replace(/\D/g, "") })}
                  />
                </Field>

                <Field label="Estado de la declaración">
                  <select className="input" value={filtros.estado} onChange={(e) => setFiltros({ ...filtros, estado: e.target.value })}>
                    <option>Todas</option>
                    <option>BORRADOR</option>
                    <option>PRESENTADA</option>
                    <option>Borrador</option>
                    <option>Procesada</option>
                    <option>Enviada</option>
                    <option>Aceptada</option>
                    <option>Rechazada</option>
                  </select>
                </Field>
              </div>

              <button onClick={cargarDeclaraciones} disabled={loading} className="btn-secondary mt-5 disabled:opacity-60">
                {loading ? <Loader2 className="animate-spin" size={18} /> : <Search size={18} />}
                {loading ? "Buscando..." : "Buscar"}
              </button>

              <div className="mt-7 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-slate-400 border-b">
                      <th className="py-3">Adhesión</th>
                      <th>Impuesto</th>
                      <th>Período</th>
                      <th>Tipo</th>
                      <th>Fecha y hora</th>
                      <th>Valor</th>
                      <th>Estado</th>
                      <th>Formulario</th>
                      <th>Comprobante</th>
                    </tr>
                  </thead>
                  <tbody>
                    {declaracionesFiltradas.map((d) => (
                      <tr key={d.id} className="border-b">
                        <td className="py-3 font-bold">{d.numeroAdhesion}</td>
                        <td>{d.tipoImpuesto}</td>
                        <td>{d.periodoFiscal} - {d.mes || d.semestre || d.anio}</td>
                        <td>{d.tipoDeclaracion}</td>
                        <td>{formatDateTime(d.createdAt || d.fechaEnvio)}</td>
                        <td>${Number(d.valorCancelado || 0).toFixed(2)}</td>
                        <td>
                          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-700">
                            {estadoLabel(d.estado)}
                          </span>
                        </td>
                        <td>
                          <button
                            type="button"
                            onClick={() => descargarDeclaracionPdf(d)}
                            className="rounded-xl bg-blue-50 px-3 py-2 text-xs font-black text-blue-700 hover:bg-blue-100"
                          >
                            PDF
                          </button>
                        </td>
                        <td>
                          <button
                            type="button"
                            onClick={() => descargarDeclaracionPdf(d, "resumen")}
                            className="rounded-xl bg-slate-100 px-3 py-2 text-xs font-black text-slate-700 hover:bg-slate-200"
                          >
                            Resumen
                          </button>
                          {(d.formulario.includes("103") || d.formulario.includes("104")) && (
                            <button
                              type="button"
                              onClick={() => descargarDeclaracionPdf(d, "comprobante")}
                              className="ml-2 rounded-xl bg-emerald-50 px-3 py-2 text-xs font-black text-emerald-700 hover:bg-emerald-100"
                            >
                              Comprobante
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {declaracionesFiltradas.length === 0 && (
                  <p className="text-sm text-slate-500 mt-5">
                    {busquedaEjecutada
                      ? "No existen resultados para los filtros seleccionados."
                      : "No existen resultados para mostrar. Seleccione filtros y presione Buscar."}
                  </p>
                )}
              </div>
            </Card>
          )}

          {active === "rdep" && (
            <Card title="Consulta de formulario 107 - RDEP" subtitle="Consulta de información fiscal por relación de dependencia.">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label="Año / Período fiscal">
                  <select className="input" value={form107.anio} onChange={(e) => setForm107({ ...form107, anio: Number(e.target.value) })}>
                    {years.map((y) => <option key={y}>{y}</option>)}
                  </select>
                </Field>

                <Field label="RUC / Razón social del empleador">
                  <input className="input" value={form107.empleador} onChange={(e) => setForm107({ ...form107, empleador: e.target.value })} />
                </Field>
              </div>

              <button onClick={consultar107} disabled={loading} className="btn-main mt-6">
                {loading ? <Loader2 className="animate-spin" size={18} /> : <Printer size={18} />}
                Consultar / Imprimir
              </button>
            </Card>
      )}

      <style>{`
        .input {
          margin-top: 0.5rem;
          width: 100%;
          border-radius: 1rem;
          border: 1px solid #e2e8f0;
          background: #f8fafc;
          padding: 0.85rem 1rem;
          font-size: 0.875rem;
          font-weight: 600;
          outline: none;
        }
        .btn-main, .btn-secondary {
          background: #003565;
          color: white;
          padding: 1rem 1.5rem;
          border-radius: 1rem;
          font-weight: 900;
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
        }
        .btn-secondary {
          background: #f1f5f9;
          color: #003565;
        }
      `}</style>
    </div>
  );
}

function Card({ title, subtitle, children }: any) {
  return (
    <section className="bg-white rounded-[2rem] border shadow-sm p-7">
      <h2 className="text-2xl font-black text-[#003565]">{title}</h2>
      <p className="text-sm text-slate-500 mt-1 mb-6">{subtitle}</p>
      {children}
    </section>
  );
}

function Field({ label, children }: any) {
  return (
    <label className="block">
      <span className="text-[11px] font-black uppercase text-slate-400">{label}</span>
      {children}
    </label>
  );
}

function SectionTitle({ text }: { text: string }) {
  return <h3 className="font-black text-[#003565] mt-8 mb-4">{text}</h3>;
}

function RadioField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="rounded-2xl border bg-slate-50 p-4">
      <p className="text-[11px] font-black uppercase text-slate-400 mb-3">{label}</p>
      <div className="flex gap-3">
        {["SI", "NO"].map((x) => (
          <button
            key={x}
            type="button"
            onClick={() => onChange(x)}
            className={`px-4 py-2 rounded-xl text-sm font-black ${value === x ? "bg-[#003565] text-white" : "bg-white border text-slate-600"}`}
          >
            {x === "SI" ? "Sí" : "No"}
          </button>
        ))}
      </div>
    </div>
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
