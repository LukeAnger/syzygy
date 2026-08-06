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
 */
import { useState } from 'react';
import { useKinematicsStore } from '../../state/index.ts';
import { CORPUS } from '../../nlp/corpus.ts';
import { lastSmartRun } from '../../nlp/smart/index.ts';
import styles from './DevPanel.module.css';

/**
 * Problems worth one click. The hand-written corpus, plus cases it cannot
 * represent: `CorpusCase` has a flat set of expected values, so the two-phase
 * roof problem has no home there despite being the sharpest test we have.
 */
const EXTRA: { id: string; text: string }[] = [
  {
    id: 'roof-two-phase',
    text:
      'a ball is dropped off a roof at 150m then falls on another roof thats 30m ' +
      'high. the ball then rolls off and falls to the ground. how fast is the ' +
      'ball traveling when it hits the ground?',
  },
  {
    id: 'staged-unsegmentable',
    text: 'a ball falls 40 m and then rolls off and hits the ground',
  },
  { id: 'plain-drop', text: 'A ball is dropped from a height of 45 m' },
];

const label = (id: string) => id.replace(/-/g, ' ');

export default function DevPanel() {
  const [open, setOpen] = useState(false);
  const submitStory = useKinematicsStore((s) => s.submitStory);
  const diagnostics = useKinematicsStore((s) => s.diagnostics);
  const story = useKinematicsStore((s) => s.story);
  const phases = useKinematicsStore((s) => s.phases);
  const smartStatus = useKinematicsStore((s) => s.smartStatus);
  const unsegmented = useKinematicsStore((s) => s.unsegmentedStages);

  const problems = [...CORPUS.map((c) => ({ id: c.id, text: c.text })), ...EXTRA];
  const run = lastSmartRun();

  return (
    <section className={styles.panel}>
      <button
        type="button"
        className={styles.toggle}
        onClick={() => setOpen((v) => !v)}
      >
        {open ? '▾' : '▸'} dev
      </button>

      {open && (
        <div className={styles.body}>
          <div className={styles.label}>Load a problem</div>
          <div className={styles.buttons}>
            {problems.map((p) => (
              <button
                key={p.id}
                type="button"
                className={styles.chip}
                title={p.text}
                onClick={() => void submitStory(p.text)}
              >
                {label(p.id)}
              </button>
            ))}
          </div>

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
            <div className={styles.rows}>
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
            </div>
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
