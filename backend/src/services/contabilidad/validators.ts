export function requireExcelBuffer(buffer: Buffer | undefined): Buffer {
  if (!buffer || buffer.length === 0) {
    throw new Error("Debe subir un archivo ATS en formato Excel.");
  }

  return buffer;
}

export function requireOriginalFilename(filename: string | undefined): string {
  const value = String(filename || "").trim();

  if (!value) {
    throw new Error("El archivo ATS no tiene nombre válido.");
  }

  return value;
}
