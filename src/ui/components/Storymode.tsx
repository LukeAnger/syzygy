import { useState } from 'react';
import { useKinematicsStore } from '../../state/index.ts';
import { Understood } from './Understood.tsx';
import { PhaseEditor } from './PhaseEditor.tsx';
import type { DomainId } from '../../domains/index.ts';
import styles from './Storymode.module.css';

/**
 * Worked examples per domain. Offering free-fall prompts while the app is set
 * to relative velocity invites a problem it cannot read, then blames the
 * wording.
 */
const EXAMPLES: Record<DomainId, string[]> = {
  'kinematics-1d': [
    'A ball is dropped from a height of 45 m',
    'A stone is thrown upward at 20 m/s and hits the ground at 30 m/s',
    'An object dropped from 100 m falls for 4.5 s',
  ],
  'relative-velocity': [
    'Two trains 600 m apart travel towards each other at 30 m/s and 20 m/s',
    'A car at 30 m/s overtakes a truck moving at 20 m/s, 100 m ahead',
  ],
};

/** Minimal typing for the vendor-prefixed Web Speech API. */
interface SpeechWindow {
  SpeechRecognition?: new () => SpeechRecognitionLike;
  webkitSpeechRecognition?: new () => SpeechRecognitionLike;
}
interface SpeechRecognitionLike {
  lang: string;
  start(): void;
  onresult: (event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void;
  onend: () => void;
  onerror: () => void;
}

export function Storymode() {
  const [listening, setListening] = useState(false);
  // The draft lives in the store so anything can load a problem into the box —
  // the worked examples, dictation, the dev panel's one-click buttons.
  const text = useKinematicsStore((s) => s.draft);
  const setText = useKinematicsStore((s) => s.setDraft);
  const solving = useKinematicsStore((s) => s.solving);
  const submitStory = useKinematicsStore((s) => s.submitStory);
  const tutorEnabled = useKinematicsStore((s) => s.tutorEnabled);
  const domain = useKinematicsStore((s) => s.domain);
  // Phases and staged motion are a 1-D kinematics idea; there is no meaning to
  // "the second stage of the fall" when the problem is two bodies on a line.
  const kinematic = domain === 'kinematics-1d';
  const examples = EXAMPLES[domain];
  const setTutorEnabled = useKinematicsStore((s) => s.setTutorEnabled);
  const unusedNumbers = useKinematicsStore((s) => s.unusedNumbers);

  const speech = window as unknown as SpeechWindow;
  const SpeechRecognition =
    speech.SpeechRecognition ?? speech.webkitSpeechRecognition;

  const submit = (value: string) => {
    setText(value);
    void submitStory(value);
  };

  const listen = () => {
    if (!SpeechRecognition) return;
    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    setListening(true);
    recognition.onresult = (event) => {
      const transcript = event.results[0]?.[0]?.transcript ?? '';
      submit(transcript);
    };
    recognition.onend = () => setListening(false);
    recognition.onerror = () => setListening(false);
    recognition.start();
  };

  return (
    <section className={styles.panel}>
      <div className={styles.header}>
        <h2 className={styles.title}>Storymode</h2>
        {SpeechRecognition && (
          <button
            type="button"
            aria-label="Dictate problem"
            className={`${styles.mic} ${listening ? styles.listening : ''}`}
            onClick={listen}
          >
            ●
          </button>
        )}
      </div>

      <textarea
        className={styles.textarea}
        value={text}
        placeholder="e.g. “A ball is dropped from a height of 45 m” — then hit Solve"
        onChange={(e) => setText(e.target.value)}
      />
      <button
        type="button"
        className={`${styles.solve} ${solving ? styles.solving : ''}`}
        onClick={() => void submitStory(text)}
        disabled={solving || text.trim() === ''}
        aria-busy={solving}
      >
        {solving ? 'Solving…' : 'Solve'}
      </button>

      <label className={styles.tutorToggle}>
        <input
          type="checkbox"
          checked={tutorEnabled}
          onChange={(e) => setTutorEnabled(e.target.checked)}
        />
        <span>Work it through</span>
        <span className={styles.tutorNote}>
          Asks what the problem wants and which values matter before showing the
          answer.
        </span>
      </label>

      <SmartParseControl />

      {unusedNumbers.length > 0 && (
        <p className={styles.warn}>
          Couldn&apos;t place: {unusedNumbers.join(', ')} — try rephrasing, or
          adjust manually below.
        </p>
      )}

      <p className={styles.examples}>
        Try:{' '}
        {examples.map((example, i) => (
          <span key={example}>
            <span
              className={styles.example}
              role="button"
              tabIndex={0}
              onClick={() => submit(example)}
              onKeyDown={(e) => e.key === 'Enter' && submit(example)}
            >
              “{example}”
            </span>
            {i < examples.length - 1 ? ' · ' : ''}
          </span>
        ))}
      </p>

      <Understood />
      {kinematic && <PhaseEditor />}
      <ShareConsent />
    </section>
  );
}

/** Opt-in local-LLM parsing: disclosed, never forced, lazy-loaded. */
function SmartParseControl() {
  const status = useKinematicsStore((s) => s.smartStatus);
  const enabled = useKinematicsStore((s) => s.smartEnabled);
  const progress = useKinematicsStore((s) => s.smartProgress);
  const label = useKinematicsStore((s) => s.smartModelLabel);
  const mb = useKinematicsStore((s) => s.smartModelMB);
  const enableSmart = useKinematicsStore((s) => s.enableSmart);
  const disableSmart = useKinematicsStore((s) => s.disableSmart);

  if (status === 'unsupported') {
    return (
      <p className={styles.smartNote}>
        ⚡ Smart parse needs WebGPU (Chrome or Edge on desktop). Using the
        built-in parser.
      </p>
    );
  }

  return (
    <div className={styles.smart}>
      <label className={styles.smartToggle}>
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => (e.target.checked ? void enableSmart() : disableSmart())}
        />
        ⚡ Smart parse <span className={styles.beta}>beta</span>
      </label>

      {!enabled && (
        <p className={styles.smartNote}>
          Understands trickier wording. One-time ~{mb} MB download ({label}),
          then runs entirely on your device.
        </p>
      )}
      {enabled && status === 'loading' && (
        <div className={styles.progressWrap}>
          <div
            className={styles.progressBar}
            style={{ width: `${Math.round(progress * 100)}%` }}
          />
          <span className={styles.progressText}>
            downloading model… {Math.round(progress * 100)}%
          </span>
        </div>
      )}
      {enabled && status === 'ready' && (
        <p className={styles.smartReady}>● ready — parsing on your device</p>
      )}
      {status === 'error' && (
        <p className={styles.smartError}>
          Couldn&apos;t load the model. Using the built-in parser.
        </p>
      )}
    </div>
  );
}

/** Consent to share problem text — only shown when a collector is configured. */
function ShareConsent() {
  const configured = useKinematicsStore((s) => s.collectorConfigured);
  const consent = useKinematicsStore((s) => s.shareConsent);
  const setConsent = useKinematicsStore((s) => s.setShareConsent);
  if (!configured) return null;
  return (
    <label className={styles.consent}>
      <input
        type="checkbox"
        checked={consent}
        onChange={(e) => setConsent(e.target.checked)}
      />
      Share problem text to improve Syzygy&apos;s parser (open source, anonymous)
    </label>
  );
}
