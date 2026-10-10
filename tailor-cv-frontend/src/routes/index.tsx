/* Legacy single-page prototype retained below for design reference.
import { createFileRoute } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import {
  Check, FileText, LayoutDashboard, History, Settings, Upload, Sparkles, Loader2, X, Sun, Moon, AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "CV Tailor — Match your CV to any job" },
      { name: "description", content: "Upload your CV and a job description, and get a tailored, validated CV in LaTeX and PDF." },
      { property: "og:title", content: "CV Tailor — Match your CV to any job" },
      { property: "og:description", content: "Upload your CV and a job description, and get a tailored, validated CV." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

type Tone = "cyan" | "emerald" | "amber" | "rose";
const toneCls: Record<Tone, string> = {
  cyan: "bg-cyan/15 border-cyan/40 text-cyan",
  emerald: "bg-emerald/15 border-emerald/40 text-emerald",
  amber: "bg-amber/15 border-amber/40 text-amber",
  rose: "bg-rose/15 border-rose/40 text-rose",
};
function Badge({ tone, children }: { tone: Tone; children: ReactNode }) {
  return <span className={cn("inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium", toneCls[tone])}>{children}</span>;
}
const steps = ["Upload", "Analyze", "Tailor", "Validate", "Export"];
const facts = [
  { skill: "React & TypeScript", status: "Matched", tone: "emerald" as Tone, src: "Resume" },
  { skill: "GraphQL APIs", status: "Partial", tone: "amber" as Tone, src: "Add-on" },
  { skill: "Kubernetes", status: "Missing", tone: "rose" as Tone, src: "Add-on" },
  { skill: "Design systems", status: "Matched", tone: "emerald" as Tone, src: "Resume" },
];
const checks = [
  { label: "No invented experience", state: "pass" },
  { label: "Keywords from job description included", state: "pass" },
  { label: "Fits on one page", state: "pending" },
  { label: "Dates consistent", state: "fail" },
] as const;

function Dropzone({ label, hint }: { label: string; hint: string }) {
  const [over, setOver] = useState(false);
  const [file, setFile] = useState<string | null>(null);
  return (
    <label
      onDragOver={(e) => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => { e.preventDefault(); setOver(false); setFile(e.dataTransfer.files[0]?.name ?? null); }}
      className={cn(
        "glass glossy-sheen lift flex cursor-pointer flex-col items-center justify-center gap-3 border-2 border-dashed border-foreground/20 p-8 text-center",
        over && "glass-glow-cyan border-cyan/60",
      )}
    >
      <input type="file" className="sr-only" onChange={(e) => setFile(e.target.files?.[0]?.name ?? null)} />
      <div className="grid size-12 place-items-center rounded-xl border border-cyan/30 bg-cyan/10 text-cyan">
        {file ? <FileText className="size-5" /> : <Upload className="size-5" />}
      </div>
      <div>
        <p className="font-medium text-heading">{file ?? label}</p>
        <p className="text-sm text-faint">{hint}</p>
      </div>
    </label>
  );
}
*/

import { createFileRoute } from "@tanstack/react-router";
import { App } from "@/App";

export const Route = createFileRoute("/")({ component: App });

function Index() {
  const [light, setLight] = useState(false);
  const [step] = useState(2);
  const [tags, setTags] = useState(["Senior", "Frontend", "Remote"]);
  const [tag, setTag] = useState("");
  const [tab, setTab] = useState<"latex" | "pdf">("latex");

  return (
    <div className={cn("min-h-screen", light && "light")} style={{ background: "var(--base)" }}>
      <div className="bg-scene">
        <div className="orb -left-32 -top-32 size-[32rem] bg-cyan" />
        <div
          className="orb -bottom-40 -right-32 size-[34rem] bg-emerald"
          style={{ animationDelay: "-8s" }}
        />
        <div
          className="orb right-1/4 top-1/3 size-[22rem] bg-amber"
          style={{ animationDelay: "-14s" }}
        />
      </div>

      <div className="flex gap-4 p-4">
        <aside className="glass sticky top-4 hidden h-[calc(100vh-2rem)] w-60 shrink-0 flex-col p-4 md:flex">
          <div className="mb-8 flex items-center gap-2 px-2">
            <Sparkles className="size-5 text-cyan" />
            <span className="text-lg font-semibold text-gradient">CV Tailor</span>
          </div>
          <nav className="space-y-1 text-sm">
            {[
              ["Workspace", LayoutDashboard, true],
              ["History", History, false],
              ["Settings", Settings, false],
            ].map(([l, I, a]) => {
              const Icon = I as typeof History;
              return (
                <a
                  key={l as string}
                  href="#"
                  className={cn(
                    "flex items-center gap-3 rounded-xl border border-transparent px-3 py-2 transition-colors hover:bg-glass",
                    a ? "glass-glow-cyan bg-cyan/10 text-cyan" : "text-body",
                  )}
                >
                  <Icon className="size-4" />
                  {l as string}
                </a>
              );
            })}
          </nav>
        </aside>

        <main className="min-w-0 flex-1 space-y-4">
          <header className="glass flex items-center justify-between px-5 py-3">
            <div>
              <h1 className="text-lg font-semibold">Tailor a new CV</h1>
              <p className="text-sm text-faint">Frontend Engineer · Acme Corp</p>
            </div>
            <button
              onClick={() => setLight(!light)}
              aria-label="Toggle theme"
              className="glass grid size-9 place-items-center rounded-full! text-body hover:text-cyan"
            >
              {light ? <Moon className="size-4" /> : <Sun className="size-4" />}
            </button>
          </header>

          {/* Stepper */}
          <section className="glass fade-up p-5">
            <div className="relative flex items-center justify-between">
              <div className="absolute left-6 right-6 top-1/2 h-px -translate-y-1/2 bg-foreground/10" />
              <div
                className="absolute left-6 top-1/2 h-0.5 -translate-y-1/2"
                style={{
                  width: `calc((100% - 3rem) * ${step / (steps.length - 1)})`,
                  background: "var(--gradient-brand)",
                }}
              />
              {steps.map((s, i) => (
                <div key={s} className="relative flex flex-col items-center gap-2">
                  <div
                    className={cn(
                      "grid size-10 place-items-center rounded-full border text-sm font-semibold backdrop-blur-xl",
                      i < step && "border-emerald/50 bg-emerald/15 text-emerald",
                      i === step && "ring-pulse border-cyan/60 bg-cyan/15 text-cyan",
                      i > step && "border-foreground/20 bg-glass text-faint",
                    )}
                  >
                    {i < step ? <Check className="size-4" /> : i + 1}
                  </div>
                  <span className={cn("text-xs", i === step ? "text-cyan" : "text-faint")}>
                    {s}
                  </span>
                </div>
              ))}
            </div>
          </section>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="fade-up space-y-4" style={{ animationDelay: "80ms" }}>
              <Dropzone label="Drop your CV" hint="PDF, DOCX or .tex" />
              <section className="glass space-y-4 p-5">
                <div>
                  <label className="mb-2 block text-sm font-medium text-heading">
                    Job description
                  </label>
                  <textarea
                    rows={5}
                    placeholder="Paste the job description here…"
                    className="glass-input w-full resize-none p-3 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-heading">Focus tags</label>
                  <div className="glass-input flex flex-wrap items-center gap-2 p-2">
                    {tags.map((t) => (
                      <span
                        key={t}
                        className="inline-flex items-center gap-1 rounded-full border border-cyan/40 bg-cyan/15 px-2.5 py-0.5 text-xs text-cyan"
                      >
                        {t}
                        <button
                          onClick={() => setTags(tags.filter((x) => x !== t))}
                          aria-label={`Remove ${t}`}
                        >
                          <X className="size-3" />
                        </button>
                      </span>
                    ))}
                    <input
                      value={tag}
                      onChange={(e) => setTag(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && tag.trim()) {
                          setTags([...tags, tag.trim()]);
                          setTag("");
                        }
                      }}
                      placeholder="Add tag…"
                      className="min-w-24 flex-1 bg-transparent px-1 text-sm text-heading outline-none"
                    />
                  </div>
                </div>
                <button className="cta-glass flex w-full items-center justify-center gap-2 px-6 py-3 font-semibold">
                  <Sparkles className="size-4 text-cyan" /> Tailor My CV
                </button>
              </section>
            </div>

            <div className="fade-up space-y-4" style={{ animationDelay: "160ms" }}>
              <section className="glass glossy-sheen lift overflow-hidden p-0">
                <div className="flex items-center justify-between px-5 py-4">
                  <h2 className="font-semibold">Skill match</h2>
                  <Badge tone="cyan">72% match</Badge>
                </div>
                <table className="w-full text-sm">
                  <tbody>
                    {facts.map((f) => (
                      <tr key={f.skill} className="border-t border-foreground/5">
                        <td className="px-5 py-3 text-heading">{f.skill}</td>
                        <td className="px-2 py-3">
                          <Badge tone={f.src === "Resume" ? "cyan" : "amber"}>{f.src}</Badge>
                        </td>
                        <td className="px-5 py-3 text-right">
                          <Badge tone={f.tone}>{f.status}</Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>

              <section className="glass space-y-2 p-5">
                <h2 className="mb-2 font-semibold">Validation</h2>
                {checks.map((c) => (
                  <div
                    key={c.label}
                    className={cn(
                      "flex items-center gap-3 rounded-xl border px-3 py-2 text-sm",
                      c.state === "fail"
                        ? "border-rose/30 bg-rose/15 text-heading"
                        : "border-foreground/10 bg-glass",
                    )}
                  >
                    {c.state === "pass" && (
                      <Check className="size-4 text-emerald drop-shadow-[0_0_6px_var(--emerald)]" />
                    )}
                    {c.state === "pending" && (
                      <Loader2 className="size-4 animate-spin text-amber" />
                    )}
                    {c.state === "fail" && <AlertTriangle className="size-4 text-rose" />}
                    <span className={c.state === "fail" ? "text-heading" : "text-body"}>
                      {c.label}
                    </span>
                  </div>
                ))}
              </section>
            </div>
          </div>

          <section className="glass fade-up p-5" style={{ animationDelay: "240ms" }}>
            <div className="mb-4 inline-flex rounded-full border border-foreground/10 bg-glass p-1 text-sm">
              {(["latex", "pdf"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={cn(
                    "rounded-full px-4 py-1.5 transition-colors",
                    tab === t ? "bg-cyan/15 text-cyan" : "text-faint hover:text-heading",
                  )}
                >
                  {t === "latex" ? "LaTeX" : "PDF preview"}
                </button>
              ))}
            </div>
            {tab === "latex" ? (
              <pre
                className="overflow-x-auto rounded-xl border border-foreground/10 bg-base/60 p-4 font-mono text-sm leading-relaxed text-body"
                style={{ background: "color-mix(in oklab, black 30%, transparent)" }}
              >
                <span className="text-cyan">\section</span>
                {"{"}Experience{"}"}
                {"\n"}
                <span className="text-cyan">\textbf</span>
                {"{"}Senior Frontend Engineer{"}"}{" "}
                <span className="text-faint">% Acme Corp, 2022–now</span>
                {"\n"}
                <span className="text-cyan">\begin</span>
                {"{"}
                <span className="text-emerald">itemize</span>
                {"}"}
                {"\n"}
                {"  "}
                <span className="text-cyan">\item</span> Led migration to React + TypeScript across
                40 screens.{"\n"}
                {"  "}
                <span className="text-cyan">\item</span> Built a design system used by 6 product
                teams.{"\n"}
                <span className="text-cyan">\end</span>
                {"{"}
                <span className="text-emerald">itemize</span>
                {"}"}
              </pre>
            ) : (
              <div className="glass glass-glow-cyan mx-auto aspect-[1/1.3] max-w-sm space-y-3 p-6">
                <div className="h-4 w-1/2 rounded bg-foreground/20" />
                <div className="h-2 w-1/3 rounded bg-foreground/10" />
                {Array.from({ length: 10 }).map((_, i) => (
                  <div
                    key={i}
                    className="h-2 rounded bg-foreground/10"
                    style={{ width: `${70 + ((i * 13) % 30)}%` }}
                  />
                ))}
              </div>
            )}
          </section>
        </main>
      </div>
    </div>
  );
}
