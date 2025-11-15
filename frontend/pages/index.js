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

const highlightStats = [
  { label: "Pages", value: "12.4k", accent: "text-primary" },
  { label: "PDF chunks", value: "3.2k", accent: "text-secondary" },
  { label: "Latency", value: "2.3s", accent: "text-accent" },
];

const pipelineTiles = [
  { title: "Crawler", status: "Complete", icon: "✅", badge: "Live" },
  { title: "Graph", status: "Refreshing", icon: "🕸️", badge: "2 min ago" },
  { title: "Embeddings", status: "Queued", icon: "⚙️", badge: "ETA 5m" },
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
    <div className="min-h-screen hero-gradient pb-16 text-base-content">
      <header className="max-w-6xl mx-auto px-6 pt-16">
        <div className="flex flex-col gap-10 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-6 max-w-3xl">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-[#FF6A13] text-white font-black text-lg flex items-center justify-center shadow-lg">
                BGSU
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.4em] text-base-content/60">FalconGraph Search</p>
                <p className="text-2xl font-bold text-base-content">Campus knowledge at a glance</p>
              </div>
            </div>
            <h1 className="text-4xl lg:text-5xl font-black leading-tight tracking-tight">
              Ask a question. See the sources. Trust the answer.
            </h1>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              {highlightStats.map((item) => (
                <div
                  key={item.label}
                  className="rounded-2xl bg-base-100/70 backdrop-blur border border-base-300 p-4 shadow-sm"
                >
                  <p className="text-xs uppercase tracking-widest text-base-content/60">{item.label}</p>
                  <p className={`text-2xl font-semibold ${item.accent}`}>{item.value}</p>
                  <p className="text-xs text-base-content/50">Live telemetry</p>
                </div>
              ))}
            </div>
          </div>
          <div className="w-full lg:max-w-md">
            <GraphPreview />
          </div>
        </div>
      </header>

      <section className="max-w-5xl mx-auto px-6 mt-12">
        <form
          onSubmit={handleSearch}
          className="card bg-base-100/90 backdrop-blur-md shadow-2xl border border-base-300 overflow-hidden"
        >
          <div className="w-full h-2 bg-gradient-to-r from-primary via-accent to-secondary" />
          <div className="card-body gap-4">
            <p className="text-xs uppercase tracking-[0.3em] text-base-content/60">Campus knowledge search</p>
            <div className="relative">
              <input
                type="text"
                className="input input-lg input-bordered w-full pr-16"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Where do I find meal plan options?"
              />
              <button
                type="submit"
                className="btn btn-circle btn-primary btn-sm absolute top-1/2 -translate-y-1/2 right-2 shadow-md"
                disabled={loading}
              >
                {loading ? (
                  <span className="loading loading-spinner loading-xs text-base-100" />
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" className="w-4 h-4 stroke-current">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M5 12h14M12 5l7 7-7 7"
                    />
                  </svg>
                )}
              </button>
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
          <div className="grid gap-4">
            {pipelineTiles.map((tile) => (
              <div key={tile.title} className="card bg-base-100 border border-base-200 shadow-md">
                <div className="card-body">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{tile.icon}</span>
                      <div>
                        <p className="text-xs uppercase tracking-widest text-base-content/60">{tile.title}</p>
                        <p className="text-lg font-semibold">{tile.status}</p>
                      </div>
                    </div>
                    <span className="badge badge-outline">{tile.badge}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="card bg-gradient-to-br from-primary to-accent text-primary-content shadow-xl border border-primary/40">
            <div className="card-body space-y-4">
              <div>
                <p className="text-xs uppercase tracking-[0.4em]">Need richer data?</p>
                <h3 className="text-2xl font-bold">Launch a fresh crawl</h3>
              </div>
              <p className="text-sm opacity-80">
                Point to a new seed in <code>config/pipeline.json</code> and keep this dashboard open to watch it land.
              </p>
              <button className="btn btn-sm bg-base-100 text-primary border-none hover:bg-base-200">Open config</button>
            </div>
          </div>
        </aside>
      </section>
    </div>
  );
}
