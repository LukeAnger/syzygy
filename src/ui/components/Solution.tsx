import type { Quantity } from '../../math/index.ts';
import {
  type PhaseLink,
  type PhaseSolveResult,
  type SolveResult,
  phaseRelevanceFor,
  relevanceFor,
} from '../../engine/index.ts';
import type { VariableKey } from '../../state/index.ts';
import { type Units, formatVar, summaryFor, symbolLatex } from '../units.ts';
import type { DomainId } from '../../domains/index.ts';
import { Katex } from './Katex.tsx';
import styles from './Solution.module.css';

interface SolutionProps {
  result: SolveResult;
  unitSystem: Units;
  /** The variable the problem asked for, when it asked for one. */
  asked?: VariableKey;
  /** Variables the story supplied, for sorting used from unnecessary. */
  given?: VariableKey[];
  /**
   * Present when the story described motion in more than one segment. The
   * answer then comes from the final segment, and `result` is ignored.
   */
  phaseResult?: PhaseSolveResult;
  /** Boundary kinds, needed to explain why a segment doesn't matter. */
  phaseLinks?: PhaseLink[];
  /** Story stages itself but could not be segmented — the answer is untrustworthy. */
  staged?: boolean;
  /** Which equation pack produced this — decides which variables to list. */
  domain?: DomainId;
}

/** The worked steps of one solve, KaTeX-typeset. */
function Steps({
  result,
  unitSystem,
}: {
  result: SolveResult;
  unitSystem: Units;
}) {
  return (
    <>
      {result.steps.map((step, i) => {
        const key = step.target as VariableKey;
        return (
          <div key={`${step.target}-${i}`} className={styles.step}>
            <div className={styles.stepHead}>
              Step {i + 1} — solve for <b>{step.target}</b>
            </div>
            <Katex tex={step.equationLatex} block />
            {step.rearrangedLatex !== step.equationLatex && (
              <Katex tex={step.rearrangedLatex} block />
            )}
            <div className={styles.inputs}>
              {step.inputs
                .map(
                  (input) =>
                    `${input.key} = ${formatVar(
                      input.key as VariableKey,
                      input.value,
                      unitSystem,
                    )}`,
                )
                .join(',  ')}
            </div>
            <div className={styles.result}>
              {step.target} = {formatVar(key, step.result, unitSystem)}
            </div>
            {step.discarded.map((d, j) => (
              <div key={j} className={styles.discard}>
                rejected {formatVar(key, d.value, unitSystem)} — {d.reason}
              </div>
            ))}
          </div>
        );
      })}
    </>
  );
}

/** "150 m → 30 m", for a phase heading. */
function span(x1: Quantity | undefined, x2: Quantity | undefined, system: Units) {
  if (!x1 || !x2) return null;
  return `${formatVar('x1', x1, system)} → ${formatVar('x2', x2, system)}`;
}

/**
 * The boundary condition, as the equation it is.
 *
 * This is what a student needs in order to see why an earlier stage does or
 * doesn't reach the answer: `v_0 = 0` has no `v` on the right, so nothing about
 * the previous stage's speed can propagate through it. `v_0 = v` plainly does.
 *
 * Stated as maths rather than prose deliberately. A worded explanation is a
 * claim a student has to trust; an equation is one they can check against the
 * numbers beside it — and it doesn't need writing anew for every situation.
 */
function boundaryLatex(link: PhaseLink): string[] {
  const position = 'x_1 = x_2';
  switch (link.kind) {
    case 'rest':
      return [position, 'v_0 = 0'];
    case 'continuous':
      return [position, 'v_0 = v'];
    case 'reversed': {
      const e = link.restitution ?? 1;
      return [position, e === 1 ? 'v_0 = -v' : `v_0 = -${e}\\,v`];
    }
  }
}

/**
 * Renders the solver's ordered worked steps, KaTeX-typeset.
 *
 * When the problem asked for something specific, the answer leads and the
 * remaining steps become supporting work — and any given the answer never
 * depended on is called out. Textbook problems include such values on purpose,
 * so surfacing them is the tutoring, not a footnote.
 *
 * A multi-segment story renders one block per segment. That layout *is* the
 * explanation: seeing the answer come from the final segment alone is what
 * makes an earlier height visibly irrelevant, which no amount of prose beside a
 * single number would achieve.
 */
export function Solution({
  result,
  unitSystem,
  asked,
  given,
  phaseResult,
  phaseLinks,
  staged = false,
  domain = 'kinematics-1d',
}: SolutionProps) {
  const summaryVariables = summaryFor(domain);
  const multi = phaseResult && phaseResult.phases.length > 1;
  // The story ends where the last segment ends, so that is where an answer
  // about the end of the motion lives.
  const finalResult = multi
    ? phaseResult.phases[phaseResult.phases.length - 1]!
    : result;
  const { unsolved, knowns } = finalResult;

  const relevance =
    asked && given && !multi ? relevanceFor(asked, given, result) : undefined;
  // Which whole segments the answer rests on. Computed, not inferred from the
  // link kind — an earlier stage that supplies the next one's start height is
  // needed even across a boundary that resets the velocity.
  const phaseRelevance =
    asked && multi && phaseLinks
      ? phaseRelevanceFor(asked, phaseResult, phaseLinks)
      : undefined;
  const answer = asked ? knowns[asked] : undefined;

  const empty = multi
    ? phaseResult.phases.every((p) => p.steps.length === 0)
    : result.steps.length === 0;

  if (empty) {
    // Acceleration is always present as the free-fall default, so it doesn't
    // count as something the user supplied.
    const supplied = summaryVariables.filter((key) => key !== 'a' && knowns[key]);
    return (
      <section className={styles.panel}>
        <h2 className={styles.title}>Solution</h2>
        {supplied.length === 0 ? (
          <p className={styles.empty}>
            Enter what the problem gives you (or describe it in Storymode) and
            the worked solution appears here.
          </p>
        ) : (
          // Something *was* understood, it just isn't enough. Saying so beats
          // the blank prompt, which reads as "nothing happened" and gives no
          // hint that the parser got halfway.
          <div className={styles.stalled}>
            <p className={styles.stalledLead}>
              Not enough to solve yet — this has{' '}
              {supplied.length === 1 ? 'only one value' : `only ${supplied.length} values`}.
            </p>
            <p className={styles.stalledDetail}>
              Understood so far:{' '}
              {supplied.map((key, i) => (
                <span key={key}>
                  {i > 0 && ', '}
                  <Katex tex={symbolLatex(key)} /> ={' '}
                  {formatVar(key, knowns[key]!, unitSystem)}
                </span>
              ))}
              . Add another value below, or rephrase the part it missed.
            </p>
          </div>
        )}
      </section>
    );
  }

  // A story that stages itself but could not be split describes different
  // motion from the one being solved. Leading with a confident number here is
  // the same failure as inventing a value: it looks like an answer.
  if (staged) {
    return (
      <section className={styles.panel}>
        <h2 className={styles.title}>Solution</h2>
        <div className={styles.stalled}>
          <p className={styles.stalledLead}>
            This problem describes more than one stage of motion, and the values
            couldn&rsquo;t be split into segments.
          </p>
          <p className={styles.stalledDetail}>
            Anything solved here would treat the whole thing as a single fall,
            which answers a different question. Split it into phases below to
            model each stage.
          </p>
        </div>
        <details className={styles.working}>
          <summary className={styles.workingToggle}>
            Show what a single-stage reading gives
          </summary>
          <Steps result={result} unitSystem={unitSystem} />
        </details>
      </section>
    );
  }

  return (
    <section className={styles.panel}>
      <h2 className={styles.title}>Solution</h2>

      {asked && (
        <div className={styles.asked}>
          <div className={styles.askedLabel}>
            Asked for <Katex tex={symbolLatex(asked)} />
          </div>
          {answer ? (
            <div className={styles.answer}>
              <Katex tex={symbolLatex(asked)} /> ={' '}
              {formatVar(asked, answer, unitSystem)}
            </div>
          ) : (
            <div className={styles.answerMissing}>
              Not enough information to answer this question yet.
            </div>
          )}
          {phaseRelevance && phaseRelevance.unnecessary.length > 0 && (
            <div className={styles.unnecessary}>
              Answered from phase {phaseRelevance.answerPhase + 1} alone.{' '}
              {phaseRelevance.unnecessary
                .map((u) => {
                  const from = phaseResult?.phases[u.phase]?.knowns['x1'];
                  return from ? formatVar('x1', from, unitSystem) : null;
                })
                .filter(Boolean)
                .join(' and ')}{' '}
              never enters it.
            </div>
          )}
          {relevance && relevance.unnecessary.length > 0 && (
            <div className={styles.unnecessary}>
              Given but not needed:{' '}
              {relevance.unnecessary.map((key, i) => (
                <span key={key}>
                  {i > 0 && ', '}
                  <Katex tex={symbolLatex(key as VariableKey)} />
                </span>
              ))}{' '}
              — solvable, but the answer never depends on them.
            </div>
          )}
        </div>
      )}

      {multi &&
        phaseResult.conflicts.map((conflict, i) => (
          <p key={i} className={styles.unsolved}>
            Phases {conflict.link + 1} and {conflict.link + 2} disagree on{' '}
            {conflict.channel}: one implies{' '}
            {formatVar('x1', conflict.implied, unitSystem)}, the other states{' '}
            {formatVar('x1', conflict.stated, unitSystem)}.
          </p>
        ))}

      {asked && !multi && result.steps.length > 0 && (
        <div className={styles.workingLabel}>Working</div>
      )}

      {multi ? (
        phaseResult.phases.map((phase, i) => {
          const heading = span(phase.knowns['x1'], phase.knowns['x2'], unitSystem);
          const notNeeded = phaseRelevance?.unnecessary.find((u) => u.phase === i);

          const link = phaseLinks?.[i];
          const boundary = link && (
            <div className={styles.boundary}>
              <span className={styles.boundaryLabel}>
                {i + 1} → {i + 2}
              </span>
              {boundaryLatex(link).map((tex) => (
                <Katex key={tex} tex={tex} />
              ))}
            </div>
          );

          // Only the arithmetic folds away. The boundary equation below stays
          // visible: it is where the reasoning lives, and it is checkable
          // against the numbers rather than a claim to be taken on trust.
          if (notNeeded) {
            return (
              <div key={i}>
                <div className={styles.skipped}>
                  <div className={styles.skippedHead}>
                    Phase {i + 1}
                    {heading && <span className={styles.phaseSpan}>{heading}</span>}
                    <span className={styles.skippedTag}>not needed</span>
                  </div>
                  <details className={styles.working}>
                    <summary className={styles.workingToggle}>
                      Show this stage's working
                    </summary>
                    <Steps result={phase} unitSystem={unitSystem} />
                  </details>
                </div>
                {boundary}
              </div>
            );
          }

          return (
            <div key={i}>
              <div className={styles.phase}>
                <div className={styles.phaseHead}>
                  Phase {i + 1}
                  {heading && <span className={styles.phaseSpan}>{heading}</span>}
                </div>
                <Steps result={phase} unitSystem={unitSystem} />
              </div>
              {boundary}
            </div>
          );
        })
      ) : (
        <Steps result={result} unitSystem={unitSystem} />
      )}

      <div className={styles.summary}>
        {summaryVariables.filter((key) => knowns[key]).map((key) => (
          <span key={key} className={styles.summaryItem}>
            <Katex tex={symbolLatex(key)} /> ={' '}
            {formatVar(key, knowns[key]!, unitSystem)}
          </span>
        ))}
      </div>

      {unsolved.length > 0 && (
        <p className={styles.unsolved}>
          Not enough information to solve: {unsolved.join(', ')}. Add another
          known value.
        </p>
      )}
    </section>
  );
}
