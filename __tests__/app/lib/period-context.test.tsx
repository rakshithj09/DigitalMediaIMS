import React from "react";
import { render, screen, act } from "@testing-library/react";
import { PeriodProvider, usePeriod } from "@/app/lib/period-context";

// Helper that exposes the context values to the DOM for assertions
function PeriodDisplay() {
  const { period, setPeriod } = usePeriod();
  return (
    <div>
      <span data-testid="period">{period}</span>
      <button onClick={() => setPeriod("PM")}>Set PM</button>
      <button onClick={() => setPeriod("AM")}>Set AM</button>
    </div>
  );
}

describe("PeriodProvider", () => {
  beforeEach(() => {
    localStorage.clear();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
    localStorage.clear();
  });

  it("renders its children", () => {
    render(
      <PeriodProvider>
        <span>child content</span>
      </PeriodProvider>
    );
    expect(screen.getByText("child content")).toBeInTheDocument();
  });

  it("provides AM as the default period", () => {
    render(
      <PeriodProvider>
        <PeriodDisplay />
      </PeriodProvider>
    );
    expect(screen.getByTestId("period").textContent).toBe("AM");
  });

  it("updates the period when setPeriod is called", () => {
    render(
      <PeriodProvider>
        <PeriodDisplay />
      </PeriodProvider>
    );
    act(() => {
      screen.getByText("Set PM").click();
    });
    expect(screen.getByTestId("period").textContent).toBe("PM");
  });

  it("persists the selected period to localStorage", () => {
    render(
      <PeriodProvider>
        <PeriodDisplay />
      </PeriodProvider>
    );
    act(() => {
      screen.getByText("Set PM").click();
    });
    expect(localStorage.getItem("ims_period")).toBe("PM");
  });

  it("reads a valid period from localStorage on mount", () => {
    localStorage.setItem("ims_period", "PM");
    render(
      <PeriodProvider>
        <PeriodDisplay />
      </PeriodProvider>
    );
    act(() => {
      jest.runAllTimers(); // flush the deferred setTimeout
    });
    expect(screen.getByTestId("period").textContent).toBe("PM");
  });

  it("ignores an invalid value stored in localStorage", () => {
    localStorage.setItem("ims_period", "INVALID");
    render(
      <PeriodProvider>
        <PeriodDisplay />
      </PeriodProvider>
    );
    act(() => {
      jest.runAllTimers();
    });
    expect(screen.getByTestId("period").textContent).toBe("AM");
  });

  it("can toggle from PM back to AM", () => {
    localStorage.setItem("ims_period", "PM");
    render(
      <PeriodProvider>
        <PeriodDisplay />
      </PeriodProvider>
    );
    act(() => jest.runAllTimers());
    expect(screen.getByTestId("period").textContent).toBe("PM");

    act(() => {
      screen.getByText("Set AM").click();
    });
    expect(screen.getByTestId("period").textContent).toBe("AM");
    expect(localStorage.getItem("ims_period")).toBe("AM");
  });
});

describe("usePeriod outside a PeriodProvider", () => {
  it("returns the default AM period from the context default value", () => {
    function Standalone() {
      const { period } = usePeriod();
      return <span data-testid="period">{period}</span>;
    }
    render(<Standalone />);
    expect(screen.getByTestId("period").textContent).toBe("AM");
  });
});
