import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

const labels = ["Upload", "Analyze", "Tailor", "Validate", "Export"] as const;

export function Stepper({
  currentStep,
  completedSteps,
  onStepChange,
}: {
  currentStep: number;
  completedSteps: Set<number>;
  onStepChange: (step: number) => void;
}) {
  const progress = ((Math.max(1, currentStep) - 1) / (labels.length - 1)) * 100;
  return (
    <section className="glass p-4 sm:p-5" aria-label="CV tailoring progress">
      <div className="stepper">
        <div className="stepper-track" aria-hidden="true">
          <span style={{ width: `${progress}%` }} />
        </div>
        {labels.map((label, index) => {
          const step = index + 1;
          const complete = completedSteps.has(step);
          const active = currentStep === step;
          return (
            <button
              key={label}
              type="button"
              disabled={!complete && !active}
              onClick={() => complete && onStepChange(step)}
              className={cn("step-item", active && "step-active", complete && "step-complete")}
              aria-current={active ? "step" : undefined}
            >
              <span className="step-number">
                {complete ? (
                  <Check aria-label={`${label} complete`} className="size-4 step-check" />
                ) : (
                  step
                )}
              </span>
              <span>{label}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
