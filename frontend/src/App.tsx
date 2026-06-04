import { useState, useEffect } from "react";
import LoginView from "./views/Login";
import DashboardView from "./views/DashboardView";

type ActiveContribuyente = {
  ruc: string;
  razonSocial: string;
};

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userRuc, setUserRuc] = useState("");
  const [userRazonSocial, setUserRazonSocial] = useState("");
  const [activeContribuyente, setActiveContribuyente] = useState<ActiveContribuyente | null>(null);

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
    setActiveContribuyente(null);
  };

  // 4. RENDERIZADO: Si no está autenticado, muestra el Login
  if (!isAuthenticated) {
    return <LoginView onLoginSuccess={handleLoginSuccess} />;
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
