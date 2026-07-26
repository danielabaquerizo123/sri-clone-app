export function obtenerIniciales(nombres?: string | null, apellidos?: string | null) {
  const tokens = `${nombres || ""} ${apellidos || ""}`
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (tokens.length === 0) return "";

  if (tokens.length === 1) {
    return tokens[0].slice(0, 2).toLocaleUpperCase("es");
  }

  return `${tokens[0][0]}${tokens[tokens.length - 1][0]}`.toLocaleUpperCase("es");
}
