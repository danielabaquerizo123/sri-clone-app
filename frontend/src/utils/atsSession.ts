export type LastAtsContribuyente = {
  ruc: string;
  razonSocial: string;
  anio: number;
  mes: string;
  loteId: string;
};

const LAST_ATS_KEY = "sri_last_ats_contribuyente";

function normalizeMes(mes: string | number | undefined) {
  return String(mes || "").padStart(2, "0");
}

export function saveLastAtsContribuyente(data: LastAtsContribuyente) {
  localStorage.setItem(
    LAST_ATS_KEY,
    JSON.stringify({
      ...data,
      mes: normalizeMes(data.mes),
    })
  );
}

export function getLastAtsContribuyente(): LastAtsContribuyente | null {
  try {
    const raw = localStorage.getItem(LAST_ATS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<LastAtsContribuyente>;
    if (!parsed.ruc || !parsed.razonSocial || !parsed.anio || !parsed.mes || !parsed.loteId) {
      return null;
    }

    return {
      ruc: parsed.ruc,
      razonSocial: parsed.razonSocial,
      anio: Number(parsed.anio),
      mes: normalizeMes(parsed.mes),
      loteId: parsed.loteId,
    };
  } catch {
    return null;
  }
}

export function getLastAtsContribuyenteForPeriod(anio: number, mes: string | number) {
  const lastAts = getLastAtsContribuyente();
  if (!lastAts) return null;
  return lastAts.anio === Number(anio) && lastAts.mes === normalizeMes(mes) ? lastAts : null;
}
