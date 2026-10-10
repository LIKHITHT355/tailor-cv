import { useState, useEffect } from "react";
import {
  ChevronDown,
  ChevronUp,
  Database,
  Loader2,
  RefreshCw,
  Search,
  AlertCircle,
  CheckCircle2,
  Layers,
  Sparkles,
} from "lucide-react";
import {
  ingestFactBank,
  getFactBankStatus,
  getSectionChunks,
  searchFactBank,
  type FactBank,
  type SectionResult,
  type SearchResult,
} from "@/lib/ragApi";
import { cn } from "@/lib/utils";

const SECTIONS = [
  "header",
  "education",
  "experience",
  "certification",
  "skills",
  "project",
] as const;

type SectionName = (typeof SECTIONS)[number];

export function RagTestPanel({ documentId }: { documentId: string | null }) {
  const [isOpen, setIsOpen] = useState(true);
  const [manualDocId, setManualDocId] = useState("");
  const activeDocId = documentId || manualDocId.trim();

  // Ingest state
  const [force, setForce] = useState(false);
  const [ingesting, setIngesting] = useState(false);
  const [ingestError, setIngestError] = useState<string | null>(null);

  // Status state
  const [status, setStatus] = useState<FactBank | null>(null);
  const [statusLoading, setStatusLoading] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);

  // Browse state
  const [selectedSection, setSelectedSection] = useState<SectionName>("skills");
  const [sectionResult, setSectionResult] = useState<SectionResult | null>(null);
  const [sectionLoading, setSectionLoading] = useState(false);
  const [sectionError, setSectionError] = useState<string | null>(null);

  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchSections, setSearchSections] = useState<string[]>(["skills", "project"]);
  const [topK, setTopK] = useState(5);
  const [searchResult, setSearchResult] = useState<SearchResult | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [expandedMatches, setExpandedMatches] = useState<Record<string, boolean>>({});

  // Auto-fetch status when activeDocId changes
  useEffect(() => {
    if (activeDocId) {
      handleFetchStatus(activeDocId);
    } else {
      setStatus(null);
    }
  }, [activeDocId]);

  const handleFetchStatus = async (idToUse = activeDocId) => {
    if (!idToUse) return;
    setStatusLoading(true);
    setStatusError(null);
    try {
      const res = await getFactBankStatus(idToUse);
      setStatus(res);
    } catch (err: any) {
      setStatusError(err.message || "Failed to fetch status");
    } finally {
      setStatusLoading(false);
    }
  };

  const handleIngest = async () => {
    if (!activeDocId) return;
    setIngesting(true);
    setIngestError(null);
    try {
      const res = await ingestFactBank(activeDocId, force);
      setStatus(res);
      // Auto-fetch status after ingest
      await handleFetchStatus(activeDocId);
    } catch (err: any) {
      setIngestError(err.message || "Ingest failed");
      await handleFetchStatus(activeDocId);
    } finally {
      setIngesting(false);
    }
  };

  const handleBrowseSection = async () => {
    if (!activeDocId) return;
    setSectionLoading(true);
    setSectionError(null);
    try {
      const res = await getSectionChunks(activeDocId, selectedSection);
      setSectionResult(res);
    } catch (err: any) {
      setSectionError(err.message || "Failed to fetch section");
    } finally {
      setSectionLoading(false);
    }
  };

  const handleSearch = async () => {
    if (!activeDocId || !searchQuery.trim()) return;
    setSearchLoading(true);
    setSearchError(null);
    try {
      const res = await searchFactBank(activeDocId, searchQuery.trim(), searchSections, topK);
      setSearchResult(res);
    } catch (err: any) {
      setSearchError(err.message || "Search failed");
    } finally {
      setSearchLoading(false);
    }
  };

  const toggleSectionCheckbox = (sec: string) => {
    setSearchSections((prev) =>
      prev.includes(sec)
        ? prev.length > 1
          ? prev.filter((s) => s !== sec)
          : prev
        : [...prev, sec]
    );
  };

  const toggleMatchExpanded = (id: string) => {
    setExpandedMatches((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const statusBadgeColor = (st?: string) => {
    switch (st) {
      case "ready":
        return "border-emerald/40 bg-emerald/15 text-emerald";
      case "processing":
        return "border-amber/40 bg-amber/15 text-amber";
      case "failed":
        return "border-rose/40 bg-rose/15 text-rose";
      default:
        return "border-white/20 bg-white/10 text-faint";
    }
  };

  return (
    <section className="glass rounded-xl border border-cyan/30 bg-black/40 p-4 transition-all">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Database className="size-4 text-cyan" />
          <h2 className="text-sm font-semibold text-gradient">RAG Test (dev)</h2>
          <span className="rounded bg-cyan/20 px-1.5 py-0.5 text-[10px] font-medium text-cyan">
            DEV
          </span>
        </div>
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="icon-button p-1"
          aria-label={isOpen ? "Collapse RAG panel" : "Expand RAG panel"}
        >
          {isOpen ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
        </button>
      </div>

      {isOpen && (
        <div className="mt-4 space-y-4 text-xs">
          {/* Document ID selection */}
          <div className="space-y-1 rounded-lg border border-white/10 bg-white/5 p-2.5">
            <span className="font-medium text-heading">Document ID</span>
            {documentId ? (
              <div className="flex items-center justify-between text-faint font-mono text-[11px]">
                <span className="truncate" title={documentId}>
                  {documentId}
                </span>
                <span className="text-emerald text-[10px] ml-2">● active</span>
              </div>
            ) : (
              <input
                type="text"
                value={manualDocId}
                onChange={(e) => setManualDocId(e.target.value)}
                placeholder="Enter Mongo docId..."
                className="glass-input w-full p-2 text-xs font-mono"
              />
            )}
          </div>

          {/* 1. Ingest Controls */}
          <div className="space-y-2 rounded-lg border border-white/10 bg-white/5 p-3">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-heading flex items-center gap-1.5">
                <Sparkles className="size-3.5 text-cyan" /> 1. Ingest to Fact Bank
              </span>
              <label className="flex items-center gap-1.5 text-faint cursor-pointer">
                <input
                  type="checkbox"
                  checked={force}
                  onChange={(e) => setForce(e.target.checked)}
                  className="rounded border-white/20 bg-white/10 text-cyan focus:ring-0"
                />
                Force
              </label>
            </div>

            <button
              type="button"
              onClick={handleIngest}
              disabled={!activeDocId || ingesting}
              className="cta-glass w-full py-2 font-medium flex items-center justify-center gap-2"
            >
              {ingesting ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" /> Ingesting (Mistral embed)...
                </>
              ) : (
                "Build Fact Bank"
              )}
            </button>

            {ingestError && (
              <div className="rounded border border-rose/40 bg-rose/10 p-2 text-rose flex items-start gap-1.5">
                <AlertCircle className="size-3.5 mt-0.5 shrink-0" />
                <span className="break-all">{ingestError}</span>
              </div>
            )}
          </div>

          {/* 2. Status Details */}
          <div className="space-y-2 rounded-lg border border-white/10 bg-white/5 p-3">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-heading flex items-center gap-1.5">
                <Layers className="size-3.5 text-cyan" /> 2. Status
              </span>
              <button
                type="button"
                onClick={() => handleFetchStatus()}
                disabled={!activeDocId || statusLoading}
                className="icon-button p-1 text-faint hover:text-heading"
                title="Refresh Status"
              >
                <RefreshCw className={cn("size-3.5", statusLoading && "animate-spin")} />
              </button>
            </div>

            {statusError && (
              <div className="rounded border border-rose/40 bg-rose/10 p-2 text-rose flex items-start gap-1.5">
                <AlertCircle className="size-3.5 mt-0.5 shrink-0" />
                <span className="break-all">{statusError}</span>
              </div>
            )}

            {status ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      "rounded-full border px-2 py-0.5 font-semibold text-[10px] uppercase",
                      statusBadgeColor(status.status)
                    )}
                  >
                    {status.status}
                  </span>
                  {status.totalChunks !== undefined && (
                    <span className="text-faint">
                      Total chunks: <strong className="text-heading">{status.totalChunks}</strong>
                    </span>
                  )}
                  {status.embeddingModel && (
                    <span className="text-faint truncate" title={status.embeddingModel}>
                      Model: {status.embeddingModel}
                    </span>
                  )}
                </div>

                {/* Section counts */}
                {status.counts && (
                  <div className="grid grid-cols-3 gap-1.5 pt-1 text-[11px]">
                    {SECTIONS.map((sec) => (
                      <div
                        key={sec}
                        className="rounded border border-white/10 bg-white/5 p-1 px-1.5 text-center"
                      >
                        <div className="text-faint capitalize text-[10px]">{sec}</div>
                        <div className="font-semibold text-heading">
                          {status.counts?.[sec] ?? 0}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {status.warnings && status.warnings.length > 0 && (
                  <div className="rounded border border-amber/30 bg-amber/10 p-2 text-amber text-[11px]">
                    <span className="font-semibold">Warnings:</span>
                    <ul className="list-disc pl-4 mt-1 space-y-0.5">
                      {status.warnings.map((w, idx) => (
                        <li key={idx}>{w}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {status.error && (
                  <div className="rounded border border-rose/40 bg-rose/10 p-2 text-rose text-[11px] break-all">
                    <strong>Error:</strong> {status.error}
                  </div>
                )}

                {status.updatedAt && (
                  <div className="text-[10px] text-faint">
                    Updated: {new Date(status.updatedAt).toLocaleTimeString()}
                  </div>
                )}
              </div>
            ) : (
              <p className="text-faint text-[11px]">No status loaded yet.</p>
            )}
          </div>

          {/* 3. Browse Chunks */}
          <div className="space-y-2 rounded-lg border border-white/10 bg-white/5 p-3">
            <span className="font-semibold text-heading">3. Browse Stored Chunks</span>
            <div className="flex gap-2">
              <select
                value={selectedSection}
                onChange={(e) => setSelectedSection(e.target.value as SectionName)}
                className="glass-input flex-1 p-1.5 text-xs capitalize"
              >
                {SECTIONS.map((sec) => (
                  <option key={sec} value={sec} className="bg-slate-900 text-white">
                    {sec}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={handleBrowseSection}
                disabled={!activeDocId || sectionLoading}
                className="secondary-button px-3 py-1.5"
              >
                {sectionLoading ? <Loader2 className="size-3.5 animate-spin" /> : "Fetch"}
              </button>
            </div>

            {sectionError && (
              <div className="rounded border border-rose/40 bg-rose/10 p-2 text-rose break-all">
                {sectionError}
              </div>
            )}

            {sectionResult && (
              <div className="space-y-1.5">
                <div className="text-faint text-[11px]">
                  Found <strong className="text-heading">{sectionResult.count}</strong> chunk(s) in{" "}
                  <span className="capitalize">{sectionResult.section}</span>:
                </div>
                <div className="max-h-44 overflow-y-auto space-y-1.5 pr-1">
                  {sectionResult.chunks.length === 0 ? (
                    <div className="text-faint italic p-1">No chunks for this section</div>
                  ) : (
                    sectionResult.chunks.map((chk) => (
                      <div
                        key={chk.id}
                        className="rounded border border-white/10 bg-black/40 p-2 text-[11px] space-y-1"
                      >
                        <div className="font-mono text-[10px] text-cyan break-all">{chk.id}</div>
                        <div className="text-heading whitespace-pre-wrap">{chk.text}</div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* 4. Similarity Search */}
          <div className="space-y-2 rounded-lg border border-white/10 bg-white/5 p-3">
            <span className="font-semibold text-heading flex items-center gap-1.5">
              <Search className="size-3.5 text-cyan" /> 4. Similarity Search
            </span>

            <div className="space-y-1">
              <div className="flex justify-between text-[10px] text-faint">
                <span>Query</span>
                <span>{searchQuery.length}/200</span>
              </div>
              <input
                type="text"
                value={searchQuery}
                maxLength={200}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="e.g. backend python docker..."
                className="glass-input w-full p-2 text-xs"
              />
            </div>

            <div className="space-y-1">
              <span className="text-[10px] text-faint">Filter Sections</span>
              <div className="grid grid-cols-3 gap-1 text-[10px]">
                {SECTIONS.map((sec) => (
                  <label key={sec} className="flex items-center gap-1 cursor-pointer capitalize">
                    <input
                      type="checkbox"
                      checked={searchSections.includes(sec)}
                      onChange={() => toggleSectionCheckbox(sec)}
                      className="rounded border-white/20 bg-white/10 text-cyan focus:ring-0 size-3"
                    />
                    {sec}
                  </label>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[10px] text-faint">Top K (1-10):</span>
              <input
                type="number"
                min={1}
                max={10}
                value={topK}
                onChange={(e) => setTopK(Math.max(1, Math.min(10, Number(e.target.value) || 1)))}
                className="glass-input w-16 p-1 text-xs text-center"
              />
              <button
                type="button"
                onClick={handleSearch}
                disabled={!activeDocId || !searchQuery.trim() || searchLoading}
                className="secondary-button ml-auto px-3 py-1.5"
              >
                {searchLoading ? <Loader2 className="size-3.5 animate-spin" /> : "Search"}
              </button>
            </div>

            <p className="text-[10px] text-amber/80 italic">
              Wait ~5 s after ingest; Pinecone is eventually consistent.
            </p>

            {searchError && (
              <div className="rounded border border-rose/40 bg-rose/10 p-2 text-rose break-all">
                {searchError}
              </div>
            )}

            {searchResult && (
              <div className="space-y-1.5 pt-1">
                <div className="text-faint text-[11px]">
                  Matches: <strong className="text-heading">{searchResult.matches.length}</strong>
                </div>
                <div className="max-h-52 overflow-y-auto space-y-1.5 pr-1">
                  {searchResult.matches.length === 0 ? (
                    <div className="text-faint italic p-1">No matches found.</div>
                  ) : (
                    searchResult.matches.map((match) => {
                      const isExpanded = expandedMatches[match.id];
                      const text = match.text || "";
                      const needsTruncation = text.length > 300;
                      const displayText =
                        needsTruncation && !isExpanded ? `${text.slice(0, 300)}...` : text;

                      return (
                        <div
                          key={match.id}
                          className="rounded border border-white/10 bg-black/40 p-2 text-[11px] space-y-1"
                        >
                          <div className="flex items-center justify-between text-[10px]">
                            <span className="rounded bg-cyan/20 px-1 py-0.5 text-cyan uppercase font-semibold">
                              {match.section}
                            </span>
                            <span className="font-mono text-emerald">
                              score: {match.score?.toFixed(3)}
                            </span>
                          </div>
                          <div className="font-mono text-[9px] text-faint break-all">{match.id}</div>
                          <div className="text-heading whitespace-pre-wrap">{displayText}</div>
                          {needsTruncation && (
                            <button
                              type="button"
                              onClick={() => toggleMatchExpanded(match.id)}
                              className="text-cyan hover:underline text-[10px]"
                            >
                              {isExpanded ? "Show less" : "Show more"}
                            </button>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
