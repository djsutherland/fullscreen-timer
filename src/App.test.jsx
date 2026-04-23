import React from 'react';
import { render } from '@testing-library/react';
import { expect, it } from 'vitest';
import App from './App';

it('renders without crashing', () => {
  const { container, unmount } = render(<App />);
  expect(container.querySelector('.App')).not.toBeNull();
  unmount();
});
