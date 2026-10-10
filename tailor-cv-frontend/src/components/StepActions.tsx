import { Loader2 } from "lucide-react";

export function StepActions({
  primaryLabel,
  onPrimary,
  primaryDisabled,
  loading,
  onBack,
  onReset,
  hidePrimary,
}: {
  primaryLabel: string;
  onPrimary: () => void;
  primaryDisabled: boolean;
  loading?: boolean;
  onBack?: () => void;
  onReset: () => void;
  hidePrimary?: boolean;
}) {
  return (
    <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-foreground/10 pt-4">
      {onBack && (
        <button type="button" onClick={onBack} className="secondary-button">
          Back
        </button>
      )}
      {!hidePrimary && (
        <button
          type="button"
          onClick={onPrimary}
          disabled={primaryDisabled || loading}
          className="cta-glass min-w-40 px-5 py-2.5 font-semibold"
        >
          {loading && <Loader2 className="mr-2 inline size-4 animate-spin" />}
          {loading ? "Extracting..." : primaryLabel}
        </button>
      )}
      <button
        type="button"
        onClick={onReset}
        className="ml-auto text-sm text-faint hover:text-cyan focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan"
      >
        Clear / Start over
      </button>
    </div>
  );
}
