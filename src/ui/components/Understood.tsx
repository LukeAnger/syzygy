import { type InputKey, useKinematicsStore } from '../../state/index.ts';
import { VARIABLES, symbolLatex, unitSymbol } from '../units.ts';
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
  const phases = useKinematicsStore((s) => s.phases);

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

  const givenSet = new Set<InputKey>(given);
  // Acceleration is always present as the free-fall assumption unless the story
  // stated it explicitly.
  //
  // Staged motion has no single pair of positions — each segment has its own,
  // and they are edited below. Showing a flat x₁/x₂ here would contradict the
  // phase list and describe motion the app is not actually solving.
  const shown: InputKey[] = VARIABLES.filter(
    (key) =>
      inputs[key].trim() !== '' && !(phases && (key === 'x1' || key === 'x2')),
  );

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
      {phases && (
        <p className={styles.staged}>
          Positions are per phase — see below.
        </p>
      )}
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
