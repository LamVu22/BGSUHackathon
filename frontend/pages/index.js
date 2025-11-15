import { useState, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import GraphPreview from "../components/GraphPreview";
import SearchResultCard from "../components/SearchResultCard";
import HistoryDrawer from "../components/HistoryDrawer";

const headlineSegments = [
  "Ask a question.",
  "See the sources.",
  "Trust the answer.",
];

const highlightStats = [
  { label: "Pages", value: 12400, suffix: "", accent: "text-primary" },
  { label: "PDF chunks", value: 3200, suffix: "", accent: "text-secondary" },
  { label: "Latency", value: 2.3, suffix: "s", accent: "text-accent", decimals: 1 },
];

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const domainFromUrl = (url = "") => {
  try {
    return new URL(url).hostname;
  } catch {
    return "";
  }
};

export default function Home({ theme, toggleTheme }) {
  const [query, setQuery] = useState("best scholarships for cs majors");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [segmentIndex, setSegmentIndex] = useState(0);
  const [typedHeadline, setTypedHeadline] = useState("");
  const [statValues, setStatValues] = useState(
    highlightStats.map(() => 0)
  );
  const [answer, setAnswer] = useState("");
  const [searchMeta, setSearchMeta] = useState([]);
  const [errorMessage, setErrorMessage] = useState("");
  const [history, setHistory] = useState([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const isDarkMode = theme === "falconDark";

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const duration = 1200;
    const frames = 60;
    const increments = highlightStats.map((stat) => stat.value / frames);
    let currentFrame = 0;

    const interval = setInterval(() => {
      currentFrame += 1;
      setStatValues((prev) =>
        prev.map((value, idx) => {
          const next = value + increments[idx];
          return currentFrame >= frames ? highlightStats[idx].value : next;
        })
      );

      if (currentFrame >= frames) {
        clearInterval(interval);
      }
    }, duration / frames);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    let charIndex = 0;
    let pauseTimeout;
    const target = headlineSegments[segmentIndex];
    setTypedHeadline("");

    const typeInterval = setInterval(() => {
      charIndex += 1;
      setTypedHeadline(target.slice(0, charIndex));

      if (charIndex >= target.length) {
        clearInterval(typeInterval);
        pauseTimeout = setTimeout(() => {
          setSegmentIndex((prev) => (prev + 1) % headlineSegments.length);
        }, 1200);
      }
    }, 45);

    return () => {
      clearInterval(typeInterval);
      clearTimeout(pauseTimeout);
    };
  }, [segmentIndex]);

  const handleSearch = async (event) => {
    event.preventDefault();
    const trimmedQuery = query.trim();
    if (!trimmedQuery) return;
    const timestamp = new Date();
    setHistory((prev) => [
      {
        id: timestamp.getTime(),
        query: trimmedQuery,
        timestamp: timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      },
      ...prev,
    ]);
    setLoading(true);
    setErrorMessage("");
    try {
      const response = await fetch(`${API_BASE_URL}/search`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: trimmedQuery }),
      });
      if (!response.ok) {
        const detail = await response.json().catch(() => ({}));
        throw new Error(detail.detail || "Search failed.");
      }
      const data = await response.json();
      const formattedCitations = (data.citations || []).map((item, index) => ({
        id: item.id || index + 1,
        type: item.type || "web",
        domain: item.domain || domainFromUrl(item.url),
        title: item.title || "Untitled",
        snippet: item.snippet || "",
        score: item.score ?? null,
        citations: [{ label: "Open link", url: item.url }],
      }));
      setAnswer(data.answer || "");
      setResults(formattedCitations);
      setSearchMeta(data.search_results || []);
    } catch (error) {
      setErrorMessage(error.message || "Search failed.");
      setAnswer("");
      setResults([]);
      setSearchMeta([]);
    } finally {
      setLoading(false);
    }
  };

  const handleHistorySelect = (value) => {
    setQuery(value);
    setHistoryOpen(false);
  };

  const formatStatValue = (stat, value = 0) => {
    if (stat.label === "Latency") {
      const decimals = stat.decimals ?? 0;
      return `${value.toFixed(decimals)}${stat.suffix ?? ""}`;
    }

    if (value >= 1000) {
      return `${(value / 1000).toFixed(1)}k${stat.suffix ?? ""}`;
    }

    return `${Math.round(value).toLocaleString()}${stat.suffix ?? ""}`;
  };

  return (
    <div className="min-h-screen hero-gradient text-base-content flex flex-col">
      <header className="max-w-6xl mx-auto px-6 pt-10 pb-4 w-full">
        <div className="flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-6 max-w-3xl">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-[#FF6A13] text-white font-black text-base flex items-center justify-center shadow-lg">
                  BGSU
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-[0.45em] text-base-content/60">FalconGraph Search</p>
                  <p className="text-xl font-bold text-base-content">Campus knowledge at a glance</p>
                </div>
              </div>
              <button
                type="button"
                className="btn btn-xs btn-outline border-base-300 hover:border-primary/60 transition-all duration-200"
                onClick={toggleTheme}
                aria-label="Toggle dark mode"
              >
                {mounted ? (isDarkMode ? "☀️ Light" : "🌙 Dark") : "🌙 Dark"}
              </button>
            </div>
            <h1 className="text-3xl lg:text-4xl font-black leading-tight tracking-tight min-h-[3.25rem]">
              {typedHeadline}
              <span className="ml-1 border-r-2 border-primary animate-pulse" />
            </h1>
            <div className="grid grid-cols-3 gap-3">
              {highlightStats.map((item, index) => (
                <div
                  key={item.label}
                  className="rounded-xl bg-base-100/70 backdrop-blur border border-base-300 px-3 py-2 shadow-sm transition-all duration-200"
                >
                  <p className="text-[10px] uppercase tracking-[0.3em] text-base-content/60">{item.label}</p>
                  <p className={`text-xl font-semibold ${item.accent}`}>
                    {formatStatValue(item, statValues[index])}
                  </p>
                  <p className="text-[10px] text-base-content/60">Live telemetry</p>
                </div>
              ))}
            </div>
          </div>
          <div className="w-full lg:max-w-md">
            <GraphPreview theme={theme} />
          </div>
        </div>
      </header>

      <main className="relative flex-1 w-full max-w-5xl mx-auto px-6 flex flex-col gap-4 pb-6">
        <section className="w-full">
          <form
            onSubmit={handleSearch}
            className="card bg-base-100/90 backdrop-blur-md shadow-xl border border-base-300 overflow-hidden"
          >
            <div className="w-full h-1 bg-gradient-to-r from-primary via-accent to-secondary" />
            <div className="card-body gap-3">
              <div className="flex items-center justify-between">
                <p className="text-[10px] uppercase tracking-[0.35em] text-base-content/60">Ask the campus graph</p>
                <button
                  type="button"
                  className="btn btn-ghost btn-xs text-primary"
                  onClick={() => setHistoryOpen((prev) => !prev)}
                >
                  {historyOpen ? "Hide history" : "Show history"}
                </button>
              </div>
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
        <section className="flex-1 overflow-hidden rounded-2xl bg-base-100/60 border border-base-300 shadow-inner p-4">
          <div className="space-y-4 h-full overflow-y-auto pr-2">
            {errorMessage && (
              <div className="alert alert-error shadow">
                <span>{errorMessage}</span>
              </div>
            )}
            {!loading && answer && (
              <div className="card bg-base-100 shadow border border-base-200">
                <div className="card-body">
                  <p className="text-xs uppercase tracking-[0.4em] text-base-content/60">FalconGraph answer</p>
                  <div className="prose prose-sm max-w-none text-base-content/90">
                    <ReactMarkdown>{answer}</ReactMarkdown>
                  </div>
                  <p className="text-xs text-base-content/50">Citations below reference the numbered snippets in this summary.</p>
                </div>
              </div>
            )}
            {loading
              ? Array.from({ length: 3 }).map((_, index) => <ResultSkeleton key={index} />)
              : results.map((result) => <SearchResultCard key={result.id} result={result} />)}
            {!loading && !results.length && !answer && !errorMessage && (
              <p className="text-sm text-base-content/60">Ask a question to see grounded results.</p>
            )}
            {!loading && searchMeta.length > 0 && (
              <div className="card bg-base-100 shadow border border-dashed border-base-300">
                <div className="card-body space-y-3">
                  <p className="text-xs uppercase tracking-[0.4em] text-base-content/60">Top web hits</p>
                  <ul className="space-y-2 text-sm">
                    {searchMeta.map((item) => (
                      <li key={item.url} className="border-b border-base-200 pb-2 last:border-none last:pb-0">
                        <a href={item.url} target="_blank" rel="noreferrer" className="link link-primary font-semibold">
                          {item.title}
                        </a>
                        <p className="text-xs text-base-content/70 mt-1">{item.snippet}</p>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </div>
        </section>
      </main>
      <HistoryDrawer open={historyOpen} history={history} onSelect={handleHistorySelect} onClose={() => setHistoryOpen(false)} />
    </div>
  );
}

function ResultSkeleton() {
  return (
    <div className="card bg-base-100 border border-base-200 shadow animate-pulse">
      <div className="card-body space-y-3">
        <div className="flex items-center gap-2">
          <div className="h-4 w-20 rounded-full bg-base-200" />
          <div className="h-3 w-16 rounded-full bg-base-200" />
        </div>
        <div className="h-5 w-3/4 rounded bg-base-200" />
        <div className="h-3 w-full rounded bg-base-200" />
        <div className="flex gap-2">
          <div className="h-6 w-20 rounded-full bg-base-200" />
          <div className="h-6 w-24 rounded-full bg-base-200" />
        </div>
      </div>
    </div>
  );
}
