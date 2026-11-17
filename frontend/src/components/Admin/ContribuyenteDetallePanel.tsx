import { CalendarDays, Clock3, Mail, UserRound, X } from "lucide-react";
import { useEffect, useRef } from "react";
import type { ContribuyenteAdmin } from "./AdminContribuyentesPanel";
import { formatDiasAcceso } from "../../utils/acceso";

interface ContribuyenteDetallePanelProps { contribuyente: ContribuyenteAdmin; onClose: () => void; }

export default function ContribuyenteDetallePanel({ contribuyente, onClose }: ContribuyenteDetallePanelProps) {
  const panel = useRef<HTMLElement>(null);
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    panel.current?.focus({ preventScroll: true });
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") close.current(); };
    window.addEventListener("keydown", escape);
    return () => { window.removeEventListener("keydown", escape); previous?.focus({ preventScroll: true }); };
  }, []);
  const states = { activo: "Activo", expira_hoy: "Expira hoy", vencido: "Vencido", desactivado: "Desactivado", sin_vencimiento: "Sin vencimiento" };
  return (
    <aside ref={panel} tabIndex={-1} className="admin-detail" aria-labelledby="admin-detail-title">
      <div className="admin-detail-title"><h2 id="admin-detail-title">Detalle del contribuyente</h2><button className="admin-button icon-only" aria-label="Cerrar detalle del contribuyente" onClick={onClose}><X size={18} /></button></div>
      <div className="admin-detail-person"><span className="admin-avatar soft">{contribuyente.razonSocial.split(" ").filter(Boolean).slice(0, 2).map(part => part[0]).join("").toUpperCase()}</span><div><h3>{contribuyente.razonSocial}</h3><p>{contribuyente.tipoContribuyente === "PERSONA_NATURAL" ? "PERSONA NATURAL" : "SOCIEDAD"}</p><span className={`admin-status ${contribuyente.estadoAcceso}`}>{states[contribuyente.estadoAcceso]}</span></div></div>
      <h3 className="admin-detail-section">Información</h3>
      <dl className="admin-detail-card"><Detail icon={<UserRound size={17} />} label="RUC" value={contribuyente.ruc} /><Detail icon={<Mail size={17} />} label="Correo" value={contribuyente.email || "No registrado"} /></dl>
      <div className="admin-detail-card"><h3><CalendarDays size={18} />Vigencia del acceso</h3><dl><Detail label="Fecha inicio" value={formatDate(contribuyente.fechaInicioAcceso || contribuyente.fechaRegistro || contribuyente.createdAt)} /><Detail label="Fecha fin" value={formatDate(contribuyente.fechaFinAcceso || contribuyente.fechaExpiracion)} /><Detail icon={<Clock3 size={17} />} label="Días restantes" value={formatDiasAcceso(contribuyente)} /></dl>
      {contribuyente.porcentajeRestante != null && <progress className="admin-access-progress" max={100} value={Math.max(0, Math.min(100, contribuyente.porcentajeRestante))} aria-label="Porcentaje de vigencia restante" />}</div>
    </aside>
  );
}
function Detail({ icon, label, value }: { icon?: React.ReactNode; label: string; value: string }) { return <div className="admin-detail-row"><dt>{icon}{label}</dt><dd>{value}</dd></div>; }
function formatDate(value?: string | null) {
  if (!value || Number.isNaN(new Date(value).getTime())) return "—";
  return new Date(value).toLocaleDateString("es-EC", { day: "2-digit", month: "short", year: "numeric", timeZone: "America/Guayaquil" });
}
