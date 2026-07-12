import { useEffect, useState } from "react";
import AtsMasivoPanel from "./AtsMasivoPanel";
import {
  FileLock2,
  Upload,
  Loader2,
} from "lucide-react";
import { authFetch } from "../../api/authApi";

interface Props {
  rucUsuario: string;
  rucActivo: string;
  activeView: string;
}

interface Anexo {
  id: string;
  tipoAnexo: string;
  periodoFiscal: string;
  anio: number;
  mes?: string | null;
  estado: string;
  archivoNombre?: string | null;
  fechaEnvio: string;
}

const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:3001";

export default function AnexosPanel({
  rucUsuario,
  rucActivo,
  activeView,
}: Props) {
  const active =
    activeView === "anexo_envio"
      ? "envio"
      : activeView === "anexo_beneficiario"
      ? "beneficiario"
      : activeView === "anexo_dependientes_2022"
      ? "dependientes2022"
      : activeView === "anexo_cargas_2023"
      ? "cargas2023"
      : "atsMasivo";
  const [loading, setLoading] = useState(false);
  const [mensaje, setMensaje] = useState("");
  const [anexos, setAnexos] = useState<Anexo[]>([]);

  const [anexoForm, setAnexoForm] = useState({
    tipoAnexo: "Anexo Transaccional Simplificado (ATS)",
    periodoFiscal: "Mensual",
    anio: new Date().getFullYear(),
    mes: "Mayo",
    archivoNombre: "ats_generado_dimm.zip",
  });

  const [beneficiarioForm, setBeneficiarioForm] = useState({
    tipoIdentificacion: "CEDULA",
    identificacion: "",
    nombres: "",
    montoAnual: "",
  });

  const [dependienteForm, setDependienteForm] = useState({
    identificacion: "",
    nombres: "",
    parentesco: "",
    anio: 2022,
    tipoPeriodo: "HASTA_2022",
  });

  const [cargaForm, setCargaForm] = useState({
    periodoFiscal: new Date().getFullYear(),
    tipoIdentificacion: "CEDULA",
    identificacion: "",
    nombres: "",
    parentesco: "",
    condicionDiscapacidad: "NO",
    enfermedadCatastrofica: false,
    tipoPeriodo: "DESDE_2023",
  });

  const cargarAnexos = async () => {
    const res = await authFetch(`${apiUrl}/api/anexos/${rucActivo}/consultar`);
    const data = await res.json();
    setAnexos(Array.isArray(data) ? data : []);
  };

  useEffect(() => {
    cargarAnexos();
  }, [rucActivo]);

  const enviarAnexo = async () => {
    try {
      setLoading(true);
      setMensaje("");

      const res = await authFetch(`${apiUrl}/api/anexos/${rucActivo}/enviar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...anexoForm, datosJSON: anexoForm }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message);

      setMensaje("Anexo enviado correctamente.");
      await cargarAnexos();
    } catch (err) {
      setMensaje(err instanceof Error ? err.message : "Error enviando anexo.");
    } finally {
      setLoading(false);
    }
  };

  const registrarBeneficiario = async () => {
    try {
      setLoading(true);
      setMensaje("");

      const res = await authFetch(`${apiUrl}/api/anexos/${rucActivo}/beneficiario-pension`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(beneficiarioForm),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message);

      setMensaje("Beneficiario de pensión alimenticia registrado correctamente.");
    } catch (err) {
      setMensaje(err instanceof Error ? err.message : "Error registrando beneficiario.");
    } finally {
      setLoading(false);
    }
  };

  const registrarDependienteHistorico = async () => {
    try {
      setLoading(true);
      setMensaje("");

      const res = await authFetch(`${apiUrl}/api/anexos/${rucActivo}/cargas-familiares`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...dependienteForm,
          periodoFiscal: dependienteForm.anio,
          tipoIdentificacion: "CEDULA",
          condicionDiscapacidad: "NO",
          enfermedadCatastrofica: false,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message);

      setMensaje("Dependiente histórico registrado correctamente.");
    } catch (err) {
      setMensaje(err instanceof Error ? err.message : "Error registrando dependiente.");
    } finally {
      setLoading(false);
    }
  };

  const registrarCarga = async () => {
    try {
      setLoading(true);
      setMensaje("");

      const res = await authFetch(`${apiUrl}/api/anexos/${rucActivo}/cargas-familiares`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cargaForm),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message);

      setMensaje("Carga familiar registrada correctamente.");
    } catch (err) {
      setMensaje(err instanceof Error ? err.message : "Error registrando carga familiar.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 pr-2">
      <section className="bg-white rounded-[2rem] border shadow-sm p-7">
        <div className="flex items-center gap-4">
          <div className="p-4 bg-slate-100 text-slate-700 rounded-2xl">
            <FileLock2 size={28} />
          </div>
          <div>
            <h1 className="text-2xl font-black text-[#003565]">ANEXOS</h1>
            <p className="text-sm text-slate-500">
              Envío, consulta y registro de anexos tributarios
            </p>
          </div>
        </div>
      </section>

      {mensaje && (
        <div className="bg-blue-50 border border-blue-200 text-blue-700 rounded-2xl p-4 font-bold">
          {mensaje}
        </div>
      )}

                {active === "atsMasivo" && (
                  <AtsMasivoPanel
                    rucAcceso={rucUsuario}
                  />
                )}

          {active === "envio" && (
            <Card
              title="Envío y consulta de anexos"
              subtitle="Carga de archivos informáticos generados externamente, como XML comprimidos en .ZIP desde DIMM Anexos."
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label="Tipo de anexo">
                  <select
                    className="input"
                    value={anexoForm.tipoAnexo}
                    onChange={(e) => setAnexoForm({ ...anexoForm, tipoAnexo: e.target.value })}
                  >
                    <option>Anexo Transaccional Simplificado (ATS)</option>
                    <option>Anexo ICE</option>
                    <option>Anexo ISD</option>
                  </select>
                </Field>

                <Field label="Período fiscal">
                  <select
                    className="input"
                    value={anexoForm.periodoFiscal}
                    onChange={(e) => setAnexoForm({ ...anexoForm, periodoFiscal: e.target.value })}
                  >
                    <option>Mensual</option>
                    <option>Semestral</option>
                    <option>Anual</option>
                  </select>
                </Field>

                <Field label="Año">
                  <input
                    className="input"
                    type="number"
                    value={anexoForm.anio}
                    onChange={(e) => setAnexoForm({ ...anexoForm, anio: Number(e.target.value) })}
                  />
                </Field>

                <Field label="Mes">
                  <input
                    className="input"
                    value={anexoForm.mes}
                    onChange={(e) => setAnexoForm({ ...anexoForm, mes: e.target.value })}
                  />
                </Field>

                <Field label="Archivo ZIP generado desde DIMM Anexos">
                  <label className="mt-2 flex min-h-[56px] cursor-pointer items-center justify-between rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-3 hover:bg-slate-100">
                    <span className="text-sm font-bold text-slate-600">
                      {anexoForm.archivoNombre || "Seleccionar archivo .ZIP"}
                    </span>

                    <span className="rounded-xl bg-[#003565] px-4 py-2 text-xs font-black text-white">
                      Subir archivo
                    </span>

                    <input
                      type="file"
                      accept=".zip,application/zip,application/x-zip-compressed"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;

                        setAnexoForm({
                          ...anexoForm,
                          archivoNombre: file.name,
                        });
                      }}
                    />
                  </label>
                </Field>
              </div>

              <button onClick={enviarAnexo} disabled={loading} className="btn-main mt-6">
                {loading ? <Loader2 className="animate-spin" size={18} /> : <Upload size={18} />}
                Enviar anexo
              </button>

              <div className="mt-8">
                <h3 className="font-black text-[#003565] mb-3">Historial de anexos enviados</h3>
                {anexos.length === 0 ? (
                  <p className="text-sm text-slate-500">No hay anexos registrados.</p>
                ) : (
                  <div className="space-y-3">
                    {anexos.map((a) => (
                      <div key={a.id} className="rounded-2xl border bg-slate-50 p-4">
                        <p className="font-black">{a.tipoAnexo}</p>
                        <p className="text-xs text-slate-500">
                          {a.periodoFiscal} · {a.mes || "-"} · {a.anio} · Estado: {a.estado}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </Card>
          )}

          {active === "beneficiario" && (
            <Card
              title="Registro de beneficiario pensión alimenticia"
              subtitle="Registro individual de menores o derechohabientes por quienes se paga pensión alimenticia legalmente fijada."
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label="Tipo de identificación">
                  <select
                    className="input"
                    value={beneficiarioForm.tipoIdentificacion}
                    onChange={(e) =>
                      setBeneficiarioForm({ ...beneficiarioForm, tipoIdentificacion: e.target.value })
                    }
                  >
                    <option>CEDULA</option>
                    <option>PASAPORTE</option>
                  </select>
                </Field>

                <Field label="Número de identificación">
                  <input
                    className="input"
                    value={beneficiarioForm.identificacion}
                    onChange={(e) =>
                      setBeneficiarioForm({ ...beneficiarioForm, identificacion: e.target.value })
                    }
                  />
                </Field>

                <Field label="Nombres y apellidos">
                  <input
                    className="input"
                    value={beneficiarioForm.nombres}
                    onChange={(e) =>
                      setBeneficiarioForm({ ...beneficiarioForm, nombres: e.target.value })
                    }
                  />
                </Field>

                <Field label="Monto anual">
                  <input
                    className="input"
                    type="number"
                    value={beneficiarioForm.montoAnual}
                    onChange={(e) =>
                      setBeneficiarioForm({ ...beneficiarioForm, montoAnual: e.target.value })
                    }
                  />
                </Field>
              </div>

              <button onClick={registrarBeneficiario} disabled={loading} className="btn-main mt-6">
                Guardar beneficiario
              </button>
            </Card>
          )}

          {active === "dependientes2022" && (
            <Card
              title="Registro de dependientes para períodos hasta 2022"
              subtitle="Opción histórica para sustituir, corregir o presentar anexos de gastos personales del año 2022 o anteriores."
            >
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 mb-5">
                Esta opción no aplica para declaraciones actuales 2023 en adelante.
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label="Año histórico">
                  <input
                    className="input"
                    type="number"
                    max={2022}
                    value={dependienteForm.anio}
                    onChange={(e) =>
                      setDependienteForm({ ...dependienteForm, anio: Number(e.target.value) })
                    }
                  />
                </Field>

                <Field label="Cédula del dependiente">
                  <input
                    className="input"
                    value={dependienteForm.identificacion}
                    onChange={(e) =>
                      setDependienteForm({ ...dependienteForm, identificacion: e.target.value })
                    }
                  />
                </Field>

                <Field label="Nombres">
                  <input
                    className="input"
                    value={dependienteForm.nombres}
                    onChange={(e) =>
                      setDependienteForm({ ...dependienteForm, nombres: e.target.value })
                    }
                  />
                </Field>

                <Field label="Parentesco">
                  <input
                    className="input"
                    value={dependienteForm.parentesco}
                    onChange={(e) =>
                      setDependienteForm({ ...dependienteForm, parentesco: e.target.value })
                    }
                  />
                </Field>
              </div>

              <button onClick={registrarDependienteHistorico} disabled={loading} className="btn-main mt-6">
                Registrar dependiente histórico
              </button>
            </Card>
          )}

          {active === "cargas2023" && (
            <Card
              title="Registro de cargas familiares para períodos a partir de 2023"
              subtitle="Registro vigente para padres, cónyuge/pareja e hijos que dependan económicamente del contribuyente."
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label="Período fiscal">
                  <select
                    className="input"
                    value={cargaForm.periodoFiscal}
                    onChange={(e) =>
                      setCargaForm({ ...cargaForm, periodoFiscal: Number(e.target.value) })
                    }
                  >
                    <option>{new Date().getFullYear()}</option>
                    <option>{new Date().getFullYear() - 1}</option>
                    <option>{new Date().getFullYear() - 2}</option>
                  </select>
                </Field>

                <Field label="Tipo de identificación">
                  <input className="input" value="CEDULA" disabled />
                </Field>

                <Field label="Número de identificación">
                  <input
                    className="input"
                    value={cargaForm.identificacion}
                    onChange={(e) =>
                      setCargaForm({ ...cargaForm, identificacion: e.target.value })
                    }
                  />
                </Field>

                <Field label="Nombres y apellidos">
                  <input
                    className="input"
                    value={cargaForm.nombres}
                    onChange={(e) => setCargaForm({ ...cargaForm, nombres: e.target.value })}
                  />
                </Field>

                <Field label="Parentesco / tipo de relación">
                  <input
                    className="input"
                    value={cargaForm.parentesco}
                    onChange={(e) => setCargaForm({ ...cargaForm, parentesco: e.target.value })}
                  />
                </Field>

                <Field label="Condición de discapacidad">
                  <select
                    className="input"
                    value={cargaForm.condicionDiscapacidad}
                    onChange={(e) =>
                      setCargaForm({ ...cargaForm, condicionDiscapacidad: e.target.value })
                    }
                  >
                    <option>NO</option>
                    <option>SI</option>
                  </select>
                </Field>
              </div>

              <label className="mt-5 flex items-center gap-3 rounded-2xl bg-slate-50 border p-4">
                <input
                  type="checkbox"
                  checked={cargaForm.enfermedadCatastrofica}
                  onChange={(e) =>
                    setCargaForm({ ...cargaForm, enfermedadCatastrofica: e.target.checked })
                  }
                />
                <span className="text-sm font-semibold">Enfermedad catastrófica certificada</span>
              </label>

              <button onClick={registrarCarga} disabled={loading} className="btn-main mt-6">
                Aceptar y registrar carga familiar
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

        .input:disabled {
          color: #64748b;
          background: #f1f5f9;
        }

        .btn-main {
          background: #003565;
          color: white;
          padding: 1rem 1.5rem;
          border-radius: 1rem;
          font-weight: 900;
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
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
