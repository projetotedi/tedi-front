export interface StepperProps {
  steps: string[];
  current: number;
  label: string;
  completedLabel: string;
}

export function Stepper({ steps, current, label, completedLabel }: StepperProps) {
  return (
    <ol aria-label={label} className="flex flex-wrap items-center justify-center gap-x-3 gap-y-2">
      {steps.map((name, index) => {
        const number = index + 1;
        const isDone = number < current;
        const isCurrent = number === current;
        const isLast = index === steps.length - 1;

        return (
          <li
            key={name}
            aria-current={isCurrent ? "step" : undefined}
            className="flex items-center gap-2 text-base"
          >
            <span
              aria-hidden="true"
              className={`flex size-7 shrink-0 items-center justify-center rounded-full font-semibold ${
                isDone || isCurrent
                  ? "bg-accent text-accent-foreground"
                  : "bg-separator text-foreground"
              }`}
            >
              {isDone ? "✓" : number}
            </span>
            <span className={isCurrent ? "font-semibold text-foreground" : "text-muted"}>
              {name}
            </span>
            {isDone ? <span className="sr-only">{completedLabel}</span> : null}
            {isLast ? null : (
              <span
                aria-hidden="true"
                className={`ms-1 hidden h-0.5 w-12 rounded-full sm:block ${
                  isDone ? "bg-accent" : "bg-separator"
                }`}
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}
