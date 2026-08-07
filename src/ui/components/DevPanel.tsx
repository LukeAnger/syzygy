/**
 * Development tooling: load a known problem in one click, and see what the
 * parsers actually did with it.
 *
 * Never shipped. `App` imports this lazily behind `import.meta.env.DEV`, which
 * Vite replaces with `false` in a production build, so the whole module — and
 * the corpus it pulls in — is dropped from the bundle rather than merely
 * hidden. Verify with `npm run build`: no dev chunk should appear.
 *
 * The part worth having is the engine split. `mergeParses` gives the grammar
 * priority, so as the grammar improves the model's contribution shrinks — a
 * story can parse perfectly while smart parse adds nothing at all. "It works"
 * cannot distinguish those, and this can.
 *
 * The buttons come from `dev-problems.ts`, grouped by the domain each problem
 * should be detected as. That file is tested; the grouping is a claim the
 * suite enforces rather than a label.
 */
import { useState } from 'react';
import { useKinematicsStore } from '../../state/index.ts';
import { CORPUS } from '../../nlp/corpus.ts';
import { DEV_GROUPS } from '../dev-problems.ts';
import { lastSmartRun } from '../../nlp/smart/index.ts';
import styles from './DevPanel.module.css';

const label = (id: string) => id.replace(/-/g, ' ');

/** Hover text: the problem, and what is known not to work about it. */
const gapNote = (p: { text: string; gap?: string }) =>
  p.gap ? `${p.text}\n\n⚠ ${p.gap}` : p.text;

export default function DevPanel() {
  const [open, setOpen] = useState(false);
  const submitStory = useKinematicsStore((s) => s.submitStory);
  const setDraft = useKinematicsStore((s) => s.setDraft);
  const solving = useKinematicsStore((s) => s.solving);
  const diagnostics = useKinematicsStore((s) => s.diagnostics);
  const story = useKinematicsStore((s) => s.story);
  const phases = useKinematicsStore((s) => s.phases);
  const smartStatus = useKinematicsStore((s) => s.smartStatus);
  const unsegmented = useKinematicsStore((s) => s.unsegmentedStages);

  const run = lastSmartRun();

  const load = (text: string) => {
    // Fills the box as well as solving, so the problem stays visible and
    // editable rather than vanishing into a result.
    setDraft(text);
    void submitStory(text);
  };

  // The corpus is all kinematics, and long, so it hangs off that group rather
  // than being listed by hand.
  const groups = DEV_GROUPS.map((group) =>
    group.domain === 'kinematics-1d'
      ? {
          ...group,
          problems: [
            ...CORPUS.map((c) => ({ id: c.id, text: c.text })),
            ...group.problems,
          ],
        }
      : group,
  );

  return (
    <section className={styles.panel}>
      <button
        type="button"
        className={styles.toggle}
        onClick={() => setOpen((v) => !v)}
      >
        {open ? '▾' : '▸'} dev tools{solving ? ' · solving…' : ''}
      </button>

      {open && (
        <div className={styles.body}>
          {groups.map((group) => (
            <div key={group.heading}>
              <div className={styles.label}>{group.heading}</div>
              <div className={styles.buttons}>
                {group.problems.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    className={styles.chip}
                    title={gapNote(p)}
                    disabled={solving}
                    onClick={() => load(p.text)}
                  >
                    {label(p.id)}
                  </button>
                ))}
              </div>
              {group.note && <p className={styles.groupNote}>{group.note}</p>}
            </div>
          ))}

          <div className={styles.label}>Last parse</div>
          {diagnostics ? (
            <dl className={styles.rows}>
              <dt>engine</dt>
              <dd>
                {diagnostics.engine}
                {diagnostics.engine === 'rule' && smartStatus === 'ready' && (
                  <span className={styles.note}> (smart returned nothing usable)</span>
                )}
              </dd>
              <dt>from grammar</dt>
              <dd>{diagnostics.fromRule.join(' ') || '—'}</dd>
              <dt>from model</dt>
              <dd className={diagnostics.fromSmart.length ? styles.good : styles.none}>
                {diagnostics.fromSmart.join(' ') || 'nothing — grammar covered it all'}
              </dd>
              <dt>asked for</dt>
              <dd>{diagnostics.asked ?? '—'}</dd>
              <dt>phases</dt>
              <dd>
                {diagnostics.phaseCount}
                {unsegmented && <span className={styles.note}> (staged, unsplit)</span>}
                {phases && <span className={styles.note}> · editable</span>}
              </dd>
              <dt>unplaced</dt>
              <dd className={diagnostics.unusedNumbers.length ? styles.warn : undefined}>
                {diagnostics.unusedNumbers.join(', ') || '—'}
              </dd>
            </dl>
          ) : (
            <p className={styles.empty}>Solve a problem to see the breakdown.</p>
          )}

          <div className={styles.label}>Smart parse internals</div>
          {run && run.text === story ? (
            <dl className={styles.rows}>
              <dt>raw output</dt>
              <dd>
                <code className={styles.raw}>{run.raw || '(empty)'}</code>
              </dd>
              <dt>took</dt>
              <dd>{run.ms} ms</dd>
              <dt>examples shown</dt>
              <dd>
                <ol className={styles.examples}>
                  {run.examples.map((text, i) => (
                    <li key={i}>{text}</li>
                  ))}
                </ol>
                <span className={styles.note}>nearest last</span>
              </dd>
            </dl>
          ) : (
            <p className={styles.empty}>
              {smartStatus === 'ready'
                ? 'No smart run for the current problem.'
                : `Smart parse is ${smartStatus}.`}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
