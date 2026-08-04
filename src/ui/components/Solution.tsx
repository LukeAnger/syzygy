import type { UnitSystem } from '../../math/index.ts';
import type { SolveResult } from '../../engine/index.ts';
import type { VariableKey } from '../../state/index.ts';
import { VARIABLES, formatVar, symbolLatex } from '../units.ts';
import { Katex } from './Katex.tsx';
import styles from './Solution.module.css';

interface SolutionProps {
  result: SolveResult;
  unitSystem: UnitSystem;
}

/** Renders the solver's ordered worked steps, KaTeX-typeset. */
export function Solution({ result, unitSystem }: SolutionProps) {
  const { steps, unsolved, knowns } = result;

  if (steps.length === 0) {
    return (
      <section className={styles.panel}>
        <h2 className={styles.title}>Solution</h2>
        <p className={styles.empty}>
          Enter three known variables (or describe a problem in Storymode) and
          the worked solution appears here.
        </p>
      </section>
    );
  }

  return (
    <section className={styles.panel}>
      <h2 className={styles.title}>Solution</h2>

      {steps.map((step, i) => {
        const key = step.target as VariableKey;
        return (
          <div key={`${step.target}-${i}`} className={styles.step}>
            <div className={styles.stepHead}>
              Step {i + 1} — solve for <b>{step.target}</b>
            </div>
            <Katex tex={step.equationLatex} block />
            {step.rearrangedLatex !== step.equationLatex && (
              <Katex tex={step.rearrangedLatex} block />
            )}
            <div className={styles.inputs}>
              {step.inputs
                .map((input) =>
                  `${input.key} = ${formatVar(
                    input.key as VariableKey,
                    input.value,
                    unitSystem,
                  )}`,
                )
                .join(',  ')}
            </div>
            <div className={styles.result}>
              {step.target} = {formatVar(key, step.result, unitSystem)}
            </div>
            {step.discarded.map((d, j) => (
              <div key={j} className={styles.discard}>
                rejected {formatVar(key, d.value, unitSystem)} — {d.reason}
              </div>
            ))}
          </div>
        );
      })}

      <div className={styles.summary}>
        {VARIABLES.filter((key) => knowns[key]).map((key) => (
          <span key={key} className={styles.summaryItem}>
            <Katex tex={symbolLatex(key)} /> ={' '}
            {formatVar(key, knowns[key]!, unitSystem)}
          </span>
        ))}
      </div>

      {unsolved.length > 0 && (
        <p className={styles.unsolved}>
          Not enough information to solve: {unsolved.join(', ')}. Add another
          known value.
        </p>
      )}
    </section>
  );
}
