import { type VariableKey, useKinematicsStore } from '../../state/index.ts';
import { symbolLatex, unitSymbol } from '../units.ts';
import { Katex } from './Katex.tsx';
import styles from './Understood.module.css';

/**
 * Read-only summary of what Storymode parsed from the problem — the trust /
 * correction layer. Values are shown, not entered; if one is wrong the student
 * jumps to manual mode to fix it (graceful degradation), but that's the
 * exception, not the required path.
 */
export function Understood() {
  const inputs = useKinematicsStore((s) => s.inputs);
  const given = useKinematicsStore((s) => s.given);
  const unitSystem = useKinematicsStore((s) => s.unitSystem);
  const setMode = useKinematicsStore((s) => s.setMode);
  const story = useKinematicsStore((s) => s.story);

  if (!story) {
    return (
      <div className={styles.wrap}>
        <p className={styles.empty}>
          Describe a free-fall problem above and Syzygy will read the values and
          solve it — no need to fill anything in.
        </p>
      </div>
    );
  }

  const givenSet = new Set<VariableKey>(given);
  // Acceleration is always present as the free-fall assumption unless the story
  // stated it explicitly.
  const shown: VariableKey[] = ['v0', 'v', 'a', 't', 'dx'].filter(
    (key) => inputs[key as VariableKey].trim() !== '',
  ) as VariableKey[];

  return (
    <div className={styles.wrap}>
      <p className={styles.label}>Understood</p>
      <div className={styles.chips}>
        {shown.map((key) => {
          const assumed = key === 'a' && !givenSet.has('a');
          return (
            <span
              key={key}
              className={`${styles.chip} ${assumed ? styles.assumed : ''}`}
            >
              <Katex tex={symbolLatex(key)} />
              <span className={styles.value}>
                {inputs[key]} {unitSymbol(key, unitSystem)}
              </span>
              {assumed ? ' (free fall)' : ''}
            </span>
          );
        })}
      </div>
      <button
        type="button"
        className={styles.adjust}
        onClick={() => setMode('manual')}
      >
        A value looks wrong? Adjust manually →
      </button>
    </div>
  );
}
