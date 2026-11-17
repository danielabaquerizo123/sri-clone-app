import { useEffect, useRef } from "react";

type CaptchaApi = { render: (element: HTMLElement, options: Record<string, unknown>) => number; reset: (id: number) => void };
export default function RecoveryCaptcha({ onToken }: { onToken: (token: string) => void }) {
  const container = useRef<HTMLDivElement>(null);
  const sitekey = import.meta.env.VITE_RECAPTCHA_SITE_KEY;
  useEffect(() => {
    if (!sitekey) return;
    const api = () => (window as unknown as { grecaptcha?: CaptchaApi }).grecaptcha;
    if (!document.getElementById("recovery-recaptcha-script")) {
      const script = document.createElement("script"); script.id = "recovery-recaptcha-script";
      script.src = "https://www.google.com/recaptcha/api.js?render=explicit&hl=es"; script.async = true; script.defer = true;
      document.head.appendChild(script);
    }
    let widget: number | undefined;
    const timer = window.setInterval(() => {
      if (widget !== undefined || !container.current || !api()?.render) return;
      widget = api()!.render(container.current, { sitekey, callback: onToken, "expired-callback": () => onToken(""), "error-callback": () => onToken("") });
    }, 100);
    return () => { window.clearInterval(timer); if (widget !== undefined) api()?.reset(widget); };
  }, [sitekey, onToken]);
  return sitekey ? <div ref={container} aria-label="Verificación reCAPTCHA" /> : null;
}
