type PeriodBadgeProps = {
  children: React.ReactNode;
};

export default function PeriodBadge({ children }: PeriodBadgeProps) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        boxSizing: "border-box",
        minHeight: 22,
        padding: "3px 10px",
        borderRadius: 9999,
        background: "#dbeafe",
        color: "#1e40af",
        border: "1px solid rgba(59,130,246,0.18)",
        fontSize: 11,
        fontWeight: 600,
        lineHeight: 1,
        letterSpacing: "0.03em",
        whiteSpace: "nowrap",
        verticalAlign: "baseline",
      }}
    >
      {children}
    </span>
  );
}
