import {
  BadgeCheck,
  Calculator,
  FileSpreadsheet,
  FileText,
  FolderKanban,
  Home,
  Layers,
  Pencil,
  Printer,
  RefreshCcw,
  Search,
} from "lucide-react";
import type { ReactNode } from "react";
import type { OpcionesRuc } from "../../views/DashboardView";

export interface NavigationRegistryItem {
  id: string;
  titulo: string;
  descripcion: string;
  palabrasClave: string[];
  tab: string;
  icono: ReactNode;
  enabled: boolean;
  principal?: boolean;
}

export function getNavigationItems(opcionesRuc: OpcionesRuc | null): NavigationRegistryItem[] {
  return [
    {
      id: "inicio",
      titulo: "Inicio",
      descripcion: "Panel principal del contribuyente",
      palabrasClave: ["dashboard", "resumen", "portal"],
      tab: "inicio",
      icono: <Home size={17} />,
      enabled: true,
      principal: true,
    },
    {
      id: "ruc_inscripcion",
      titulo: "Inscripcion RUC",
      descripcion: "Vista formal de registro tributario",
      palabrasClave: ["ruc", "registro", "inscripcion"],
      tab: "ruc_inscripcion",
      icono: <Search size={17} />,
      enabled: !!opcionesRuc?.inscripcion,
    },
    {
      id: "ruc_actualizacion",
      titulo: "Actualizacion RUC",
      descripcion: "Editar informacion del contribuyente",
      palabrasClave: ["ruc", "actualizar", "perfil", "datos"],
      tab: "ruc_actualizacion",
      icono: <Pencil size={17} />,
      enabled: !!opcionesRuc?.actualizacion,
      principal: true,
    },
    {
      id: "ruc_reapertura",
      titulo: "Reapertura RUC",
      descripcion: "Solicitud de reapertura del RUC",
      palabrasClave: ["ruc", "reabrir", "reactivar"],
      tab: "ruc_reapertura",
      icono: <RefreshCcw size={17} />,
      enabled: !!opcionesRuc?.reapertura,
    },
    {
      id: "ruc_reimpresion",
      titulo: "Reimpresion RUC",
      descripcion: "Descargar certificado RUC",
      palabrasClave: ["ruc", "certificado", "descargar", "perfil"],
      tab: "ruc_reimpresion",
      icono: <Printer size={17} />,
      enabled: !!opcionesRuc?.reimpresion,
      principal: true,
    },
    {
      id: "declaracion_elaboracion",
      titulo: "Declaraciones",
      descripcion: "Elaboracion y envio de declaraciones",
      palabrasClave: ["declarar", "nueva declaracion", "envio"],
      tab: "declaracion_elaboracion",
      icono: <FileSpreadsheet size={17} />,
      enabled: true,
      principal: true,
    },
    {
      id: "declaracion_consulta",
      titulo: "Consultar declaraciones",
      descripcion: "Historial de declaraciones enviadas",
      palabrasClave: ["declaraciones", "consulta", "historial"],
      tab: "declaracion_consulta",
      icono: <Search size={17} />,
      enabled: true,
      principal: true,
    },
    {
      id: "declaracion_103",
      titulo: "Formulario 103",
      descripcion: "Retenciones en la fuente",
      palabrasClave: ["103", "retenciones", "formulario"],
      tab: "declaracion_103",
      icono: <FileText size={17} />,
      enabled: true,
    },
    {
      id: "declaracion_104",
      titulo: "Formulario 104",
      descripcion: "Declaracion de IVA",
      palabrasClave: ["104", "iva", "formulario"],
      tab: "declaracion_104",
      icono: <FileSpreadsheet size={17} />,
      enabled: true,
    },
    {
      id: "anexo_ats",
      titulo: "ATS",
      descripcion: "Anexo transaccional simplificado",
      palabrasClave: ["anexo", "ats", "transaccional"],
      tab: "anexo_ats",
      icono: <FolderKanban size={17} />,
      enabled: true,
      principal: true,
    },
    {
      id: "anexo_envio",
      titulo: "Envio y consulta de anexos",
      descripcion: "Gestion de anexos enviados",
      palabrasClave: ["anexos", "consulta", "envio"],
      tab: "anexo_envio",
      icono: <FolderKanban size={17} />,
      enabled: true,
    },
    {
      id: "anexo_beneficiario",
      titulo: "Beneficiario pension",
      descripcion: "Registro de beneficiario de pension",
      palabrasClave: ["beneficiario", "pension", "anexo"],
      tab: "anexo_beneficiario",
      icono: <BadgeCheck size={17} />,
      enabled: true,
    },
    {
      id: "anexo_cargas_2023",
      titulo: "Cargas desde 2023",
      descripcion: "Registro de cargas familiares",
      palabrasClave: ["cargas", "familiares", "anexo"],
      tab: "anexo_cargas_2023",
      icono: <Layers size={17} />,
      enabled: true,
    },
    {
      id: "contabilidad",
      titulo: "Contabilidad",
      descripcion: "Libro Diario, Libro Mayor y balances",
      palabrasClave: ["libro diario", "diario", "libro mayor", "mayor", "balance", "estado resultados"],
      tab: "contabilidad",
      icono: <Calculator size={17} />,
      enabled: true,
      principal: true,
    },
  ];
}

export function getSectionTitleFromRegistry(activeTab: string, opcionesRuc: OpcionesRuc | null) {
  return getNavigationItems(opcionesRuc).find((item) => item.tab === activeTab)?.titulo || "Portal transaccional";
}
