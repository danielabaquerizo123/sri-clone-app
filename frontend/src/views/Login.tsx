import { useState } from "react";
import {
  Eye,
  EyeOff,
  KeyRound,
  Menu,
  User,
  UserPlus,
  HelpCircle,
  Globe,
} from "lucide-react";
import { motion } from "framer-motion";

interface LoginViewProps {
  onLoginSuccess: (ruc: string) => void;
}

export default function LoginView({ onLoginSuccess }: LoginViewProps) {
  const [ruc, setRuc] = useState("0602539041001");
  const [ciAdicional, setCiAdicional] = useState("");
  const [clave, setClave] = useState("sripassword2026");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const cargarDemo = () => {
    setRuc("0602539041001");
    setCiAdicional("");
    setClave("sripassword2026");
    setError("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    setError("");

    if (!ruc.trim()) {
      setError("Ingrese su RUC, C.I. o Pasaporte.");
      return;
    }

    if (!clave.trim()) {
      setError("Ingrese su clave.");
      return;
    }

    try {
      setLoading(true);

      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/api/auth/login`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            ruc: ruc.trim(),
            ciAdicional: ciAdicional.trim(),
            clave: clave,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Credenciales incorrectas.");
      }

      localStorage.setItem("sri_token", data.token);
      localStorage.setItem("sri_user", JSON.stringify(data.user));

      onLoginSuccess(data.user.ruc);
    } catch (err: any) {
      setError(err.message || "No se pudo conectar con el servidor.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#003565] text-white flex flex-col">
      <header className="h-[72px] bg-[#003565] border-b border-white/10 flex items-center justify-between px-6 shadow">
        <div className="flex items-center gap-4">
          <Menu size={22} />
          <span className="text-2xl font-bold">SRI en línea</span>
        </div>

        <div className="flex items-center gap-4">
          <HelpCircle size={20} />
          <Globe size={20} />
          <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
            <User size={16} />
          </div>
        </div>
      </header>

      <div className="flex flex-1">
        <section className="hidden md:flex flex-1 relative bg-slate-200 overflow-hidden">
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{
              backgroundImage:
                "url('https://images.unsplash.com/photo-1520607162513-77705c0f0d4a?q=80&w=1600')",
            }}
          />

          <div className="absolute inset-0 bg-black/10" />

          <div className="absolute left-10 bottom-12 flex flex-col gap-3 z-10">
            <div className="bg-[#004784] px-5 py-3 rounded-xl font-bold shadow-lg">
              ✓ DECLARAR Y PAGAR TUS IMPUESTOS
            </div>

            <div className="bg-[#014c8c] px-5 py-3 rounded-xl font-bold shadow-lg">
              ✓ FACTURACIÓN ELECTRÓNICA GRATUITA
            </div>

            <div className="bg-[#2e5cae] px-5 py-3 rounded-xl font-bold shadow-lg">
              ✓ RESPONSABILIDAD TRIBUTARIA
            </div>
          </div>
        </section>

        <section className="w-full md:w-[480px] bg-[#003565] flex items-center justify-center px-8 py-10">
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full max-w-sm"
          >
            <button
              onClick={cargarDemo}
              type="button"
              className="w-full mb-6 bg-[#f5a400] hover:bg-[#ffb321] text-black font-bold py-3 rounded transition"
            >
              ▶ CARGAR DEMO
            </button>

            <div className="flex justify-center mb-8">
              <div className="bg-white/10 border border-white/10 rounded-xl px-8 py-5 text-xl font-bold">
                SRI en Línea
              </div>
            </div>

            {error && (
              <div className="mb-5 bg-red-600 border border-red-500 rounded-lg p-4 text-sm">
                {error}
              </div>
            )}

            <div className="mb-6 text-center text-xs text-white/70 bg-white/5 border border-white/10 p-3 rounded-lg">
              Inicia sesión con tu RUC o CI.
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="text-xs font-bold uppercase">
                  *RUC / C.I. / PASAPORTE
                </label>

                <div className="mt-2 flex bg-white rounded overflow-hidden">
                  <div className="bg-slate-100 px-4 flex items-center text-slate-600">
                    <User size={18} />
                  </div>

                  <input
                    value={ruc}
                    onChange={(e) =>
                      setRuc(e.target.value.replace(/\D/g, ""))
                    }
                    className="flex-1 px-4 py-3 text-black outline-none"
                    maxLength={13}
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold uppercase">
                  C.I. ADICIONAL
                </label>

                <div className="mt-2 flex bg-white rounded overflow-hidden">
                  <div className="bg-slate-100 px-4 flex items-center text-slate-600">
                    <UserPlus size={18} />
                  </div>

                  <input
                    value={ciAdicional}
                    onChange={(e) =>
                      setCiAdicional(e.target.value.replace(/\D/g, ""))
                    }
                    className="flex-1 px-4 py-3 text-black outline-none"
                    maxLength={10}
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold uppercase">
                  *CLAVE DE ACCESO
                </label>

                <div className="mt-2 flex bg-white rounded overflow-hidden">
                  <div className="bg-slate-100 px-4 flex items-center text-slate-600">
                    <KeyRound size={18} />
                  </div>

                  <input
                    type={showPassword ? "text" : "password"}
                    value={clave}
                    onChange={(e) => setClave(e.target.value)}
                    className="flex-1 px-4 py-3 text-black outline-none"
                  />

                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="bg-slate-100 px-4 text-slate-600"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <button
                disabled={loading}
                className="w-full bg-white text-[#003565] font-bold py-4 rounded hover:bg-slate-100 transition disabled:opacity-60"
              >
                {loading ? "Validando..." : "Ingresar"}
              </button>
            </form>
          </motion.div>
        </section>
      </div>
    </main>
  );
}
