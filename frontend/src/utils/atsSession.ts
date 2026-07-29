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

function scopedKey(ownerRuc?: string | null) {
  const normalized = String(ownerRuc || "").trim();
  return normalized ? `${LAST_ATS_KEY}:${normalized}` : LAST_ATS_KEY;
}

export function saveLastAtsContribuyente(data: LastAtsContribuyente, ownerRuc?: string | null) {
  const payload = JSON.stringify({
    ...data,
    mes: normalizeMes(data.mes),
  });
  localStorage.setItem(scopedKey(ownerRuc), payload);
  if (!ownerRuc) {
    localStorage.setItem(LAST_ATS_KEY, payload);
  }
}

export function clearLastAtsContribuyente(ownerRuc?: string | null) {
  localStorage.removeItem(scopedKey(ownerRuc));
  if (!ownerRuc) {
    localStorage.removeItem(LAST_ATS_KEY);
  }
}

export function getLastAtsContribuyente(ownerRuc?: string | null): LastAtsContribuyente | null {
  try {
    const raw = localStorage.getItem(scopedKey(ownerRuc)) || (!ownerRuc ? null : localStorage.getItem(LAST_ATS_KEY));
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

export function getLastAtsContribuyenteForPeriod(anio: number, mes: string | number, ownerRuc?: string | null) {
  const lastAts = getLastAtsContribuyente(ownerRuc);
  if (!lastAts) return null;
  return lastAts.anio === Number(anio) && lastAts.mes === normalizeMes(mes) ? lastAts : null;
}
