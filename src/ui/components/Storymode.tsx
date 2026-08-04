import { useState } from 'react';
import { useKinematicsStore } from '../../state/index.ts';
import { Understood } from './Understood.tsx';
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
  const loadStory = useKinematicsStore((s) => s.loadStory);
  const unusedNumbers = useKinematicsStore((s) => s.unusedNumbers);

  const speech = window as unknown as SpeechWindow;
  const SpeechRecognition =
    speech.SpeechRecognition ?? speech.webkitSpeechRecognition;

  const submit = (value: string) => {
    setText(value);
    loadStory(value);
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
        onClick={() => loadStory(text)}
      >
        Solve
      </button>

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
    </section>
  );
}
