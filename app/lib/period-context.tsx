"use client";

import { createContext, useContext, useState, ReactNode } from "react";
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
  // Initialize from localStorage using lazy initializer to avoid setting state inside an effect
  const [period, setPeriodState] = useState<Period>(() => {
    try {
      if (typeof window === "undefined") return "AM";
      const stored = localStorage.getItem("ims_period") as Period | null;
      if (stored === "AM" || stored === "PM") return stored;
    } catch {
      // If any error (e.g., access denied), fall back to default
    }
    return "AM";
  });

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
