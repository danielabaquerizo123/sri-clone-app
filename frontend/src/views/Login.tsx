import { useEffect, useRef, useState } from "react";
import type { ReactNode, RefObject } from "react";
import {
  Building2,
  ChevronRight,
  Download,
  Eye,
  EyeOff,
  FileText,
  Globe,
  HelpCircle,
  IdCard,
  KeyRound,
  LogIn,
  Mail,
  Menu,
  Phone,
  ShieldCheck,
  User,
  UserPlus,
} from "lucide-react";
import "./Login.css";
import RecoveryCaptcha from "../components/RecoveryCaptcha";

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

type RegisterFieldErrors = Partial<Record<keyof RegisterForm, string>>;

type RecoveryAccount = { ruc: string; razonSocial: string; canReset: boolean; hasEmail: boolean; };

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

const normalizeUppercaseText = (value: string) =>
  value.replace(/\s+/g, " ").toLocaleUpperCase("es");

const normalizeUppercaseTextForSubmit = (value: string) =>
  normalizeUppercaseText(value.trim());

const normalizeEmail = (value: string) => value.trim().toLowerCase();

const isValidEmail = (value: string) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) &&
  value.split("@").length === 2;

export default function LoginView({ onLoginSuccess }: LoginViewProps) {
  const [mode, setMode] = useState<"login" | "register" | "forgot" | "reset">(
    "login"
  );
  const [recoveryAccount, setRecoveryAccount] = useState<RecoveryAccount | null>(null);
  const [recoveryCode, setRecoveryCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [codeLoading, setCodeLoading] = useState(false);
  const [codeMessage, setCodeMessage] = useState("");
  const [captchaToken, setCaptchaToken] = useState("");
  const [captchaVersion, setCaptchaVersion] = useState(0);
  const [ruc, setRuc] = useState("");
  const [ciAdicional, setCiAdicional] = useState("");
  const [clave, setClave] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showRegisterPassword, setShowRegisterPassword] = useState(false);
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [registerLoading, setRegisterLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [error, setError] = useState("");
  const [registerError, setRegisterError] = useState("");
  const [forgotError, setForgotError] = useState("");
  const [resetError, setResetError] = useState("");
  const [registerSuccessMessage, setRegisterSuccessMessage] = useState("");
  const [verificationMessage, setVerificationMessage] = useState("");
  const [forgotIdentifier, setForgotIdentifier] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [resetIdentity, setResetIdentity] = useState<{ razonSocial: string; ruc: string } | null>(null);
  const [checkingReset, setCheckingReset] = useState(false);
  const [nuevaClave, setNuevaClave] = useState("");
  const [confirmarNuevaClave, setConfirmarNuevaClave] = useState("");
  const [registerForm, setRegisterForm] =
    useState<RegisterForm>(initialRegisterForm);
  const [registeredCredentials, setRegisteredCredentials] =
    useState<RegisteredCredentials | null>(null);
  const [registerFieldErrors, setRegisterFieldErrors] =
    useState<RegisterFieldErrors>({});
  const identificacionRef = useRef<HTMLInputElement | null>(null);
  const razonSocialRef = useRef<HTMLInputElement | null>(null);
  const emailRef = useRef<HTMLInputElement | null>(null);
  const telefonoRef = useRef<HTMLInputElement | null>(null);
  const passwordRef = useRef<HTMLInputElement | null>(null);
  const confirmPasswordRef = useRef<HTMLInputElement | null>(null);

  const updateRegisterField = <K extends keyof RegisterForm>(
    field: K,
    value: RegisterForm[K]
  ) => {
    const normalizedValue =
      field === "razonSocial"
        ? normalizeUppercaseText(String(value))
        : field === "email"
          ? String(value).trim().toLowerCase()
          : value;

    setRegisterForm((current) => ({ ...current, [field]: normalizedValue as RegisterForm[K] }));
    setRegisterFieldErrors((current) => ({ ...current, [field]: undefined }));
    setRegisterError("");
  };

  const focusFirstRegisterError = (errors: RegisterFieldErrors) => {
    const refs: Partial<Record<keyof RegisterForm, RefObject<HTMLInputElement>>> = {
      identificacion: identificacionRef,
      razonSocial: razonSocialRef,
      email: emailRef,
      telefono: telefonoRef,
      password: passwordRef,
      confirmPassword: confirmPasswordRef,
    };

    const firstError = (Object.keys(errors) as Array<keyof RegisterForm>).find(
      (field) => Boolean(errors[field])
    );

    if (firstError) refs[firstError]?.current?.focus();
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const fragment = new URLSearchParams(window.location.hash.slice(1));
    const token = fragment.get("token") || params.get("token");
    if (!window.location.pathname.includes("reset-password")) return;
    if (!token) { setMode("reset"); setResetError("El enlace no es válido. Solicite uno nuevo desde ¿Olvidaste tu contraseña?."); return; }
    setMode("reset");
    setResetToken(token);
    window.history.replaceState({}, "", "/reset-password");
  }, []);

  useEffect(() => {
    if (!resetToken) return;
    const controller = new AbortController();
    setCheckingReset(true);
    setResetIdentity(null);
    fetch(`${apiBaseUrl}/api/auth/recovery/verify`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: resetToken }), signal: controller.signal,
    }).then(async response => {
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "El enlace no es válido.");
      if (!controller.signal.aborted) setResetIdentity(data.user);
    }).catch(error => {
      if (!controller.signal.aborted) setResetError(error.message || "No se pudo verificar el enlace.");
    }).finally(() => { if (!controller.signal.aborted) setCheckingReset(false); });
    return () => controller.abort();
  }, [resetToken]);

  const credentialsTxt = (credentials: RegisteredCredentials) => `TRIBUX - CREDENCIALES DE ACCESO
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
    link.download = `credenciales-tribux-${credentials.identificacion}.txt`;
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
        throw new Error(data.message || "Credenciales incorrectas.");
      }

      sessionStorage.setItem("sri_token", data.token);
      sessionStorage.setItem("sri_user", JSON.stringify(data.user));

      onLoginSuccess(data.user.ruc);
    } catch (err: any) {
      setError(err.message || "No se pudo conectar con el servidor.");
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotError("");
    setRecoveryAccount(null);
    const identificacion = forgotIdentifier.trim();
    if (!/^(\d{10}|\d{13})$/.test(identificacion)) {
      setForgotError("Ingrese una cédula o RUC válido.");
      return;
    }
    setLoading(true);
    try {
      const response = await fetch(`${apiBaseUrl}/api/auth/recovery/find`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identificacion, ...(resetToken ? { token: resetToken } : {}) }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "No fue posible buscar la cuenta.");
      setRecoveryAccount({ ...data.account, canReset: data.canReset === true, hasEmail: data.hasEmail === true });
      setCodeSent(false); setRecoveryCode(""); setCodeMessage(""); setCaptchaToken(""); setCaptchaVersion(v => v + 1);
      setNuevaClave("");
      setConfirmarNuevaClave("");
    } catch (err: any) {
      setForgotError(err.message || "No fue posible buscar la cuenta.");
    } finally { setLoading(false); }
  };

  const sendRecoveryCode = async () => {
    if (!recoveryAccount || codeLoading) return;
    setForgotError(""); setCodeMessage("");
    if (import.meta.env.VITE_RECAPTCHA_SITE_KEY && !captchaToken) { setForgotError("Complete la verificación reCAPTCHA."); return; }
    setCodeLoading(true);
    try {
      const response = await fetch(`${apiBaseUrl}/api/auth/recovery/send-code`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ identificacion: recoveryAccount.ruc, captchaToken }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "No se pudo enviar el código.");
      setCodeSent(true); setRecoveryCode(""); setCodeMessage(data.message);
    } catch (err: any) { setForgotError(err.message || "No se pudo conectar con el servidor."); }
    finally { setCodeLoading(false); setCaptchaToken(""); setCaptchaVersion(v => v + 1); }
  };

  const confirmRecoveryCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recoveryAccount || codeLoading) return;
    setForgotError("");
    if (!/^\d{6}$/.test(recoveryCode)) { setForgotError("Ingrese el código de seis dígitos recibido por correo."); return; }
    setCodeLoading(true);
    try {
      const response = await fetch(`${apiBaseUrl}/api/auth/recovery/confirm-code`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ identificacion: recoveryAccount.ruc, code: recoveryCode }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "No se pudo verificar el código.");
      setResetToken(data.token); setRecoveryAccount({ ...recoveryAccount, canReset: true });
      setRecoveryCode(""); setCodeMessage("Código verificado. Ingrese su nueva contraseña."); setNuevaClave(""); setConfirmarNuevaClave("");
    } catch (err: any) { setForgotError(err.message || "No se pudo conectar con el servidor."); }
    finally { setCodeLoading(false); }
  };

  const handleAuthorizedRecovery = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotError("");
    if (!recoveryAccount?.canReset || resetLoading) return;
    if (!nuevaClave || !confirmarNuevaClave) { setForgotError("Complete ambos campos de contraseña."); return; }
    if (nuevaClave !== confirmarNuevaClave) { setForgotError("Las contraseñas no coinciden."); return; }
    if (nuevaClave.length < 8 || new TextEncoder().encode(nuevaClave).length > 72) { setForgotError("La contraseña debe tener mínimo 8 caracteres y máximo 72 bytes."); return; }
    setResetLoading(true);
    try {
      const response = await fetch(`${apiBaseUrl}/api/auth/recovery/reset`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identificacion: recoveryAccount.ruc, token: resetToken, nuevaClave, confirmarNuevaClave }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "No se pudo actualizar la contraseña.");
      sessionStorage.removeItem("sri_token");
      sessionStorage.removeItem("sri_user");
      sessionStorage.removeItem("sri_active_contribuyente");
      setResetToken(""); setResetIdentity(null); setCodeSent(false); setCodeMessage("");
      setRuc(recoveryAccount.ruc);
      setClave("");
      setCiAdicional("");
      setNuevaClave("");
      setConfirmarNuevaClave("");
      setRecoveryAccount(null);
      setVerificationMessage("Contraseña actualizada correctamente");
      setMode("login");
    } catch (err: any) { setForgotError(err.message || "No se pudo conectar con el servidor."); }
    finally { setResetLoading(false); }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetError("");

    if (!resetToken || !resetIdentity) {
      setResetError("El enlace de recuperación no contiene un token válido.");
      return;
    }

    if (!nuevaClave || !confirmarNuevaClave) { setResetError("Complete ambos campos de contraseña."); return; }
    if (nuevaClave.length < 8 || new TextEncoder().encode(nuevaClave).length > 72) {
      setResetError("La nueva contraseña debe tener mínimo 8 caracteres y máximo 72 bytes.");
      return;
    }

    if (nuevaClave !== confirmarNuevaClave) {
      setResetError("La confirmación no coincide con la nueva contraseña.");
      return;
    }

    try {
      setResetLoading(true);
      const response = await fetch(`${apiBaseUrl}/api/auth/recovery/reset`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ token: resetToken, nuevaClave, confirmarNuevaClave }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "No se pudo actualizar la contraseña.");
      }

      sessionStorage.removeItem("sri_token");
      sessionStorage.removeItem("sri_user");
      sessionStorage.removeItem("sri_active_contribuyente");
      setRuc(resetIdentity.ruc);
      setClave("");
      setNuevaClave("");
      setConfirmarNuevaClave("");
      setResetToken("");
      setResetIdentity(null);
      window.history.replaceState({}, "", "/");
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
    setRegisterFieldErrors({});
    setRegisterSuccessMessage("");
    setRegisteredCredentials(null);

    const identificacion = registerForm.identificacion.trim();
    const razonSocial = normalizeUppercaseTextForSubmit(registerForm.razonSocial);
    const email = normalizeEmail(registerForm.email);
    const telefono = registerForm.telefono.trim().replace(/\s+/g, " ");
    const expectedLength =
      registerForm.tipoIdentificacion === "CEDULA" ? 10 : 13;
    const fieldErrors: RegisterFieldErrors = {};

    if (!identificacion) {
      fieldErrors.identificacion = "La identificación es obligatoria.";
    } else if (identificacion.length !== expectedLength) {
      fieldErrors.identificacion =
        registerForm.tipoIdentificacion === "CEDULA"
          ? "La cédula debe tener 10 dígitos."
          : "El RUC debe tener 13 dígitos.";
    }

    if (!razonSocial) {
      fieldErrors.razonSocial = "Los nombres o razón social son obligatorios.";
    } else if (razonSocial.length < 3) {
      fieldErrors.razonSocial = "Ingrese nombres o razón social válidos.";
    }

    if (!email) {
      fieldErrors.email = "El correo electrónico es obligatorio.";
    } else if (!isValidEmail(email)) {
      fieldErrors.email = "Ingrese un correo electrónico válido.";
    }

    if (!telefono) {
      fieldErrors.telefono = "El teléfono es obligatorio.";
    } else if (telefono.length < 7) {
      fieldErrors.telefono = "Ingrese un teléfono válido.";
    } else if (telefono.length > 20) {
      fieldErrors.telefono = "El teléfono no puede superar 20 caracteres.";
    }

    if (registerForm.password.length < 8) {
      fieldErrors.password = "La contraseña debe tener mínimo 8 caracteres.";
    }

    if (!registerForm.confirmPassword) {
      fieldErrors.confirmPassword = "Debe confirmar la contraseña.";
    } else if (registerForm.password !== registerForm.confirmPassword) {
      fieldErrors.confirmPassword = "Las contraseñas no coinciden.";
    }

    if (Object.keys(fieldErrors).length > 0) {
      setRegisterFieldErrors(fieldErrors);
      setRegisterError("Revise los campos marcados antes de crear el registro.");
      focusFirstRegisterError(fieldErrors);
      return;
    }

    try {
      setRegisterLoading(true);

      const payload = {
        ...registerForm,
        identificacion,
        razonSocial,
        email,
        telefono,
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
        if (data.fieldErrors) {
          setRegisterFieldErrors(data.fieldErrors);
          focusFirstRegisterError(data.fieldErrors);
        }
        throw new Error(data.message || "No se pudo crear el registro.");
      }

      const credentials = {
        ...payload,
        fechaRegistro: new Date().toLocaleString("es-EC"),
      };

      setRegisteredCredentials(credentials);
      setRegisterSuccessMessage(
        data.message ||
          "Registro creado correctamente. Ya puede iniciar sesión."
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
    <div className="tribux-login" data-mode={mode}>
      <header className="login-header">
        <div className="login-header-brand">
          <Menu size={22} aria-hidden="true" />
          <LoginBrand />
        </div>
        <div className="login-header-icons" aria-hidden="true">
          <HelpCircle size={22} /><Globe size={22} /><span><User size={20} /></span>
        </div>
      </header>
      <main className="login-layout">
        <section className="login-hero" aria-labelledby="login-hero-title">
          <img className="login-photo" src="/images/tribux/login/tributacion-background-approved.png" alt="" width="1672" height="941" />
          <div className="login-hero-content">
            <h2 id="login-hero-title">Tu<br /><span>gestión tributaria</span><br />más simple</h2>
            <span className="login-hero-accent" aria-hidden="true" />
            <p className="login-hero-description">Accede, declara y cumple<br />en un solo lugar.</p>
            <div className="login-features">
              <FeatureCard icon={<FileText size={28} />} title="DECLARAR Y PAGAR" subtitle="Tus impuestos" />
              <FeatureCard icon={<FileText size={28} />} title="FACTURACIÓN ELECTRÓNICA" subtitle="Gratuita" />
              <FeatureCard icon={<ShieldCheck size={28} />} title="RESPONSABILIDAD TRIBUTARIA" subtitle="Información y obligaciones" />
            </div>
          </div>
        </section>
        <section className="login-panel" aria-label="Acceso a Tributación">
          <div className="login-panel-content">
            {mode === "login" ? (
              <>
                <div className="login-form-brand">
                  <LoginBrand />
                </div>
                <h1 className="login-title">Bienvenido</h1>
                <p className="login-subtitle">Inicia sesión con tu RUC o C.I.</p>
                {error && (
                  <div role="alert" className="mt-5 bg-red-500/15 border border-red-400/40 rounded-xl p-3.5 text-sm text-red-100">
                    {error}
                  </div>
                )}

                {verificationMessage && (
                  <div role="status" className="mt-5 bg-emerald-500/15 border border-emerald-400/40 rounded-xl p-3.5 text-sm text-emerald-100">
                    {verificationMessage}
                  </div>
                )}

                <form onSubmit={handleSubmit} className="login-form">
                  <div className="login-field">
                    <label htmlFor="login-identifier">RUC / C.I. / PASAPORTE</label>
                    <div className="login-input">
                      <User size={21} aria-hidden="true" />
                      <input id="login-identifier" name="username" autoComplete="username" inputMode="numeric"
                        placeholder="Ingresa tu identificación" value={ruc}
                        onChange={(e) => setRuc(e.target.value.replace(/\D/g, ""))} maxLength={13} />
                    </div>
                  </div>
                  <div className="login-field">
                    <label htmlFor="login-password">CLAVE DE ACCESO</label>
                    <div className="login-input">
                      <KeyRound size={21} aria-hidden="true" />
                      <input id="login-password" name="password" autoComplete="current-password"
                        placeholder="Ingresa tu clave de acceso" type={showPassword ? "text" : "password"}
                        value={clave} onChange={(e) => setClave(e.target.value)} />
                      <button type="button" onClick={() => setShowPassword(!showPassword)}
                        aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"} aria-pressed={showPassword}>
                        {showPassword ? <EyeOff size={21} /> : <Eye size={21} />}
                      </button>
                    </div>
                  </div>
                  <div className="login-forgot">
                    <button type="button" onClick={() => {
                      setMode("forgot");
                    setForgotIdentifier(ruc.trim());
                    setRecoveryAccount(null);
                    setError("");
                    setForgotError("");
                    

                  }}>¿Olvidaste tu contraseña?</button>
                  </div>
                  <button type="submit" disabled={loading} className="login-submit">
                    <span>{loading ? "Validando..." : "Ingresar"}</span><ChevronRight size={22} aria-hidden="true" />
                  </button>
                </form>
                <div className="login-request">
                  <span>¿No tiene acceso? </span>
                  <button type="button" onClick={() => { setMode("register"); setError(""); }}>Solicitar acceso</button>
                </div>
              </>
            ) : mode === "forgot" ? (
              <>
                <div className="mb-5 flex items-center gap-3 text-xl font-bold">
                  <KeyRound size={22} className="text-[#c9b3ff]" />Recuperar contraseña
                </div>
                {forgotError && <div role="alert" className="mb-5 bg-red-500/15 border border-red-400/40 rounded-xl p-4 text-sm text-red-100">{forgotError}</div>}
                <form onSubmit={handleForgotPassword} className="space-y-5">
                  <div>
                    <label htmlFor="forgot-identifier" className="text-xs font-bold uppercase tracking-wider text-violet-200/90">Cédula o RUC</label>
                    <div className="mt-2 flex items-center bg-white/10 border border-white/15 rounded-xl transition focus-within:border-violet-400">
                      <div className="px-4 flex items-center text-violet-200/80"><User size={18} /></div>
                      <input id="forgot-identifier" inputMode="numeric" maxLength={13} value={forgotIdentifier} disabled={loading || resetLoading || codeLoading}
                        onChange={(e) => { setForgotIdentifier(e.target.value.replace(/\D/g, "")); setForgotError(""); setRecoveryAccount(null); }}
                        className="flex-1 min-w-0 bg-transparent px-3 py-3.5 text-white outline-none placeholder-white/40" autoComplete="username" />
                    </div>
                  </div>
                  <button type="submit" disabled={loading || codeLoading || resetLoading} className="w-full rounded-xl bg-gradient-to-r from-violet-600 to-[#8b5cf6] py-4 font-bold text-white shadow-lg shadow-violet-900/40 transition hover:brightness-110 disabled:opacity-60">{loading ? "Buscando..." : "Buscar"}</button>
                </form>
                {recoveryAccount && <div className="mt-5 space-y-4">
                  <div className="rounded-xl border border-white/15 bg-white/5 p-4 text-sm">
                    <p className="font-semibold">{recoveryAccount.razonSocial}</p>
                    <p className="mt-1 text-white/80">Cédula o RUC: {recoveryAccount.ruc}</p>
                  </div>
                  <p id="recovery-blocked" role="status" className="text-sm text-violet-100">{recoveryAccount.canReset ? "Solicitud autorizada. Puede actualizar su contraseña." : "Para actualizar su contraseña, verifique el código enviado al correo registrado."}</p>
                  {!recoveryAccount.canReset && (recoveryAccount.hasEmail ? <div className="space-y-4">
                    <RecoveryCaptcha key={captchaVersion} onToken={setCaptchaToken} />
                    <button type="button" onClick={sendRecoveryCode} disabled={codeLoading} className="w-full rounded-xl bg-violet-600 py-3 font-bold disabled:opacity-60">{codeLoading ? "Procesando..." : codeSent ? "Reenviar código" : "Enviar código al correo registrado"}</button>
                    {codeSent && <form onSubmit={confirmRecoveryCode} className="space-y-3">
                      <label htmlFor="recovery-code">Código de verificación</label>
                      <input id="recovery-code" value={recoveryCode} onChange={e => setRecoveryCode(e.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" maxLength={6} disabled={codeLoading} className="w-full rounded-xl bg-white/10 px-3 py-3 text-white" />
                      <button type="submit" disabled={codeLoading} className="w-full rounded-xl bg-violet-600 py-3 font-bold disabled:opacity-60">Verificar código</button>
                    </form>}
                  </div> : <p role="status">Esta cuenta no tiene un correo válido registrado. Contacte al administrador para verificar su identidad y actualizar sus datos.</p>)}
                  {codeMessage && <p role="status" className="text-sm text-violet-100">{codeMessage}</p>}
                  <form onSubmit={handleAuthorizedRecovery}><fieldset disabled={!recoveryAccount.canReset || resetLoading} aria-describedby="recovery-blocked" className="space-y-4">
                    <div><label htmlFor="recovery-new-password" className="text-xs font-bold uppercase tracking-wider text-violet-200/90">Nueva contraseña</label>
                      <input id="recovery-new-password" value={nuevaClave} onChange={e => setNuevaClave(e.target.value)} type="password" autoComplete="new-password" className="mt-2 w-full bg-white/10 border border-white/15 rounded-xl px-3 py-3 text-white" /></div>
                    <div><label htmlFor="recovery-confirm-password" className="text-xs font-bold uppercase tracking-wider text-violet-200/90">Confirmar nueva contraseña</label>
                      <input id="recovery-confirm-password" value={confirmarNuevaClave} onChange={e => setConfirmarNuevaClave(e.target.value)} type="password" autoComplete="new-password" className="mt-2 w-full bg-white/10 border border-white/15 rounded-xl px-3 py-3 text-white" /></div>
                    <p className="text-sm text-white/80">Ambas contraseñas deberán coincidir y tener mínimo 8 caracteres y máximo 72 bytes.</p>
                    <button type="submit" className="w-full rounded-xl bg-gradient-to-r from-violet-600 to-[#8b5cf6] py-4 font-bold text-white disabled:opacity-60">{resetLoading ? "Actualizando..." : "Actualizar contraseña"}</button>
                  </fieldset></form>
                </div>}
                <button type="button" disabled={codeLoading || resetLoading} onClick={() => { setMode("login"); setForgotError(""); setRecoveryAccount(null); }} className="w-full mt-5 text-sm font-semibold text-white/85 hover:text-white underline-offset-4 hover:underline transition">Volver al ingreso</button>
              </>
            ) : mode === "reset" ? (
              <>
                <div className="mb-5">
                  <div className="flex items-center gap-3 text-xl font-bold">
                    <KeyRound size={22} className="text-[#c9b3ff]" />
                    Nueva contraseña
                  </div>
                </div>

                {resetError && (
                  <div role="alert" className="mb-5 bg-red-500/15 border border-red-400/40 rounded-xl p-4 text-sm text-red-100">
                    {resetError}
                  </div>
                )}

                {checkingReset && <p role="status" className="mb-5 text-sm">Verificando enlace...</p>}
                {resetIdentity && <div className="mb-5 rounded-xl border border-white/15 bg-white/5 p-4 text-sm"><p>{resetIdentity.razonSocial}</p><p>Cédula o RUC: {resetIdentity.ruc}</p></div>}
                {resetIdentity && <form onSubmit={handleResetPassword} className="space-y-5">
                  <div>
                    <label htmlFor="reset-password" className="text-xs font-bold uppercase tracking-wider text-violet-200/90">
                      Nueva contraseña
                    </label>

                    <div className="mt-2 flex items-center bg-white/10 border border-white/15 rounded-xl overflow-hidden transition focus-within:border-violet-400">
                      <div className="px-4 flex items-center text-violet-200/80">
                        <KeyRound size={18} />
                      </div>

                      <input
                        type={showResetPassword ? "text" : "password"}
                        id="reset-password" value={nuevaClave}
                        onChange={(e) => {
                          setNuevaClave(e.target.value);
                          setResetError("");
                        }}
                        className="flex-1 min-w-0 bg-transparent px-3 py-3.5 text-white outline-none placeholder-white/40"
                        minLength={8}
                        autoComplete="new-password"
                      />

                      <button
                        type="button"
                        onClick={() => setShowResetPassword(!showResetPassword)}
                        className="px-4 text-violet-200/80 hover:text-white transition"
                        aria-label="Mostrar u ocultar nueva contraseña"
                      >
                        {showResetPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label htmlFor="reset-confirm" className="text-xs font-bold uppercase tracking-wider text-violet-200/90">
                      Confirmar nueva contraseña
                    </label>

                    <div className="mt-2 flex items-center bg-white/10 border border-white/15 rounded-xl overflow-hidden transition focus-within:border-violet-400">
                      <div className="px-4 flex items-center text-violet-200/80">
                        <KeyRound size={18} />
                      </div>

                      <input
                        type={showResetPassword ? "text" : "password"}
                        id="reset-confirm" value={confirmarNuevaClave}
                        onChange={(e) => {
                          setConfirmarNuevaClave(e.target.value);
                          setResetError("");
                        }}
                        className="flex-1 min-w-0 bg-transparent px-3 py-3.5 text-white outline-none placeholder-white/40"
                        minLength={8}
                        autoComplete="new-password"
                      />
                    </div>
                  </div>

                  <button
                    disabled={resetLoading}
                    className="w-full rounded-xl bg-gradient-to-r from-violet-600 to-[#8b5cf6] py-4 font-bold text-white shadow-lg shadow-violet-900/40 transition hover:brightness-110 disabled:opacity-60"
                  >
                    {resetLoading ? "Actualizando..." : "Actualizar contraseña"}
                  </button>
                </form>}

                <button
                  type="button"
                  onClick={() => {
                    setMode("login");
                    setResetError("");
                    setResetToken("");
                    setResetIdentity(null);
                    window.history.replaceState({}, "", "/");
                  }}
                  className="w-full mt-5 text-sm font-semibold text-white/85 hover:text-white underline-offset-4 hover:underline transition"
                >
                  Volver al ingreso
                </button>
              </>
            ) : (
              <>
                <div className="register-heading mb-5">
                  <div className="flex items-center gap-3 text-xl font-bold">
                    <UserPlus size={22} className="text-[#c9b3ff]" />
                    Solicitar acceso
                  </div>
                </div>

                {registerError && (
                  <div role="alert" className="mb-5 bg-red-500/15 border border-red-400/40 rounded-xl p-4 text-sm text-red-100">
                    {registerError}
                  </div>
                )}

                {registeredCredentials && (
                  <div role="status" className="mb-5 bg-emerald-500/15 border border-emerald-400/40 rounded-xl p-4 text-sm text-emerald-100">
                    {registerSuccessMessage} Descargue y conserve sus credenciales.
                  </div>
                )}

                <form onSubmit={handleRegister} className="register-form space-y-4">
                  <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-xs font-semibold leading-5 text-violet-100/80">
                    <p>* Campos obligatorios</p>
                    <p>Los nombres y datos personales se guardarán en mayúsculas.</p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label htmlFor="register-type" className="text-xs font-bold uppercase tracking-wider text-violet-200/90">
                        * Tipo de identificación
                      </label>
                      <select
                        id="register-type" value={registerForm.tipoIdentificacion}
                        onChange={(e) =>
                          updateRegisterField(
                            "tipoIdentificacion",
                            e.target.value as RegisterForm["tipoIdentificacion"]
                          )
                        }
                        className="mt-2 w-full rounded-xl border border-white/15 bg-white/10 px-4 py-3 text-white outline-none focus:border-violet-400"
                      >
                        <option value="CEDULA" className="text-black">CÉDULA</option>
                        <option value="RUC" className="text-black">RUC</option>
                      </select>
                    </div>

                    <div>
                      <label htmlFor="register-identifier" className="text-xs font-bold uppercase tracking-wider text-violet-200/90">
                        * Número
                      </label>
                      <div className="mt-2 flex items-center bg-white/10 border border-white/15 rounded-xl overflow-hidden transition focus-within:border-violet-400">
                        <div className="bg-white/5 px-3 flex items-center text-violet-200/80">
                          <IdCard size={18} />
                        </div>
                        <input
                          id="register-identifier" ref={identificacionRef}
                          value={registerForm.identificacion}
                          onChange={(e) =>
                            updateRegisterField(
                              "identificacion",
                              e.target.value.replace(/\D/g, "")
                            )
                          }
                          className="flex-1 min-w-0 bg-transparent px-3 py-3 text-white outline-none"
                          maxLength={
                            registerForm.tipoIdentificacion === "CEDULA"
                              ? 10
                              : 13
                          }
                          required
                        />
                      </div>
                      <FieldError message={registerFieldErrors.identificacion} />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="register-name" className="text-xs font-bold uppercase tracking-wider text-violet-200/90">
                      * Nombres completos / Razón social
                    </label>
                    <div className="mt-2 flex items-center bg-white/10 border border-white/15 rounded-xl overflow-hidden transition focus-within:border-violet-400">
                      <div className="bg-white/5 px-3 flex items-center text-violet-200/80">
                        <Building2 size={18} />
                      </div>
                      <input
                        id="register-name" ref={razonSocialRef}
                        value={registerForm.razonSocial}
                        onChange={(e) =>
                          updateRegisterField("razonSocial", e.target.value)
                        }
                        className="flex-1 min-w-0 bg-transparent px-3 py-3 text-white outline-none"
                        required
                      />
                    </div>
                    <FieldError message={registerFieldErrors.razonSocial} />
                  </div>

                  <div>
                    <label htmlFor="register-taxpayer-type" className="text-xs font-bold uppercase tracking-wider text-violet-200/90">
                      * Tipo de contribuyente
                    </label>
                    <select
                      id="register-taxpayer-type" value={registerForm.tipoContribuyente}
                      onChange={(e) =>
                        updateRegisterField(
                          "tipoContribuyente",
                          e.target.value as RegisterForm["tipoContribuyente"]
                        )
                      }
                      className="mt-2 w-full rounded-xl border border-white/15 bg-white/10 px-4 py-3 text-white outline-none focus:border-violet-400"
                    >
                      <option value="PERSONA_NATURAL" className="text-black">PERSONA NATURAL</option>
                      <option value="SOCIEDAD" className="text-black">SOCIEDAD</option>
                    </select>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label htmlFor="register-email" className="text-xs font-bold uppercase tracking-wider text-violet-200/90">
                        * Correo electrónico
                      </label>
                      <div className="mt-2 flex items-center bg-white/10 border border-white/15 rounded-xl overflow-hidden transition focus-within:border-violet-400">
                        <div className="bg-white/5 px-3 flex items-center text-violet-200/80">
                          <Mail size={18} />
                        </div>
                        <input
                          id="register-email" ref={emailRef}
                          type="email"
                          value={registerForm.email}
                          onChange={(e) =>
                            updateRegisterField("email", e.target.value)
                          }
                          className="flex-1 min-w-0 bg-transparent px-3 py-3 text-white outline-none placeholder-white/40"
                          placeholder="nombre@correo.com"
                          required
                        />
                      </div>
                      <FieldError message={registerFieldErrors.email} />
                    </div>

                    <div>
                      <label htmlFor="register-phone" className="text-xs font-bold uppercase tracking-wider text-violet-200/90">
                        * Teléfono / celular
                      </label>
                      <div className="mt-2 flex items-center bg-white/10 border border-white/15 rounded-xl overflow-hidden transition focus-within:border-violet-400">
                        <div className="bg-white/5 px-3 flex items-center text-violet-200/80">
                          <Phone size={18} />
                        </div>
                        <input
                          id="register-phone" ref={telefonoRef}
                          value={registerForm.telefono}
                          onChange={(e) =>
                            updateRegisterField("telefono", e.target.value)
                          }
                          className="flex-1 min-w-0 bg-transparent px-3 py-3 text-white outline-none"
                          required
                        />
                      </div>
                      <FieldError message={registerFieldErrors.telefono} />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label htmlFor="register-password" className="text-xs font-bold uppercase tracking-wider text-violet-200/90">
                        * Contraseña
                      </label>
                      <div className="mt-2 flex items-center bg-white/10 border border-white/15 rounded-xl overflow-hidden transition focus-within:border-violet-400">
                        <div className="bg-white/5 px-3 flex items-center text-violet-200/80">
                          <KeyRound size={18} />
                        </div>
                        <input
                          id="register-password" ref={passwordRef}
                          type={showRegisterPassword ? "text" : "password"}
                          value={registerForm.password}
                          onChange={(e) =>
                            updateRegisterField("password", e.target.value)
                          }
                          className="flex-1 min-w-0 bg-transparent px-3 py-3 text-white outline-none"
                          minLength={8}
                          required
                        />
                      </div>
                      <FieldError message={registerFieldErrors.password} />
                    </div>

                    <div>
                      <label htmlFor="register-confirm" className="text-xs font-bold uppercase tracking-wider text-violet-200/90">
                        * Confirmar contraseña
                      </label>
                      <div className="mt-2 flex items-center bg-white/10 border border-white/15 rounded-xl overflow-hidden transition focus-within:border-violet-400">
                        <div className="bg-white/5 px-3 flex items-center text-violet-200/80" aria-hidden="true">
                          <KeyRound size={18} />
                        </div>
                        <input
                          id="register-confirm" ref={confirmPasswordRef}
                          type={showRegisterPassword ? "text" : "password"}
                          value={registerForm.confirmPassword}
                          onChange={(e) =>
                            updateRegisterField(
                              "confirmPassword",
                              e.target.value
                            )
                          }
                          className="flex-1 min-w-0 bg-transparent px-3 py-3 text-white outline-none"
                          minLength={8}
                          required
                        />
                        <button
                          type="button"
                          onClick={() =>
                            setShowRegisterPassword(!showRegisterPassword)
                          }
                          className="px-3 text-violet-200/80 hover:text-white transition"
                          aria-label="Mostrar u ocultar claves"
                        >
                          {showRegisterPassword ? (
                            <EyeOff size={18} />
                          ) : (
                            <Eye size={18} />
                          )}
                        </button>
                      </div>
                      <FieldError message={registerFieldErrors.confirmPassword} />
                    </div>
                  </div>

                  <button
                    disabled={registerLoading}
                    className="w-full rounded-xl bg-gradient-to-r from-violet-600 to-[#8b5cf6] py-4 font-bold text-white shadow-lg shadow-violet-900/40 transition hover:brightness-110 disabled:opacity-60"
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
                      className="flex items-center justify-center gap-2 bg-gradient-to-r from-violet-600 to-[#8b5cf6] hover:brightness-110 text-white font-bold py-3 rounded-xl transition"
                    >
                      <Download size={18} />
                      Descargar credenciales TXT
                    </button>

                    <button
                      type="button"
                      onClick={goToLoginWithRegisteredUser}
                      className="flex items-center justify-center gap-2 bg-white/10 border border-white/20 hover:bg-white/15 text-white font-bold py-3 rounded-xl transition"
                    >
                      <LogIn size={18} />
                      Iniciar sesión ahora
                    </button>
                  </div>
                )}

                <button
                  type="button"
                  onClick={goToLoginWithRegisteredUser}
                  className="w-full mt-5 text-sm font-semibold text-white/85 hover:text-white underline-offset-4 hover:underline transition"
                >
                  Volver al ingreso
                </button>
              </>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}

function LoginBrand() {
  return (
    <div className="login-brand" aria-label="TRIBUTACIÓN En línea">
      <span className="login-brand-symbol" aria-hidden="true">
        <img src="/images/tribux/login/tributacion-logo-approved.png" alt="" />
      </span>
      <span className="login-brand-text"><strong>TRIBUTACIÓN</strong><span>En línea</span></span>
    </div>
  );
}

function FeatureCard({ icon, title, subtitle }: { icon: ReactNode; title: string; subtitle: string }) {
  return (
    <div className="login-feature">
      <span className="login-feature-icon" aria-hidden="true">{icon}</span>
      <div><h3>{title}</h3><p>{subtitle}</p></div>
      <ChevronRight size={22} aria-hidden="true" />
    </div>
  );
}
function FieldError({ message }: { message?: string }) {
  if (!message) return null;

  return <p className="mt-1 text-xs font-bold text-red-200">{message}</p>;
}
