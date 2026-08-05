import { useState } from 'react';
import { useKinematicsStore } from '../../state/index.ts';
import { Understood } from './Understood.tsx';
import { PhaseEditor } from './PhaseEditor.tsx';
import styles from './Storymode.module.css';

const EXAMPLES = [
  'A ball is dropped from a height of 45 m',
  'A stone is thrown upward at 20 m/s and hits the ground at 30 m/s',
  'An object dropped from 100 m falls for 4.5 s',
];

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
  const [text, setText] = useState('');
  const [listening, setListening] = useState(false);
  const submitStory = useKinematicsStore((s) => s.submitStory);
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
        className={styles.solve}
        onClick={() => void submitStory(text)}
      >
        Solve
      </button>

      <SmartParseControl />

      {unusedNumbers.length > 0 && (
        <p className={styles.warn}>
          Couldn&apos;t place: {unusedNumbers.join(', ')} — try rephrasing, or
          adjust manually below.
        </p>
      )}

      <p className={styles.examples}>
        Try:{' '}
        {EXAMPLES.map((example, i) => (
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
            {i < EXAMPLES.length - 1 ? ' · ' : ''}
          </span>
        ))}
      </p>

      <Understood />
      <PhaseEditor />
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
