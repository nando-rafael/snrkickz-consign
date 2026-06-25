"use client";

type Props = {
  totalCount: number;
  selectedCount: number;
  allSelected: boolean;
  onSelectAll: (checked: boolean) => void;
  onBulkDelist: () => void;
  onBulkPriceEdit: () => void;
  loading?: boolean;
};

export default function BulkListingsToolbar({
  totalCount,
  selectedCount,
  allSelected,
  onSelectAll,
  onBulkDelist,
  onBulkPriceEdit,
  loading = false,
}: Props) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "10px 14px",
        background: "var(--card)",
        border: "1px solid var(--border)",
        borderRadius: 8,
        marginBottom: 12,
        flexWrap: "wrap",
      }}
    >
      <label
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          cursor: "pointer",
          fontSize: 13,
          fontWeight: 600,
          color: "var(--fg)",
          userSelect: "none",
        }}
      >
        <input
          type="checkbox"
          checked={allSelected && totalCount > 0}
          ref={(el) => {
            if (el) el.indeterminate = selectedCount > 0 && !allSelected;
          }}
          onChange={(e) => onSelectAll(e.target.checked)}
          disabled={loading || totalCount === 0}
          style={{ width: 16, height: 16, cursor: "pointer" }}
        />
        Alles selecteren
      </label>

      <span
        style={{
          fontSize: 13,
          color: selectedCount > 0 ? "var(--fg)" : "var(--muted)",
          fontWeight: selectedCount > 0 ? 600 : 400,
        }}
      >
        {selectedCount > 0
          ? `${selectedCount} geselecteerd`
          : "Geen selectie"}
      </span>

      {selectedCount > 0 && (
        <>
          <button
            className="btn sm"
            type="button"
            disabled={loading}
            onClick={onBulkPriceEdit}
            style={{
              background: "rgba(59,130,246,0.15)",
              color: "#60a5fa",
              marginLeft: "auto",
            }}
          >
            {loading ? "Bezig…" : `Prijs aanpassen (${selectedCount})`}
          </button>
          <button
            className="btn danger sm"
            type="button"
            disabled={loading}
            onClick={onBulkDelist}
          >
            {loading ? "Bezig…" : `Delist (${selectedCount})`}
          </button>
        </>
      )}
    </div>
  );
}
