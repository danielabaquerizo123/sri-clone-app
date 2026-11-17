import { useEffect, useRef } from "react";
import { RefreshCcw, X } from "lucide-react";
import type { ContribuyenteData } from "../../views/DashboardView";
import { formatDiasAcceso, type AccessInfo } from "../../utils/acceso";

export default function DashboardProfileSummary({ open, data, accessInfo, obligaciones, onClose, onRefresh }: {
  open: boolean;
  data: ContribuyenteData;
  accessInfo: AccessInfo;
  obligaciones: string[];
  onClose: () => void;
  onRefresh: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = dialogRef.current;
    if (open && !dialog?.open) dialog?.showModal();
    if (!open && dialog?.open) dialog.close();
  }, [open]);
  return (
    <dialog ref={dialogRef} className="tributacion-profile" onCancel={onClose} onClose={onClose} aria-labelledby="tributacion-profile-title">
      <div className="tributacion-profile-heading"><h2 id="tributacion-profile-title">Resumen del contribuyente</h2><button type="button" aria-label="Cerrar perfil" onClick={onClose}><X /></button></div>
      <dl>{[
        ["RUC", data.ruc], ["Razón social", data.razonSocial],
        ["Tipo de contribuyente", data.tipoContribuyente === "SOCIEDAD" ? "Sociedad" : "Persona natural"],
        ["Estado RUC", data.estadoRuc], ["Estado tributario", data.estadoTributario], ["Régimen tributario", data.regimen],
        ["Correo electrónico", data.email], ["Días de acceso", formatDiasAcceso(accessInfo)],
        ["Expira el", accessInfo.fechaExpiracion?.toLocaleDateString("es-EC")],
        ["Acceso restante", accessInfo.porcentajeRestante == null ? "—" : `${accessInfo.porcentajeRestante}%`],
      ].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value || "—"}</dd></div>)}</dl>
      <h3>Obligaciones registradas ({obligaciones.length})</h3>
      <ul>{obligaciones.map((item, index) => <li key={`${index}-${item}`}>{item}</li>)}</ul>
      <button className="tributacion-refresh" type="button" onClick={onRefresh}><RefreshCcw size={18} />Actualizar datos</button>
    </dialog>
  );
}
