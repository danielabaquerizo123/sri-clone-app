import { Clock3, LockKeyhole, LogOut } from "lucide-react";
import type { AccessBlockedReason } from "../../api/authApi";

interface AccessBlockedViewProps {
  reason: AccessBlockedReason;
  onBackToLogin: () => void;
}

export default function AccessBlockedView({
  reason,
  onBackToLogin,
}: AccessBlockedViewProps) {
  const copy =
    reason === "expired"
      ? {
          icon: <Clock3 size={34} />,
          title: "Periodo de acceso finalizado",
          message:
            "Tu periodo de acceso al sistema ha finalizado. Contacta al administrador para renovar tu suscripción.",
        }
      : {
          icon: <LockKeyhole size={34} />,
          title: "Acceso suspendido",
          message:
            "Tu acceso a este sistema ha sido suspendido. Contacta al administrador para más información.",
        };

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-5 py-10">
      <section className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-xl bg-[#003565] text-white">
          {copy.icon}
        </div>

        <p className="mb-2 text-xs font-black uppercase tracking-wide text-slate-400">
          Acceso no disponible
        </p>

        <h1 className="text-2xl font-black text-[#003565]">{copy.title}</h1>

        <p className="mt-4 text-sm font-semibold leading-6 text-slate-600">
          {copy.message}
        </p>

        <button
          type="button"
          onClick={onBackToLogin}
          className="mt-7 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#003565] px-5 py-4 text-sm font-black text-white transition hover:bg-[#004784]"
        >
          <LogOut size={18} />
          Volver al login
        </button>
      </section>
    </main>
  );
}
