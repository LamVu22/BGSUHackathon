#include <curl/curl.h>
#include <omp.h>

#include <algorithm>
#include <atomic>
#include <chrono>
#include <condition_variable>
#include <cctype>
#include <filesystem>
#include <fstream>
#include <iostream>
#include <mutex>
#include <optional>
#include <queue>
#include <regex>
#include <set>
#include <sstream>
#include <string>
#include <thread>
#include <unordered_set>
#include <vector>

namespace fs = std::filesystem;

namespace {

struct Config {
    std::string start_url = "https://www.bgsu.edu";
    std::vector<std::string> allowed_domains {"www.bgsu.edu", "bgsu.edu"};
    fs::path raw_output = fs::path("data") / "raw";
    long max_pages = -1;
    double request_delay_seconds = 0.25;
    double timeout_seconds = 20.0;
    int threads = 8;
    std::unordered_set<std::string> allowed_extensions {
        ".html", ".htm", ".php", ".asp", ".aspx", ".jsp",
        ".pdf",  ".txt", ".json", ".csv",  ".xml",
        ".doc",  ".docx", ".ppt", ".pptx", ".xls", ".xlsx",
        ".rtf",  ".srt",  ".vtt",  ".jpg",  ".jpeg", ".png",
        ".gif",  ".svg",  ".zip",  ".tar", ".gz",   ".mp3",
        ".mp4"
    };
};

std::string read_file(const fs::path& path) {
    std::ifstream in(path);
    if (!in.is_open()) {
        return {};
    }
    std::ostringstream ss;
    ss << in.rdbuf();
    return ss.str();
}

std::string read_string(const std::string& data, const std::string& key, const std::string& fallback) {
    std::regex pattern("\\\"" + key + "\\\"\\s*:\\s*\\\"([^\\\"]*)\\\"");
    std::smatch match;
    if (std::regex_search(data, match, pattern)) {
        return match[1].str();
    }
    return fallback;
}

long read_long(const std::string& data, const std::string& key, long fallback) {
    std::regex pattern("\\\"" + key + "\\\"\\s*:\\s*([-0-9]+)");
    std::smatch match;
    if (std::regex_search(data, match, pattern)) {
        return std::stol(match[1].str());
    }
    return fallback;
}

double read_double(const std::string& data, const std::string& key, double fallback) {
    std::regex pattern("\\\"" + key + "\\\"\\s*:\\s*([-0-9.]+)");
    std::smatch match;
    if (std::regex_search(data, match, pattern)) {
        return std::stod(match[1].str());
    }
    return fallback;
}

std::vector<std::string> read_string_array(const std::string& data, const std::string& key, const std::vector<std::string>& fallback) {
    std::regex pattern("\\\"" + key + "\\\"\\s*:\\s*\\[(.*?)\\]");
    std::smatch match;
    if (!std::regex_search(data, match, pattern)) {
        return fallback;
    }
    std::vector<std::string> values;
    std::string content = match[1].str();
    std::regex value_pattern("\\\"([^\\\"]+)\\\"");
    auto begin = std::sregex_iterator(content.begin(), content.end(), value_pattern);
    auto end = std::sregex_iterator();
    for (auto it = begin; it != end; ++it) {
        values.push_back((*it)[1].str());
    }
    return values.empty() ? fallback : values;
}

std::string to_lower(std::string value) {
    std::transform(value.begin(), value.end(), value.begin(), [](unsigned char c) { return static_cast<char>(std::tolower(c)); });
    return value;
}

fs::path resolve_path(const fs::path& repo_root, const std::string& raw_path) {
    fs::path path = raw_path;
    if (path.empty()) {
        return repo_root;
    }
    if (path.is_absolute()) {
        return path;
    }
    return repo_root / path;
}

Config load_config(const fs::path& starting_dir) {
    Config cfg;
    fs::path repo_root = starting_dir;
    const fs::path config_rel_path = "config/pipeline.json";
    while (!repo_root.empty() && !fs::exists(repo_root / config_rel_path)) {
        if (repo_root.has_parent_path()) {
            repo_root = repo_root.parent_path();
        } else {
            break;
        }
    }
    if (fs::exists(repo_root / config_rel_path)) {
        std::cout << "Using config at " << repo_root / config_rel_path << "\n";
    } else {
        std::cerr << "Config not found starting from " << starting_dir << ". Using defaults.\n";
    }

    cfg.raw_output = repo_root / cfg.raw_output;
    cfg.threads = static_cast<int>(std::max(1u, std::thread::hardware_concurrency()));

    fs::path config_path = repo_root / "config" / "pipeline.json";
    if (fs::exists(config_path)) {
        std::string data = read_file(config_path);
        if (!data.empty()) {
            cfg.start_url = read_string(data, "start_url", cfg.start_url);
            cfg.allowed_domains = read_string_array(data, "allowed_domains", cfg.allowed_domains);
            std::string raw_output_str = read_string(data, "raw_output", cfg.raw_output.string());
            cfg.raw_output = resolve_path(repo_root, raw_output_str);
            cfg.max_pages = read_long(data, "max_pages", cfg.max_pages);
            cfg.request_delay_seconds = read_double(data, "delay", cfg.request_delay_seconds);
            cfg.timeout_seconds = read_double(data, "timeout", cfg.timeout_seconds);
            long link_threads = read_long(data, "crawler_threads", cfg.threads);
            if (link_threads > 0) {
                cfg.threads = static_cast<int>(link_threads);
            }
            auto extensions = read_string_array(data, "extensions", {});
            if (!extensions.empty()) {
                cfg.allowed_extensions.clear();
                for (const auto& ext : extensions) {
                    if (!ext.empty() && ext[0] == '.') {
                        cfg.allowed_extensions.insert(ext);
                    } else if (!ext.empty()) {
                        cfg.allowed_extensions.insert('.' + ext);
                    }
                }
            }
        }
    } else {
        std::cerr << "Config not found at " << config_path << ". Using defaults.\n";
    }
    for (auto& domain : cfg.allowed_domains) {
        domain = to_lower(domain);
    }
    return cfg;
}

std::string trim(const std::string& input) {
    size_t start = input.find_first_not_of(" \t\n\r");
    size_t end = input.find_last_not_of(" \t\n\r");
    if (start == std::string::npos || end == std::string::npos) {
        return "";
    }
    return input.substr(start, end - start + 1);
}

struct UrlParts {
    std::string scheme;
    std::string host;
    std::string path;
};

std::optional<UrlParts> parse_url(const std::string& url) {
    static const std::regex pattern(R"(^([a-zA-Z][a-zA-Z0-9+.-]*)://([^/]+)(/.*)?$)");
    std::smatch match;
    if (!std::regex_match(url, match, pattern)) {
        return std::nullopt;
    }
    UrlParts parts;
    parts.scheme = to_lower(match[1].str());
    parts.host = to_lower(match[2].str());
    parts.path = match[3].matched ? match[3].str() : "/";
    return parts;
}

std::string strip_fragment(const std::string& url) {
    auto pos = url.find('#');
    if (pos != std::string::npos) {
        return url.substr(0, pos);
    }
    return url;
}

std::string make_absolute(const std::string& base_url, const std::string& href) {
    std::string link = trim(href);
    if (link.empty()) {
        return {};
    }
    if (link.rfind("mailto:", 0) == 0 || link.rfind("javascript:", 0) == 0) {
        return {};
    }
    if (link.rfind("http://", 0) == 0 || link.rfind("https://", 0) == 0) {
        return strip_fragment(link);
    }
    if (link.rfind("//", 0) == 0) {
        auto base_parts = parse_url(base_url);
        if (!base_parts) {
            return {};
        }
        return base_parts->scheme + ":" + strip_fragment(link);
    }
    auto base_parts = parse_url(base_url);
    if (!base_parts) {
        return {};
    }
    std::string base_path = base_parts->path;
    if (link.front() == '/') {
        base_path = link;
    } else {
        auto slash = base_path.find_last_of('/');
        std::string directory = slash == std::string::npos ? "/" : base_path.substr(0, slash + 1);
        base_path = directory + link;
    }
    return base_parts->scheme + "://" + base_parts->host + base_path;
}

std::string extension_from_url(const std::string& url) {
    auto clean = strip_fragment(url);
    auto query_pos = clean.find('?');
    if (query_pos != std::string::npos) {
        clean = clean.substr(0, query_pos);
    }
    auto slash = clean.find_last_of('/');
    std::string filename = slash == std::string::npos ? clean : clean.substr(slash + 1);
    auto dot = filename.find_last_of('.');
    if (dot == std::string::npos) {
        return {};
    }
    std::string ext = filename.substr(dot);
    std::transform(ext.begin(), ext.end(), ext.begin(), [](unsigned char c) { return static_cast<char>(std::tolower(c)); });
    return ext;
}

bool query_indicates_download(const std::string& url) {
    auto lower = to_lower(url);
    if (lower.find("format=pdf") != std::string::npos) {
        return true;
    }
    if (lower.find("format=doc") != std::string::npos) {
        return true;
    }
    if (lower.find("download=1") != std::string::npos) {
        return true;
    }
    return false;
}

std::string sanitize_filename(const UrlParts& parts, const std::string& extension, const std::string& prefix) {
    std::string path = parts.path;
    if (path.empty() || path == "/") {
        path = "/index";
    }
    std::string safe = path;
    std::replace(safe.begin(), safe.end(), '/', '_');
    std::string file_name = prefix + "__" + parts.host + safe;
    if (!extension.empty() && file_name.find(extension) == std::string::npos) {
        file_name += extension;
    }
    static const std::regex invalid("[^A-Za-z0-9._-]+");
    file_name = std::regex_replace(file_name, invalid, "_");
    if (file_name.size() > 240) {
        file_name = file_name.substr(0, 240);
    }
    return file_name;
}

struct FetchResult {
    std::string body;
    std::string content_type;
};

size_t write_callback(char* ptr, size_t size, size_t nmemb, void* userdata) {
    auto* buffer = static_cast<std::string*>(userdata);
    buffer->append(ptr, size * nmemb);
    return size * nmemb;
}

size_t header_callback(char* buffer, size_t size, size_t nitems, void* userdata) {
    size_t total = size * nitems;
    std::string header(buffer, total);
    auto* content_type = static_cast<std::string*>(userdata);
    std::string lower = to_lower(header);
    if (lower.rfind("content-type:", 0) == 0) {
        auto colon = header.find(':');
        if (colon != std::string::npos) {
            std::string value = header.substr(colon + 1);
            *content_type = trim(value);
        }
    }
    return total;
}

FetchResult fetch_url(const std::string& url, double timeout_seconds) {
    FetchResult result;
    CURL* curl = curl_easy_init();
    if (!curl) {
        return result;
    }
    curl_easy_setopt(curl, CURLOPT_URL, url.c_str());
    curl_easy_setopt(curl, CURLOPT_FOLLOWLOCATION, 1L);
    curl_easy_setopt(curl, CURLOPT_USERAGENT, "FalconGraphCrawler/1.0");
    curl_easy_setopt(curl, CURLOPT_WRITEFUNCTION, write_callback);
    curl_easy_setopt(curl, CURLOPT_WRITEDATA, &result.body);
    curl_easy_setopt(curl, CURLOPT_HEADERFUNCTION, header_callback);
    curl_easy_setopt(curl, CURLOPT_HEADERDATA, &result.content_type);
    curl_easy_setopt(curl, CURLOPT_TIMEOUT, static_cast<long>(timeout_seconds));
    CURLcode res = curl_easy_perform(curl);
    if (res != CURLE_OK) {
        std::cerr << "Failed to fetch " << url << ": " << curl_easy_strerror(res) << "\n";
        result.body.clear();
    }
    curl_easy_cleanup(curl);
    return result;
}

std::vector<std::string> extract_links(const std::string& html, const std::string& base_url) {
    static const std::regex href_regex(R"(href\s*=\s*['\"]([^'\"]+)['\"])", std::regex::icase);
    std::vector<std::string> links;
    auto begin = std::sregex_iterator(html.begin(), html.end(), href_regex);
    auto end = std::sregex_iterator();
    for (auto it = begin; it != end; ++it) {
        std::string raw_link = (*it)[1].str();
        std::string absolute = make_absolute(base_url, raw_link);
        if (!absolute.empty()) {
            links.push_back(absolute);
        }
    }
    return links;
}

class ParallelCrawler {
   public:
    explicit ParallelCrawler(Config config)
        : config_(std::move(config)) {
        fs::create_directories(config_.raw_output);
        html_dir_ = config_.raw_output / "html";
        files_dir_ = config_.raw_output / "files";
        fs::create_directories(html_dir_);
        fs::create_directories(files_dir_);
        metadata_path_ = config_.raw_output / "metadata.tsv";
        if (!fs::exists(metadata_path_)) {
            std::ofstream out(metadata_path_);
            out << "url\tpath\tcontent_type\n";
        }
    }

    void run() {
        curl_global_init(CURL_GLOBAL_DEFAULT);
        enqueue_url(config_.start_url);

        std::atomic<bool> stop {false};

        #pragma omp parallel num_threads(config_.threads)
        {
            while (true) {
                if (stop.load()) {
                    break;
                }
                std::string url;
                {
                    std::lock_guard<std::mutex> lock(queue_mutex_);
                    if (!frontier_.empty()) {
                        url = frontier_.front();
                        frontier_.pop();
                        active_workers_.fetch_add(1);
                    } else {
                        if (active_workers_.load() == 0) {
                            stop.store(true);
                            break;
                        }
                        continue;
                    }
                }

                if (!mark_visited(url)) {
                    decrement_active();
                    continue;
                }

                bool keep_running = process_url(url);
                decrement_active();
                if (!keep_running) {
                    stop.store(true);
                    break;
                }
            }
        }

        curl_global_cleanup();
    }

   private:
    bool mark_visited(const std::string& url) {
        std::lock_guard<std::mutex> lock(visited_mutex_);
        auto [it, inserted] = visited_.insert(url);
        if (inserted) {
            queued_.erase(url);
        }
        return inserted;
    }

    void decrement_active() {
        auto remaining = active_workers_.fetch_sub(1) - 1;
        if (remaining < 0) {
            active_workers_.store(0);
        }
    }

    bool process_url(const std::string& url) {
        if (config_.max_pages >= 0 && pages_downloaded_.load() >= config_.max_pages) {
            return false;
        }

        auto result = fetch_url(url, config_.timeout_seconds);
        if (result.body.empty()) {
            return true;
        }

        std::string content_type = to_lower(result.content_type);
        bool is_html = content_type.find("text/html") != std::string::npos || content_type.empty();
        auto parts = parse_url(url);
        if (!parts) {
            return true;
        }

        fs::path saved_path;
        if (is_html) {
            saved_path = html_dir_ / sanitize_filename(*parts, ".html", "html");
            std::ofstream out(saved_path, std::ios::binary);
            out << result.body;
        } else {
            std::string ext = extension_from_url(url);
            if (ext.empty()) {
                ext = ".bin";
            }
            saved_path = files_dir_ / sanitize_filename(*parts, ext, "file");
            std::ofstream out(saved_path, std::ios::binary);
            out << result.body;
        }

        {
            std::lock_guard<std::mutex> lock(metadata_mutex_);
            std::ofstream meta(metadata_path_, std::ios::app);
            meta << url << '\t' << saved_path.generic_string() << '\t' << (content_type.empty() ? "" : content_type) << '\n';
        }

        long current = pages_downloaded_.fetch_add(1) + 1;
        if (is_html) {
            auto links = extract_links(result.body, url);
            for (const auto& link : links) {
                if (should_enqueue(link)) {
                    enqueue_url(link);
                }
            }
        }

        if (config_.request_delay_seconds > 0) {
            std::this_thread::sleep_for(std::chrono::duration<double>(config_.request_delay_seconds));
        }

        if (config_.max_pages >= 0 && current >= config_.max_pages) {
            return false;
        }
        return true;
    }

    bool should_enqueue(const std::string& url) {
        auto normalized = strip_fragment(url);
        if (normalized.empty()) {
            return false;
        }
        if (!is_allowed_domain(normalized)) {
            return false;
        }
        std::string ext = extension_from_url(normalized);
        if (!ext.empty()) {
            if (config_.allowed_extensions.find(ext) == config_.allowed_extensions.end()) {
                return false;
            }
        } else if (!query_indicates_download(normalized)) {
            // treat extension-less as HTML
        }
        return true;
    }

    bool is_allowed_domain(const std::string& url) {
        auto parts = parse_url(url);
        if (!parts) {
            return false;
        }
        std::string host = parts->host;
        for (const auto& domain : config_.allowed_domains) {
            if (host == to_lower(domain)) {
                return true;
            }
        }
        return false;
    }

    void enqueue_url(const std::string& url) {
        auto normalized = strip_fragment(url);
        if (normalized.empty()) {
            return;
        }
        if (!is_allowed_domain(normalized)) {
            return;
        }
        std::lock_guard<std::mutex> lock(visited_mutex_);
        if (visited_.count(normalized) > 0 || queued_.count(normalized) > 0) {
            return;
        }
        queued_.insert(normalized);
        {
            std::lock_guard<std::mutex> qlock(queue_mutex_);
            frontier_.push(normalized);
        }
    }

    Config config_;
    fs::path html_dir_;
    fs::path files_dir_;
    fs::path metadata_path_;

    std::queue<std::string> frontier_;
    std::unordered_set<std::string> visited_;
    std::unordered_set<std::string> queued_;
    std::mutex queue_mutex_;
    std::mutex visited_mutex_;
    std::mutex metadata_mutex_;
    std::atomic<long> pages_downloaded_ {0};
    std::atomic<long> active_workers_ {0};
};

}  // namespace

int main() {
    Config config = load_config(fs::current_path());
    ParallelCrawler crawler(std::move(config));
    crawler.run();
    std::cout << "Parallel crawler finished." << std::endl;
    return 0;
}
