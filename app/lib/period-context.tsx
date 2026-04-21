"use client";

import { createContext, useContext, useState, ReactNode, useEffect } from "react";
import { Period } from "./types";

interface PeriodContextType {
  period: Period;
  setPeriod: (p: Period) => void;
}

const PeriodContext = createContext<PeriodContextType>({
  period: "AM",
  setPeriod: () => {},
});

export function PeriodProvider({ children }: { children: ReactNode }) {
  // Start with the server-safe default so server and initial client render match.
  // After the component mounts, read localStorage and update the period if needed.
  const [period, setPeriodState] = useState<Period>("AM");

  // Read the persisted period only on the client after mount to avoid
  // server/client rendering differences (hydration mismatch).
  useEffect(() => {
    try {
      const stored = localStorage.getItem("ims_period") as Period | null;
      // Defer the state update to avoid synchronous setState inside the effect
      // which some linters treat as problematic for cascading renders.
      if (stored === "AM" || stored === "PM") {
        setTimeout(() => setPeriodState(stored), 0);
      }
    } catch {
      // ignore
    }
  }, []);

  const setPeriod = (p: Period) => {
    setPeriodState(p);
    localStorage.setItem("ims_period", p);
  };

  return (
    <PeriodContext.Provider value={{ period, setPeriod }}>
      {children}
    </PeriodContext.Provider>
  );
}

export function usePeriod() {
  return useContext(PeriodContext);
}
