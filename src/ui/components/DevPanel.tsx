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
  // For "Work it through": both ask a question and offer a real choice.
  // Verified with the relevance trace — the brick's two heights genuinely do
  // not enter v, since v = v0 + at needs only the duration.
  {
    id: 'tutor-all-needed',
    text: 'A ball is dropped from a height of 45 m. How fast is it going when it lands?',
  },
  // Relative velocity, from a standard problem set.
  {
    id: 'rv-two-vehicles',
    text:
      'A motorcycle traveling on the highway at a speed of 120 km/h passes a ' +
      'car traveling at a speed of 90 km/h. From the point of view of a ' +
      'passenger on the car, what is the velocity of the motorcycle?',
  },
  // Known gap: needs "straight up" read as v_a = 0, and "relative to the
  // truck" to outrank word order in deciding which body is which.
  {
    id: 'rv-inferred-zero',
    text:
      'A ball is kicked off the back of a pickup truck traveling at 50 km/h. A ' +
      'pedestrian on the ground sees the ball hit the pavement and then bounce ' +
      'straight up. What was the velocity of the ball relative to the truck?',
  },
  {
    id: 'tutor-two-distractors',
    text: 'A brick is dropped from 80 m onto a shed 5 m tall and takes 3.9 s. How fast is it moving when it lands?',
  },
  // The two river archetypes, side by side. Worth one click each precisely
  // because they are hard to tell apart by eye: if a change ever makes the
  // second read like the first, the answer stays plausible and stops being
  // right, which is the failure mode that is hardest to notice by hand.
  {
    id: 'rv2d-duck-drift',
    text:
      'A duck swims at a constant speed from one side of a river to the other ' +
      'side in a time of 4 seconds. The river is 6 meters wide and it is ' +
      'flowing at a speed of 2 m/s. What is the velocity of the duck and what ' +
      'is its direction of travel, with respect to ground?',
  },
  {
    id: 'rv2d-swimmer-compensating',
    text:
      'A swimmer who can swim at 1.2 m/s must head upstream to land directly ' +
      'opposite across a river 30 m wide flowing at 0.5 m/s. At what angle ' +
      'must she head?',
  },
];

const label = (id: string) => id.replace(/-/g, ' ');

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

  const problems = [...CORPUS.map((c) => ({ id: c.id, text: c.text })), ...EXTRA];
  const run = lastSmartRun();

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
          <div className={styles.label}>Load a problem</div>
          <div className={styles.buttons}>
            {problems.map((p) => (
              <button
                key={p.id}
                type="button"
                className={styles.chip}
                title={p.text}
                disabled={solving}
                // Fills the box as well as solving, so the problem stays
                // visible and editable rather than vanishing into a result.
                onClick={() => {
                  setDraft(p.text);
                  void submitStory(p.text);
                }}
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
