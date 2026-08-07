import type { SolveResult } from '../../engine/index.ts';
import { useKinematicsStore } from '../../state/index.ts';
import { symbolLatex, unitSymbol, variablesFor } from '../units.ts';
import { Katex } from './Katex.tsx';
import styles from './VariableForm.module.css';

interface VariableFormProps {
  result: SolveResult;
}

/**
 * Manual entry for the five SUVAT variables. Fill what you know, leave the rest
 * blank — the solver fills them in and they render as solved (dashed green).
 */
export function VariableForm({ result }: VariableFormProps) {
  const inputs = useKinematicsStore((s) => s.inputs);
  const unitSystem = useKinematicsStore((s) => s.unitSystem);
  const setInput = useKinematicsStore((s) => s.setInput);
  const setUnitSystem = useKinematicsStore((s) => s.setUnitSystem);
  const domain = useKinematicsStore((s) => s.domain);
  const variables = variablesFor(domain);
  const loadFreeFall = useKinematicsStore((s) => s.loadFreeFall);
  const reset = useKinematicsStore((s) => s.reset);

  const solvedKeys = new Set(result.solvedOrder);

  return (
    <section className={styles.panel}>
      <h2 className={styles.title}>Variables</h2>

      <div className={styles.toggle}>
        {(['metric', 'imperial'] as const).map((system) => (
          <button
            key={system}
            type="button"
            className={`${styles.toggleOption} ${
              unitSystem === system ? styles.active : ''
            }`}
            onClick={() => setUnitSystem(system)}
          >
            {system}
          </button>
        ))}
      </div>

      <p className={styles.hint}>
        Enter the values you know. Blank fields are solved automatically.
      </p>

      {variables.map((key) => {
        const solved = solvedKeys.has(key);
        return (
          <div key={key} className={styles.row}>
            <span className={styles.symbol}>
              <Katex tex={symbolLatex(key)} />
            </span>
            <input
              className={`${styles.input} ${solved ? styles.solved : ''}`}
              value={inputs[key]}
              inputMode="decimal"
              placeholder={solved ? '—' : ''}
              onChange={(e) => setInput(key as never, e.target.value)}
            />
            <span className={styles.unit}>{unitSymbol(key, unitSystem)}</span>
          </div>
        );
      })}

      <div className={styles.controls}>
        {/* A gravity preset only means something where `a` exists. */}
        {domain === 'kinematics-1d' && (
          <button type="button" className={styles.btn} onClick={loadFreeFall}>
            Free fall
          </button>
        )}
        <button type="button" className={styles.btn} onClick={reset}>
          Reset
        </button>
      </div>
    </section>
  );
}
