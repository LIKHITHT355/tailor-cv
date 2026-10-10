import { useState, type DragEvent, type KeyboardEvent } from "react";
import { Navigate, NavLink, Route, Routes } from "react-router-dom";
import {
  FileText,
  History,
  LayoutDashboard,
  Loader2,
  Menu,
  Sparkles,
  Upload,
  X,
  Linkedin,
  Github,
  Link as LinkIcon,
} from "lucide-react";
import { Stepper } from "@/components/Stepper";
import { StepActions } from "@/components/StepActions";
import { TextModal } from "@/components/TextModal";
import { RagTestPanel } from "@/components/RagTestPanel";
import {
  analyzeResume,
  downloadResume,
  extractResume,
  saveAddons,
  saveLinks,
  tailorResume,
  type Addon,
  UnexpectedApiResponseError,
  validateResume,
} from "@/lib/api";
import { cn } from "@/lib/utils";
import { HistoryPage } from "@/pages/HistoryPage";

function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const links = [
    ["/", "Workspace", LayoutDashboard],
    ["/history", "History", History],
  ] as const;
  return (
    <aside className={cn("sidebar glass", open && "sidebar-open")} aria-label="Main navigation">
      <div className="mb-8 flex items-center justify-between gap-2 px-2">
        <div className="flex items-center gap-2">
          <Sparkles className="size-5 text-cyan" />
          <span className="text-lg font-semibold text-gradient">CV Tailor</span>
        </div>
        <button
          type="button"
          className="icon-button md:hidden"
          onClick={onClose}
          aria-label="Close navigation"
        >
          <X className="size-4" />
        </button>
      </div>
      <nav className="space-y-1">
        {links.map(([to, label, Icon]) => (
          <NavLink
            key={to}
            to={to}
            end={to === "/"}
            onClick={onClose}
            className={({ isActive }) => cn("side-link", isActive && "side-link-active")}
          >
            <Icon className="size-4" />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}

function Workspace() {
  const [currentStep, setCurrentStep] = useState(1);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(() => new Set());
  const [file, setFile] = useState<File | null>(null);
  const [resumeText, setResumeText] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [links, setLinks] = useState<{ linkedin: string; github: string; other: string[] }>({
    linkedin: "",
    github: "",
    other: [],
  });
  const [addons, setAddons] = useState<Addon[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [documentId, setDocumentId] = useState<string | null>(null);
  const [tag, setTag] = useState("");
  const [savingLinks, setSavingLinks] = useState(false);
  const [linksSaved, setLinksSaved] = useState(false);
  const [linksError, setLinksError] = useState("");
  const [savingAddons, setSavingAddons] = useState(false);
  const [addonsSaved, setAddonsSaved] = useState(false);
  const [addonsError, setAddonsError] = useState("");
  const [extracting, setExtracting] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [textOpen, setTextOpen] = useState(false);
  const complete = (step: number, next: number) => {
    setCompletedSteps((previous) => new Set([...previous, step]));
    setCurrentStep(next);
  };
  const reset = () => {
    setCurrentStep(1);
    setCompletedSteps(new Set());
    setFile(null);
    setResumeText("");
    setJobDescription("");
    setLinks({ linkedin: "", github: "", other: [] });
    setAddons([]);
    setDocumentId(null);
    setTags([]);
    setTag("");
    setLinksSaved(false);
    setLinksError("");
    setAddonsSaved(false);
    setAddonsError("");
    setError("");
    setToast("");
  };
  const selectFile = (next: File | undefined) => {
    if (next) {
      setFile(next);
      setError("");
    }
  };
  const extract = async () => {
    if (!file) return;
    setExtracting(true);
    setError("");
    try {
      const result = await extractResume(file);
      setResumeText(result.text);
      setDocumentId(result.id);
      setFile(null);
      complete(1, 2);
    } catch (reason) {
      if (reason instanceof UnexpectedApiResponseError) {
        console.error(reason.message);
        setError(reason.friendlyMessage);
      } else {
        setError(reason instanceof Error ? reason.message : "Extraction failed");
      }
    } finally {
      setExtracting(false);
    }
  };
  const showStub = async (call: () => Promise<never>) => {
    try {
      await call();
    } catch (reason) {
      setToast(reason instanceof Error ? reason.message : "Request failed");
    }
  };
  const addTag = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter" && tag.trim()) {
      event.preventDefault();
      setTags((current) => (current.includes(tag.trim()) ? current : [...current, tag.trim()]));
      setTag("");
    }
  };

  // simple URL sanitiser – trims and ensures http(s) scheme
  const saveDocumentLinks = async () => {
    if (!documentId) return;
    setLinksSaved(false);
    setLinksError("");
    setSavingLinks(true);
    try {
      const result = await saveLinks(documentId, links);
      setLinks({
        linkedin: result.links.linkedin ?? "",
        github: result.links.github ?? "",
        other: result.links.other ?? [],
      });
      setLinksSaved(true);
    } catch (reason) {
      setLinksError(reason instanceof Error ? reason.message : "Unable to save links.");
    } finally {
      setSavingLinks(false);
    }
  };
  const saveDocumentAddons = async () => {
    if (!documentId) return;
    setAddonsSaved(false);
    setAddonsError("");
    setSavingAddons(true);
    try {
      const result = await saveAddons(
        documentId,
        addons.filter((addon) => addon.text.trim()),
      );
      setAddons(result.addons ?? []);
      setAddonsSaved(true);
    } catch (reason) {
      setAddonsError(
        reason instanceof Error ? reason.message : "Unable to save additional information.",
      );
    } finally {
      setSavingAddons(false);
    }
  };
  const drop = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    selectFile(event.dataTransfer.files[0]);
  };
  const canPrevious = currentStep > 1 ? () => setCurrentStep(currentStep - 1) : undefined;
  const primary =
    currentStep === 1
      ? { label: "Next", disabled: !file, action: extract }
      : currentStep === 2
        ? {
            label: "Analyze match",
            disabled: !resumeText || !jobDescription.trim(),
            action: () => void showStub(() => analyzeResume(resumeText, jobDescription)),
          }
        : currentStep === 3
          ? {
              label: "Tailor CV",
              disabled: !completedSteps.has(2),
              action: () => void showStub(() => tailorResume(resumeText, jobDescription)),
            }
          : currentStep === 4
            ? {
                label: "Run validation",
                disabled: !completedSteps.has(3),
                action: () => void showStub(() => validateResume(resumeText)),
              }
            : {
                label: "Download",
                disabled: !completedSteps.has(4),
                action: () => void showStub(() => downloadResume(resumeText)),
              };
  return (
    <main className="min-w-0 flex-1 space-y-4">
      <header className="glass flex items-center justify-between px-5 py-3">
        <div>
          <h1 className="text-lg font-semibold">Tailor a new CV</h1>
          <p className="text-sm text-faint">Upload, match, and refine your application</p>
        </div>
        {resumeText && (
          <button type="button" className="secondary-button" onClick={() => setTextOpen(true)}>
            <FileText className="size-4" /> View extracted text
          </button>
        )}
      </header>
      <Stepper
        currentStep={currentStep}
        completedSteps={completedSteps}
        onStepChange={setCurrentStep}
      />
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="step-content space-y-4" key={currentStep}>
          {import.meta.env.DEV && <RagTestPanel documentId={documentId} />}
          <section className="glass space-y-4 p-5">
            <h2 className="font-semibold">
              {currentStep === 1
                ? "Upload your CV"
                : currentStep === 2
                  ? "Analyze the role"
                  : `Step ${currentStep}: ${["", "", "", "Tailor", "Validate", "Export"][currentStep]}`}
            </h2>
            {currentStep === 1 && (
              <label
                onDragOver={(event) => event.preventDefault()}
                onDrop={drop}
                className="dropzone"
              >
                <input
                  type="file"
                  className="sr-only"
                  onChange={(event) => selectFile(event.target.files?.[0])}
                />
                <Upload className="size-5 text-cyan" />
                <p className="font-medium text-heading">{file?.name ?? "Drop your CV here"}</p>
                <p className="text-sm text-faint">
                  PDF, DOCX, spreadsheet, image, or text file · 25 MB max
                </p>
              </label>
            )}
            {currentStep === 1 && (
              <>
                <button
                  type="button"
                  onClick={extract}
                  disabled={!file || extracting}
                  className="cta-glass w-full px-5 py-3 font-semibold"
                >
                  {extracting && <Loader2 className="mr-2 inline size-4 animate-spin" />}
                  {extracting ? "Processing..." : "Next"}
                </button>
                {error && (
                  <p
                    className="rounded-lg border border-rose/50 bg-rose/10 p-3 text-sm text-rose"
                    role="alert"
                  >
                    {error}
                  </p>
                )}
                {extracting && (
                  <div className="extract-progress" aria-label="Extraction in progress">
                    <span />
                  </div>
                )}
              </>
            )}
            {currentStep !== 1 && (
              <p className="rounded-xl border border-emerald/30 bg-emerald/10 p-3 text-sm text-body">
                Text extracted and ready for the next step.
              </p>
            )}
            <div>
              <label
                htmlFor="job-description"
                className="mb-2 block text-sm font-medium text-heading"
              >
                Job description
              </label>
              <textarea
                id="job-description"
                value={jobDescription}
                onChange={(e) => setJobDescription(e.target.value)}
                rows={6}
                placeholder="Paste the job description here…"
                className="glass-input w-full resize-none p-3 text-sm"
              />
            </div>

            <section className="rounded-xl border border-white/10 bg-white/5 p-4">
              <div className="mb-3">
                <h3 className="font-medium text-heading">Your links</h3>
                {!documentId && (
                  <p className="mt-1 text-sm text-faint">Extract your resume first.</p>
                )}
              </div>
              <fieldset
                disabled={!documentId}
                className="space-y-3 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <div>
                  <label
                    htmlFor="linkedin"
                    className="mb-1 flex items-center gap-2 text-sm text-heading"
                  >
                    <Linkedin className="size-4" /> LinkedIn
                  </label>
                  <input
                    id="linkedin"
                    value={links.linkedin}
                    onChange={(event) => {
                      setLinks((current) => ({ ...current, linkedin: event.target.value }));
                      setLinksSaved(false);
                    }}
                    placeholder="https://linkedin.com/in/your-name"
                    className="glass-input w-full p-3 text-sm"
                  />
                </div>
                <div>
                  <label
                    htmlFor="github"
                    className="mb-1 flex items-center gap-2 text-sm text-heading"
                  >
                    <Github className="size-4" /> GitHub
                  </label>
                  <input
                    id="github"
                    value={links.github}
                    onChange={(event) => {
                      setLinks((current) => ({ ...current, github: event.target.value }));
                      setLinksSaved(false);
                    }}
                    placeholder="https://github.com/your-username"
                    className="glass-input w-full p-3 text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <p className="text-sm text-heading">Others</p>
                  {links.other.map((value, index) => (
                    <div key={index}>
                      <div className="flex gap-2">
                        <input
                          value={value}
                          onChange={(event) => {
                            const other = [...links.other];
                            other[index] = event.target.value;
                            setLinks((current) => ({ ...current, other }));
                            setLinksSaved(false);
                          }}
                          placeholder="Any URL to be used for the resume creation"
                          className="glass-input min-w-0 flex-1 p-3 text-sm"
                        />
                        <button
                          type="button"
                          className="icon-button"
                          onClick={() =>
                            setLinks((current) => ({
                              ...current,
                              other: current.other.filter((_, itemIndex) => itemIndex !== index),
                            }))
                          }
                          aria-label="Remove link"
                        >
                          <X className="size-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                  {links.other.length < 10 && (
                    <button
                      type="button"
                      className="secondary-button text-sm"
                      onClick={() => {
                        setLinks((current) => ({ ...current, other: [...current.other, ""] }));
                        setLinksSaved(false);
                      }}
                    >
                      <LinkIcon className="size-4" /> + Add another
                    </button>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => void saveDocumentLinks()}
                    disabled={savingLinks}
                  >
                    {savingLinks && <Loader2 className="size-4 animate-spin" />}
                    {savingLinks ? "Saving..." : "Save links"}
                  </button>
                  {linksSaved && <span className="text-sm text-emerald">Links saved</span>}
                </div>
                {linksError && (
                  <p className="text-sm text-rose" role="alert">
                    {linksError}
                  </p>
                )}
                <section className="space-y-2">
                  <div>
                    <h3 className="font-medium text-heading">Additional information (optional)</h3>
                    <p className="mt-1 text-sm text-faint">
                      Skills, certifications, experience or projects not in your resume.
                    </p>
                  </div>
                  {addons.map((addon, index) => (
                    <div key={index} className="space-y-2 rounded-lg border border-white/10 p-3">
                      <div className="flex gap-2">
                        <select
                          aria-label={`Additional information type ${index + 1}`}
                          value={addon.section}
                          onChange={(event) => {
                            const next = [...addons];
                            next[index] = {
                              ...addon,
                              section: event.target.value as Addon["section"],
                            };
                            setAddons(next);
                            setAddonsSaved(false);
                          }}
                          className="glass-input min-w-0 flex-1 p-3 text-sm"
                        >
                          <option value="skills">Skills</option>
                          <option value="certification">Certification</option>
                          <option value="experience">Experience</option>
                          <option value="project">Project</option>
                        </select>
                        <button
                          type="button"
                          className="icon-button"
                          onClick={() => {
                            setAddons((current) =>
                              current.filter((_, itemIndex) => itemIndex !== index),
                            );
                            setAddonsSaved(false);
                          }}
                          aria-label="Remove additional information"
                        >
                          <X className="size-4" />
                        </button>
                      </div>
                      <textarea
                        aria-label={`Additional information text ${index + 1}`}
                        value={addon.text}
                        maxLength={2000}
                        onChange={(event) => {
                          const next = [...addons];
                          next[index] = { ...addon, text: event.target.value };
                          setAddons(next);
                          setAddonsSaved(false);
                        }}
                        rows={3}
                        placeholder="Add a relevant detail"
                        className="glass-input w-full resize-none p-3 text-sm"
                      />
                      <p className="text-right text-xs text-faint">{addon.text.length}/2000</p>
                    </div>
                  ))}
                  {addons.length < 10 && (
                    <button
                      type="button"
                      className="secondary-button text-sm"
                      onClick={() => {
                        setAddons((current) => [...current, { section: "skills", text: "" }]);
                        setAddonsSaved(false);
                      }}
                    >
                      + Add another
                    </button>
                  )}
                </section>
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => void saveDocumentAddons()}
                    disabled={savingAddons}
                  >
                    {savingAddons && <Loader2 className="size-4 animate-spin" />}
                    {savingAddons ? "Saving..." : "Save additional information"}
                  </button>
                  {addonsSaved && (
                    <span className="text-sm text-emerald">Additional information saved</span>
                  )}
                </div>
                {addonsError && (
                  <p className="text-sm text-rose" role="alert">
                    {addonsError}
                  </p>
                )}
              </fieldset>
            </section>
            <div>
              <label htmlFor="focus-tags" className="mb-2 block text-sm font-medium text-heading">
                Focus tags
              </label>
              <div className="glass-input flex flex-wrap items-center gap-2 p-2">
                {tags.map((item) => (
                  <span key={item} className="tag">
                    {item}
                    <button
                      type="button"
                      onClick={() =>
                        setTags((current) => current.filter((value) => value !== item))
                      }
                      aria-label={`Remove ${item}`}
                    >
                      <X className="size-3" />
                    </button>
                  </span>
                ))}
                <input
                  id="focus-tags"
                  value={tag}
                  onChange={(event) => setTag(event.target.value)}
                  onKeyDown={addTag}
                  placeholder="Add tag…"
                  className="min-w-24 flex-1 bg-transparent px-1 text-sm text-heading outline-none"
                />
              </div>
            </div>
            <StepActions
              primaryLabel={primary.label}
              onPrimary={primary.action}
              primaryDisabled={primary.disabled}
              loading={false}
              {...(canPrevious ? { onBack: canPrevious } : {})}
              onReset={reset}
              hidePrimary={currentStep === 1}
            />
          </section>
        </div>
        <div className="space-y-4">
          <section className="glass p-5">
            <h2 className="font-semibold">Skill match</h2>
            <p className="empty-state">Run Analyze to see your skill match.</p>
          </section>
          <section className="glass p-5">
            <h2 className="font-semibold">Validation</h2>
            <p className="empty-state">Run validation to see checks for your tailored CV.</p>
          </section>
        </div>
      </div>
      {toast && (
        <div className="toast" role="status">
          <span>{toast}</span>
          <button type="button" onClick={() => setToast("")} aria-label="Dismiss notification">
            <X className="size-4" />
          </button>
        </div>
      )}
      <TextModal
        open={textOpen}
        title="Extracted text"
        text={resumeText}
        onClose={() => setTextOpen(false)}
      />
    </main>
  );
}

export function App() {
  const [navOpen, setNavOpen] = useState(false);
  return (
    <div className="min-h-screen">
      <div className="bg-scene">
        <div className="orb -left-32 -top-32 size-[32rem] bg-cyan" />
        <div className="orb -bottom-40 -right-32 size-[34rem] bg-emerald" />
      </div>
      <button
        type="button"
        className="mobile-menu icon-button glass md:hidden"
        onClick={() => setNavOpen(true)}
        aria-label="Open navigation"
      >
        <Menu className="size-5" />
      </button>
      <div className="app-shell">
        <Sidebar open={navOpen} onClose={() => setNavOpen(false)} />
        <Routes>
          <Route path="/" element={<Workspace />} />
          <Route path="/history" element={<HistoryPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </div>
  );
}
