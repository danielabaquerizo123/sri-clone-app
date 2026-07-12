import {
  BarChart3,
  CalendarDays,
  LayoutDashboard,
  LogOut,
  ShieldCheck,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import AdminContribuyentesPanel from "../components/Admin/AdminContribuyentesPanel";

interface AdminViewProps {
  userRuc: string;
  userRazonSocial: string;
  onLogout: () => void;
  onOpenContable: () => void;
}

export default function AdminView({
  userRuc,
  userRazonSocial,
  onLogout,
  onOpenContable,
}: AdminViewProps) {
  const [now, setNow] = useState(() => new Date());
  const [attentionCount, setAttentionCount] = useState(0);
  const tableSectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const formattedDate = useMemo(
    () =>
      now.toLocaleDateString("es-EC", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      }),
    [now]
  );

  const formattedTime = useMemo(
    () =>
      now.toLocaleTimeString("es-EC", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      }),
    [now]
  );

  const goToPanel = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <main className="min-h-screen bg-[#eef4fb] text-slate-900 lg:flex">
      <aside className="flex flex-col bg-[#003565] text-white shadow-xl lg:sticky lg:top-0 lg:h-screen lg:w-72 lg:shrink-0">
        <div className="border-b border-white/10 p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 text-white">
              <ShieldCheck size={22} />
            </div>
            <div>
              <p className="text-lg font-black leading-tight">SRI en línea</p>
              <p className="text-xs font-black uppercase text-white/55">
                Administración
              </p>
            </div>
          </div>
        </div>

        <nav className="flex-1 space-y-2 p-4">
          <SidebarItem
            active
            badge={attentionCount}
            icon={<LayoutDashboard size={18} />}
            label="Panel de control"
            onClick={goToPanel}
          />
        </nav>

        <div className="space-y-3 border-t border-white/10 p-4">
          <SidebarItem
            active={false}
            icon={<BarChart3 size={18} />}
            label="Ver sistema contable"
            onClick={onOpenContable}
          />
          <div className="rounded-2xl bg-white/10 p-4">
            <p className="text-xs font-black uppercase text-white/55">
              Administrador
            </p>
            <p className="mt-1 truncate text-sm font-black">{userRazonSocial}</p>
            <p className="mt-1 font-mono text-xs text-white/60">RUC {userRuc}</p>
          </div>
        </div>
      </aside>

      <div className="min-w-0 flex-1">
      <header className="border-b border-slate-200 bg-white/95 shadow-sm backdrop-blur">
        <div className="flex min-h-20 flex-col gap-4 px-5 py-4 sm:flex-row sm:items-center sm:justify-between lg:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#003565] text-white shadow-sm">
              <ShieldCheck size={22} />
            </div>
            <div>
              <p className="text-xs font-black uppercase text-slate-400">
                Panel administrativo
              </p>
              <h1 className="text-xl font-black leading-tight text-[#003565]">
                Bienvenido/a, Administrador
              </h1>
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="text-left leading-tight sm:text-right">
              <p className="text-sm font-black text-[#003565]">{userRazonSocial}</p>
              <p className="font-mono text-xs font-semibold text-slate-500">
                RUC {userRuc}
              </p>
            </div>

            <div className="hidden h-10 w-px bg-slate-200 sm:block" />

            <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-slate-700">
              <CalendarDays size={18} className="text-[#006aa6]" />
              <div className="leading-tight">
                <p className="text-[11px] font-bold capitalize text-slate-500">
                  {formattedDate}
                </p>
                <p className="font-mono text-sm font-black text-[#003565]">
                  {formattedTime}
                </p>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={onLogout}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#003565] px-4 py-3 text-sm font-black text-white transition hover:bg-[#004784]"
              >
                <LogOut size={17} />
                Cerrar sesión
              </button>
            </div>
          </div>
        </div>
      </header>

      <section className="px-5 py-8 lg:px-8">
        <AdminContribuyentesPanel
          tableSectionRef={tableSectionRef}
          onAttentionCountChange={setAttentionCount}
        />
      </section>
      </div>
    </main>
  );
}

function SidebarItem({
  active,
  badge,
  icon,
  label,
  onClick,
}: {
  active: boolean;
  badge?: number;
  icon: ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center justify-between gap-3 rounded-2xl px-4 py-3 text-left text-sm font-black transition ${
        active
          ? "bg-blue-500 text-white shadow-lg shadow-blue-950/20"
          : "text-white/78 hover:bg-white/10 hover:text-white"
      }`}
    >
      <span className="flex min-w-0 items-center gap-3">
        <span className={active ? "text-white" : "text-blue-100"}>{icon}</span>
        <span className="truncate">{label}</span>
      </span>
      {!!badge && (
        <span className="rounded-full bg-[#f5a400] px-2 py-0.5 text-xs font-black text-[#003565]">
          {badge}
        </span>
      )}
    </button>
  );
}
