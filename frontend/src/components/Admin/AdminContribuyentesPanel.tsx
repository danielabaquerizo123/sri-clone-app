import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import {
  AlertTriangle,
  Ban,
  Clock3,
  Database,
  Loader2,
  MoreVertical,
  Pencil,
  Power,
  RefreshCcw,
  RotateCcw,
  Search,
  ShieldCheck,
  Users,
} from "lucide-react";
import { authFetch } from "../../api/authApi";
import {
  calcularDiasRestantes,
  calcularEstadoAcceso,
  estaPorVencer,
} from "../../utils/acceso";
import ContribuyenteDetallePanel from "./ContribuyenteDetallePanel";
import EditarVigenciaModal from "./EditarVigenciaModal";

export type EstadoAcceso = "activo" | "vencido" | "desactivado";

export type ContribuyenteAdmin = {
  id: string;
  ruc: string;
  razonSocial: string;
  email?: string | null;
  rol: "ADMIN" | "CONTADOR" | "CONTRIBUYENTE";
  tipoContribuyente: "PERSONA_NATURAL" | "SOCIEDAD";
  estadoRuc: string;
  estadoTributario: string;
  activo: boolean;
  fechaExpiracion: string;
  fechaRegistro?: string | null;
  createdAt: string;
  estadoAcceso: EstadoAcceso;
  diasRestantes: number;
};

type EstadoFiltro =
  | "todos"
  | "activo"
  | "por_vencer"
  | "vencido"
  | "desactivado";

const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:3001";

interface AdminContribuyentesPanelProps {
  tableSectionRef?: RefObject<HTMLDivElement>;
  onAttentionCountChange?: (count: number) => void;
}

export default function AdminContribuyentesPanel({
  tableSectionRef,
  onAttentionCountChange,
}: AdminContribuyentesPanelProps) {
  const [contribuyentes, setContribuyentes] = useState<ContribuyenteAdmin[]>([]);
  const [selectedContribuyente, setSelectedContribuyente] =
    useState<ContribuyenteAdmin | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [vigenciaTarget, setVigenciaTarget] =
    useState<ContribuyenteAdmin | null>(null);
  const [openActionMenuId, setOpenActionMenuId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [accionId, setAccionId] = useState("");
  const [bulkLoading, setBulkLoading] = useState(false);
  const [mensaje, setMensaje] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [estadoFiltro, setEstadoFiltro] = useState<EstadoFiltro>("todos");
  const [fechaActual, setFechaActual] = useState(() => new Date());
  const actionMenuRef = useRef<HTMLDivElement | null>(null);

  const resumen = useMemo(
    () => ({
      activos: contribuyentes.filter(
        (item) => getEstadoAcceso(item, fechaActual) === "activo"
      ).length,
      porVencer: contribuyentes.filter((item) => isPorVencer(item, fechaActual))
        .length,
      vencidos: contribuyentes.filter(
        (item) => getEstadoAcceso(item, fechaActual) === "vencido"
      ).length,
      desactivados: contribuyentes.filter(
        (item) => getEstadoAcceso(item, fechaActual) === "desactivado"
      ).length,
      total: contribuyentes.length,
    }),
    [contribuyentes, fechaActual]
  );

  const contribuyentesFiltrados = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();

    return contribuyentes.filter((item) => {
      const estadoAcceso = getEstadoAcceso(item, fechaActual);
      const coincideEstado =
        estadoFiltro === "todos" ||
        estadoAcceso === estadoFiltro ||
        (estadoFiltro === "por_vencer" && isPorVencer(item, fechaActual));
      const coincideTexto =
        !texto ||
        item.ruc.toLowerCase().includes(texto) ||
        item.razonSocial.toLowerCase().includes(texto) ||
        (item.email || "").toLowerCase().includes(texto);

      return coincideEstado && coincideTexto;
    });
  }, [busqueda, contribuyentes, estadoFiltro, fechaActual]);

  useEffect(() => {
    onAttentionCountChange?.(resumen.porVencer + resumen.vencidos);
  }, [onAttentionCountChange, resumen.porVencer, resumen.vencidos]);

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (
        openActionMenuId &&
        actionMenuRef.current &&
        !actionMenuRef.current.contains(event.target as Node)
      ) {
        setOpenActionMenuId(null);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
    };
  }, [openActionMenuId]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setFechaActual(new Date());
    }, 60 * 1000);

    return () => window.clearInterval(intervalId);
  }, []);

  const visibleIds = useMemo(
    () => contribuyentesFiltrados.map((item) => item.id),
    [contribuyentesFiltrados]
  );

  const selectedContribuyentes = useMemo(
    () => contribuyentes.filter((item) => selectedIds.has(item.id)),
    [contribuyentes, selectedIds]
  );

  const selectedVisibleCount = useMemo(
    () => visibleIds.filter((id) => selectedIds.has(id)).length,
    [selectedIds, visibleIds]
  );

  const allVisibleSelected =
    visibleIds.length > 0 && selectedVisibleCount === visibleIds.length;

  const toggleSelected = (id: string) => {
    setSelectedIds((current) => {
      const next = new Set(current);

      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }

      return next;
    });
  };

  const toggleAllVisible = () => {
    setSelectedIds((current) => {
      const next = new Set(current);

      if (allVisibleSelected) {
        visibleIds.forEach((id) => next.delete(id));
      } else {
        visibleIds.forEach((id) => next.add(id));
      }

      return next;
    });
  };

  const cargarContribuyentes = async () => {
    try {
      setLoading(true);
      setMensaje("");
      const response = await authFetch(`${apiUrl}/api/admin/contribuyentes`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "No se pudo cargar contribuyentes.");
      }

      const nextContribuyentes = Array.isArray(data) ? data : [];
      setContribuyentes(nextContribuyentes);
      setSelectedIds((current) => {
        const validIds = new Set(
          nextContribuyentes.map((item: ContribuyenteAdmin) => item.id)
        );
        return new Set([...current].filter((id) => validIds.has(id)));
      });
    } catch (error) {
      setMensaje(
        error instanceof Error
          ? error.message
          : "No se pudo cargar contribuyentes."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarContribuyentes();
  }, []);

  const ejecutarAccion = async (
    id: string,
    accion: "reactivar" | "desactivar"
  ) => {
    try {
      setAccionId(id);
      setMensaje("");

      const response = await authFetch(
        `${apiUrl}/api/admin/contribuyentes/${id}/${accion}`,
        {
          method: "PATCH",
        }
      );
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "No se pudo completar la acción.");
      }

      setMensaje(data.message || "Acción completada.");
      await cargarContribuyentes();
      return true;
    } catch (error) {
      setMensaje(
        error instanceof Error ? error.message : "No se pudo completar la acción."
      );
      return false;
    } finally {
      setAccionId("");
    }
  };

  const reactivarIndividual = async (contribuyente: ContribuyenteAdmin) => {
    const confirmado = window.confirm(
      `¿Reactivar a ${contribuyente.razonSocial} por 4 meses?`
    );

    if (!confirmado) return;

    await ejecutarAccion(contribuyente.id, "reactivar");
  };

  const confirmarEdicionVigencia = async (fechaExpiracion: string) => {
    if (!vigenciaTarget) return;

    const ok = await editarVigencia(vigenciaTarget.id, fechaExpiracion);

    if (ok) {
      setVigenciaTarget(null);
    }
  };

  const editarVigencia = async (id: string, fechaExpiracion: string) => {
    try {
      setAccionId(id);
      setMensaje("");

      const response = await authFetch(
        `${apiUrl}/api/admin/contribuyentes/${id}/vigencia`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fechaExpiracion }),
        }
      );
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "No se pudo actualizar la vigencia.");
      }

      setMensaje(data.message || "Vigencia actualizada correctamente.");
      await cargarContribuyentes();
      return true;
    } catch (error) {
      setMensaje(
        error instanceof Error
          ? error.message
          : "No se pudo actualizar la vigencia."
      );
      return false;
    } finally {
      setAccionId("");
    }
  };

  const ejecutarAccionMasiva = async (accion: "reactivar" | "desactivar") => {
    const seleccionados = selectedContribuyentes;
    const cantidad = seleccionados.length;

    if (cantidad === 0) return;

    const verbo = accion === "reactivar" ? "reactivar" : "desactivar";
    const confirmado = window.confirm(
      `¿Confirmas ${verbo} ${cantidad} contribuyente${cantidad === 1 ? "" : "s"}?`
    );

    if (!confirmado) return;

    setBulkLoading(true);
    setMensaje("");

    const fallidos: string[] = [];
    let procesados = 0;

    for (const contribuyente of seleccionados) {
      try {
        const response = await authFetch(
          `${apiUrl}/api/admin/contribuyentes/${contribuyente.id}/${accion}`,
          { method: "PATCH" }
        );
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.message || "No se pudo completar la acción.");
        }

        procesados += 1;
      } catch {
        fallidos.push(contribuyente.ruc);
      }
    }

    await cargarContribuyentes();
    setSelectedIds(new Set());
    setBulkLoading(false);
    setMensaje(
      fallidos.length
        ? `${procesados} de ${cantidad} procesados correctamente, ${fallidos.length} ${fallidos.length === 1 ? "falló" : "fallaron"} (${fallidos.join(", ")}).`
        : `${procesados} de ${cantidad} procesados correctamente.`
    );
  };

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-4">
            <div className="rounded-2xl bg-blue-50 p-4 text-[#006aa6]">
              <ShieldCheck size={28} />
            </div>
            <div>
              <h1 className="text-2xl font-black text-[#003565]">
                Administración de accesos
              </h1>
              <p className="text-sm font-semibold text-slate-500">
                Vigencia, reactivación y desactivación de contribuyentes.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={cargarContribuyentes}
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-[#003565] transition hover:bg-slate-50 disabled:opacity-60"
          >
            {loading ? (
              <Loader2 className="animate-spin" size={16} />
            ) : (
              <RefreshCcw size={16} />
            )}
            Actualizar datos
          </button>
        </div>
      </section>

      {mensaje && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm font-bold text-blue-700">
          {mensaje}
        </div>
      )}

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <SummaryCard
          icon={<Users size={20} />}
          label="Activos"
          value={resumen.activos}
          detail="Con acceso vigente"
          tone="emerald"
        />
        <SummaryCard
          icon={<Clock3 size={20} />}
          label="Por vencer (7 días)"
          value={resumen.porVencer}
          detail="Requieren atención"
          tone="amber"
        />
        <SummaryCard
          icon={<AlertTriangle size={20} />}
          label="Vencidos"
          value={resumen.vencidos}
          detail="Periodo finalizado"
          tone="red"
        />
        <SummaryCard
          icon={<Ban size={20} />}
          label="Desactivados"
          value={resumen.desactivados}
          detail="Suspendidos"
          tone="blue"
        />
        <SummaryCard
          icon={<Database size={20} />}
          label="Total registros"
          value={resumen.total}
          detail="Contribuyentes"
          tone="slate"
        />
      </section>

      <section
        ref={tableSectionRef}
        className={`grid scroll-mt-6 grid-cols-1 gap-6 ${
          selectedContribuyente
            ? "2xl:grid-cols-[minmax(0,1fr)_320px]"
            : ""
        }`}
      >
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          {selectedIds.size > 0 && (
            <div className="mb-4 flex flex-col gap-3 rounded-2xl border border-blue-200 bg-blue-50 p-4 lg:flex-row lg:items-center lg:justify-between">
              <p className="text-sm font-black text-[#003565]">
                {selectedIds.size} contribuyente
                {selectedIds.size === 1 ? "" : "s"} seleccionado
                {selectedIds.size === 1 ? "" : "s"}
              </p>
              <div className="flex flex-col gap-2 sm:flex-row">
                <button
                  type="button"
                  onClick={() => ejecutarAccionMasiva("desactivar")}
                  disabled={bulkLoading}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-red-50 px-4 py-3 text-sm font-black text-red-700 transition hover:bg-red-100 disabled:opacity-60"
                >
                  {bulkLoading ? (
                    <Loader2 className="animate-spin" size={16} />
                  ) : (
                    <Power size={16} />
                  )}
                  Desactivar seleccionados
                </button>
                <button
                  type="button"
                  onClick={() => ejecutarAccionMasiva("reactivar")}
                  disabled={bulkLoading}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-black text-emerald-700 transition hover:bg-emerald-100 disabled:opacity-60"
                >
                  {bulkLoading ? (
                    <Loader2 className="animate-spin" size={16} />
                  ) : (
                    <RotateCcw size={16} />
                  )}
                  Reactivar seleccionados
                </button>
              </div>
            </div>
          )}

          <div className="mb-5 grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_220px]">
            <div className="flex min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white">
              <div className="flex items-center px-3 text-slate-400">
                <Search size={18} />
              </div>
              <input
                value={busqueda}
                onChange={(event) => setBusqueda(event.target.value)}
                placeholder="Buscar por RUC, nombre o email..."
                className="w-full min-w-0 px-2 py-3 text-sm font-semibold outline-none"
              />
            </div>

            <select
              value={estadoFiltro}
              onChange={(event) =>
                setEstadoFiltro(event.target.value as EstadoFiltro)
              }
              className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-700 outline-none"
            >
              <option value="todos">Todos</option>
              <option value="activo">Activos</option>
              <option value="por_vencer">Por vencer</option>
              <option value="vencido">Vencidos</option>
              <option value="desactivado">Desactivados</option>
            </select>
          </div>

          {loading ? (
            <div className="flex items-center gap-3 rounded-xl bg-slate-50 p-5 text-sm font-black text-slate-600">
              <Loader2 className="animate-spin" size={18} />
              Cargando contribuyentes...
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-slate-200">
              <table className="min-w-[980px] w-full text-sm">
                <thead className="bg-slate-50 text-left text-[11px] uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="w-12 px-4 py-4">
                      <input
                        type="checkbox"
                        checked={allVisibleSelected}
                        ref={(input) => {
                          if (input) {
                            input.indeterminate =
                              selectedVisibleCount > 0 && !allVisibleSelected;
                          }
                        }}
                        onChange={toggleAllVisible}
                        className="h-4 w-4 rounded border-slate-300 text-[#003565]"
                        aria-label="Seleccionar contribuyentes visibles"
                      />
                    </th>
                    <th className="px-4 py-4">Contribuyente</th>
                    <th className="px-4 py-4">RUC</th>
                    <th className="px-4 py-4">Email</th>
                    <th className="px-4 py-4">Estado</th>
                    <th className="px-4 py-4">Expira</th>
                    <th className="px-4 py-4">Días restantes</th>
                    <th className="px-4 py-4 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {contribuyentesFiltrados.map((contribuyente) => {
                    const selected = selectedContribuyente?.id === contribuyente.id;
                    const estadoAcceso = getEstadoAcceso(
                      contribuyente,
                      fechaActual
                    );
                    const diasRestantes = calcularDiasRestantes(
                      contribuyente.fechaExpiracion,
                      fechaActual
                    );

                    return (
                      <tr
                        key={contribuyente.id}
                        onClick={() => setSelectedContribuyente(contribuyente)}
                        className={`cursor-pointer border-t transition ${
                          selected
                            ? "bg-blue-50/70"
                            : "bg-white hover:bg-slate-50"
                        }`}
                      >
                        <td className="px-4 py-4">
                          <input
                            type="checkbox"
                            checked={selectedIds.has(contribuyente.id)}
                            onClick={(event) => event.stopPropagation()}
                            onChange={() => toggleSelected(contribuyente.id)}
                            className="h-4 w-4 rounded border-slate-300 text-[#003565]"
                            aria-label={`Seleccionar ${contribuyente.razonSocial}`}
                          />
                        </td>
                        <td className="px-4 py-4">
                          <p className="font-black text-slate-700">
                            {contribuyente.razonSocial}
                          </p>
                          <p className="text-xs font-semibold text-slate-400">
                            {formatTipoContribuyente(
                              contribuyente.tipoContribuyente
                            )}
                          </p>
                        </td>
                        <td className="px-4 py-4 font-mono font-bold text-slate-700">
                          {contribuyente.ruc}
                        </td>
                        <td className="px-4 py-4 font-semibold text-slate-600">
                          {contribuyente.email || "-"}
                        </td>
                        <td className="px-4 py-4">
                          <EstadoBadge
                            estado={
                              isPorVencer(contribuyente, fechaActual)
                                ? "por_vencer"
                                : estadoAcceso
                            }
                          />
                        </td>
                        <td className="px-4 py-4 font-semibold text-slate-600">
                          {formatDate(contribuyente.fechaExpiracion)}
                        </td>
                        <td className="px-4 py-4 font-black text-slate-700">
                          {estadoAcceso === "activo" ? diasRestantes ?? 0 : 0}
                        </td>
                        <td className="px-4 py-4">
                          <div
                            ref={
                              openActionMenuId === contribuyente.id
                                ? actionMenuRef
                                : undefined
                            }
                            className="relative flex justify-end"
                          >
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                setOpenActionMenuId((current) =>
                                  current === contribuyente.id
                                    ? null
                                    : contribuyente.id
                                );
                              }}
                              className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50 hover:text-[#003565]"
                              aria-label={`Abrir acciones de ${contribuyente.razonSocial}`}
                            >
                              <MoreVertical size={18} />
                            </button>

                            {openActionMenuId === contribuyente.id && (
                              <div
                                onClick={(event) => event.stopPropagation()}
                                className="absolute right-0 top-11 z-20 w-52 rounded-2xl border border-slate-200 bg-white p-2 text-left shadow-xl"
                              >
                                {estadoAcceso !== "activo" && (
                                  <ActionMenuItem
                                    icon={
                                      accionId === contribuyente.id ? (
                                        <Loader2
                                          className="animate-spin"
                                          size={15}
                                        />
                                      ) : (
                                        <RotateCcw size={15} />
                                      )
                                    }
                                    label="Reactivar"
                                    tone="emerald"
                                    disabled={accionId === contribuyente.id}
                                    onClick={() => {
                                      setOpenActionMenuId(null);
                                      reactivarIndividual(contribuyente);
                                    }}
                                  />
                                )}

                                <ActionMenuItem
                                  icon={<Pencil size={15} />}
                                  label="Editar vigencia"
                                  tone="blue"
                                  disabled={accionId === contribuyente.id}
                                  onClick={() => {
                                    setOpenActionMenuId(null);
                                    setVigenciaTarget(contribuyente);
                                  }}
                                />

                                {estadoAcceso !== "desactivado" && (
                                  <ActionMenuItem
                                    icon={<Power size={15} />}
                                    label="Desactivar"
                                    tone="red"
                                    disabled={accionId === contribuyente.id}
                                    onClick={() => {
                                      setOpenActionMenuId(null);
                                      ejecutarAccion(
                                        contribuyente.id,
                                        "desactivar"
                                      );
                                    }}
                                  />
                                )}
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {contribuyentesFiltrados.length === 0 && (
                <p className="p-5 text-sm font-semibold text-slate-500">
                  No hay contribuyentes que coincidan con los filtros.
                </p>
              )}
            </div>
          )}

          <div className="mt-4 flex flex-col gap-2 text-sm font-semibold text-slate-500 sm:flex-row sm:items-center sm:justify-between">
            <p>
              Mostrando {contribuyentesFiltrados.length} de{" "}
              {contribuyentes.length} registros
            </p>
          </div>
        </div>

        {selectedContribuyente && (
          <ContribuyenteDetallePanel
            contribuyente={selectedContribuyente}
            fechaActual={fechaActual}
            onClose={() => setSelectedContribuyente(null)}
          />
        )}
      </section>

      <EditarVigenciaModal
        contribuyente={vigenciaTarget}
        loading={!!vigenciaTarget && accionId === vigenciaTarget.id}
        onCancel={() => setVigenciaTarget(null)}
        onConfirm={confirmarEdicionVigencia}
      />
    </div>
  );
}

function ActionMenuItem({
  disabled,
  icon,
  label,
  onClick,
  tone,
}: {
  disabled?: boolean;
  icon: ReactNode;
  label: string;
  onClick: () => void;
  tone: "blue" | "emerald" | "red";
}) {
  const tones = {
    blue: "text-[#006aa6] hover:bg-blue-50",
    emerald: "text-emerald-700 hover:bg-emerald-50",
    red: "text-red-700 hover:bg-red-50",
  };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-black transition disabled:cursor-not-allowed disabled:opacity-50 ${tones[tone]}`}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

function SummaryCard({
  icon,
  label,
  value,
  detail,
  tone,
}: {
  icon: ReactNode;
  label: string;
  value: number;
  detail: string;
  tone: "emerald" | "amber" | "red" | "blue" | "slate";
}) {
  const tones = {
    emerald: "bg-emerald-50 text-emerald-700",
    amber: "bg-amber-50 text-amber-700",
    red: "bg-red-50 text-red-700",
    blue: "bg-blue-50 text-[#006aa6]",
    slate: "bg-slate-100 text-slate-700",
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center gap-3">
        <div className={`rounded-xl p-3 ${tones[tone]}`}>{icon}</div>
        <div>
          <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">
            {label}
          </p>
          <p className="text-3xl font-black text-[#003565]">{value}</p>
        </div>
      </div>
      <p className="text-xs font-semibold text-slate-500">{detail}</p>
    </div>
  );
}

function EstadoBadge({
  estado,
}: {
  estado: EstadoAcceso | "por_vencer";
}) {
  const className =
    estado === "activo"
      ? "bg-emerald-50 text-emerald-700"
      : estado === "por_vencer"
      ? "bg-amber-50 text-amber-700"
      : estado === "vencido"
      ? "bg-red-50 text-red-700"
      : "bg-slate-100 text-slate-600";

  const label = estado === "por_vencer" ? "por vencer" : estado;

  return (
    <span className={`rounded-full px-3 py-1 text-xs font-black uppercase ${className}`}>
      {label}
    </span>
  );
}

function isPorVencer(contribuyente: ContribuyenteAdmin, fechaActual: Date) {
  return (
    getEstadoAcceso(contribuyente, fechaActual) === "activo" &&
    estaPorVencer(contribuyente.fechaExpiracion, fechaActual)
  );
}

function getEstadoAcceso(contribuyente: ContribuyenteAdmin, fechaActual: Date) {
  return calcularEstadoAcceso(
    contribuyente.activo,
    contribuyente.fechaExpiracion,
    fechaActual
  ) as EstadoAcceso;
}

function formatDate(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("es-EC");
}

function formatTipoContribuyente(value: ContribuyenteAdmin["tipoContribuyente"]) {
  return value === "PERSONA_NATURAL" ? "PERSONA NATURAL" : "SOCIEDAD";
}
