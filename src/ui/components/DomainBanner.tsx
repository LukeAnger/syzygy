/**
 * What kind of problem the app thinks this is, and a way to disagree.
 *
 * A domain picker would ask the student to classify the problem before the app
 * helps — but recognising "this is a relative-velocity question" is part of
 * what they are trying to learn, and choosing wrong hands them the wrong solver
 * with no hint that anything is off.
 *
 * So the classification is read from the wording and *named*, which teaches it,
 * and left changeable, because detection is deliberately conservative and being
 * stuck with the wrong equations is worse than being asked.
 */
import { DOMAIN_IDS, DOMAINS, type DomainId } from '../../domains/index.ts';
import { useKinematicsStore } from '../../state/index.ts';
import styles from './DomainBanner.module.css';

/** What each pack is for, in the terms a student would recognise it by. */
const BLURB: Record<DomainId, string> = {
  'kinematics-1d': 'one object, constant acceleration',
  'relative-velocity': 'two bodies moving along a line',
  'relative-velocity-2d': 'velocities combined in a plane',
};

export function DomainBanner() {
  const domain = useKinematicsStore((s) => s.domain);
  const ambiguous = useKinematicsStore((s) => s.domainAmbiguous);
  const setDomain = useKinematicsStore((s) => s.setDomain);
  const story = useKinematicsStore((s) => s.story);

  return (
    <div className={styles.wrap}>
      <div className={styles.label}>{story ? 'Read as' : 'Solving'}</div>
      <div className={styles.options}>
        {DOMAIN_IDS.map((id) => (
          <button
            key={id}
            type="button"
            className={`${styles.option} ${id === domain ? styles.active : ''}`}
            aria-pressed={id === domain}
            onClick={() => setDomain(id)}
          >
            {DOMAINS[id].name}
            <span className={styles.blurb}>{BLURB[id]}</span>
          </button>
        ))}
      </div>

      {ambiguous && (
        <p className={styles.ambiguous}>
          This mentions a second object but only states one speed, so it&rsquo;s
          being solved as one body. Switch above if that&rsquo;s wrong.
        </p>
      )}
    </div>
  );
}
