import { useEffect, useState, type ButtonHTMLAttributes } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/cn";
import { formatWhen, type Step } from "@/lib/sparks";

export function Button({
  variant = "primary",
  className,
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ghost" | "quiet";
}) {
  return (
    <button
      type={type}
      className={cn(
        "inline-flex h-11 items-center justify-center gap-2 rounded-lg px-4 text-sm font-medium transition-colors duration-150 ease-out disabled:opacity-50",
        variant === "primary" && "bg-accent text-accent-fg",
        variant === "ghost" && "border border-line bg-elevated text-ink",
        variant === "quiet" && "px-3 text-muted",
        className,
      )}
      {...props}
    />
  );
}

export function Time({ ts }: { ts: number }) {
  const [label, setLabel] = useState("");
  useEffect(() => {
    const render = () => setLabel(formatWhen(ts));
    render();
    const timer = window.setInterval(render, 60_000);
    return () => window.clearInterval(timer);
  }, [ts]);
  return <span className="tabular-nums">{label || "·"}</span>;
}

export function StepList({
  steps,
  onToggle,
  onText,
}: {
  steps: Step[];
  onToggle: (index: number) => void;
  onText: (index: number, text: string) => void;
}) {
  return (
    <ul>
      {steps.map((step, index) => (
        <li key={index} className="border-b border-line last:border-b-0">
          <div className="flex min-h-11 items-start gap-3 py-2">
            <button
              type="button"
              role="checkbox"
              aria-checked={step.done}
              aria-label={step.done ? "标为未做" : "标为已做"}
              onClick={() => onToggle(index)}
              className={cn(
                "mt-1 grid size-5 shrink-0 place-items-center rounded-sm border",
                step.done ? "border-accent bg-accent text-accent-fg" : "border-line-strong bg-elevated",
              )}
            >
              {step.done ? <Check className="size-3" strokeWidth={2.5} aria-hidden /> : null}
            </button>
            <input
              value={step.text}
              aria-label={`第 ${index + 1} 步`}
              onChange={(event) => onText(index, event.target.value)}
              className={cn(
                "min-h-11 w-full bg-transparent py-1 text-sm leading-6 focus:outline-none",
                step.done ? "text-muted line-through" : "text-ink",
              )}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
