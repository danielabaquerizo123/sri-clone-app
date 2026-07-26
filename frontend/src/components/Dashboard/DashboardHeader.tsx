import { useRef, useState, type ReactNode } from "react";
import { Camera, ChevronDown, LogOut, Trash2, User } from "lucide-react";
import type { AccessInfo } from "../../utils/acceso";
import type { OpcionesRuc } from "../../views/DashboardView";
import GlobalSearch from "./GlobalSearch";
import HeaderDropdownPortal from "./HeaderDropdownPortal";
import LiveClock from "./LiveClock";
import NotificationButton from "./NotificationButton";
import UserAvatar from "../Profile/UserAvatar";
import ProfilePhotoDialog from "../Profile/ProfilePhotoDialog";
import { getNavigationItems, getSectionTitleFromRegistry } from "./navigationRegistry";

interface DashboardHeaderProps {
  activeTab: string;
  accessInfo: AccessInfo;
  activo: boolean;
  email?: string | null;
  emailVerified?: boolean | null;
  nombreUsuario: string;
  opcionesRuc: OpcionesRuc | null;
  rucUsuario: string;
  tipoContribuyente: "PERSONA_NATURAL" | "SOCIEDAD";
  fotoPerfilUrl?: string | null;
  photoLoading?: boolean;
  photoError?: string;
  onNavigate: (tab: string) => void;
  onViewProfile: () => void;
  onUploadProfilePhoto: (file: File) => Promise<void>;
  onDeleteProfilePhoto: () => Promise<void>;
  onLogout: () => void;
}

export default function DashboardHeader({
  accessInfo,
  activo,
  activeTab,
  email,
  emailVerified,
  nombreUsuario,
  opcionesRuc,
  rucUsuario,
  tipoContribuyente,
  fotoPerfilUrl,
  photoLoading = false,
  photoError = "",
  onNavigate,
  onViewProfile,
  onUploadProfilePhoto,
  onDeleteProfilePhoto,
  onLogout,
}: DashboardHeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [photoDialogOpen, setPhotoDialogOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const isInicio = activeTab === "inicio";
  const navigationItems = getNavigationItems(opcionesRuc);
  const headerTitle = isInicio
    ? `Hola, ${getNombrePila(nombreUsuario, tipoContribuyente)}`
    : getSectionTitleFromRegistry(activeTab, opcionesRuc);

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
    <header className="relative z-[var(--dashboard-z-header)] border-b border-slate-200/80 bg-white/95 shadow-sm backdrop-blur">
      <div className="flex min-h-[88px] items-center justify-between gap-3 px-5 py-4 lg:flex-nowrap xl:px-7">
        <div className="min-w-[230px] shrink-0 lg:min-w-[260px]">
          <h1 className="truncate text-2xl font-black leading-tight text-[#082b68]">
            {headerTitle}
            {isInicio && <span className="ml-2" aria-hidden="true">👋</span>}
          </h1>
          {isInicio && (
            <p className="mt-1 hidden text-sm font-semibold leading-5 text-slate-500 2xl:block">
              Aqui tienes un resumen actualizado de tu informacion tributaria.
            </p>
          )}
        </div>

        <GlobalSearch items={navigationItems} onNavigate={onNavigate} />

        <div className="ml-auto flex shrink-0 items-center gap-3 lg:flex-nowrap">
          <LiveClock />
          <NotificationButton
            accessInfo={accessInfo}
            activo={activo}
            emailVerified={emailVerified}
          />

          <div className="hidden h-10 w-px bg-slate-200 xl:block" />

        <div ref={menuRef} className="relative flex h-12 max-w-[220px] shrink-0 items-center gap-2 rounded-2xl bg-white px-2 xl:max-w-[240px] 2xl:max-w-[280px]">
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
            className="hidden min-w-0 text-left leading-tight focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 xl:block"
          >
            <p title={nombreUsuario} className="max-w-[140px] truncate whitespace-nowrap text-sm font-black text-[#082b68] 2xl:max-w-[180px]">
              {nombreUsuario}
            </p>
            <p className="whitespace-nowrap font-mono text-xs font-semibold text-slate-500">
              RUC: {rucUsuario}
            </p>
          </button>
          <button
            type="button"
            aria-label="Abrir menú de perfil"
            onClick={() => setMenuOpen((current) => !current)}
            className="hidden rounded-full p-1 text-slate-500 transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 sm:block"
          >
            <ChevronDown size={17} />
          </button>

          <HeaderDropdownPortal
            anchorRef={menuRef}
            open={menuOpen}
            width={320}
            onClose={() => setMenuOpen(false)}
          >
            <div role="menu" className="overflow-hidden rounded-2xl border border-slate-200 bg-white py-2 shadow-2xl">
              <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-3">
                <UserAvatar fotoPerfilUrl={fotoPerfilUrl} nombres={nombreUsuario} size={48} />
                <div className="min-w-0">
                  <p title={nombreUsuario} className="truncate text-sm font-black text-[#082b68]">
                    {nombreUsuario}
                  </p>
                  {email && (
                    <p title={email} className="truncate text-xs font-semibold text-slate-500">
                      {email}
                    </p>
                  )}
                  <p className="font-mono text-xs font-semibold text-slate-500">
                    RUC: {rucUsuario}
                  </p>
                </div>
              </div>
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
          </HeaderDropdownPortal>

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
      </div>
    </header>
  );
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
