import { Suspense, lazy, useMemo } from 'react';
import {
  type Mode,
  solveInputs,
  solvePhaseSequence,
  useKinematicsStore,
} from './state/index.ts';
import { phaseRelevanceFor } from './engine/index.ts';
import { Header } from './ui/components/Header.tsx';
import { VariableForm } from './ui/components/VariableForm.tsx';
import { Storymode } from './ui/components/Storymode.tsx';
import { Solution } from './ui/components/Solution.tsx';
import { MotionChart } from './ui/components/MotionChart.tsx';
import { WorkItThrough } from './ui/components/WorkItThrough.tsx';
import styles from './App.module.css';

// Lazy behind a statically-false flag in production, so the whole dev panel —
// and the corpus it imports — is dropped from the bundle rather than hidden.
const DevPanel = import.meta.env.DEV
  ? lazy(() => import('./ui/components/DevPanel.tsx'))
  : null;

const MODES: { id: Mode; label: string }[] = [
  { id: 'story', label: 'Storymode' },
  { id: 'manual', label: 'Manual' },
];

export default function App() {
  const mode = useKinematicsStore((s) => s.mode);
  const setMode = useKinematicsStore((s) => s.setMode);
  const inputs = useKinematicsStore((s) => s.inputs);
  const unitSystem = useKinematicsStore((s) => s.unitSystem);
  // Only Storymode carries a question; the manual form has no prose to ask one.
  const asked = useKinematicsStore((s) => (s.mode === 'story' ? s.asked : undefined));
  const given = useKinematicsStore((s) => s.given);
  const phases = useKinematicsStore((s) => s.phases);
  // Only meaningful when the parser could not split a staged story *and* has
  // no phase sequence to fall back on.
  const tutorEnabled = useKinematicsStore((s) => s.tutorEnabled);
  const story = useKinematicsStore((s) => s.story);
  const staged = useKinematicsStore(
    (s) => s.mode === 'story' && s.unsegmentedStages && !s.phases,
  );

  const result = useMemo(
    () => solveInputs(inputs, unitSystem),
    [inputs, unitSystem],
  );

  // Only Storymode can describe staged motion; the manual form is one segment
  // by construction.
  const phaseResult = useMemo(
    () =>
      mode === 'story' && phases
        ? solvePhaseSequence(phases, inputs, unitSystem)
        : undefined,
    [mode, phases, inputs, unitSystem],
  );

  // Chart only the motion the answer rests on. Plotting a stage the answer
  // ignores makes it look load-bearing, which is the opposite of the lesson.
  const charted = useMemo(() => {
    if (!phaseResult) return [result];
    if (!asked || !phases) return phaseResult.phases;
    const relevance = phaseRelevanceFor(asked, phaseResult, phases.links);
    return relevance.needed.map((i) => phaseResult.phases[i]!);
  }, [phaseResult, result, asked, phases]);

  return (
    <div className={styles.app}>
      <Header />

      <div className={styles.modeSwitch}>
        {MODES.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            className={`${styles.modeBtn} ${mode === id ? styles.active : ''}`}
            onClick={() => setMode(id)}
          >
            {label}
          </button>
        ))}
      </div>

      <div className={styles.grid}>
        <div className={styles.left}>
          {mode === 'story' ? <Storymode /> : <VariableForm result={result} />}
        </div>
        <div className={styles.right}>
          {/* Keyed on the story so the questions reset for each new problem
              rather than staying answered from the last one. */}
          <WorkItThrough
            key={story}
            asked={tutorEnabled && mode === 'story' ? asked : undefined}
            given={given}
            result={result}
            unitSystem={unitSystem}
          >
          <Solution
            result={result}
            unitSystem={unitSystem}
            asked={asked}
            given={given}
            phaseResult={phaseResult}
            phaseLinks={phases?.links}
            staged={staged}
          />
          </WorkItThrough>
          <MotionChart
            results={charted}
            unitSystem={unitSystem}
          />
        </div>
      </div>

      {DevPanel && (
        <Suspense fallback={null}>
          <DevPanel />
        </Suspense>
      )}
    </div>
  );
}
