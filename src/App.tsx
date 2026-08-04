import { useMemo } from 'react';
import { solveInputs, useKinematicsStore } from './state/index.ts';
import { Header } from './ui/components/Header.tsx';
import { VariableForm } from './ui/components/VariableForm.tsx';
import { Storymode } from './ui/components/Storymode.tsx';
import { Solution } from './ui/components/Solution.tsx';
import { MotionChart } from './ui/components/MotionChart.tsx';
import styles from './App.module.css';

export default function App() {
  const inputs = useKinematicsStore((s) => s.inputs);
  const unitSystem = useKinematicsStore((s) => s.unitSystem);

  const result = useMemo(
    () => solveInputs(inputs, unitSystem),
    [inputs, unitSystem],
  );

  return (
    <div className={styles.app}>
      <Header />
      <div className={styles.grid}>
        <div className={styles.left}>
          <VariableForm result={result} />
          <Storymode />
        </div>
        <div className={styles.right}>
          <Solution result={result} unitSystem={unitSystem} />
          <MotionChart result={result} unitSystem={unitSystem} />
        </div>
      </div>
    </div>
  );
}
