/**
 * Two questions before the answer.
 *
 * The app already knows what a problem asks for and which values carry the
 * answer, and it has been using both to *tell*. Asking first is the difference
 * between informing and teaching: being told 150 m is irrelevant is a fact,
 * noticing it yourself and then being shown why is a skill.
 *
 * The second question is the one that matters. Textbook problems include a
 * solvable-but-irrelevant value precisely to see whether a student can tell,
 * and a tutor that quietly consumes every given has done that discrimination
 * for them.
 *
 * Wraps the solution rather than replacing it — once both questions are
 * answered, `children` renders exactly as before. Answering is never required:
 * "Skip" is always available, because a student who wants the answer should
 * get it rather than be held hostage.
 */
import { type ReactNode, useState } from 'react';
import { type Relevance, relevanceFor } from '../../engine/index.ts';
import type { SolveResult } from '../../engine/index.ts';
import type { VariableKey } from '../../state/index.ts';
import { gradeGivens, gradeTarget, isWorkable } from '../../tutor/grade.ts';
import { type Units, formatVar, summaryFor, symbolLatex } from '../units.ts';
import type { DomainId } from '../../domains/index.ts';
import { Katex } from './Katex.tsx';
import styles from './WorkItThrough.module.css';

interface Props {
  asked?: VariableKey;
  given: VariableKey[];
  result: SolveResult;
  unitSystem: Units;
  domain: DomainId;
  children: ReactNode;
}

/**
 * What a problem can ask for — every variable the active domain declares,
 * results included, since "how far" and "where do they meet" are real
 * questions. A fixed list would offer free-fall symbols for a two-body problem.
 */
function targetsFor(domain: DomainId): VariableKey[] {
  return summaryFor(domain);
}

type Stage = 'target' | 'givens' | 'revealed';

export function WorkItThrough({ asked, given, result, unitSystem, domain, children }: Props) {
  const targets = targetsFor(domain);
  const [stage, setStage] = useState<Stage>('target');
  const [pickedTarget, setPickedTarget] = useState<VariableKey | null>(null);
  const [picks, setPicks] = useState<VariableKey[]>([]);
  const [givensGrade, setGivensGrade] = useState<ReturnType<typeof gradeGivens> | null>(
    null,
  );

  // Nothing to work through without a question and a choice to make.
  if (!isWorkable(asked, given) || stage === 'revealed') return <>{children}</>;

  const relevance: Relevance = relevanceFor(asked!, given, result);
  const targetCorrect = gradeTarget(pickedTarget, asked);

  const skip = (
    <button type="button" className={styles.skip} onClick={() => setStage('revealed')}>
      Skip to the answer
    </button>
  );

  if (stage === 'target') {
    return (
      <section className={styles.panel}>
        <h2 className={styles.title}>Work it through</h2>
        <p className={styles.question}>What is this problem asking you to find?</p>
        <div className={styles.choices}>
          {targets.map((key) => (
            <button
              key={key}
              type="button"
              className={`${styles.choice} ${
                pickedTarget === key ? (targetCorrect ? styles.right : styles.wrong) : ''
              }`}
              disabled={pickedTarget !== null && targetCorrect}
              onClick={() => setPickedTarget(key)}
            >
              <Katex tex={symbolLatex(key)} />
            </button>
          ))}
        </div>

        {pickedTarget !== null &&
          (targetCorrect ? (
            <div className={styles.feedbackRight}>
              Yes — the question asks for <Katex tex={symbolLatex(asked!)} />.
              <button
                type="button"
                className={styles.next}
                onClick={() => setStage('givens')}
              >
                Next →
              </button>
            </div>
          ) : (
            <div className={styles.feedbackWrong}>
              Not that one. Read the last sentence again — it names the quantity
              it wants.
            </div>
          ))}
        {skip}
      </section>
    );
  }

  return (
    <section className={styles.panel}>
      <h2 className={styles.title}>Work it through</h2>
      <p className={styles.question}>
        Which of these do you actually need to find{' '}
        <Katex tex={symbolLatex(asked!)} />?
      </p>
      <p className={styles.hint}>Not all of them are necessarily useful.</p>

      <div className={styles.checks}>
        {given.map((key) => {
          const value = result.knowns[key];
          return (
            <label key={key} className={styles.check}>
              <input
                type="checkbox"
                checked={picks.includes(key)}
                disabled={givensGrade !== null}
                onChange={(e) =>
                  setPicks((prev) =>
                    e.target.checked ? [...prev, key] : prev.filter((k) => k !== key),
                  )
                }
              />
              <Katex tex={symbolLatex(key)} />
              {value && (
                <span className={styles.value}>{formatVar(key, value, unitSystem)}</span>
              )}
            </label>
          );
        })}
      </div>

      {givensGrade === null ? (
        <button
          type="button"
          className={styles.next}
          onClick={() => setGivensGrade(gradeGivens(picks, relevance))}
        >
          Check
        </button>
      ) : (
        <div className={givensGrade.perfect ? styles.feedbackRight : styles.feedbackWrong}>
          {givensGrade.perfect ? (
            <>That&rsquo;s exactly the set the answer depends on.</>
          ) : (
            <>
              {givensGrade.extra.length > 0 && (
                <p className={styles.line}>
                  The answer never uses{' '}
                  {givensGrade.extra.map((key, i) => (
                    <span key={key}>
                      {i > 0 && ', '}
                      <Katex tex={symbolLatex(key as VariableKey)} />
                    </span>
                  ))}
                  . Solvable, but not part of this question — the working below
                  shows where each value goes.
                </p>
              )}
              {givensGrade.missed.length > 0 && (
                <p className={styles.line}>
                  You also need{' '}
                  {givensGrade.missed.map((key, i) => (
                    <span key={key}>
                      {i > 0 && ', '}
                      <Katex tex={symbolLatex(key as VariableKey)} />
                    </span>
                  ))}
                  .
                </p>
              )}
            </>
          )}
          <button
            type="button"
            className={styles.next}
            onClick={() => setStage('revealed')}
          >
            Show the solution →
          </button>
        </div>
      )}
      {skip}
    </section>
  );
}
