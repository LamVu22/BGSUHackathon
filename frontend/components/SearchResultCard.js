const iconForUrl = (url = "") => {
  if (url.endsWith(".pdf")) return "📄";
  if (url.includes("bgsu.edu")) return "🌐";
  return "🔗";
};

export default function SearchResultCard({ result }) {
  const normalizedScore =
    typeof result.score === "number" ? Math.max(0, Math.min(1, result.score)) : null;
  const scoreLabel = normalizedScore !== null ? `${(normalizedScore * 100).toFixed(1)}% match` : null;

  return (
    <article className="card bg-base-100 shadow-lg border border-base-200 transition-all duration-200 hover:-translate-y-1 hover:border-primary/50 hover:shadow-2xl group">
      <div className="card-body space-y-3">
        <div className="flex items-center justify-between text-xs uppercase tracking-wide text-secondary">
          <div className="flex items-center gap-2">
            <span className="badge badge-outline badge-secondary group-hover:bg-secondary group-hover:text-white transition-colors duration-200">
              {result.type || "context"}
            </span>
            {result.domain && (
              <span className="text-base-content/70 group-hover:text-base-content/90 transition-colors duration-200">{result.domain}</span>
            )}
            {scoreLabel && <span className="badge badge-ghost text-base-content/70">{scoreLabel}</span>}
          </div>
          {result.citations?.length ? (
            <a
              href={result.citations[0]?.url || "#"}
              target="_blank"
              rel="noreferrer"
              className="btn btn-ghost btn-xs text-primary hover:text-primary-focus"
            >
              View source →
            </a>
          ) : null}
        </div>
        <div>
          <h3 className="card-title text-lg text-primary group-hover:text-primary-focus transition-colors duration-200">{result.title}</h3>
          <p className="text-sm text-base-content/80 group-hover:text-base-content/90 transition-colors duration-200">{result.snippet}</p>
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          {result.citations.map((cite) => (
            <a
              key={cite.url}
              href={cite.url}
              className="btn btn-xs btn-outline rounded-full normal-case flex items-center gap-2"
              target="_blank"
              rel="noreferrer"
            >
              <span>{iconForUrl(cite.url)}</span>
              <span className="text-xs">{cite.label}</span>
            </a>
          ))}
        </div>
      </div>
    </article>
  );
}
