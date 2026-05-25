import { useState, useEffect } from "react";
import LoginView from "./views/Login";
import DashboardView from "./views/DashboardView";

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userRuc, setUserRuc] = useState("");

  // 1. ESTO ES NUEVO: Verifica si ya habías iniciado sesión antes (para que no te saque al presionar F5)
  useEffect(() => {
    const user = localStorage.getItem("sri_user");
    if (user) {
      const parsedUser = JSON.parse(user);
      setUserRuc(parsedUser.ruc);
      setIsAuthenticated(true);
    }
  }, []);

  // 2. TU MISMA FUNCIÓN INTACTA: Maneja el inicio de sesión exitoso
  const handleLoginSuccess = (ruc: string) => {
    setIsAuthenticated(true);
    setUserRuc(ruc);
  };

  // 3. NUEVA FUNCIÓN: Limpia la memoria del navegador al salir
  const handleLogout = () => {
    localStorage.removeItem("sri_token");
    localStorage.removeItem("sri_user");
    setIsAuthenticated(false);
    setUserRuc("");
  };

  // 4. RENDERIZADO: Si no está autenticado, muestra el Login
  if (!isAuthenticated) {
    return <LoginView onLoginSuccess={handleLoginSuccess} />;
  }

  // 5. EL CAMBIO PRINCIPAL: En lugar de tu texto de prueba, ahora carga el Dashboard real que construimos
  return <DashboardView rucUsuario={userRuc} onLogout={handleLogout} />;
}
