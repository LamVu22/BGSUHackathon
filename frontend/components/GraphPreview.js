const sampleNodes = [
  { id: 1, label: "Admissions", level: 1 },
  { id: 2, label: "Financial Aid", level: 2 },
  { id: 3, label: "Scholarships", level: 3 },
  { id: 4, label: "Campus Life", level: 2 },
];

const sampleEdges = [
  [1, 2],
  [2, 3],
  [1, 4],
];

export default function GraphPreview() {
  return (
    <div className="bg-base-100 border border-base-200 rounded-2xl p-6 h-full shadow-inner transition-all duration-200 hover:shadow-2xl hover:border-primary/40">
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-xs uppercase tracking-widest text-secondary">Graph context</p>
          <p className="text-lg font-semibold">Link neighborhood</p>
        </div>
        <button className="btn btn-xs btn-outline hover:btn-primary transition-colors duration-200">Expand</button>
      </div>
      <div className="grid grid-cols-2 gap-4">
        {sampleNodes.map((node) => (
          <div
            key={node.id}
            className="p-3 rounded-xl border border-dashed border-primary/30 flex flex-col gap-1 transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/60 hover:bg-primary/5"
          >
            <span className="text-xs text-secondary">Depth {node.level}</span>
            <span className="font-medium text-sm">{node.label}</span>
          </div>
        ))}
      </div>
      <div className="mt-6">
        <p className="text-xs text-base-content/60">
          {sampleEdges.length} edges highlight how evidence flows into the summary.
        </p>
      </div>
    </div>
  );
}
