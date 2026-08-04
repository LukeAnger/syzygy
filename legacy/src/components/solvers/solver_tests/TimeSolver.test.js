import React from 'react';
import { render } from '@testing-library/react';
import '@testing-library/jest-dom/extend-expect';
import TimeSolver from '../TimeSolver.jsx';

describe('TimeSolver', () => {
  test('displays the correct time when given v1, v2, and a', () => {
    const vars = { v1: -40, v2: -80, a: -9.82 };
    const { getByText } = render(<TimeSolver vars={vars} />);
    expect(getByText('t = 4.07 s')).toBeInTheDocument();
  });

  test('displays the correct time when given v1, x1, x2, and a', () => {
    const vars = { v1: 40, x1: 200, x2: 0, a: -9.82 };
    const { getByText } = render(<TimeSolver vars={vars} />);
    expect(getByText('t = 11.64 s')).toBeInTheDocument();
  });

  test('displays an empty div when not given enough variables', () => {
    const vars = {};
    const { container } = render(<TimeSolver vars={vars} />);
    expect(container.firstChild).toBeEmptyDOMElement();
  });
});