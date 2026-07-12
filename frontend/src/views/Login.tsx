import { useEffect, useState } from "react";
import {
  Download,
  Eye,
  EyeOff,
  KeyRound,
  LogIn,
  Menu,
  User,
  UserPlus,
  HelpCircle,
  Globe,
  Mail,
  Phone,
  Building2,
  IdCard,
} from "lucide-react";
import { motion } from "framer-motion";

interface LoginViewProps {
  onLoginSuccess: (ruc: string) => void;
}

type RegisterForm = {
  tipoIdentificacion: "CEDULA" | "RUC";
  identificacion: string;
  razonSocial: string;
  tipoContribuyente: "PERSONA_NATURAL" | "SOCIEDAD";
  email: string;
  telefono: string;
  password: string;
  confirmPassword: string;
};

type RegisteredCredentials = RegisterForm & {
  fechaRegistro: string;
};

const initialRegisterForm: RegisterForm = {
  tipoIdentificacion: "RUC",
  identificacion: "",
  razonSocial: "",
  tipoContribuyente: "PERSONA_NATURAL",
  email: "",
  telefono: "",
  password: "",
  confirmPassword: "",
};

const apiBaseUrl = import.meta.env.VITE_API_URL || "http://localhost:3001";

const formatTipoContribuyente = (value: RegisterForm["tipoContribuyente"]) =>
  value === "PERSONA_NATURAL" ? "PERSONA NATURAL" : "SOCIEDAD";

export default function LoginView({ onLoginSuccess }: LoginViewProps) {
  const [mode, setMode] = useState<"login" | "register" | "forgot" | "reset">(
    "login"
  );
  const [ruc, setRuc] = useState("");
  const [ciAdicional, setCiAdicional] = useState("");
  const [clave, setClave] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showRegisterPassword, setShowRegisterPassword] = useState(false);
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [registerLoading, setRegisterLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [forgotLoading, setForgotLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [error, setError] = useState("");
  const [registerError, setRegisterError] = useState("");
  const [forgotError, setForgotError] = useState("");
  const [resetError, setResetError] = useState("");
  const [registerSuccessMessage, setRegisterSuccessMessage] = useState("");
  const [forgotMessage, setForgotMessage] = useState("");
  const [verificationMessage, setVerificationMessage] = useState("");
  const [showResendVerification, setShowResendVerification] = useState(false);
  const [resendIdentifier, setResendIdentifier] = useState("");
  const [forgotIdentifier, setForgotIdentifier] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [nuevaClave, setNuevaClave] = useState("");
  const [confirmarNuevaClave, setConfirmarNuevaClave] = useState("");
  const [registerForm, setRegisterForm] =
    useState<RegisterForm>(initialRegisterForm);
  const [registeredCredentials, setRegisteredCredentials] =
    useState<RegisteredCredentials | null>(null);

  const updateRegisterField = <K extends keyof RegisterForm>(
    field: K,
    value: RegisterForm[K]
  ) => {
    setRegisterForm((current) => ({ ...current, [field]: value }));
    setRegisterError("");
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const verificationToken = params.get("verifyEmailToken");
    const passwordResetToken = params.get("token");

    if (
      window.location.pathname.includes("reset-password") &&
      passwordResetToken
    ) {
      setResetToken(passwordResetToken);
      setMode("reset");
      params.delete("token");
      const query = params.toString();
      const nextUrl = `/${query ? `?${query}` : ""}`;
      window.history.replaceState({}, "", nextUrl);
      return;
    }

    if (!verificationToken) return;

    const verifyEmail = async () => {
      try {
        setError("");
        setVerificationMessage("Verificando correo electrónico...");

        const response = await fetch(
          `${apiBaseUrl}/api/auth/verify-email?token=${encodeURIComponent(
            verificationToken
          )}`
        );
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.message || "No se pudo verificar el correo.");
        }

        setVerificationMessage(data.message || "Correo verificado correctamente.");
        setMode("login");
      } catch (err: any) {
        setVerificationMessage("");
        setError(err.message || "No se pudo verificar el correo.");
      } finally {
        params.delete("verifyEmailToken");
        const query = params.toString();
        const nextUrl = `${window.location.pathname}${query ? `?${query}` : ""}`;
        window.history.replaceState({}, "", nextUrl);
      }
    };

    verifyEmail();
  }, []);

  const credentialsTxt = (credentials: RegisteredCredentials) => `SRI CLONE APP - CREDENCIALES DE ACCESO
Fecha de registro: ${credentials.fechaRegistro}
Usuario/RUC/C.I.: ${credentials.identificacion}
Nombre/Razón social: ${credentials.razonSocial}
Tipo de contribuyente: ${formatTipoContribuyente(credentials.tipoContribuyente)}
Correo: ${credentials.email}
Teléfono: ${credentials.telefono}
Clave de acceso: ${credentials.password}

Advertencia:
Conserve este archivo en un lugar seguro. La clave no podrá recuperarse posteriormente.
`;

  const downloadCredentialsTxt = (credentials: RegisteredCredentials) => {
    const blob = new Blob([credentialsTxt(credentials)], {
      type: "text/plain;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `credenciales-sri-${credentials.identificacion}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const goToLoginWithRegisteredUser = () => {
    if (registeredCredentials) {
      setRuc(registeredCredentials.identificacion);
      setClave("");
      setCiAdicional("");
    }

    setMode("login");
    setError("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    setError("");
    setShowResendVerification(false);

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

      const response = await fetch(`${apiBaseUrl}/api/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ruc: ruc.trim(),
          ciAdicional: ciAdicional.trim(),
          clave: clave,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.code === "EMAIL_NOT_VERIFIED") {
          setShowResendVerification(true);
          setResendIdentifier(data.email || data.ruc || ruc.trim());
        }
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

  const handleResendVerification = async () => {
    const identifier = resendIdentifier || ruc.trim();

    if (!identifier) {
      setError("Ingrese su RUC o correo para reenviar la verificación.");
      return;
    }

    try {
      setResendLoading(true);
      setError("");
      setVerificationMessage("");

      const isEmail = identifier.includes("@");
      const response = await fetch(`${apiBaseUrl}/api/auth/resend-verification`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(isEmail ? { email: identifier } : { ruc: identifier }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "No se pudo reenviar el correo.");
      }

      setVerificationMessage(data.message || "Correo de verificación reenviado.");
      setShowResendVerification(false);
    } catch (err: any) {
      setError(err.message || "No se pudo reenviar el correo.");
    } finally {
      setResendLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    const identifier = forgotIdentifier.trim();

    setForgotError("");
    setForgotMessage("");

    if (!identifier) {
      setForgotError("Ingrese su correo electrónico o RUC.");
      return;
    }

    try {
      setForgotLoading(true);
      const isEmail = identifier.includes("@");
      const response = await fetch(`${apiBaseUrl}/api/auth/forgot-password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(isEmail ? { email: identifier } : { ruc: identifier }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "No se pudo procesar la solicitud.");
      }

      setForgotMessage(
        data.message ||
          "Si existe una cuenta asociada, enviaremos un correo con instrucciones."
      );
    } catch (err: any) {
      setForgotError(err.message || "No se pudo conectar con el servidor.");
    } finally {
      setForgotLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetError("");

    if (!resetToken) {
      setResetError("El enlace de recuperación no contiene un token válido.");
      return;
    }

    if (nuevaClave.length < 8) {
      setResetError("La nueva contraseña debe tener mínimo 8 caracteres.");
      return;
    }

    if (nuevaClave !== confirmarNuevaClave) {
      setResetError("La confirmación no coincide con la nueva contraseña.");
      return;
    }

    try {
      setResetLoading(true);
      const response = await fetch(`${apiBaseUrl}/api/auth/reset-password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ token: resetToken, nuevaClave }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "No se pudo actualizar la contraseña.");
      }

      setNuevaClave("");
      setConfirmarNuevaClave("");
      setResetToken("");
      setVerificationMessage(
        data.message || "Contraseña actualizada correctamente."
      );
      setMode("login");
    } catch (err: any) {
      setResetError(err.message || "No se pudo conectar con el servidor.");
    } finally {
      setResetLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegisterError("");
    setRegisterSuccessMessage("");
    setRegisteredCredentials(null);

    const identificacion = registerForm.identificacion.trim();
    const expectedLength =
      registerForm.tipoIdentificacion === "CEDULA" ? 10 : 13;

    if (identificacion.length !== expectedLength) {
      setRegisterError(
        registerForm.tipoIdentificacion === "CEDULA"
          ? "La cédula debe tener 10 dígitos."
          : "El RUC debe tener 13 dígitos."
      );
      return;
    }

    if (registerForm.password.length < 8) {
      setRegisterError("La contraseña debe tener mínimo 8 caracteres.");
      return;
    }

    if (registerForm.password !== registerForm.confirmPassword) {
      setRegisterError("La confirmación no coincide con la contraseña.");
      return;
    }

    try {
      setRegisterLoading(true);

      const payload = {
        ...registerForm,
        identificacion,
        razonSocial: registerForm.razonSocial.trim(),
        email: registerForm.email.trim(),
        telefono: registerForm.telefono.trim(),
      };

      const response = await fetch(`${apiBaseUrl}/api/auth/register`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "No se pudo crear el registro.");
      }

      const credentials = {
        ...payload,
        fechaRegistro: new Date().toLocaleString("es-EC"),
      };

      setRegisteredCredentials(credentials);
      setRegisterSuccessMessage(
        data.message ||
          "Registro creado correctamente. Revise su correo para verificar la cuenta antes de iniciar sesión."
      );
      setRuc(credentials.identificacion);
      setClave("");
      setCiAdicional("");
      downloadCredentialsTxt(credentials);
    } catch (err: any) {
      setRegisterError(err.message || "No se pudo conectar con el servidor.");
    } finally {
      setRegisterLoading(false);
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
              DECLARAR Y PAGAR TUS IMPUESTOS
            </div>

            <div className="bg-[#014c8c] px-5 py-3 rounded-xl font-bold shadow-lg">
              FACTURACIÓN ELECTRÓNICA GRATUITA
            </div>

            <div className="bg-[#2e5cae] px-5 py-3 rounded-xl font-bold shadow-lg">
              RESPONSABILIDAD TRIBUTARIA
            </div>
          </div>
        </section>

        <section className="w-full md:w-[520px] bg-[#003565] flex items-center justify-center px-6 py-8">
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full max-w-md my-auto"
          >
            {mode === "login" ? (
              <>
                <div className="flex justify-center mb-10">
                  <div className="bg-white/10 border border-white/10 rounded-xl px-8 py-5 text-xl font-bold">
                    SRI en Línea
                  </div>
                </div>

                {error && (
                  <div className="mb-5 bg-red-600 border border-red-500 rounded-lg p-4 text-sm">
                    {error}
                  </div>
                )}

                {verificationMessage && (
                  <div className="mb-5 bg-emerald-600 border border-emerald-500 rounded-lg p-4 text-sm">
                    {verificationMessage}
                  </div>
                )}

                {showResendVerification && (
                  <div className="mb-5 bg-white/5 border border-white/10 rounded-lg p-4 text-sm">
                    <p className="text-white/80">
                      Si no recibió el correo, puede solicitar un nuevo enlace de verificación.
                    </p>
                    <button
                      type="button"
                      onClick={handleResendVerification}
                      disabled={resendLoading}
                      className="mt-3 w-full bg-[#f5a400] hover:bg-[#ffb321] text-black font-bold py-3 rounded transition disabled:opacity-60"
                    >
                      {resendLoading ? "Reenviando..." : "Reenviar correo de verificación"}
                    </button>
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
                        className="flex-1 px-4 py-3 text-black outline-none min-w-0"
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
                        className="flex-1 px-4 py-3 text-black outline-none min-w-0"
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
                        className="flex-1 px-4 py-3 text-black outline-none min-w-0"
                      />

                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="bg-slate-100 px-4 text-slate-600"
                        aria-label="Mostrar u ocultar clave"
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

                <button
                  type="button"
                  onClick={() => {
                    setMode("register");
                    setError("");
                  }}
                  className="w-full mt-5 text-sm font-semibold text-white/90 hover:text-white underline-offset-4 hover:underline"
                >
                  ¿No tiene acceso? Solicitar acceso
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setMode("forgot");
                    setForgotIdentifier(ruc.trim());
                    setError("");
                    setForgotError("");
                    setForgotMessage("");
                  }}
                  className="w-full mt-3 text-sm font-semibold text-white/80 hover:text-white underline-offset-4 hover:underline"
                >
                  ¿Olvidaste tu contraseña?
                </button>
              </>
            ) : mode === "forgot" ? (
              <>
                <div className="mb-5">
                  <div className="flex items-center gap-3 text-xl font-bold">
                    <Mail size={22} />
                    Recuperar contraseña
                  </div>
                </div>

                {forgotError && (
                  <div className="mb-5 bg-red-600 border border-red-500 rounded-lg p-4 text-sm">
                    {forgotError}
                  </div>
                )}

                {forgotMessage && (
                  <div className="mb-5 bg-emerald-600 border border-emerald-500 rounded-lg p-4 text-sm">
                    {forgotMessage}
                  </div>
                )}

                <form onSubmit={handleForgotPassword} className="space-y-5">
                  <div>
                    <label className="text-xs font-bold uppercase">
                      Correo electrónico o RUC
                    </label>

                    <div className="mt-2 flex bg-white rounded overflow-hidden">
                      <div className="bg-slate-100 px-4 flex items-center text-slate-600">
                        <User size={18} />
                      </div>

                      <input
                        value={forgotIdentifier}
                        onChange={(e) => {
                          setForgotIdentifier(e.target.value);
                          setForgotError("");
                          setForgotMessage("");
                        }}
                        className="flex-1 px-4 py-3 text-black outline-none min-w-0"
                        autoComplete="username"
                      />
                    </div>
                  </div>

                  <button
                    disabled={forgotLoading}
                    className="w-full bg-white text-[#003565] font-bold py-4 rounded hover:bg-slate-100 transition disabled:opacity-60"
                  >
                    {forgotLoading ? "Enviando..." : "Enviar correo de recuperación"}
                  </button>
                </form>

                <button
                  type="button"
                  onClick={() => {
                    setMode("login");
                    setForgotError("");
                  }}
                  className="w-full mt-5 text-sm font-semibold text-white/90 hover:text-white underline-offset-4 hover:underline"
                >
                  Volver al ingreso
                </button>
              </>
            ) : mode === "reset" ? (
              <>
                <div className="mb-5">
                  <div className="flex items-center gap-3 text-xl font-bold">
                    <KeyRound size={22} />
                    Nueva contraseña
                  </div>
                </div>

                {resetError && (
                  <div className="mb-5 bg-red-600 border border-red-500 rounded-lg p-4 text-sm">
                    {resetError}
                  </div>
                )}

                <form onSubmit={handleResetPassword} className="space-y-5">
                  <div>
                    <label className="text-xs font-bold uppercase">
                      Nueva contraseña
                    </label>

                    <div className="mt-2 flex bg-white rounded overflow-hidden">
                      <div className="bg-slate-100 px-4 flex items-center text-slate-600">
                        <KeyRound size={18} />
                      </div>

                      <input
                        type={showResetPassword ? "text" : "password"}
                        value={nuevaClave}
                        onChange={(e) => {
                          setNuevaClave(e.target.value);
                          setResetError("");
                        }}
                        className="flex-1 px-4 py-3 text-black outline-none min-w-0"
                        minLength={8}
                        autoComplete="new-password"
                      />

                      <button
                        type="button"
                        onClick={() => setShowResetPassword(!showResetPassword)}
                        className="bg-slate-100 px-4 text-slate-600"
                        aria-label="Mostrar u ocultar nueva contraseña"
                      >
                        {showResetPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-bold uppercase">
                      Confirmar nueva contraseña
                    </label>

                    <div className="mt-2 flex bg-white rounded overflow-hidden">
                      <div className="bg-slate-100 px-4 flex items-center text-slate-600">
                        <KeyRound size={18} />
                      </div>

                      <input
                        type={showResetPassword ? "text" : "password"}
                        value={confirmarNuevaClave}
                        onChange={(e) => {
                          setConfirmarNuevaClave(e.target.value);
                          setResetError("");
                        }}
                        className="flex-1 px-4 py-3 text-black outline-none min-w-0"
                        minLength={8}
                        autoComplete="new-password"
                      />
                    </div>
                  </div>

                  <button
                    disabled={resetLoading}
                    className="w-full bg-white text-[#003565] font-bold py-4 rounded hover:bg-slate-100 transition disabled:opacity-60"
                  >
                    {resetLoading ? "Actualizando..." : "Actualizar contraseña"}
                  </button>
                </form>

                <button
                  type="button"
                  onClick={() => {
                    setMode("login");
                    setResetError("");
                  }}
                  className="w-full mt-5 text-sm font-semibold text-white/90 hover:text-white underline-offset-4 hover:underline"
                >
                  Volver al ingreso
                </button>
              </>
            ) : (
              <>
                <div className="mb-5">
                  <div className="flex items-center gap-3 text-xl font-bold">
                    <UserPlus size={22} />
                    Solicitar acceso
                  </div>
                </div>

                {registerError && (
                  <div className="mb-5 bg-red-600 border border-red-500 rounded-lg p-4 text-sm">
                    {registerError}
                  </div>
                )}

                {registeredCredentials && (
                  <div className="mb-5 bg-emerald-600 border border-emerald-500 rounded-lg p-4 text-sm">
                    {registerSuccessMessage} Descargue y conserve sus credenciales.
                  </div>
                )}

                <form onSubmit={handleRegister} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-bold uppercase">
                        Tipo de identificación
                      </label>
                      <select
                        value={registerForm.tipoIdentificacion}
                        onChange={(e) =>
                          updateRegisterField(
                            "tipoIdentificacion",
                            e.target.value as RegisterForm["tipoIdentificacion"]
                          )
                        }
                        className="mt-2 w-full px-4 py-3 rounded text-black outline-none"
                      >
                        <option value="CEDULA">CÉDULA</option>
                        <option value="RUC">RUC</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-xs font-bold uppercase">
                        Número
                      </label>
                      <div className="mt-2 flex bg-white rounded overflow-hidden">
                        <div className="bg-slate-100 px-3 flex items-center text-slate-600">
                          <IdCard size={18} />
                        </div>
                        <input
                          value={registerForm.identificacion}
                          onChange={(e) =>
                            updateRegisterField(
                              "identificacion",
                              e.target.value.replace(/\D/g, "")
                            )
                          }
                          className="flex-1 px-3 py-3 text-black outline-none min-w-0"
                          maxLength={
                            registerForm.tipoIdentificacion === "CEDULA"
                              ? 10
                              : 13
                          }
                          required
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-bold uppercase">
                      Nombres completos / Razón social
                    </label>
                    <div className="mt-2 flex bg-white rounded overflow-hidden">
                      <div className="bg-slate-100 px-3 flex items-center text-slate-600">
                        <Building2 size={18} />
                      </div>
                      <input
                        value={registerForm.razonSocial}
                        onChange={(e) =>
                          updateRegisterField("razonSocial", e.target.value)
                        }
                        className="flex-1 px-3 py-3 text-black outline-none min-w-0"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-bold uppercase">
                      Tipo de contribuyente
                    </label>
                    <select
                      value={registerForm.tipoContribuyente}
                      onChange={(e) =>
                        updateRegisterField(
                          "tipoContribuyente",
                          e.target.value as RegisterForm["tipoContribuyente"]
                        )
                      }
                      className="mt-2 w-full px-4 py-3 rounded text-black outline-none"
                    >
                      <option value="PERSONA_NATURAL">PERSONA NATURAL</option>
                      <option value="SOCIEDAD">SOCIEDAD</option>
                    </select>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-bold uppercase">
                        Correo electrónico
                      </label>
                      <div className="mt-2 flex bg-white rounded overflow-hidden">
                        <div className="bg-slate-100 px-3 flex items-center text-slate-600">
                          <Mail size={18} />
                        </div>
                        <input
                          type="email"
                          value={registerForm.email}
                          onChange={(e) =>
                            updateRegisterField("email", e.target.value)
                          }
                          className="flex-1 px-3 py-3 text-black outline-none min-w-0"
                          required
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-xs font-bold uppercase">
                        Teléfono / celular
                      </label>
                      <div className="mt-2 flex bg-white rounded overflow-hidden">
                        <div className="bg-slate-100 px-3 flex items-center text-slate-600">
                          <Phone size={18} />
                        </div>
                        <input
                          value={registerForm.telefono}
                          onChange={(e) =>
                            updateRegisterField("telefono", e.target.value)
                          }
                          className="flex-1 px-3 py-3 text-black outline-none min-w-0"
                          required
                        />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-bold uppercase">
                        Contraseña
                      </label>
                      <div className="mt-2 flex bg-white rounded overflow-hidden">
                        <div className="bg-slate-100 px-3 flex items-center text-slate-600">
                          <KeyRound size={18} />
                        </div>
                        <input
                          type={showRegisterPassword ? "text" : "password"}
                          value={registerForm.password}
                          onChange={(e) =>
                            updateRegisterField("password", e.target.value)
                          }
                          className="flex-1 px-3 py-3 text-black outline-none min-w-0"
                          minLength={8}
                          required
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-xs font-bold uppercase">
                        Confirmar contraseña
                      </label>
                      <div className="mt-2 flex bg-white rounded overflow-hidden">
                        <input
                          type={showRegisterPassword ? "text" : "password"}
                          value={registerForm.confirmPassword}
                          onChange={(e) =>
                            updateRegisterField(
                              "confirmPassword",
                              e.target.value
                            )
                          }
                          className="flex-1 px-3 py-3 text-black outline-none min-w-0"
                          minLength={8}
                          required
                        />
                        <button
                          type="button"
                          onClick={() =>
                            setShowRegisterPassword(!showRegisterPassword)
                          }
                          className="bg-slate-100 px-3 text-slate-600"
                          aria-label="Mostrar u ocultar claves"
                        >
                          {showRegisterPassword ? (
                            <EyeOff size={18} />
                          ) : (
                            <Eye size={18} />
                          )}
                        </button>
                      </div>
                    </div>
                  </div>

                  <button
                    disabled={registerLoading}
                    className="w-full bg-white text-[#003565] font-bold py-4 rounded hover:bg-slate-100 transition disabled:opacity-60"
                  >
                    {registerLoading ? "Registrando..." : "Crear registro"}
                  </button>
                </form>

                {registeredCredentials && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
                    <button
                      type="button"
                      onClick={() =>
                        downloadCredentialsTxt(registeredCredentials)
                      }
                      className="flex items-center justify-center gap-2 bg-[#f5a400] hover:bg-[#ffb321] text-black font-bold py-3 rounded transition"
                    >
                      <Download size={18} />
                      Descargar credenciales TXT
                    </button>

                    <button
                      type="button"
                      onClick={goToLoginWithRegisteredUser}
                      className="flex items-center justify-center gap-2 bg-white/10 border border-white/20 hover:bg-white/15 text-white font-bold py-3 rounded transition"
                    >
                      <LogIn size={18} />
                      Iniciar sesión ahora
                    </button>
                  </div>
                )}

                <button
                  type="button"
                  onClick={goToLoginWithRegisteredUser}
                  className="w-full mt-5 text-sm font-semibold text-white/90 hover:text-white underline-offset-4 hover:underline"
                >
                  Volver al ingreso
                </button>
              </>
            )}
          </motion.div>
        </section>
      </div>
    </main>
  );
}
