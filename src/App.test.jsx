import React from 'react';
import { createEvent, fireEvent, render } from '@testing-library/react';
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

it('lets the user type a time directly', () => {
  const { container, getByLabelText, getByText, unmount } = render(<App />);

  fireEvent.click(getByText('T'));
  fireEvent.change(getByLabelText('Time input'), { target: { value: '1:23:45' } });
  fireEvent.click(getByText('Set'));

  expect(container.querySelector('.clock')?.textContent).toBe('1:23:45');

  unmount();
});

it('does not type the shortcut key into the time prompt', () => {
  const { getByLabelText, unmount } = render(<App />);

  const event = createEvent.keyDown(window, { key: 't' });
  fireEvent(window, event);

  expect(event.defaultPrevented).toBe(true);
  expect(getByLabelText('Time input').value).toBe('0:00:00');

  unmount();
});

it('shows a validation error for invalid typed times', () => {
  const { container, getByLabelText, getByText, queryByText, unmount } = render(<App />);

  fireEvent.click(getByText('T'));
  fireEvent.change(getByLabelText('Time input'), { target: { value: '1:75:00' } });
  fireEvent.click(getByText('Set'));

  expect(getByText('Use h:mm:ss, m:ss, or ss')).not.toBeNull();
  expect(container.querySelector('.clock')?.textContent).toBe('0:00:00');

  fireEvent.change(getByLabelText('Time input'), { target: { value: '45' } });
  fireEvent.click(getByText('Set'));

  expect(queryByText('Use h:mm:ss, m:ss, or ss')).toBeNull();
  expect(container.querySelector('.clock')?.textContent).toBe('0:00:45');

  unmount();
});
