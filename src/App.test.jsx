import React from 'react';
import { act, createEvent, fireEvent, render, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import App from './App';

afterEach(() => {
  window.history.replaceState(null, '', window.location.pathname);
  window.sessionStorage.clear();
  if (typeof window.localStorage?.clear === 'function') {
    window.localStorage.clear();
  }
});

it('renders without crashing', () => {
  const { container, unmount } = render(<App />);
  expect(container.querySelector('.App')).not.toBeNull();
  unmount();
});

it('renders time as hours, minutes, and seconds', () => {
  const { container, unmount } = render(<App />);

  expect(container.querySelector('.clock')?.textContent).toBe('00:00');
  expect(container.querySelector('.seconds-group')).not.toBeNull();
  expect(container.querySelector('.clock')?.classList.contains('paused')).toBe(true);
  expect(new URLSearchParams(window.location.search).get('stopwatch')).toBe('0:00:00');

  unmount();
});

it('restores timer state from the query string on load', () => {
  window.history.replaceState(null, '', `${window.location.pathname}?countdown=0:56:31`);

  const { container, getByText, unmount } = render(<App />);

  expect(container.querySelector('.clock')?.textContent).toBe('56:31');
  expect(getByText('countdown ✓')).not.toBeNull();
  expect(JSON.parse(window.sessionStorage.getItem('fullscreen-timer-state') || '{}')).toMatchObject({
    t: 3391,
    mode: 'countdown',
  });

  unmount();
});

it('restores timer state from session storage when the query is missing', () => {
  window.sessionStorage.setItem('fullscreen-timer-state', JSON.stringify({
    t: 3391,
    mode: 'countdown',
  }));

  const { container, getByText, unmount } = render(<App />);

  expect(container.querySelector('.clock')?.textContent).toBe('56:31');
  expect(getByText('countdown ✓')).not.toBeNull();

  unmount();
});

it('restores timer state from local storage when session storage is missing', () => {
  const originalLocalStorage = window.localStorage;
  const localStorageMock = {
    store: new Map(),
    clear() {
      this.store.clear();
    },
    getItem(key) {
      return this.store.has(key) ? this.store.get(key) : null;
    },
    setItem(key, value) {
      this.store.set(key, value);
    },
  };

  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    value: localStorageMock,
  });

  try {
    window.localStorage.setItem('fullscreen-timer-state', JSON.stringify({
      t: 3391,
      mode: 'countdown',
    }));

    const { container, getByText, unmount } = render(<App />);

    expect(container.querySelector('.clock')?.textContent).toBe('56:31');
    expect(getByText('countdown ✓')).not.toBeNull();

    unmount();
  } finally {
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      value: originalLocalStorage,
    });
  }
});

it('restores persisted timer state on pageshow and starts from that value', () => {
  const { container, getByText, unmount } = render(<App />);

  window.history.replaceState(null, '', `${window.location.pathname}?countdown=0:08:09`);
  window.sessionStorage.setItem('fullscreen-timer-state', JSON.stringify({
    t: 489,
    mode: 'countdown',
  }));

  fireEvent(window, new Event('pageshow'));

  expect(container.querySelector('.clock')?.textContent).toBe('08:09');
  expect(getByText('countdown ✓')).not.toBeNull();

  fireEvent.click(getByText('Space'));

  expect(container.querySelector('.clock')?.textContent).toBe('08:09');

  unmount();
});

it('removes the paused styling when the timer starts', () => {
  const { container, getByText, unmount } = render(<App />);

  fireEvent.click(getByText('Space'));

  expect(container.querySelector('.clock')?.classList.contains('paused')).toBe(false);

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
  expect(getByText('countdown ✓')).not.toBeNull();
  expect(new URLSearchParams(window.location.search).get('countdown')).toBe('1:23:45');
  expect(new URLSearchParams(window.location.search).get('stopwatch')).toBeNull();

  unmount();
});

it('quantizes stopwatch seconds while running at one hour or more', () => {
  window.history.replaceState(null, '', `${window.location.pathname}?stopwatch=1:02:16`);

  const { container, getByText, unmount } = render(<App />);

  fireEvent.click(getByText('Space'));

  expect(container.querySelector('.clock')?.textContent).toBe('1:02:15');

  unmount();
});

it('quantizes countdown seconds while running between twenty minutes and one hour', () => {
  window.history.replaceState(null, '', `${window.location.pathname}?countdown=0:56:31`);

  const { container, getByText, unmount } = render(<App />);

  fireEvent.click(getByText('Space'));

  expect(container.querySelector('.clock')?.textContent).toBe('56:35');

  unmount();
});

it('shows the exact countdown second again when paused', async () => {
  vi.useFakeTimers();
  window.history.replaceState(null, '', `${window.location.pathname}?countdown=0:56:31`);

  const { container, getByText, unmount } = render(<App />);

  try {
    fireEvent.click(getByText('Space'));
    expect(container.querySelector('.clock')?.textContent).toBe('56:35');

    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });
    fireEvent.click(getByText('Space'));

    expect(container.querySelector('.clock')?.textContent).toBe('56:31');
  } finally {
    unmount();
    vi.useRealTimers();
  }
});

it('does not type the shortcut key into the time prompt', () => {
  const { getByLabelText, unmount } = render(<App />);

  const event = createEvent.keyDown(window, { key: 't' });
  fireEvent(window, event);

  expect(event.defaultPrevented).toBe(true);
  expect(getByLabelText('Time input').value).toBe('0:00:00');

  unmount();
});

it('keeps a wake lock active while fullscreen is on', async () => {
  const release = vi.fn().mockResolvedValue(undefined);
  const request = vi.fn().mockResolvedValue({
    release,
    addEventListener: vi.fn(),
  });
  const originalWakeLock = navigator.wakeLock;
  const originalRequestFullscreen = document.documentElement.requestFullscreen;
  const originalExitFullscreen = document.exitFullscreen;
  const originalFullscreenElement = document.fullscreenElement;

  Object.defineProperty(navigator, 'wakeLock', {
    configurable: true,
    value: { request },
  });
  Object.defineProperty(document.documentElement, 'requestFullscreen', {
    configurable: true,
    value: vi.fn(() => {
      Object.defineProperty(document, 'fullscreenElement', {
        configurable: true,
        value: document.documentElement,
      });
      fireEvent(document, new Event('fullscreenchange'));
      return Promise.resolve();
    }),
  });
  Object.defineProperty(document, 'exitFullscreen', {
    configurable: true,
    value: vi.fn(() => {
      Object.defineProperty(document, 'fullscreenElement', {
        configurable: true,
        value: null,
      });
      fireEvent(document, new Event('fullscreenchange'));
      return Promise.resolve();
    }),
  });
  Object.defineProperty(document, 'fullscreenElement', {
    configurable: true,
    value: null,
  });

  const { getByText, unmount } = render(<App />);

  fireEvent.click(getByText('F'));
  await waitFor(() => expect(request).toHaveBeenCalledWith('screen'));

  fireEvent.click(getByText('F'));
  await waitFor(() => expect(release).toHaveBeenCalled());

  unmount();

  Object.defineProperty(navigator, 'wakeLock', {
    configurable: true,
    value: originalWakeLock,
  });
  Object.defineProperty(document.documentElement, 'requestFullscreen', {
    configurable: true,
    value: originalRequestFullscreen,
  });
  Object.defineProperty(document, 'exitFullscreen', {
    configurable: true,
    value: originalExitFullscreen,
  });
  Object.defineProperty(document, 'fullscreenElement', {
    configurable: true,
    value: originalFullscreenElement,
  });
});

it('hides the cursor after inactivity in fullscreen mode', async () => {
  vi.useFakeTimers();

  const originalWakeLock = navigator.wakeLock;
  const originalRequestFullscreen = document.documentElement.requestFullscreen;
  const originalExitFullscreen = document.exitFullscreen;
  const originalFullscreenElement = document.fullscreenElement;

  Object.defineProperty(navigator, 'wakeLock', {
    configurable: true,
    value: {
      request: vi.fn().mockResolvedValue({
        release: vi.fn().mockResolvedValue(undefined),
        addEventListener: vi.fn(),
      }),
    },
  });
  Object.defineProperty(document.documentElement, 'requestFullscreen', {
    configurable: true,
    value: vi.fn(() => {
      Object.defineProperty(document, 'fullscreenElement', {
        configurable: true,
        value: document.documentElement,
      });
      fireEvent(document, new Event('fullscreenchange'));
      return Promise.resolve();
    }),
  });
  Object.defineProperty(document, 'exitFullscreen', {
    configurable: true,
    value: vi.fn(() => Promise.resolve()),
  });
  Object.defineProperty(document, 'fullscreenElement', {
    configurable: true,
    value: null,
  });

  const { getByText, unmount } = render(<App />);

  try {
    fireEvent.click(getByText('F'));
    expect(document.documentElement.classList.contains('hide-cursor')).toBe(false);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1500);
    });
    expect(document.documentElement.classList.contains('hide-cursor')).toBe(true);

    fireEvent.pointerMove(window);
    expect(document.documentElement.classList.contains('hide-cursor')).toBe(false);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1500);
    });
    expect(document.documentElement.classList.contains('hide-cursor')).toBe(true);
  } finally {
    unmount();

    Object.defineProperty(navigator, 'wakeLock', {
      configurable: true,
      value: originalWakeLock,
    });
    Object.defineProperty(document.documentElement, 'requestFullscreen', {
      configurable: true,
      value: originalRequestFullscreen,
    });
    Object.defineProperty(document, 'exitFullscreen', {
      configurable: true,
      value: originalExitFullscreen,
    });
    Object.defineProperty(document, 'fullscreenElement', {
      configurable: true,
      value: originalFullscreenElement,
    });
    vi.useRealTimers();
  }
});

it('shows a validation error for invalid typed times', () => {
  const { container, getByLabelText, getByText, queryByText, unmount } = render(<App />);

  fireEvent.click(getByText('T'));
  fireEvent.change(getByLabelText('Time input'), { target: { value: '1:75:00' } });
  fireEvent.click(getByText('Set'));

  expect(getByText('Use h:mm:ss, m:ss, or ss')).not.toBeNull();
  expect(container.querySelector('.clock')?.textContent).toBe('00:00');

  fireEvent.change(getByLabelText('Time input'), { target: { value: '45' } });
  fireEvent.click(getByText('Set'));

  expect(queryByText('Use h:mm:ss, m:ss, or ss')).toBeNull();
  expect(container.querySelector('.clock')?.textContent).toBe('00:45');

  unmount();
});
