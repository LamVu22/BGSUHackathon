export default function SearchResultCard({ result }) {
  return (
    <article className="card bg-base-100 shadow-lg border border-base-200">
      <div className="card-body">
        <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-secondary">
          <span className="badge badge-outline badge-secondary">{result.type}</span>
          <span>{result.domain}</span>
        </div>
        <h3 className="card-title text-lg text-primary">{result.title}</h3>
        <p className="text-sm text-base-content/80">{result.snippet}</p>
        <div className="mt-4 flex flex-wrap gap-2 text-xs">
          {result.citations.map((cite) => (
            <a
              key={cite.url}
              href={cite.url}
              className="link link-primary"
              target="_blank"
              rel="noreferrer"
            >
              {cite.label}
            </a>
          ))}
        </div>
      </div>
    </article>
  );
}
