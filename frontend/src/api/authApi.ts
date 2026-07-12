export const getAuthToken = () => localStorage.getItem("sri_token");

export type AccessBlockedReason = "expired" | "disabled";

type AccessBlockedCode = "ACCESS_EXPIRED" | "ACCESS_DISABLED";

export const ACCESS_BLOCKED_EVENT = "sri:access-blocked";

const accessCodeToReason: Record<AccessBlockedCode, AccessBlockedReason> = {
  ACCESS_EXPIRED: "expired",
  ACCESS_DISABLED: "disabled",
};

const isAccessBlockedCode = (value: unknown): value is AccessBlockedCode =>
  value === "ACCESS_EXPIRED" || value === "ACCESS_DISABLED";

const notifyAccessBlocked = (reason: AccessBlockedReason) => {
  if (typeof window === "undefined") return;

  window.dispatchEvent(
    new CustomEvent(ACCESS_BLOCKED_EVENT, {
      detail: { reason },
    })
  );
};

const detectAccessBlocked = async (response: Response) => {
  if (response.status !== 401 && response.status !== 403) return;

  try {
    const data = await response.clone().json();
    const code = data?.code;

    if (isAccessBlockedCode(code)) {
      notifyAccessBlocked(accessCodeToReason[code]);
    }
  } catch {
    // Responses such as file downloads are not guaranteed to be JSON.
  }
};

export const authFetch = async (
  input: RequestInfo | URL,
  init: RequestInit = {}
) => {
  const token = getAuthToken();
  const headers = new Headers(init.headers);

  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(input, {
    ...init,
    headers,
  });

  await detectAccessBlocked(response);

  return response;
};
