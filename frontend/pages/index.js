import { useState } from "react";
import GraphPreview from "../components/GraphPreview";
import SearchResultCard from "../components/SearchResultCard";

const mockResults = [
  {
    id: 1,
    title: "How do I apply for BGSU scholarships?",
    type: "answer",
    domain: "bgsu.edu",
    snippet:
      "Visit the Falcon Scholarship application portal, submit FAFSA by Jan 15, and attach your academic resume to unlock donor-funded awards tied to your major.",
    citations: [
      { label: "Scholarships & Aid", url: "https://www.bgsu.edu/financial-aid" },
      { label: "Honors College", url: "https://www.bgsu.edu/honors" },
    ],
  },
  {
    id: 2,
    title: "Key submission deadlines",
    type: "insight",
    domain: "bgsu.edu",
    snippet: "FAFSA priority deadline is January 15 and Falcon Guarantee deposit is May 1 for Fall admits.",
    citations: [
      { label: "Admissions Calendar", url: "https://www.bgsu.edu/admissions" },
    ],
  },
];

export default function Home() {
  const [query, setQuery] = useState("best scholarships for cs majors");
  const [results, setResults] = useState(mockResults);
  const [loading, setLoading] = useState(false);

  const handleSearch = async (event) => {
    event.preventDefault();
    setLoading(true);
    // TODO: call FastAPI backend `/search` once available
    setTimeout(() => setLoading(false), 800);
  };

  return (
    <div className="min-h-screen hero-gradient pb-16">
      <header className="max-w-6xl mx-auto px-6 pt-16">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-6">
            <p className="badge badge-lg badge-outline border-primary text-primary">FalconGraph Search</p>
            <h1 className="text-4xl lg:text-5xl font-bold leading-tight">
              Grounded AI answers for every BGSU question.
            </h1>
            <p className="text-lg text-base-content/70 max-w-2xl">
              We crawl falcon resources, build a campus link graph, and use a RAG pipeline so every answer shows its source and graph neighborhood.
            </p>
            <div className="stats stats-vertical lg:stats-horizontal shadow">
              <div className="stat">
                <div className="stat-title">Pages indexed</div>
                <div className="stat-value text-primary">12,480</div>
                <div className="stat-desc">Updated nightly</div>
              </div>
              <div className="stat">
                <div className="stat-title">PDF chunks</div>
                <div className="stat-value text-secondary">3,210</div>
                <div className="stat-desc">FAISS vector store</div>
              </div>
              <div className="stat">
                <div className="stat-title">Avg. latency</div>
                <div className="stat-value text-accent">2.3s</div>
                <div className="stat-desc">LLM + retrieval</div>
              </div>
            </div>
          </div>
          <div className="w-full lg:max-w-sm">
            <GraphPreview />
          </div>
        </div>
      </header>

      <section className="max-w-5xl mx-auto px-6 mt-12">
        <form onSubmit={handleSearch} className="card bg-base-100 shadow-2xl border border-base-300">
          <div className="card-body gap-4">
            <label className="form-control w-full">
              <div className="label">
                <span className="label-text text-sm uppercase tracking-widest">Ask anything about BGSU</span>
                <span className="label-text-alt">RAG powered by OpenAI + FAISS</span>
              </div>
              <div className="flex flex-col gap-3 lg:flex-row">
                <input
                  type="text"
                  className="input input-lg input-bordered w-full"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Where do I find meal plan options?"
                />
                <button className="btn btn-primary btn-lg w-full lg:w-auto" disabled={loading}>
                  {loading ? <span className="loading loading-spinner loading-md"></span> : "Search"}
                </button>
              </div>
            </label>
            <div className="flex flex-wrap gap-3 text-sm text-base-content/70">
              <span className="badge badge-outline">Scholarships</span>
              <span className="badge badge-outline">Housing</span>
              <span className="badge badge-outline">Course planning</span>
              <span className="badge badge-outline">Student orgs</span>
            </div>
          </div>
        </form>
      </section>

      <section className="max-w-5xl mx-auto px-6 mt-10 grid gap-6 lg:grid-cols-[2fr,1fr]">
        <div className="space-y-6">
          {results.map((result) => (
            <SearchResultCard key={result.id} result={result} />
          ))}
        </div>
        <aside className="space-y-6">
          <div className="card bg-base-100 shadow-lg border border-base-300">
            <div className="card-body">
              <h2 className="card-title">Pipeline status</h2>
              <ul className="timeline timeline-vertical text-sm">
                <li>
                  <div className="timeline-start timeline-box">Crawler ingest complete</div>
                  <div className="timeline-middle">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                      <path d="M10 18a8 8 0 100-16 8 8 0 000 16zm-1-5l-3-3 1.5-1.5L9 10.5l3.5-3.5L14 8.5l-5 4.5z" />
                    </svg>
                  </div>
                  <hr />
                </li>
                <li>
                  <hr />
                  <div className="timeline-middle">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                      <path d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11H9v4h4v-2h-2V7z" />
                    </svg>
                  </div>
                  <div className="timeline-end timeline-box">Graph metrics refreshed</div>
                  <hr />
                </li>
                <li>
                  <hr />
                  <div className="timeline-middle">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                      <path d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12H9v5h4V9h-2V6z" />
                    </svg>
                  </div>
                  <div className="timeline-end timeline-box">Embeddings queued</div>
                </li>
              </ul>
            </div>
          </div>
          <div className="card bg-primary text-primary-content shadow-lg">
            <div className="card-body">
              <h3 className="card-title">Need richer data?</h3>
              <p>Trigger a new crawl from `config/pipeline.json` and monitor ingestion from this panel.</p>
              <button className="btn">Open pipeline config</button>
            </div>
          </div>
        </aside>
      </section>
    </div>
  );
}
