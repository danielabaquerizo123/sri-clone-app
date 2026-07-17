export type ValidationIssueType = "ERROR" | "WARNING" | "INFO";
export type ValidationIssueSeverity = "CRITICO" | "BLOQUEANTE" | "OBSERVACION" | "INFORMATIVO";

export type ValidationIssue = {
  tipo: ValidationIssueType;
  severidad?: ValidationIssueSeverity;
  codigo?: string;
  hoja?: string;
  fila?: number;
  campo?: string;
  documentoOrigen?: string;
  mensaje: string;
};
