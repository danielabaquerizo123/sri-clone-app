import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Download,
  Loader2,
  Pencil,
  Printer,
  RefreshCcw,
  Save,
  Search,
  ShieldCheck,
} from "lucide-react";

import DeclaracionesPanel from "../components/Declaraciones/DeclaracionesPanel";
import AnexosPanel from "../components/Anexos/AnexosPanel";
import ContabilidadPanel from "../components/Contabilidad/ContabilidadPanel";
import DashboardHeader from "../components/Dashboard/DashboardHeader";
import DashboardHome from "../components/Dashboard/DashboardHome";
import DashboardSidebar from "../components/Dashboard/DashboardSidebar";
import { authFetch } from "../api/authApi";
import { calcularDiasRestantes } from "../utils/acceso";

interface DashboardViewProps {
  rucUsuario: string;
  razonSocialUsuario: string;
  activeContribuyente: {
    ruc: string;
    razonSocial: string;
  };
  onLogout: () => void;
}

interface Conteos {
  declaraciones: number;
  ventas: number;
  compras: number;
  anulados: number;
  guias: number;
  proveedores: number;
}

export interface ContribuyenteData {
  id: string;
  ruc: string;
  ciAdicional?: string | null;
  clave?: string;
  razonSocial: string;
  tipoContribuyente: "PERSONA_NATURAL" | "SOCIEDAD";
  estadoTributario: string;
  rol: "ADMIN" | "CONTADOR" | "CONTRIBUYENTE";
  activo: boolean;
  fechaExpiracion: string;
  estadoRuc: string;
  regimen: string;
  obligaciones: string;
  actividadesEconomicas: string;
  establecimientosAbiertos: number;
  establecimientosCerrados: number;
  createdAt: string;
  fechaRegistro?: string | null;
  fechaInicioActividades?: string | null;
  fechaCeseActividades?: string | null;
  fechaReinicioActividades?: string | null;
  fechaActualizacion?: string | null;
  provincia?: string | null;
  canton?: string | null;
  parroquia?: string | null;
  barrio?: string | null;
  calle?: string | null;
  numero?: string | null;
  interseccion?: string | null;
  referencia?: string | null;
  jurisdiccion?: string | null;
  email?: string | null;
  telefonoDomicilio?: string | null;
  celular?: string | null;
  artesano?: string | null;
  obligadoContabilidad?: string | null;
  tipoAgenteRetencion?: string | null;
  agenteRetencion?: string | null;
  contribuyenteEspecial?: string | null;
  numerosRucAnteriores?: string | null;
  codigoVerificacion?: string | null;
  direccionIpEmision?: string | null;
  _count?: Conteos;
}

export interface OpcionesRuc {
  inscripcion: boolean;
  actualizacion: boolean;
  reapertura: boolean;
  reimpresion: boolean;
}

const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:3001";

export default function DashboardView({
  rucUsuario,
  razonSocialUsuario,
  activeContribuyente,
  onLogout,
}: DashboardViewProps) {
  const [activeTab, setActiveTab] = useState("inicio");
  const [data, setData] = useState<ContribuyenteData | null>(null);
  const [form, setForm] = useState<Partial<ContribuyenteData>>({});
  const [opcionesRuc, setOpcionesRuc] = useState<OpcionesRuc | null>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [reaperturaLoading, setReaperturaLoading] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [fechaActual, setFechaActual] = useState(() => new Date());

  const [reaperturaMotivo, setReaperturaMotivo] = useState("");
  const [reaperturaObs, setReaperturaObs] = useState("");
  const [confirmReapertura, setConfirmReapertura] = useState(false);

  const obligacionesList = useMemo(
    () => data?.obligaciones?.split(",").map((x) => x.trim()).filter(Boolean) || [],
    [data]
  );

  const rucActivo = activeContribuyente.ruc || rucUsuario;
  const diasRestantesAcceso = useMemo(
    () => calcularDiasRestantes(data?.fechaExpiracion, fechaActual),
    [data?.fechaExpiracion, fechaActual]
  );

  const actividadesList = useMemo(
    () =>
      data?.actividadesEconomicas
        ?.split("•")
        .join(",")
        .split(",")
        .map((x) => x.trim())
        .filter(Boolean) || [],
    [data]
  );

  const cargarDatos = async () => {
    const primeraCarga = !data;

    try {
      if (primeraCarga) {
        setLoading(true);
      }
      setError("");

      const [perfilRes, opcionesRes] = await Promise.all([
        authFetch(`${apiUrl}/api/contribuyentes/perfil/${rucActivo}`),
        authFetch(`${apiUrl}/api/contribuyentes/${rucActivo}/ruc/opciones`),
      ]);

      if (!perfilRes.ok) throw new Error("No se pudo cargar el perfil.");
      if (!opcionesRes.ok) throw new Error("No se pudieron cargar las opciones RUC.");

      const perfil = await perfilRes.json();
      const opciones = await opcionesRes.json();

      setData(perfil);
      setForm(perfil);
      setOpcionesRuc(opciones.opciones);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error cargando información.");
    } finally {
      if (primeraCarga) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    cargarDatos();
  }, [rucActivo]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setFechaActual(new Date());
    }, 60 * 1000);

    return () => window.clearInterval(intervalId);
  }, []);

  const updateField = (name: keyof ContribuyenteData, value: string | number) => {
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const guardarActualizacion = async (e: FormEvent) => {
    e.preventDefault();

    try {
      setSaving(true);
      setError("");
      setSuccess("");

      const response = await authFetch(`${apiUrl}/api/contribuyentes/${rucActivo}/ruc/actualizar`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      const result = await response.json();

      if (!response.ok) throw new Error(result.message || "No se pudo actualizar.");

      setData(result.contribuyente);
      setForm(result.contribuyente);
      setSuccess("Datos actualizados correctamente.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error guardando actualización.");
    } finally {
      setSaving(false);
    }
  };

  const enviarReapertura = async (e: FormEvent) => {
    e.preventDefault();

    try {
      setReaperturaLoading(true);
      setError("");
      setSuccess("");

      const response = await authFetch(`${apiUrl}/api/contribuyentes/${rucActivo}/ruc/reapertura`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ motivo: reaperturaMotivo, observaciones: reaperturaObs }),
      });

      const result = await response.json();

      if (!response.ok) throw new Error(result.message || "No se pudo procesar la reapertura.");

      setData(result.contribuyente);
      setForm(result.contribuyente);
      setSuccess("Reapertura procesada correctamente.");
      setReaperturaMotivo("");
      setReaperturaObs("");
      setConfirmReapertura(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error procesando reapertura.");
    } finally {
      setReaperturaLoading(false);
    }
  };

  const descargarPdfRuc = async () => {
    try {
      setDownloadingPdf(true);
      setError("");

      const response = await authFetch(`${apiUrl}/api/contribuyentes/${rucActivo}/ruc/reimpresion/pdf`);

      if (!response.ok) throw new Error("No se pudo descargar el PDF.");

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);

      const link = document.createElement("a");
      link.href = url;
      link.download = `RUC-${rucActivo}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();

      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error descargando PDF.");
    } finally {
      setDownloadingPdf(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center">
        <div className="bg-white rounded-3xl shadow-xl border px-8 py-6 flex items-center gap-4">
          <Loader2 className="animate-spin text-[#003565]" />
          <span className="font-black text-slate-700">Cargando portal transaccional...</span>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-6">
        <div className="bg-white rounded-3xl shadow-xl border p-8 max-w-lg">
          <h1 className="font-black text-red-700 mb-2">No se encontró información</h1>
          <p className="text-sm text-slate-600">{error}</p>
          <button onClick={onLogout} className="mt-5 bg-[#003565] text-white px-5 py-3 rounded-xl font-bold">
            Volver al login
          </button>
        </div>
      </div>
    );
  }

  const isActivo = data.estadoRuc?.toUpperCase() === "ACTIVO";
  const displayRuc = rucUsuario;
  const displayRazonSocial = razonSocialUsuario || rucUsuario;

  return (
    <div className="flex h-screen overflow-hidden bg-[#eef4fb] text-slate-800">
      <DashboardSidebar
        activeTab={activeTab}
        data={data}
        diasRestantesAcceso={diasRestantesAcceso}
        opcionesRuc={opcionesRuc}
        onLogout={onLogout}
        onNavigate={setActiveTab}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <DashboardHeader
          activeTab={activeTab}
          nombreUsuario={displayRazonSocial}
          rucUsuario={displayRuc}
          tipoContribuyente={data.tipoContribuyente}
          now={fechaActual}
        />

        <main className={`min-w-0 flex-1 overflow-x-hidden overflow-y-auto p-4 [scrollbar-width:thin] [scrollbar-color:#cbd5e1_transparent] lg:p-5 2xl:p-6 ${activeTab === "contabilidad" ? "pb-0 lg:pb-0 2xl:pb-0" : ""}`}>
          {(error || success) && (
            <div className="mx-auto mb-4 w-full max-w-[1800px]">
              {error && <Alert type="error" text={error} />}
              {success && <Alert type="success" text={success} />}
            </div>
          )}

          {activeTab === "inicio" && (
            <DashboardHome
              data={data}
              diasRestantesAcceso={diasRestantesAcceso}
              obligacionesList={obligacionesList}
              actividadesList={actividadesList}
              onNavigate={setActiveTab}
              onRefresh={cargarDatos}
            />
          )}

          {activeTab === "ruc_inscripcion" && (
            <Page title="Inscripción RUC" subtitle="Formulario institucional de registro tributario." icon={<Search />}>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2">
                  <PremiumForm>
                    <FormGrid>
                      <ReadInput label="RUC detectado" value={data.ruc} />
                      <ReadInput label="Razón social" value={data.razonSocial} />
                      <ReadInput label="Tipo contribuyente" value={data.tipoContribuyente} />
                      <ReadInput label="Estado actual" value={data.estadoRuc} />
                      <ReadInput label="Régimen" value={data.regimen} />
                      <ReadInput label="Fecha registro" value={formatDate(data.fechaRegistro)} />
                    </FormGrid>
                    <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800">
                      Este RUC ya existe en la base de datos. La inscripción no crea duplicados; sirve como vista formal de registro.
                    </div>
                  </PremiumForm>
                </div>

                <SideNote title="Validación de inscripción">
                  El sistema identifica que este contribuyente ya posee RUC registrado, por eso no se genera un nuevo registro duplicado.
                </SideNote>
              </div>
            </Page>
          )}

          {activeTab === "ruc_actualizacion" && (
            <Page title="Actualización RUC" subtitle="Edita la información del contribuyente y guarda los cambios." icon={<Pencil />}>
              <form onSubmit={guardarActualizacion} className="space-y-6">
                <PremiumForm title="Datos principales">
                  <FormGrid>
                    <Input label="Razón social" value={form.razonSocial} onChange={(v) => updateField("razonSocial", v)} />
                    <Input label="Estado tributario" value={form.estadoTributario} onChange={(v) => updateField("estadoTributario", v)} />
                    <Input label="Estado RUC" value={form.estadoRuc} onChange={(v) => updateField("estadoRuc", v)} />
                    <Input label="Régimen" value={form.regimen} onChange={(v) => updateField("regimen", v)} />
                    <Input label="Establecimientos abiertos" type="number" value={form.establecimientosAbiertos} onChange={(v) => updateField("establecimientosAbiertos", Number(v))} />
                    <Input label="Establecimientos cerrados" type="number" value={form.establecimientosCerrados} onChange={(v) => updateField("establecimientosCerrados", Number(v))} />
                  </FormGrid>
                </PremiumForm>

                <PremiumForm title="Dirección y contacto">
                  <FormGrid>
                    <Input label="Provincia" value={form.provincia} onChange={(v) => updateField("provincia", v)} />
                    <Input label="Cantón" value={form.canton} onChange={(v) => updateField("canton", v)} />
                    <Input label="Parroquia" value={form.parroquia} onChange={(v) => updateField("parroquia", v)} />
                    <Input label="Barrio" value={form.barrio} onChange={(v) => updateField("barrio", v)} />
                    <Input label="Calle" value={form.calle} onChange={(v) => updateField("calle", v)} />
                    <Input label="Número" value={form.numero} onChange={(v) => updateField("numero", v)} />
                    <Input label="Intersección" value={form.interseccion} onChange={(v) => updateField("interseccion", v)} />
                    <Input label="Referencia" value={form.referencia} onChange={(v) => updateField("referencia", v)} />
                    <Input label="Email" value={form.email} onChange={(v) => updateField("email", v)} />
                    <Input label="Teléfono domicilio" value={form.telefonoDomicilio} onChange={(v) => updateField("telefonoDomicilio", v)} />
                    <Input label="Celular" value={form.celular} onChange={(v) => updateField("celular", v)} />
                    <Input label="Jurisdicción" value={form.jurisdiccion} onChange={(v) => updateField("jurisdiccion", v)} />
                  </FormGrid>
                </PremiumForm>

                <PremiumForm title="Información tributaria">
                  <FormGrid>
                    <Input label="Artesano" value={form.artesano} onChange={(v) => updateField("artesano", v)} />
                    <Input label="Obligado contabilidad" value={form.obligadoContabilidad} onChange={(v) => updateField("obligadoContabilidad", v)} />
                    <Input label="Tipo agente retención" value={form.tipoAgenteRetencion} onChange={(v) => updateField("tipoAgenteRetencion", v)} />
                    <Input label="Contribuyente especial" value={form.contribuyenteEspecial} onChange={(v) => updateField("contribuyenteEspecial", v)} />
                  </FormGrid>

                  <TextArea label="Actividades económicas" value={form.actividadesEconomicas} onChange={(v) => updateField("actividadesEconomicas", v)} />
                  <TextArea label="Obligaciones" value={form.obligaciones} onChange={(v) => updateField("obligaciones", v)} />
                </PremiumForm>

                <div className="flex justify-end">
                  <button disabled={saving} className="bg-[#003565] hover:bg-[#00284d] text-white px-6 py-4 rounded-2xl font-black shadow-lg flex items-center gap-2 disabled:opacity-60">
                    {saving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                    {saving ? "Guardando..." : "Guardar cambios"}
                  </button>
                </div>
              </form>
            </Page>
          )}

          {activeTab === "ruc_reapertura" && (
            <Page title="Reapertura RUC" subtitle="Solicitud de reapertura con validación del estado actual." icon={<RefreshCcw />}>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <form onSubmit={enviarReapertura} className="lg:col-span-2">
                  <PremiumForm>
                    {isActivo && (
                      <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800">
                        Este RUC está ACTIVO. Puede llenar el formulario, pero la reapertura no procede porque no corresponde cambiar el estado.
                      </div>
                    )}

                    <Input label="RUC" value={data.ruc} disabled onChange={() => {}} />
                    <Input label="Estado actual" value={data.estadoRuc} disabled onChange={() => {}} />
                    <TextArea label="Motivo de reapertura" value={reaperturaMotivo} onChange={setReaperturaMotivo} />
                    <TextArea label="Observaciones" value={reaperturaObs} onChange={setReaperturaObs} />

                    <label className="mt-5 flex items-start gap-3 rounded-2xl bg-slate-50 border p-4 text-sm">
                      <input type="checkbox" checked={confirmReapertura} onChange={(e) => setConfirmReapertura(e.target.checked)} className="mt-1" />
                      <span>Declaro que la información ingresada es verdadera y exacta.</span>
                    </label>

                    <button disabled={!confirmReapertura || reaperturaLoading} className="mt-6 w-full bg-[#003565] hover:bg-[#00284d] text-white px-6 py-4 rounded-2xl font-black shadow-lg flex items-center justify-center gap-2 disabled:opacity-50">
                      {reaperturaLoading ? <Loader2 className="animate-spin" size={18} /> : <RefreshCcw size={18} />}
                      Enviar solicitud
                    </button>
                  </PremiumForm>
                </form>

                <SideNote title="Regla del sistema">
                  Si el RUC está activo, la reapertura no procede. Si está suspendido, se actualiza el estado a ACTIVO y se registra la fecha de reinicio.
                </SideNote>
              </div>
            </Page>
          )}

          {activeTab === "ruc_reimpresion" && (
            <Page title="Reimpresión RUC" subtitle="Revisa los datos antes de descargar el certificado PDF." icon={<Printer />}>
              <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                <div className="xl:col-span-2 bg-white rounded-[2rem] border shadow-sm p-8">
                  <div className="flex items-center justify-between border-b pb-5 mb-6">
                    <div>
                      <h2 className="font-black text-2xl text-[#003565]">Certificado RUC</h2>
                      <p className="text-sm text-slate-500">Registro Único de Contribuyentes</p>
                    </div>
                    <div className="bg-blue-50 text-blue-700 px-4 py-2 rounded-2xl text-xs font-black">
                      {data.estadoRuc}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Info label="RUC" value={data.ruc} />
                    <Info label="Razón social" value={data.razonSocial} />
                    <Info label="Régimen" value={data.regimen} />
                    <Info label="Provincia / Cantón" value={`${data.provincia || "-"} / ${data.canton || "-"}`} />
                    <Info label="Email" value={data.email} />
                    <Info label="Código verificación" value={data.codigoVerificacion || "Se generará al emitir"} />
                  </div>

                  <div className="mt-6 rounded-2xl bg-slate-50 border p-5">
                    <h3 className="font-black text-[#003565] mb-2">Actividades económicas</h3>
                    <p className="text-sm text-slate-600 leading-relaxed">{data.actividadesEconomicas}</p>
                  </div>
                </div>

                <div className="bg-white rounded-[2rem] border shadow-sm p-6 h-fit">
                  <h3 className="font-black text-[#003565] mb-3">Descarga oficial</h3>
                  <p className="text-sm text-slate-500 mb-5">
                    El certificado se genera desde los datos reales registrados.
                  </p>
                  <button onClick={descargarPdfRuc} disabled={downloadingPdf} className="w-full bg-[#003565] hover:bg-[#00284d] text-white rounded-2xl px-5 py-4 font-black flex items-center justify-center gap-2 shadow-lg disabled:opacity-60">
                    {downloadingPdf ? <Loader2 className="animate-spin" size={18} /> : <Download size={18} />}
                    {downloadingPdf ? "Generando PDF..." : "Descargar PDF"}
                  </button>
                </div>
              </div>
            </Page>
          )}

          {activeTab.startsWith("declaracion_") && (
            <DeclaracionesPanel
              rucUsuario={rucUsuario}
              activeView={activeTab}
              razonSocial={razonSocialUsuario}
            />
          )}

          {activeTab.startsWith("anexo_") && (
            <AnexosPanel
              rucUsuario={rucUsuario}
              rucActivo={rucActivo}
              activeView={activeTab}
            />
          )}

          {activeTab === "contabilidad" && (
            <div className="flex min-h-full flex-col">
              <ContabilidadPanel rucActivo={rucActivo} />
            </div>
          )}

        </main>
      </div>
    </div>
  );
}

function Page({ title, subtitle, icon, children }: { title: string; subtitle: string; icon: ReactNode; children: ReactNode }) {
  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="bg-white rounded-[2rem] border shadow-sm p-7 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="p-4 bg-blue-50 text-[#006aa6] rounded-2xl">{icon}</div>
          <div>
            <h1 className="text-2xl font-black text-[#003565]">{title}</h1>
            <p className="text-sm text-slate-500 mt-1">{subtitle}</p>
          </div>
        </div>
        <ArrowRight className="text-slate-300" />
      </div>
      {children}
    </div>
  );
}

function PremiumForm({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <div className="bg-white rounded-[2rem] border shadow-sm p-7">
      {title && <h2 className="font-black text-[#003565] mb-5">{title}</h2>}
      {children}
    </div>
  );
}

function FormGrid({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{children}</div>;
}

function Input({ label, value, onChange, type = "text", disabled = false }: { label: string; value: any; onChange: (value: string) => void; type?: string; disabled?: boolean }) {
  return (
    <label className="block">
      <span className="text-[11px] font-black uppercase text-slate-400">{label}</span>
      <input
        disabled={disabled}
        type={type}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        className="mt-2 w-full rounded-2xl border bg-slate-50 px-4 py-3 text-sm font-semibold outline-none focus:ring-2 focus:ring-[#0077b6]/30 disabled:text-slate-400"
      />
    </label>
  );
}

function ReadInput({ label, value }: { label: string; value?: string | null }) {
  return <Input label={label} value={value || "-"} disabled onChange={() => {}} />;
}

function TextArea({ label, value, onChange }: { label: string; value: any; onChange: (value: string) => void }) {
  return (
    <label className="block mt-4">
      <span className="text-[11px] font-black uppercase text-slate-400">{label}</span>
      <textarea
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        rows={4}
        className="mt-2 w-full rounded-2xl border bg-slate-50 px-4 py-3 text-sm font-semibold outline-none focus:ring-2 focus:ring-[#0077b6]/30 resize-none"
      />
    </label>
  );
}

function Info({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="rounded-2xl border bg-slate-50 p-4">
      <p className="text-[10px] uppercase font-black text-slate-400 mb-1">{label}</p>
      <p className="font-bold text-slate-800">{value || "-"}</p>
    </div>
  );
}

function SideNote({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="bg-gradient-to-br from-[#003565] to-[#0077b6] text-white rounded-[2rem] p-7 shadow-xl h-fit">
      <ShieldCheck size={32} className="mb-4 text-blue-100" />
      <h3 className="font-black text-lg mb-2">{title}</h3>
      <p className="text-sm text-white/75 leading-relaxed">{children}</p>
    </div>
  );
}

function Alert({ type, text }: { type: "error" | "success"; text: string }) {
  return (
    <div
      className={`rounded-2xl border px-5 py-4 text-sm font-bold flex items-center gap-3 ${
        type === "error"
          ? "bg-red-50 border-red-200 text-red-700"
          : "bg-emerald-50 border-emerald-200 text-emerald-700"
      }`}
    >
      {type === "error" ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}
      {text}
    </div>
  );
}

function formatDate(value?: string | null) {
  if (!value) return "No registra";
  return new Date(value).toLocaleDateString("es-EC");
}
