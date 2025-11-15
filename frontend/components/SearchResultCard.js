export default function SearchResultCard({ result }) {
  return (
    <article className="card bg-base-100 shadow-lg border border-base-200 transition-all duration-200 hover:-translate-y-1 hover:border-primary/50 hover:shadow-2xl group">
      <div className="card-body">
        <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-secondary">
          <span className="badge badge-outline badge-secondary group-hover:bg-secondary group-hover:text-white transition-colors duration-200">
            {result.type}
          </span>
          <span className="text-base-content/70 group-hover:text-base-content/90 transition-colors duration-200">{result.domain}</span>
        </div>
        <h3 className="card-title text-lg text-primary group-hover:text-primary-focus transition-colors duration-200">{result.title}</h3>
        <p className="text-sm text-base-content/80 group-hover:text-base-content/90 transition-colors duration-200">{result.snippet}</p>
        <div className="mt-4 flex flex-wrap gap-2 text-xs">
          {result.citations.map((cite) => (
            <a
              key={cite.url}
              href={cite.url}
              className="link link-primary hover:text-primary-focus"
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
