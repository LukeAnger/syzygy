import 'chart.js/auto';
import { Line } from 'react-chartjs-2';
import type { ChartOptions } from 'chart.js';
import type { UnitSystem } from '../../math/index.ts';
import type { SolveResult } from '../../engine/index.ts';
import { unitFactor, unitSymbol } from '../units.ts';
import styles from './MotionChart.module.css';

interface MotionChartProps {
  /**
   * One entry per motion segment, in order — a single-element array for
   * ordinary motion. Plotting only the first segment of a staged fall would
   * contradict the answer, which comes from the last.
   */
  results: SolveResult[];
  unitSystem: UnitSystem;
}

const SAMPLES = 40;
const CYAN = '#00e5ff';
const ORANGE = '#ff6a00';
const GRID = 'rgba(0, 229, 255, 0.08)';
const TICK = '#6f8a92';

/** Plots position and velocity over the motion once v₀, a, and t are known. */
export function MotionChart({ results, unitSystem }: MotionChartProps) {
  // A segment is plottable once its own v₀, a and duration are known. Later
  // segments of a staged fall often resolve before earlier ones, so plot the
  // leading run that is ready rather than dropping the chart entirely.
  const ready: { v0: number; a: number; t: number; x0: number }[] = [];
  for (const result of results) {
    const { knowns } = result;
    const v0 = knowns['v0'];
    const a = knowns['a'];
    const t = knowns['t'];
    if (!v0 || !a || !t || t.value <= 0) break;
    ready.push({
      v0: v0.value,
      a: a.value,
      t: t.value,
      x0: knowns['x1']?.value ?? 0,
    });
  }

  if (ready.length === 0) {
    return (
      <section className={styles.panel}>
        <h2 className={styles.title}>Motion</h2>
        <p className={styles.empty}>
          The position and velocity curves appear once time is determined.
        </p>
      </section>
    );
  }

  const lengthFactor = unitFactor('x1', unitSystem);
  const velocityFactor = unitFactor('v', unitSystem);

  const labels: string[] = [];
  const position: number[] = [];
  const velocity: number[] = [];
  // Segments are laid end to end on a shared clock, so a staged fall reads as
  // one continuous motion — the velocity reset at a boundary shows up as the
  // discontinuity it physically is.
  let elapsed = 0;
  ready.forEach((segment, index) => {
    // Skip the duplicate sample where one segment's end meets the next's start.
    const from = index === 0 ? 0 : 1;
    for (let i = from; i <= SAMPLES; i++) {
      const tau = (segment.t * i) / SAMPLES;
      labels.push((elapsed + tau).toFixed(2));
      position.push(
        (segment.x0 + segment.v0 * tau + 0.5 * segment.a * tau * tau) /
          lengthFactor,
      );
      velocity.push((segment.v0 + segment.a * tau) / velocityFactor);
    }
    elapsed += segment.t;
  });

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
        title: { display: true, text: `x (${unitSymbol('x1', unitSystem)})`, color: CYAN },
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
        label: 'position',
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
