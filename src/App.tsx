import { useMemo } from 'react';
import { type Mode, solveInputs, useKinematicsStore } from './state/index.ts';
import { Header } from './ui/components/Header.tsx';
import { VariableForm } from './ui/components/VariableForm.tsx';
import { Storymode } from './ui/components/Storymode.tsx';
import { Solution } from './ui/components/Solution.tsx';
import { MotionChart } from './ui/components/MotionChart.tsx';
import styles from './App.module.css';

const MODES: { id: Mode; label: string }[] = [
  { id: 'story', label: 'Storymode' },
  { id: 'manual', label: 'Manual' },
];

export default function App() {
  const mode = useKinematicsStore((s) => s.mode);
  const setMode = useKinematicsStore((s) => s.setMode);
  const inputs = useKinematicsStore((s) => s.inputs);
  const unitSystem = useKinematicsStore((s) => s.unitSystem);

  const result = useMemo(
    () => solveInputs(inputs, unitSystem),
    [inputs, unitSystem],
  );

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
          <Solution result={result} unitSystem={unitSystem} />
          <MotionChart result={result} unitSystem={unitSystem} />
        </div>
      </div>
    </div>
  );
}
