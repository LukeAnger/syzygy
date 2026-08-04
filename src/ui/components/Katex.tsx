import katex from 'katex';
import { useMemo } from 'react';

interface KatexProps {
  tex: string;
  block?: boolean;
}

/** Renders a LaTeX string with KaTeX. Never throws — malformed TeX shows raw. */
export function Katex({ tex, block = false }: KatexProps) {
  const html = useMemo(
    () => katex.renderToString(tex, { throwOnError: false, displayMode: block }),
    [tex, block],
  );
  return (
    <span
      style={block ? { display: 'block', margin: '0.35rem 0' } : undefined}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
