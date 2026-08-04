import styles from './Header.module.css';

export function Header() {
  return (
    <header className={styles.header}>
      <h1 className={styles.logo}>SYZYGY</h1>
      <div className={styles.rule} />
      <p className={styles.tagline}>1-D Kinematics Solver &amp; Tutor</p>
    </header>
  );
}
