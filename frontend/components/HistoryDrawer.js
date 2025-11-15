export default function HistoryDrawer({ open, history, onSelect, onClose, onClear }) {
  return (
    <aside
      className={`fixed top-28 right-4 w-72 max-w-[90vw] bg-base-100 border border-base-300 rounded-2xl shadow-2xl transition-transform duration-300 z-20 ${
        open ? "translate-x-0 opacity-100" : "translate-x-full opacity-0 pointer-events-none"
      }`}
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-base-200">
        <div>
          <p className="text-xs uppercase tracking-[0.4em] text-base-content/60">History</p>
          <p className="text-sm font-semibold">Recent queries</p>
        </div>
        <div className="flex items-center gap-2">
          {history.length > 0 && (
            <button className="btn btn-ghost btn-xs text-error" onClick={onClear}>
              Clear
            </button>
          )}
          <button className="btn btn-xs btn-ghost" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
      <div className="max-h-80 overflow-y-auto px-4 py-3">
        {history.length === 0 ? (
          <p className="text-xs text-base-content/60">No searches yet. Start asking!</p>
        ) : (
          <ul className="space-y-3">
            {history.map((entry) => (
              <li
                key={entry.id}
                className="p-3 rounded-xl border border-base-200 bg-base-200/40 flex flex-col gap-1"
              >
                <p className="text-sm font-medium text-base-content/90 truncate">{entry.query}</p>
                <div className="flex items-center justify-between text-xs text-base-content/60">
                  <span>{entry.timestamp}</span>
                  <button
                    type="button"
                    className="btn btn-xs btn-primary text-white"
                    onClick={() => onSelect(entry.query)}
                  >
                    Re-run
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </aside>
  );
}
