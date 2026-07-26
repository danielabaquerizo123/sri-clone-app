import { useEffect, useRef, useState, type ReactNode } from "react";
import { CalendarDays, Camera, LogOut, Search, Trash2, User } from "lucide-react";
import UserAvatar from "../Profile/UserAvatar";
import ProfilePhotoDialog from "../Profile/ProfilePhotoDialog";

interface DashboardHeaderProps {
  activeTab: string;
  nombreUsuario: string;
  rucUsuario: string;
  tipoContribuyente: "PERSONA_NATURAL" | "SOCIEDAD";
  fotoPerfilUrl?: string | null;
  now: Date;
  photoLoading?: boolean;
  photoError?: string;
  onViewProfile: () => void;
  onUploadProfilePhoto: (file: File) => Promise<void>;
  onDeleteProfilePhoto: () => Promise<void>;
  onLogout: () => void;
}

export default function DashboardHeader({
  activeTab,
  nombreUsuario,
  rucUsuario,
  tipoContribuyente,
  fotoPerfilUrl,
  now,
  photoLoading = false,
  photoError = "",
  onViewProfile,
  onUploadProfilePhoto,
  onDeleteProfilePhoto,
  onLogout,
}: DashboardHeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [photoDialogOpen, setPhotoDialogOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const isInicio = activeTab === "inicio";
  const headerTitle = isInicio
    ? `Hola, ${getNombrePila(nombreUsuario, tipoContribuyente)}`
    : getSectionTitle(activeTab);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };

    window.addEventListener("mousedown", handleClickOutside);
    window.addEventListener("keydown", handleEscape);

    return () => {
      window.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("keydown", handleEscape);
    };
  }, []);

  const handleUpload = async (file: File) => {
    await onUploadProfilePhoto(file);
    setPhotoDialogOpen(false);
    setMenuOpen(false);
  };

  const handleDelete = async () => {
    await onDeleteProfilePhoto();
    setMenuOpen(false);
  };

  return (
    <header className="border-b border-slate-200 bg-white/95 shadow-sm backdrop-blur">
      <div className="grid gap-3 px-4 py-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center xl:grid-cols-[minmax(0,1fr)_minmax(220px,300px)_auto_auto] xl:px-6">
        <div className="min-w-0">
          <h1 className="truncate text-lg font-black leading-tight text-[#003565] xl:text-xl">
            {headerTitle}
          </h1>
          {isInicio && (
            <p className="mt-1 truncate text-xs font-semibold text-slate-500 xl:text-sm">
              Aqui tienes un resumen actualizado de tu informacion tributaria.
            </p>
          )}
        </div>

        <div className="hidden min-w-0 items-center gap-3 rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-slate-500 shadow-sm xl:flex">
          <Search size={18} className="shrink-0 text-slate-400" />
          <input
            aria-label="Buscar en el sistema"
            className="min-w-0 flex-1 bg-transparent text-sm font-semibold outline-none placeholder:text-slate-400"
            placeholder="Buscar en el sistema..."
          />
          <span className="hidden rounded-lg bg-slate-100 px-2 py-1 text-[10px] font-black text-slate-500 sm:inline">
            Ctrl + K
          </span>
        </div>

        <div className="hidden items-center gap-3 rounded-2xl bg-slate-50 px-3 py-2.5 text-slate-700 md:flex lg:justify-self-end xl:justify-self-auto">
          <CalendarDays size={18} className="text-[#006aa6]" />
          <div className="leading-tight">
            <p className="text-[11px] font-bold capitalize text-slate-500">
              {formatDate(now)}
            </p>
            <p className="font-mono text-sm font-black text-[#003565]">
              {formatTime(now)}
            </p>
          </div>
        </div>

        <div ref={menuRef} className="relative flex min-w-0 items-center gap-3 rounded-2xl bg-white px-2 py-2 lg:justify-self-end xl:justify-self-auto">
          <button
            type="button"
            aria-label="Abrir menú de perfil"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((current) => !current)}
            className="rounded-full outline-none ring-offset-2 ring-offset-white focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            <UserAvatar fotoPerfilUrl={fotoPerfilUrl} nombres={nombreUsuario} size={44} />
          </button>
          <button
            type="button"
            onClick={() => setMenuOpen((current) => !current)}
            className="min-w-0 text-left leading-tight"
          >
            <p className="max-w-36 truncate text-sm font-black text-[#003565] 2xl:max-w-44">
              {nombreUsuario}
            </p>
            <p className="font-mono text-xs font-semibold text-slate-500">
              RUC: {rucUsuario}
            </p>
          </button>

          {menuOpen && (
            <div
              role="menu"
              className="absolute right-0 top-full z-40 mt-2 w-56 overflow-hidden rounded-2xl border border-slate-200 bg-white py-2 shadow-xl"
            >
              <MenuItem
                icon={<User size={16} />}
                label="Ver perfil"
                onClick={() => {
                  onViewProfile();
                  setMenuOpen(false);
                }}
              />
              <MenuItem
                icon={<Camera size={16} />}
                label="Cambiar foto"
                onClick={() => {
                  setPhotoDialogOpen(true);
                  setMenuOpen(false);
                }}
              />
              {fotoPerfilUrl && (
                <MenuItem
                  icon={<Trash2 size={16} />}
                  label="Eliminar foto"
                  danger
                  disabled={photoLoading}
                  onClick={handleDelete}
                />
              )}
              <div className="my-2 border-t border-slate-100" />
              <MenuItem icon={<LogOut size={16} />} label="Cerrar sesión" onClick={onLogout} />
            </div>
          )}

          <ProfilePhotoDialog
            open={photoDialogOpen}
            currentPhotoUrl={fotoPerfilUrl}
            nombreUsuario={nombreUsuario}
            loading={photoLoading}
            error={photoError}
            onClose={() => setPhotoDialogOpen(false)}
            onSave={handleUpload}
          />
        </div>
      </div>
    </header>
  );
}

function formatDate(value: Date) {
  return value.toLocaleDateString("es-EC", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function getNombrePila(
  razonSocial: string,
  tipoContribuyente: DashboardHeaderProps["tipoContribuyente"]
) {
  const parts = razonSocial.split(" ").map((part) => part.trim()).filter(Boolean);

  if (parts.length === 0) return "contribuyente";

  if (tipoContribuyente === "PERSONA_NATURAL" && parts.length >= 3) {
    return parts[parts.length - 2];
  }

  return parts[0];
}

function getSectionTitle(activeTab: string) {
  const titles: Record<string, string> = {
    ruc_inscripcion: "Inscripcion RUC",
    ruc_actualizacion: "Actualizacion RUC",
    ruc_reapertura: "Reapertura RUC",
    ruc_reimpresion: "Reimpresion RUC",
    declaracion_elaboracion: "Declaraciones",
    declaracion_consulta: "Consulta de declaraciones",
    declaracion_107: "Formulario 107 - RDEP",
    declaracion_103: "Formulario 103",
    declaracion_104: "Formulario 104",
    anexo_ats: "ATS",
    anexo_envio: "Envio y consulta de anexos",
    anexo_beneficiario: "Beneficiario pension",
    anexo_dependientes_2022: "Dependientes hasta 2022",
    anexo_cargas_2023: "Cargas desde 2023",
    contabilidad: "Contabilidad",
  };

  return titles[activeTab] || "Portal transaccional";
}

function formatTime(value: Date) {
  return value.toLocaleTimeString("es-EC", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function MenuItem({
  icon,
  label,
  danger = false,
  disabled = false,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  danger?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      onClick={onClick}
      className={`flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm font-bold disabled:opacity-50 ${
        danger ? "text-red-600 hover:bg-red-50" : "text-slate-700 hover:bg-slate-50"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}
