import { type LinkKind } from '../../engine/index.ts';
import { displayKit, useKinematicsStore } from '../../state/index.ts';
import { unitSymbol } from '../units.ts';
import styles from './PhaseEditor.module.css';

/** What each boundary means, in the student's words rather than the model's. */
const LINK_LABELS: ReadonlyArray<readonly [LinkKind, string]> = [
  ['rest', 'stops, then goes again'],
  ['continuous', 'keeps its speed'],
  ['reversed', 'bounces back'],
];

/**
 * Editable view of a story's motion segments.
 *
 * The parser proposes the split; this is where it can be corrected. §4.4 makes
 * the manual form the ground truth and the parser a pre-fill, and phases were
 * briefly an exception — a mis-segmented story had no way back. Adding a phase
 * also works from a *single*-segment story, which is the escape hatch for
 * staged problems the parser could not segment at all.
 */
export function PhaseEditor() {
  const phases = useKinematicsStore((s) => s.phases);
  const inputs = useKinematicsStore((s) => s.inputs);
  const unitSystem = useKinematicsStore((s) => s.unitSystem);
  const displayUnits = useKinematicsStore((s) => s.displayUnits);
  // The story's own units, so a field reads back what was typed.
  const kit = displayKit(unitSystem, displayUnits);
  const story = useKinematicsStore((s) => s.story);
  const unsegmentedStages = useKinematicsStore((s) => s.unsegmentedStages);
  const setPhaseHeight = useKinematicsStore((s) => s.setPhaseHeight);
  const setPhaseLink = useKinematicsStore((s) => s.setPhaseLink);
  const addPhase = useKinematicsStore((s) => s.addPhase);
  const removePhase = useKinematicsStore((s) => s.removePhase);
  const clearPhases = useKinematicsStore((s) => s.clearPhases);

  if (!story) return null;

  const unit = unitSymbol('x1', kit);
  // "The answer below" has to actually be there. A story the parser read almost
  // nothing from shows this warning next to an empty Solution panel, and
  // pointing at an answer that was never produced reads as a second failure.
  const solvable = Object.values(inputs).filter((v) => v.trim() !== '').length >= 2;

  // Nothing staged and nothing detected: offer the split rather than showing
  // an empty editor on every ordinary problem.
  if (!phases) {
    return (
      <div className={styles.wrap}>
        {unsegmentedStages && (
          <p className={styles.warn}>
            This problem describes more than one stage of motion, but the values
            couldn&rsquo;t be split into segments
            {solvable
              ? " — the answer below treats it as one. Split it manually to model each stage."
              : '. Split it manually to model each stage, or fill the values in below.'}
          </p>
        )}
        <button type="button" className={styles.add} onClick={addPhase}>
          + Split into phases
        </button>
      </div>
    );
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.label}>Phases</div>

      {phases.phases.map((phase, i) => (
        <div key={i} className={styles.phase}>
          <div className={styles.row}>
            <span className={styles.index}>{i + 1}</span>
            <input
              className={styles.height}
              value={phase.x1}
              onChange={(e) => setPhaseHeight(i, 'x1', e.target.value)}
              aria-label={`Phase ${i + 1} start height`}
              inputMode="decimal"
            />
            <span className={styles.unit}>{unit}</span>
            <span className={styles.arrow}>→</span>
            <input
              className={styles.height}
              value={phase.x2}
              onChange={(e) => setPhaseHeight(i, 'x2', e.target.value)}
              aria-label={`Phase ${i + 1} end height`}
              inputMode="decimal"
            />
            <span className={styles.unit}>{unit}</span>
            <button
              type="button"
              className={styles.remove}
              onClick={() => removePhase(i)}
              aria-label={`Remove phase ${i + 1}`}
            >
              ×
            </button>
          </div>

          {i < phases.links.length && (
            <label className={styles.linkRow}>
              <span className={styles.linkLabel}>then it</span>
              <select
                className={styles.link}
                value={phases.links[i]!.kind}
                onChange={(e) => setPhaseLink(i, e.target.value as LinkKind)}
                aria-label={`What happens between phase ${i + 1} and ${i + 2}`}
              >
                {LINK_LABELS.map(([kind, label]) => (
                  <option key={kind} value={kind}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
      ))}

      <div className={styles.actions}>
        <button type="button" className={styles.add} onClick={addPhase}>
          + Add phase
        </button>
        <button type="button" className={styles.clear} onClick={clearPhases}>
          Solve as one phase
        </button>
      </div>
    </div>
  );
}
