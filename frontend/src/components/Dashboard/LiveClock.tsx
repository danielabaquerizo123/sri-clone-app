import { useEffect, useMemo, useState } from "react";

const TIME_ZONE = "America/Guayaquil";

export default function LiveClock() {
  const [currentDate, setCurrentDate] = useState(() => new Date());

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setCurrentDate(new Date());
    }, 1000);

    return () => window.clearInterval(intervalId);
  }, []);

  const formatted = useMemo(() => {
    const dateLong = new Intl.DateTimeFormat("es-EC", {
      day: "2-digit",
      month: "long",
      timeZone: TIME_ZONE,
      year: "numeric",
    }).format(currentDate);

    const dateShort = new Intl.DateTimeFormat("es-EC", {
      day: "2-digit",
      month: "2-digit",
      timeZone: TIME_ZONE,
      year: "2-digit",
    }).format(currentDate);

    const time = new Intl.DateTimeFormat("es-EC", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      timeZone: TIME_ZONE,
    }).format(currentDate);

    return { dateLong, dateShort, time };
  }, [currentDate]);

  return (
    <time
      dateTime={currentDate.toISOString()}
      title={`${formatted.dateLong} ${formatted.time}`}
      className="hidden min-w-[86px] max-w-[170px] rounded-2xl bg-slate-50 px-3 py-2 text-right leading-tight text-slate-600 md:block xl:min-w-[150px]"
    >
      <span className="hidden text-[11px] font-bold capitalize text-slate-500 xl:block">
        {formatted.dateLong}
      </span>
      <span className="hidden text-[11px] font-bold text-slate-500 md:block xl:hidden">
        {formatted.dateShort}
      </span>
      <span className="font-mono text-sm font-black text-[#082b68]">
        {formatted.time}
      </span>
    </time>
  );
}
