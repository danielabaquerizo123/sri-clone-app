import {
  useEffect,
  useMemo,
  useState,
  type RefObject,
} from "react";
import {
  AlertTriangle,
  Ban,
  Clock3,
  Database,
  Loader2,
  Power,
  RefreshCcw,
  RotateCcw,
  Search,
  Users, CalendarDays, ArrowRight, ChevronLeft, ChevronRight, X,
} from "lucide-react";
import { authFetch } from "../../api/authApi";
import { formatDiasAcceso } from "../../utils/acceso";
import ContribuyenteDetallePanel from "./ContribuyenteDetallePanel";
import EditarVigenciaModal from "./EditarVigenciaModal";

export type EstadoAcceso =
  | "activo"
  | "expira_hoy"
  | "vencido"
  | "desactivado"
  | "sin_vencimiento";

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
  fechaExpiracion?: string | null;
  fechaRegistro?: string | null;
  createdAt: string;
  estadoAcceso: EstadoAcceso;
  diasRestantes: number | null;
  fechaInicioAcceso?: string | null;
  fechaFinAcceso?: string | null;
  porcentajeRestante?: number | null;
  zonaHorariaAcceso?: string | null;
};

type EstadoFiltro =
  | "todos"
  | "activo"
  | "por_vencer"
  | "vencido"
  | "desactivado";

const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:3001";

interface AdminContribuyentesPanelProps {
  currentUserRuc: string;
  tableSectionRef?: RefObject<HTMLDivElement>;
  onAttentionCountChange?: (count: number) => void;
}

export default function AdminContribuyentesPanel({
  tableSectionRef,
  currentUserRuc,
  onAttentionCountChange,
}: AdminContribuyentesPanelProps) {
  const [contribuyentes, setContribuyentes] = useState<ContribuyenteAdmin[]>([]);
  const [selectedContribuyente, setSelectedContribuyente] =
    useState<ContribuyenteAdmin | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [vigenciaTarget, setVigenciaTarget] =
    useState<ContribuyenteAdmin | null>(null);
  const [loading, setLoading] = useState(true);
  const [accionId, setAccionId] = useState("");
  const [bulkLoading, setBulkLoading] = useState(false);
  const [mensaje, setMensaje] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [estadoFiltro, setEstadoFiltro] = useState<EstadoFiltro>("todos");
  const [tipoFiltro, setTipoFiltro] = useState("todos");
  const [orden, setOrden] = useState("registro");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(6);

  const resumen = useMemo(
    () => ({
      activos: contribuyentes.filter(
        (item) => item.estadoAcceso === "activo"
      ).length,
      porVencer: contribuyentes.filter((item) => isPorVencer(item))
        .length,
      vencidos: contribuyentes.filter(
        (item) => item.estadoAcceso === "vencido"
      ).length,
      desactivados: contribuyentes.filter(
        (item) => item.estadoAcceso === "desactivado"
      ).length,
      total: contribuyentes.length,
    }),
    [contribuyentes]
  );

  const contribuyentesFiltrados = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();

    return contribuyentes.filter((item) => {
      const estadoAcceso = item.estadoAcceso;
      const coincideEstado =
        estadoFiltro === "todos" ||
        estadoAcceso === estadoFiltro ||
        (estadoFiltro === "por_vencer" && isPorVencer(item));
      const coincideTexto =
        !texto ||
        item.ruc.toLowerCase().includes(texto) ||
        item.razonSocial.toLowerCase().includes(texto) ||
        (item.email || "").toLowerCase().includes(texto);

      return coincideEstado && coincideTexto && (tipoFiltro === "todos" || item.tipoContribuyente === tipoFiltro);
    }).sort((a, b) => {
      if (orden === "nombre") return a.razonSocial.localeCompare(b.razonSocial, "es");
      if (orden === "vencimiento") return (a.fechaExpiracion ? new Date(a.fechaExpiracion).getTime() : Infinity) - (b.fechaExpiracion ? new Date(b.fechaExpiracion).getTime() : Infinity);
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [busqueda, contribuyentes, estadoFiltro, tipoFiltro, orden]);

  useEffect(() => setPage(1), [busqueda, estadoFiltro, tipoFiltro, orden, pageSize]);
  const totalPaginas = Math.max(1, Math.ceil(contribuyentesFiltrados.length / pageSize));
  const paginaActual = Math.min(page, totalPaginas);
  const paginaContribuyentes = contribuyentesFiltrados.slice((paginaActual - 1) * pageSize, paginaActual * pageSize);

  useEffect(() => {
    onAttentionCountChange?.(resumen.porVencer + resumen.vencidos);
  }, [onAttentionCountChange, resumen.porVencer, resumen.vencidos]);

  const visibleIds = paginaContribuyentes.filter(item => item.ruc !== currentUserRuc).map(item => item.id);

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
    if (accion === "desactivar" && contribuyentes.some(item => item.id === id && item.ruc === currentUserRuc)) return false;
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
    const seleccionados = selectedContribuyentes.filter(item => item.ruc !== currentUserRuc && (accion === "desactivar" ? item.activo : item.estadoAcceso !== "activo"));
    const cantidad = seleccionados.length;

    if (cantidad === 0) return;

    const verbo = accion === "reactivar" ? "reactivar" : "desactivar";
    const confirmado = window.confirm(
      `¿Confirmas ${verbo} ${cantidad} contribuyente${cantidad === 1 ? "" : "s"}${accion === "reactivar" ? " por 4 meses" : ""}?`
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
    <div className={`admin-panel ${selectedContribuyente ? "has-detail" : ""}`}>
      <div className="admin-list">
        <div className="admin-list-heading"><div className="admin-heading"><span className="admin-icon"><Users size={24} /></span><div><h2>Contribuyentes registrados</h2><p>Vigencia, reactivación y desactivación de accesos</p></div></div><button className="admin-button" onClick={cargarContribuyentes} disabled={loading || bulkLoading || !!accionId}>{loading ? <Loader2 size={16} className="animate-spin" /> : <RefreshCcw size={16} />}Actualizar datos</button></div>
        {mensaje && <div className="admin-message" role="status">{mensaje}</div>}
        <div className="admin-summaries">
          {([
            ["activo", "Activos", resumen.activos, <Users size={24} />, "purple"],
            ["por_vencer", "Por vencer (≤ 15 días)", resumen.porVencer, <Clock3 size={24} />, "amber"],
            ["vencido", "Vencidos", resumen.vencidos, <AlertTriangle size={24} />, "red"],
            ["desactivado", "Desactivados", resumen.desactivados, <Ban size={24} />, "slate"],
            ["todos", "Total registrados", resumen.total, <Database size={24} />, "purple"],
          ] as const).map(([filter, label, value, icon, tone]) => <button key={filter} className={`admin-summary ${tone} ${estadoFiltro === filter ? "is-selected" : ""}`} aria-pressed={estadoFiltro === filter} onClick={() => setEstadoFiltro(filter)}><span className="admin-summary-icon">{icon}</span><span><strong>{value}</strong><span>{label} <ArrowRight size={13} /></span></span><ChevronRight size={16} /></button>)}
        </div>
        <div className="admin-filters">
          <label className="admin-search"><Search size={18} /><input aria-label="Buscar contribuyentes" placeholder="Buscar por nombre, RUC o correo..." value={busqueda} onChange={event => setBusqueda(event.target.value)} /></label>
          <select aria-label="Filtrar por estado" value={estadoFiltro} onChange={event => setEstadoFiltro(event.target.value as EstadoFiltro)}><option value="todos">Todos los estados</option><option value="activo">Activos</option><option value="por_vencer">Por vencer</option><option value="vencido">Vencidos</option><option value="desactivado">Desactivados</option></select>
          <select aria-label="Filtrar por tipo de contribuyente" value={tipoFiltro} onChange={event => setTipoFiltro(event.target.value)}><option value="todos">Todas las personas</option><option value="PERSONA_NATURAL">Persona natural</option><option value="SOCIEDAD">Sociedad</option></select>
          <label className="admin-sort">Ordenar por<select aria-label="Ordenar contribuyentes" value={orden} onChange={event => setOrden(event.target.value)}><option value="registro">Registro (reciente)</option><option value="vencimiento">Vencimiento (pronto)</option><option value="nombre">Nombre</option></select></label>
        </div>
        {selectedIds.size > 0 && <div className="admin-bulk"><strong>{selectedIds.size} seleccionados</strong>
          {selectedContribuyentes.some(item => item.activo && item.ruc !== currentUserRuc) && <button className="admin-button danger" disabled={bulkLoading || !!accionId} onClick={() => ejecutarAccionMasiva("desactivar")}><Power size={16} />Desactivar</button>}
          {selectedContribuyentes.some(item => item.estadoAcceso !== "activo" && item.ruc !== currentUserRuc) && <button className="admin-button" disabled={bulkLoading || !!accionId} onClick={() => ejecutarAccionMasiva("reactivar")}><RotateCcw size={16} />Reactivar (4 meses)</button>}
          {bulkLoading && <Loader2 className="animate-spin" size={18} />}
          <button className="admin-clear" disabled={bulkLoading} onClick={() => setSelectedIds(new Set())}><X size={16} />Limpiar selección</button>
        </div>}
        <div ref={tableSectionRef} className="admin-table-scroll" role="region" aria-label="Tabla de contribuyentes" tabIndex={0}>
          {loading ? <div className="admin-loading" role="status"><Loader2 className="animate-spin" size={20} />Cargando contribuyentes...</div> : <table className="admin-table"><thead><tr>
            <th><input type="checkbox" aria-label="Seleccionar contribuyentes visibles" checked={allVisibleSelected} disabled={bulkLoading} ref={input => { if (input) input.indeterminate = selectedVisibleCount > 0 && !allVisibleSelected; }} onChange={toggleAllVisible} /></th>
            <th>Contribuyente</th><th>RUC</th><th>Correo electrónico</th><th>Inicio</th><th>Vencimiento</th><th>Días restantes</th><th>Estado</th><th>Acciones</th>
          </tr></thead><tbody>{paginaContribuyentes.map(contribuyente => <tr key={contribuyente.id} className={selectedContribuyente?.id === contribuyente.id ? "is-selected" : ""} onClick={() => setSelectedContribuyente(contribuyente)}>
            <td><input type="checkbox" aria-label={`Seleccionar ${contribuyente.razonSocial}`} checked={selectedIds.has(contribuyente.id)} disabled={bulkLoading || contribuyente.ruc === currentUserRuc} onClick={event => event.stopPropagation()} onChange={() => toggleSelected(contribuyente.id)} /></td>
            <td><button className="admin-person" aria-label={`Ver detalle de ${contribuyente.razonSocial}`} onClick={() => setSelectedContribuyente(contribuyente)}><span className="admin-avatar soft">{contribuyente.razonSocial.split(" ").filter(Boolean).slice(0, 2).map(word => word[0]).join("")}</span><span><strong>{contribuyente.razonSocial}</strong><small>{formatTipoContribuyente(contribuyente.tipoContribuyente)}</small></span></button></td>
            <td>{contribuyente.ruc}</td><td className="admin-email">{contribuyente.email || "—"}</td>
            <td>{formatDate(contribuyente.fechaInicioAcceso || contribuyente.fechaRegistro || contribuyente.createdAt)}</td><td>{formatDate(contribuyente.fechaFinAcceso || contribuyente.fechaExpiracion)}</td>
            <td><DiasAccesoBadge contribuyente={contribuyente} />{contribuyente.porcentajeRestante != null && <progress className={`admin-access-progress ${getDiasAccesoTone(contribuyente)}`} max={100} value={Math.max(0, Math.min(100, contribuyente.porcentajeRestante))} aria-label="Porcentaje de vigencia restante" />}</td>
            <td><EstadoBadge estado={contribuyente.estadoAcceso} /></td>
            <td><div className="admin-row-actions" onClick={event => event.stopPropagation()}>
              <button className="admin-button icon-only" title="Editar vigencia" aria-label={`Editar vigencia de ${contribuyente.razonSocial}`} disabled={bulkLoading || !!accionId} onClick={() => setVigenciaTarget(contribuyente)}><CalendarDays size={17} /></button>
              <button className={`admin-button icon-only ${contribuyente.activo ? "danger" : "success"}`} title={contribuyente.ruc === currentUserRuc ? "No puedes desactivar tu propia cuenta" : contribuyente.activo ? "Desactivar" : "Activar (renueva por 4 meses)"} aria-label={`${contribuyente.activo ? "Desactivar" : "Activar"} a ${contribuyente.razonSocial}`} disabled={bulkLoading || !!accionId || contribuyente.ruc === currentUserRuc} onClick={() => { if (contribuyente.activo) { if (window.confirm(`¿Desactivar el acceso de ${contribuyente.razonSocial}?`)) ejecutarAccion(contribuyente.id, "desactivar"); } else reactivarIndividual(contribuyente); }}>{accionId === contribuyente.id ? <Loader2 className="animate-spin" size={17} /> : contribuyente.activo ? <Ban size={17} /> : <Power size={17} />}</button>
            </div></td>
          </tr>)}</tbody></table>}
          {!loading && contribuyentesFiltrados.length === 0 && <p className="admin-empty">No hay contribuyentes que coincidan con los filtros.</p>}
        </div>
        <div className="admin-pagination"><p>Mostrando {contribuyentesFiltrados.length ? (paginaActual - 1) * pageSize + 1 : 0} - {Math.min(paginaActual * pageSize, contribuyentesFiltrados.length)} de {contribuyentesFiltrados.length} contribuyentes</p><div><button className="admin-button icon-only" aria-label="Página anterior" disabled={paginaActual <= 1} onClick={() => setPage(paginaActual - 1)}><ChevronLeft size={17} /></button><span aria-live="polite">{paginaActual} / {totalPaginas}</span><button className="admin-button icon-only" aria-label="Página siguiente" disabled={paginaActual >= totalPaginas} onClick={() => setPage(paginaActual + 1)}><ChevronRight size={17} /></button><select aria-label="Registros por página" value={pageSize} onChange={event => setPageSize(Number(event.target.value))}><option value={6}>6 por página</option><option value={12}>12 por página</option><option value={24}>24 por página</option></select></div></div>
      </div>
      {selectedContribuyente && <ContribuyenteDetallePanel contribuyente={contribuyentes.find(item => item.id === selectedContribuyente.id) || selectedContribuyente} onClose={() => setSelectedContribuyente(null)} />}
      <EditarVigenciaModal contribuyente={vigenciaTarget} loading={!!vigenciaTarget && accionId === vigenciaTarget.id} onCancel={() => setVigenciaTarget(null)} onConfirm={confirmarEdicionVigencia} />
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
      : estado === "expira_hoy"
      ? "bg-red-50 text-red-700"
      : estado === "vencido"
      ? "bg-red-50 text-red-700"
      : estado === "sin_vencimiento"
      ? "bg-blue-50 text-blue-700"
      : "bg-slate-100 text-slate-600";

  const labels = {
    activo: "activo",
    por_vencer: "por vencer",
    expira_hoy: "expira hoy",
    vencido: "vencido",
    desactivado: "desactivado",
    sin_vencimiento: "sin vencimiento",
  };

  return (
    <span className={`rounded-full px-3 py-1 text-xs font-black uppercase ${className}`}>
      {labels[estado]}
    </span>
  );
}

function DiasAccesoBadge({ contribuyente }: { contribuyente: ContribuyenteAdmin }) {
  const tone = getDiasAccesoTone(contribuyente);
  const tones = {
    normal: "border-emerald-200 bg-emerald-50 text-emerald-700",
    warning: "border-amber-200 bg-amber-50 text-amber-700",
    critical: "border-red-200 bg-red-50 text-red-700",
    disabled: "border-slate-200 bg-slate-100 text-slate-600",
    indefinite: "border-blue-200 bg-blue-50 text-blue-700",
  };

  return (
    <span className={`inline-flex min-w-[112px] justify-center rounded-full border px-3 py-1 text-xs font-black ${tones[tone]}`}>
      {formatDiasAcceso(contribuyente)}
    </span>
  );
}

function getDiasAccesoTone(contribuyente: ContribuyenteAdmin) {
  if (contribuyente.estadoAcceso === "desactivado") return "disabled";
  if (contribuyente.estadoAcceso === "sin_vencimiento") return "indefinite";
  if (contribuyente.estadoAcceso === "vencido" || contribuyente.estadoAcceso === "expira_hoy") return "critical";
  if (contribuyente.diasRestantes !== null && contribuyente.diasRestantes <= 15) return "warning";
  return "normal";
}

function isPorVencer(contribuyente: ContribuyenteAdmin) {
  return (
    contribuyente.estadoAcceso === "activo" &&
    contribuyente.diasRestantes !== null &&
    contribuyente.diasRestantes >= 1 &&
    contribuyente.diasRestantes <= 15
  );
}

function formatDate(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("es-EC", { day: "2-digit", month: "short", year: "numeric", timeZone: "America/Guayaquil" });
}

function formatTipoContribuyente(value: ContribuyenteAdmin["tipoContribuyente"]) {
  return value === "PERSONA_NATURAL" ? "PERSONA NATURAL" : "SOCIEDAD";
}
