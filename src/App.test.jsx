import React from 'react';
import { fireEvent, render } from '@testing-library/react';
import { expect, it } from 'vitest';
import App from './App';

it('renders without crashing', () => {
  const { container, unmount } = render(<App />);
  expect(container.querySelector('.App')).not.toBeNull();
  unmount();
});

it('renders time as hours, minutes, and seconds', () => {
  const { container, unmount } = render(<App />);

  expect(container.querySelector('.clock')?.textContent).toBe('0:00:00');
  expect(container.querySelector('.seconds-group')).not.toBeNull();

  unmount();
});

it('lets arrow-key editing adjust hours', () => {
  const { container, unmount } = render(<App />);

  fireEvent.keyDown(window, { key: 'ArrowLeft' });
  fireEvent.keyDown(window, { key: 'ArrowLeft' });
  fireEvent.keyDown(window, { key: 'ArrowUp' });

  expect(container.querySelector('.clock')?.textContent).toBe('1:00:00');

  for (let i = 0; i < 9; i += 1) {
    fireEvent.keyDown(window, { key: 'ArrowUp' });
  }

  expect(container.querySelector('.clock')?.textContent).toBe('10:00:00');

  unmount();
});
