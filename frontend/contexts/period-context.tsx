"use client";

import { createContext, useContext, useMemo, useState } from "react";

interface PeriodValue {
  /** YYYY-MM the whole app is looking at; empty means now. */
  month: string;
  setMonth: (month: string) => void;
}

const PeriodContext = createContext<PeriodValue>({ month: "", setMonth: () => {} });
export const usePeriod = () => useContext(PeriodContext);

/** The period picked anywhere (dashboard, registers, heat map) carries to every table until it is changed or the page reloads. */
export function PeriodProvider({ children }: { children: React.ReactNode }) {
  const [month, setMonth] = useState("");
  const value = useMemo(() => ({ month, setMonth }), [month]);
  return <PeriodContext.Provider value={value}>{children}</PeriodContext.Provider>;
}
