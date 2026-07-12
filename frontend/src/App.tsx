import { useState, useEffect } from "react";
import LoginView from "./views/Login";
import DashboardView from "./views/DashboardView";
import AdminView from "./views/AdminView";
import AccessBlockedView from "./components/Auth/AccessBlockedView";
import {
  ACCESS_BLOCKED_EVENT,
  type AccessBlockedReason,
} from "./api/authApi";

type ActiveContribuyente = {
  ruc: string;
  razonSocial: string;
};

type Rol = "ADMIN" | "CONTADOR" | "CONTRIBUYENTE";

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userRuc, setUserRuc] = useState("");
  const [userRazonSocial, setUserRazonSocial] = useState("");
  const [userRol, setUserRol] = useState<Rol>("CONTRIBUYENTE");
  const [adminMode, setAdminMode] = useState(false);
  const [accessBlockedReason, setAccessBlockedReason] =
    useState<AccessBlockedReason | null>(null);
  const [activeContribuyente, setActiveContribuyente] = useState<ActiveContribuyente | null>(null);

  useEffect(() => {
    const handleAccessBlocked = (event: Event) => {
      const reason = (event as CustomEvent<{ reason: AccessBlockedReason }>)
        .detail?.reason;

      if (reason === "expired" || reason === "disabled") {
        setAccessBlockedReason(reason);
      }
    };

    window.addEventListener(ACCESS_BLOCKED_EVENT, handleAccessBlocked);

    return () => {
      window.removeEventListener(ACCESS_BLOCKED_EVENT, handleAccessBlocked);
    };
  }, []);

  // 1. ESTO ES NUEVO: Verifica si ya habías iniciado sesión antes (para que no te saque al presionar F5)
  useEffect(() => {
    const user = localStorage.getItem("sri_user");
    if (user) {
      const parsedUser = JSON.parse(user);
      const storedActive = localStorage.getItem("sri_active_contribuyente");
      const parsedActive = storedActive ? JSON.parse(storedActive) : null;
      const activeFromSession =
        parsedActive?.ruc === parsedUser.ruc
          ? parsedActive
          : {
              ruc: parsedUser.ruc,
              razonSocial: parsedUser.razonSocial || parsedUser.ruc,
            };
      setUserRuc(parsedUser.ruc);
      setUserRazonSocial(parsedUser.razonSocial || parsedUser.ruc);
      setUserRol(parsedUser.rol || "CONTRIBUYENTE");
      setAdminMode(parsedUser.rol === "ADMIN");
      setActiveContribuyente(activeFromSession);
      localStorage.setItem("sri_active_contribuyente", JSON.stringify(activeFromSession));
      setIsAuthenticated(true);
    }
  }, []);

  // 2. TU MISMA FUNCIÓN INTACTA: Maneja el inicio de sesión exitoso
  const handleLoginSuccess = (ruc: string) => {
    const user = localStorage.getItem("sri_user");
    const parsedUser = user ? JSON.parse(user) : null;
    const active = {
      ruc,
      razonSocial: parsedUser?.razonSocial || ruc,
    };
    setIsAuthenticated(true);
    setUserRuc(ruc);
    setUserRazonSocial(parsedUser?.razonSocial || ruc);
    setUserRol(parsedUser?.rol || "CONTRIBUYENTE");
    setAdminMode(parsedUser?.rol === "ADMIN");
    setAccessBlockedReason(null);
    setActiveContribuyente(active);
    localStorage.setItem("sri_active_contribuyente", JSON.stringify(active));
  };

  // 3. NUEVA FUNCIÓN: Limpia la memoria del navegador al salir
  const handleLogout = () => {
    localStorage.removeItem("sri_token");
    localStorage.removeItem("sri_user");
    localStorage.removeItem("sri_active_contribuyente");
    setIsAuthenticated(false);
    setUserRuc("");
    setUserRazonSocial("");
    setUserRol("CONTRIBUYENTE");
    setAdminMode(false);
    setAccessBlockedReason(null);
    setActiveContribuyente(null);
  };

  // 4. RENDERIZADO: Si no está autenticado, muestra el Login
  if (!isAuthenticated) {
    return <LoginView onLoginSuccess={handleLoginSuccess} />;
  }

  if (accessBlockedReason) {
    return (
      <AccessBlockedView
        reason={accessBlockedReason}
        onBackToLogin={handleLogout}
      />
    );
  }

  if (userRol === "ADMIN" && adminMode) {
    return (
      <AdminView
        userRuc={userRuc}
        userRazonSocial={userRazonSocial || userRuc}
        onLogout={handleLogout}
        onOpenContable={() => setAdminMode(false)}
      />
    );
  }

  // 5. EL CAMBIO PRINCIPAL: En lugar de tu texto de prueba, ahora carga el Dashboard real que construimos
  return (
    <DashboardView
      rucUsuario={userRuc}
      razonSocialUsuario={userRazonSocial || userRuc}
      activeContribuyente={activeContribuyente || { ruc: userRuc, razonSocial: userRuc }}
      onLogout={handleLogout}
    />
  );
}
