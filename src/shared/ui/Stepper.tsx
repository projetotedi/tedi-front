export interface StepperProps {
  /** Nome de cada etapa, na ordem em que aparecem. */
  steps: string[];
  /** Etapa atual, contada a partir de 1. As anteriores aparecem como concluídas. */
  current: number;
  /** Nome acessível da lista: onde a pessoa está (ex.: "Etapa 2 de 2"). */
  label: string;
  /** Texto só para leitores de tela ao lado de cada etapa concluída (ex.: "concluída"). */
  completedLabel: string;
}

/**
 * Indicador de etapas de um formulário em passos. É uma lista ordenada (`<ol>`) com o nome
 * acessível `label`; a etapa atual leva `aria-current="step"` e as concluídas ganham o texto
 * `completedLabel` só para leitores de tela. Os círculos e os conectores são decorativos
 * (`aria-hidden`): quem lê o número e o estado é o texto ao lado.
 *
 * Fonte de 16px nos nomes e nos números. Os conectores somem em telas estreitas (abaixo do
 * breakpoint `sm`), onde as etapas ficam lado a lado sem eles em vez de quebrar linha.
 */
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
