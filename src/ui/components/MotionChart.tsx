import 'chart.js/auto';
import { Line } from 'react-chartjs-2';
import type { ChartOptions } from 'chart.js';
import type { UnitSystem } from '../../math/index.ts';
import type { SolveResult } from '../../engine/index.ts';
import { unitFactor, unitSymbol } from '../units.ts';
import styles from './MotionChart.module.css';

interface MotionChartProps {
  result: SolveResult;
  unitSystem: UnitSystem;
}

const SAMPLES = 40;
const CYAN = '#00e5ff';
const ORANGE = '#ff6a00';
const GRID = 'rgba(0, 229, 255, 0.08)';
const TICK = '#6f8a92';

/** Plots displacement and velocity over the motion once v₀, a, and t are known. */
export function MotionChart({ result, unitSystem }: MotionChartProps) {
  const { knowns } = result;
  const v0 = knowns['v0'];
  const a = knowns['a'];
  const t = knowns['t'];

  const ready = v0 && a && t && t.value > 0;

  if (!ready) {
    return (
      <section className={styles.panel}>
        <h2 className={styles.title}>Motion</h2>
        <p className={styles.empty}>
          The displacement and velocity curves appear once time is determined.
        </p>
      </section>
    );
  }

  const tMax = t.value; // seconds (same in both systems)
  const lengthFactor = unitFactor('dx', unitSystem);
  const velocityFactor = unitFactor('v', unitSystem);

  const labels: string[] = [];
  const position: number[] = [];
  const velocity: number[] = [];
  for (let i = 0; i <= SAMPLES; i++) {
    const tau = (tMax * i) / SAMPLES;
    labels.push(tau.toFixed(2));
    position.push((v0.value * tau + 0.5 * a.value * tau * tau) / lengthFactor);
    velocity.push((v0.value + a.value * tau) / velocityFactor);
  }

  const options: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { intersect: false, mode: 'index' },
    plugins: {
      legend: { labels: { color: TICK, font: { family: 'monospace' } } },
    },
    scales: {
      x: {
        title: { display: true, text: `t (${unitSymbol('t', unitSystem)})`, color: TICK },
        grid: { color: GRID },
        ticks: { color: TICK, maxTicksLimit: 8 },
      },
      y: {
        position: 'left',
        title: { display: true, text: `Δx (${unitSymbol('dx', unitSystem)})`, color: CYAN },
        grid: { color: GRID },
        ticks: { color: CYAN },
      },
      y1: {
        position: 'right',
        title: { display: true, text: `v (${unitSymbol('v', unitSystem)})`, color: ORANGE },
        grid: { drawOnChartArea: false },
        ticks: { color: ORANGE },
      },
    },
  };

  const data = {
    labels,
    datasets: [
      {
        label: 'displacement',
        data: position,
        borderColor: CYAN,
        backgroundColor: CYAN,
        yAxisID: 'y',
        pointRadius: 0,
        borderWidth: 2,
        tension: 0.1,
      },
      {
        label: 'velocity',
        data: velocity,
        borderColor: ORANGE,
        backgroundColor: ORANGE,
        yAxisID: 'y1',
        pointRadius: 0,
        borderWidth: 2,
        tension: 0.1,
      },
    ],
  };

  return (
    <section className={styles.panel}>
      <h2 className={styles.title}>Motion</h2>
      <div className={styles.canvasWrap}>
        <Line options={options} data={data} />
      </div>
    </section>
  );
}
