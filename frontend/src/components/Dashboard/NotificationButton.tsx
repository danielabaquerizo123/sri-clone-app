import { Bell, CheckCheck, Clock3, ShieldAlert } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import type { AccessInfo } from "../../utils/acceso";
import HeaderDropdownPortal from "./HeaderDropdownPortal";

interface NotificationButtonProps {
  accessInfo: AccessInfo;
  activo: boolean;
  emailVerified?: boolean | null;
}

interface NotificationItem {
  id: string;
  title: string;
  detail: string;
  date: Date;
  tone: "amber" | "red";
}

export default function NotificationButton({
  accessInfo,
  activo,
  emailVerified,
}: NotificationButtonProps) {
  const [open, setOpen] = useState(false);
  const [readIds, setReadIds] = useState<string[]>([]);
  const buttonRef = useRef<HTMLButtonElement | null>(null);

  const notifications = useMemo(
    () => buildNotifications({ accessInfo, activo, emailVerified }),
    [accessInfo, activo, emailVerified]
  );

  const unreadCount = notifications.filter((item) => !readIds.includes(item.id)).length;

  const markAllAsRead = () => {
    setReadIds(notifications.map((item) => item.id));
  };

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        aria-label="Abrir notificaciones"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className="relative hidden h-12 w-12 items-center justify-center rounded-full border border-slate-200 bg-white text-blue-700 shadow-sm transition hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 md:flex lg:justify-self-end xl:justify-self-auto"
      >
        <Bell size={20} />
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-blue-700 px-1 text-[11px] font-black text-white">
            {unreadCount}
          </span>
        )}
      </button>

      <HeaderDropdownPortal
        anchorRef={buttonRef}
        open={open}
        width={380}
        onClose={() => setOpen(false)}
      >
        <section className="max-h-[460px] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
          <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
            <div>
              <h2 className="text-sm font-black text-[#082b68]">Notificaciones</h2>
              <p className="text-xs font-semibold text-slate-500">
                {unreadCount > 0 ? `${unreadCount} sin leer` : "Sin pendientes"}
              </p>
            </div>
            {notifications.length > 0 && (
              <button
                type="button"
                onClick={markAllAsRead}
                className="inline-flex items-center gap-1 rounded-xl bg-blue-50 px-3 py-2 text-xs font-black text-blue-700 transition hover:bg-blue-100"
              >
                <CheckCheck size={14} />
                Marcar leidas
              </button>
            )}
          </div>

          <div className="max-h-[360px] overflow-y-auto p-2">
            {notifications.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm font-semibold text-slate-500">
                No tienes notificaciones nuevas.
              </p>
            ) : (
              notifications.map((item) => {
                const isRead = readIds.includes(item.id);

                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setReadIds((current) => [...new Set([...current, item.id])])}
                    className="flex w-full items-start gap-3 rounded-xl px-3 py-3 text-left transition hover:bg-slate-50"
                  >
                    <span className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${item.tone === "red" ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-700"}`}>
                      {item.tone === "red" ? <ShieldAlert size={18} /> : <Clock3 size={18} />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        {!isRead && <span className="h-2 w-2 rounded-full bg-blue-600" />}
                        <span className="truncate text-sm font-black text-[#082b68]">
                          {item.title}
                        </span>
                      </span>
                      <span className="mt-1 block text-xs font-semibold leading-5 text-slate-500">
                        {item.detail}
                      </span>
                      <span className="mt-1 block text-[11px] font-bold text-slate-400">
                        {formatDate(item.date)}
                      </span>
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </section>
      </HeaderDropdownPortal>
    </>
  );
}

function buildNotifications({
  accessInfo,
  activo,
  emailVerified,
}: NotificationButtonProps): NotificationItem[] {
  const items: NotificationItem[] = [];

  if (!activo) {
    items.push({
      id: "access-disabled",
      title: "Acceso desactivado",
      detail: "Tu acceso al portal no se encuentra activo.",
      date: new Date(),
      tone: "red",
    });
  } else if (accessInfo.estadoAcceso === "vencido") {
    items.push({
      id: "access-expired",
      title: "Acceso vencido",
      detail: "La fecha de expiracion registrada ya fue alcanzada.",
      date: accessInfo.fechaExpiracion || new Date(),
      tone: "red",
    });
  } else if (
    accessInfo.diasRestantes !== null &&
    accessInfo.diasRestantes <= 30
  ) {
    items.push({
      id: "access-expiring",
      title: "Acceso proximo a expirar",
      detail: `Quedan ${accessInfo.diasRestantes} dias de acceso.`,
      date: accessInfo.fechaExpiracion || new Date(),
      tone: accessInfo.diasRestantes <= 7 ? "red" : "amber",
    });
  }

  if (emailVerified === false) {
    items.push({
      id: "email-unverified",
      title: "Correo pendiente de verificacion",
      detail: "El correo del contribuyente aun no consta como verificado.",
      date: new Date(),
      tone: "amber",
    });
  }

  return items;
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("es-EC", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Guayaquil",
  }).format(value);
}
