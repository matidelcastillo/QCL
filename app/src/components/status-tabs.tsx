import type { BookStatus } from "@/lib/types";
import { statusLabel } from "@/lib/format";

type Filter = "todos" | BookStatus;

const options: { id: Filter; label: string }[] = [
  { id: "todos", label: "Todos" },
  { id: "quiero", label: statusLabel("quiero") },
  { id: "lei", label: statusLabel("lei") },
];

export function StatusTabs({
  value,
  onChange,
}: {
  value: Filter;
  onChange: (value: Filter) => void;
}) {
  return (
    <div className="qc-filter-tabs qcl-filter-tabs">
      <div className="qc-filter-tab-list qcl-filter-tab-list">
        {options.map((option) => {
          const active = option.id === value;
          return (
            <button
              key={option.id}
              type="button"
              className="qc-filter-tab qcl-filter-tab"
              data-active={active ? "true" : "false"}
              aria-pressed={active}
              onClick={() => onChange(option.id)}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function StatusChoice({
  value,
  onChange,
}: {
  value: BookStatus;
  onChange: (value: BookStatus) => void;
}) {
  return (
    <div className="drawer-choice-dock qcl-status-choice">
      <button
        type="button"
        className={`drawer-choice${value === "quiero" ? " drawer-choice-active" : ""}`}
        aria-pressed={value === "quiero"}
        onClick={() => onChange("quiero")}
      >
        Quiero
      </button>
      <button
        type="button"
        className={`drawer-choice${value === "lei" ? " drawer-choice-active" : ""}`}
        aria-pressed={value === "lei"}
        onClick={() => onChange("lei")}
      >
        Leí
      </button>
    </div>
  );
}
