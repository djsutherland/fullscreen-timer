import React, { Component } from 'react';
import clsx from 'clsx';
import './App.css';

const pad = (n) => (n < 10) ? `0${n}` : n;
const formatHour = (n) => (n < 10) ? `${n}` : pad(n);
const getExactWholeSeconds = (t, mode) => {
  if (mode === 'countdown') {
    return t >= 0 ? Math.ceil(t) : Math.floor(t);
  }

  return t >= 0 ? Math.floor(t) : Math.ceil(t);
};
const formatClockTime = (totalSeconds) => {
  const isNegative = totalSeconds < 0;
  const absoluteSeconds = Math.abs(totalSeconds);
  const hour = Math.floor(absoluteSeconds / 3600);
  const minute = Math.floor((absoluteSeconds % 3600) / 60);
  const second = absoluteSeconds % 60;
  const sign = isNegative ? '-' : '';
  return {
    hour,
    minute,
    second,
    isNegative,
    text: `${sign}${formatHour(hour)}:${pad(minute)}:${pad(second)}`,
  };
};
const formatQueryTime = (totalSeconds) => formatClockTime(totalSeconds).text.replaceAll(':', '.');
const getQueryTimeValue = (t, mode) => formatQueryTime(getExactWholeSeconds(t, mode));
const getRunningDisplayStep = (totalSeconds) => {
  const absoluteSeconds = Math.abs(totalSeconds);
  if (absoluteSeconds >= 3600) return 15;
  if (absoluteSeconds >= 1200) return 5;
  return 1;
};
const getDisplayTotalSeconds = (t, paused, mode) => {
  const wholeSeconds = getExactWholeSeconds(t, mode);

  if (paused) {
    return wholeSeconds;
  }

  const step = getRunningDisplayStep(t);

  if (step === 1) {
    return wholeSeconds;
  }

  if (mode === 'countdown') {
    return wholeSeconds >= 0
      ? Math.ceil(wholeSeconds / step) * step
      : Math.floor(wholeSeconds / step) * step;
  }

  return wholeSeconds >= 0
    ? Math.floor(wholeSeconds / step) * step
    : Math.ceil(wholeSeconds / step) * step;
};
const parseTimeInput = (value) => {
  const trimmedValue = value.trim();
  const sign = trimmedValue.startsWith('-') ? -1 : 1;
  const normalizedValue = sign === -1 ? trimmedValue.slice(1) : trimmedValue;
  const segments = normalizedValue.split(/[:.]/);
  if (!segments[0] || segments.length > 3 || segments.some((segment) => !/^\d+$/.test(segment))) {
    return null;
  }

  const parts = segments.map((segment) => parseInt(segment, 10));
  let hour = 0;
  let minute = 0;
  let second = 0;

  if (parts.length === 3) {
    [hour, minute, second] = parts;
  } else if (parts.length === 2) {
    [minute, second] = parts;
  } else {
    [second] = parts;
  }

  if (minute >= 60 || second >= 60) {
    return null;
  }

  return sign * ((hour * 3600) + (minute * 60) + second);
};
const TIMER_STATE_STORAGE_KEY = 'fullscreen-timer-state';
const getAvailableStorages = () => [window.sessionStorage, window.localStorage].filter(
  (storage) => storage
    && typeof storage.getItem === 'function'
    && typeof storage.setItem === 'function',
);
const getTimerStateFromWebStorage = (storage) => {
  try {
    const rawValue = storage.getItem(TIMER_STATE_STORAGE_KEY);
    if (!rawValue) return null;

    const parsedValue = JSON.parse(rawValue);
    if (!['countdown', 'stopwatch'].includes(parsedValue.mode)) return null;
    if (typeof parsedValue.t !== 'number' || Number.isNaN(parsedValue.t)) return null;

    return {
      t: parsedValue.t,
      mode: parsedValue.mode,
    };
  } catch {
    return null;
  }
};
const getTimerStateFromStorage = () => {
  for (const storage of getAvailableStorages()) {
    const persistedState = getTimerStateFromWebStorage(storage);
    if (persistedState) {
      return persistedState;
    }
  }

  return null;
};
const getTimerStateFromQuery = () => {
  const params = new URLSearchParams(window.location.search);

  for (const mode of ['countdown', 'stopwatch']) {
    if (!params.has(mode)) continue;

    const parsedTime = parseTimeInput(params.get(mode) || '');
    if (parsedTime === null) continue;

    return {
      t: parsedTime,
      mode,
    };
  }

  return {
    t: null,
    mode: null,
  };
};
const getInitialTimerState = () => {
  const queryState = getTimerStateFromQuery();
  if (queryState.mode) {
    return queryState;
  }

  return getTimerStateFromStorage() || {
    t: 0,
    mode: 'stopwatch',
  };
};
const CURSOR_HIDE_DELAY_MS = 1500;
const shouldAutoHideFullscreenUi = ({ fullscreen, paused }) => fullscreen && !paused;

class App extends Component {
  constructor(props) {
    super(props);
    const initialTimerState = getInitialTimerState();
    this.state = {
      t: initialTimerState.t,
      paused: true,
      mode: initialTimerState.mode,
      fullscreen: false,
      adjusting: false,
      editing: null, // hour, minute, second, null
      showCursor: false,
      cursorVisible: true,
      showTimeInput: false,
      timeInputValue: formatClockTime(initialTimerState.t).text,
      timeInputError: '',
    };
    this.timer = null;
    this.wakeLock = null;
    this.cursorHideTimer = null;
    this.restoreRetryTimers = [];
    this.timeInputRef = React.createRef();
  }

  componentDidMount() {
    this.restoreTimerStateFromPersistence();
    this.scheduleRestoreRetries();
    this.timer = setInterval(() => {
      this.tick();
    }, 500);
    window.addEventListener('pagehide', this.syncTimerStateToStorage);
    window.addEventListener('pageshow', this.restoreTimerStateFromPersistence);
    window.addEventListener('popstate', this.restoreTimerStateFromPersistence);
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('mousemove', this.handlePointerActivity);
    window.addEventListener('pointermove', this.handlePointerActivity);
    document.addEventListener('fullscreenchange', this.handleFullscreenChange);
  }

  componentWillUnmount() {
    clearInterval(this.timer);
    clearTimeout(this.cursorHideTimer);
    this.restoreRetryTimers.forEach((timerId) => clearTimeout(timerId));
    window.removeEventListener('pagehide', this.syncTimerStateToStorage);
    window.removeEventListener('pageshow', this.restoreTimerStateFromPersistence);
    window.removeEventListener('popstate', this.restoreTimerStateFromPersistence);
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('mousemove', this.handlePointerActivity);
    window.removeEventListener('pointermove', this.handlePointerActivity);
    document.removeEventListener('fullscreenchange', this.handleFullscreenChange);
    document.documentElement.classList.remove('hide-cursor');
    this.releaseWakeLock();
  }

  componentDidUpdate(prevProps, prevState) {
    if (!prevState.showTimeInput && this.state.showTimeInput && this.timeInputRef.current) {
      this.timeInputRef.current.focus();
      this.timeInputRef.current.select();
    }

    const persistedState = getInitialTimerState();
    if (
      this.state.paused &&
      this.state.t === 0 &&
      persistedState.t !== 0 &&
      this.state.mode === persistedState.mode
    ) {
      this.setState({
        t: persistedState.t,
        timeInputValue: formatClockTime(persistedState.t).text,
      });
      return;
    }

    if (
      prevState.mode !== this.state.mode ||
      getQueryTimeValue(prevState.t, prevState.mode) !== getQueryTimeValue(this.state.t, this.state.mode)
    ) {
      this.syncTimerStateToQuery();
      this.syncTimerStateToStorage();
    }

    const wasAutoHidingFullscreenUi = shouldAutoHideFullscreenUi(prevState);
    const isAutoHidingFullscreenUi = shouldAutoHideFullscreenUi(this.state);
    if (wasAutoHidingFullscreenUi !== isAutoHidingFullscreenUi) {
      if (isAutoHidingFullscreenUi) {
        this.setState({ cursorVisible: true });
        this.scheduleCursorHide();
      } else {
        this.clearCursorHideTimer();
        if (!this.state.cursorVisible) {
          this.setState({ cursorVisible: true });
          return;
        }
      }
    }

    document.documentElement.classList.toggle(
      'hide-cursor',
      isAutoHidingFullscreenUi && !this.state.cursorVisible,
    );
  }

  syncTimerStateToQuery = () => {
    const params = new URLSearchParams(window.location.search);
    const queryValue = getQueryTimeValue(this.state.t, this.state.mode);

    params.delete('countdown');
    params.delete('stopwatch');
    params.set(this.state.mode, queryValue);

    const nextSearch = params.toString();
    const nextUrl = `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ''}${window.location.hash}`;

    window.history.replaceState(window.history.state, document.title, nextUrl);
  };

  syncTimerStateToStorage = () => {
    const serializedState = JSON.stringify({
      t: this.state.t,
      mode: this.state.mode,
    });

    for (const storage of getAvailableStorages()) {
      try {
        storage.setItem(TIMER_STATE_STORAGE_KEY, serializedState);
      } catch {
        // Ignore storage failures and rely on other persistence layers.
      }
    }
  };

  scheduleRestoreRetries = () => {
    this.restoreRetryTimers.forEach((timerId) => clearTimeout(timerId));
    this.restoreRetryTimers = [50, 250].map((delayMs) => setTimeout(() => {
      this.restoreTimerStateFromPersistence();
    }, delayMs));
  };

  restoreTimerStateFromPersistence = () => {
    const persistedState = getInitialTimerState();

    this.setState((prevState) => {
      if (
        prevState.mode === persistedState.mode &&
        prevState.t === persistedState.t
      ) {
        return null;
      }

      return {
        t: persistedState.t,
        paused: true,
        mode: persistedState.mode,
        timeInputValue: formatClockTime(persistedState.t).text,
      };
    }, () => {
      this.syncTimerStateToQuery();
      this.syncTimerStateToStorage();
    });
  };

  async requestWakeLock() {
    try {
      if (this.wakeLock) return;
      if ('wakeLock' in navigator) {
        this.wakeLock = await navigator.wakeLock.request('screen');
        this.wakeLock.addEventListener('release', () => {
          this.wakeLock = null;
          console.log('Wake Lock was released');
        });
        console.log('Wake Lock is active');
      }
    } catch (err) {
      console.error(`${err.name}, ${err.message}`);
    }
  }

  async releaseWakeLock() {
    if (this.wakeLock) {
      await this.wakeLock.release();
      this.wakeLock = null;
    }
  }

  clearCursorHideTimer = () => {
    if (this.cursorHideTimer) {
      clearTimeout(this.cursorHideTimer);
      this.cursorHideTimer = null;
    }
  };

  scheduleCursorHide = () => {
    this.clearCursorHideTimer();
    this.cursorHideTimer = setTimeout(() => {
      this.setState({ cursorVisible: false });
      this.cursorHideTimer = null;
    }, CURSOR_HIDE_DELAY_MS);
  };

  revealFullscreenUi = () => {
    if (!document.fullscreenElement) return;

    this.setState({ cursorVisible: true });
    if (shouldAutoHideFullscreenUi(this.state)) {
      this.scheduleCursorHide();
    } else {
      this.clearCursorHideTimer();
    }
  };

  tick() {
    const { mode, paused, showCursor, editing } = this.state;
    if (editing) {
      this.setState({ showCursor: !showCursor });
    }
    if (paused) return;
    this.setState((prevState) => {
      const t = prevState.t + (mode === 'countdown' ? -1 : 1) * 0.5;
      return { t };
    });
  }

  handleFullscreenChange = () => {
    const fullscreen = Boolean(document.fullscreenElement);
    this.setState({ fullscreen, cursorVisible: true });

    if (fullscreen) {
      this.requestWakeLock();
    } else {
      this.clearCursorHideTimer();
      this.releaseWakeLock();
    }
  };

  handlePointerActivity = () => {
    this.revealFullscreenUi();
  };

  toggleFullScreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
  };

  resetTimer = () => {
    this.setState({
      t: 0,
      paused: true,
      showTimeInput: false,
      timeInputValue: '0:00:00',
      timeInputError: '',
    });
  };

  switchMode = (mode) => {
    this.setState({
      mode: mode || (this.state.mode === 'stopwatch' ? 'countdown' : 'stopwatch'),
    });
  };

  pauseTimer = () => {
    const paused = !this.state.paused;
    const persistedState = getInitialTimerState();
    const nextTime = (
      this.state.paused &&
      this.state.t === 0 &&
      persistedState.t !== 0 &&
      this.state.mode === persistedState.mode
    ) ? persistedState.t : this.state.t;
    this.setState({
      t: nextTime,
      paused,
      editing: false,
    });
  };

  toggleEditing = () => {
    const { editing, showTimeInput } = this.state;
    if (showTimeInput) return;
    this.setState({
      editing: editing ? null : 'second',
    });
  };

  openTimeInput = () => {
    this.setState((prevState) => ({
      paused: true,
      editing: null,
      showTimeInput: true,
      timeInputValue: formatClockTime(parseInt(prevState.t, 10)).text,
      timeInputError: '',
    }));
  };

  closeTimeInput = () => {
    this.setState({
      showTimeInput: false,
      timeInputError: '',
    });
  };

  handleTimeInputChange = (event) => {
    this.setState({
      timeInputValue: event.target.value,
      timeInputError: '',
    });
  };

  submitTimeInput = () => {
    const nextTime = parseTimeInput(this.state.timeInputValue);

    if (nextTime === null) {
      this.setState({
        timeInputError: 'Use h:mm:ss, m:ss, or ss',
      });
      return;
    }

    this.setState({
      t: nextTime,
      paused: true,
      mode: 'countdown',
      showTimeInput: false,
      timeInputValue: formatClockTime(nextTime).text,
      timeInputError: '',
    });
  };

  handleCursorMove(direction) {
    const state = { ...this.state };
    const editPositions = ['hour', 'minute', 'second'];
    if (state.showTimeInput) return;
    state.paused = true;
    switch (direction) {
      case 'up':
      case 'down':
        if (!state.editing) {
          state.editing = 'second';
        }
        state.t += (direction === 'up' ? 1 : -1) * (
          state.editing === 'second' ? 1 : state.editing === 'minute' ? 60 : 3600
        );
        if (state.t < 0) {
          state.t = 0;
        }
        break;
      case 'left':
        if (!state.editing) {
          state.editing = 'minute';
        } else {
          const currentIndex = editPositions.indexOf(state.editing);
          state.editing = editPositions[Math.max(0, currentIndex - 1)];
        }
        break;
      case 'right':
        if (!state.editing) {
          state.editing = 'second';
        } else {
          const currentIndex = editPositions.indexOf(state.editing);
          state.editing = editPositions[Math.min(editPositions.length - 1, currentIndex + 1)];
        }
        break;
      default:
        break;
    }
    this.setState(state);
  }

  handleKeyDown = (event) => {
    this.revealFullscreenUi();

    const targetTag = event.target.tagName;
    if (targetTag === 'INPUT') {
      if (event.key === 'Escape') {
        event.preventDefault();
        this.closeTimeInput();
      }
      return;
    }

    switch (event.key) {
      case 'F':
      case 'f':
        event.preventDefault();
        this.toggleFullScreen();
        break;
      case 'R':
      case 'r':
        event.preventDefault();
        this.resetTimer();
        break;
      case 'S':
      case 's':
        event.preventDefault();
        this.switchMode();
        break;
      case 'ArrowUp':
      case 'ArrowDown':
      case 'ArrowLeft':
      case 'ArrowRight':
        event.preventDefault();
        this.handleCursorMove(event.key.toLowerCase().replace('arrow', ''));
        break;
      case 'Enter':
        event.preventDefault();
        if (this.state.showTimeInput) {
          this.submitTimeInput();
        } else {
          this.toggleEditing();
        }
        break;
      case 'T':
      case 't':
        event.preventDefault();
        this.openTimeInput();
        break;
      case 'Escape':
        if (this.state.showTimeInput) {
          event.preventDefault();
          this.closeTimeInput();
        }
        break;
      case ' ':
        event.preventDefault();
        this.pauseTimer();
        break;
      default:
        break;
    }
  };

  render() {
    const {
      t,
      paused,
      editing,
      mode,
      showCursor,
      fullscreen,
      cursorVisible,
      showTimeInput,
      timeInputValue,
      timeInputError,
    } = this.state;
    const persistedState = getInitialTimerState();
    const effectiveState = (
      paused &&
      t === 0 &&
      persistedState.t !== 0 &&
      mode === persistedState.mode
    ) ? { ...this.state, t: persistedState.t } : this.state;
    const displaySeconds = getDisplayTotalSeconds(effectiveState.t, paused, effectiveState.mode);
    const displayTime = formatClockTime(displaySeconds);
    const { hour, minute, second, isNegative } = displayTime;
    const showHours = hour > 0;
    const hideFullscreenUi = shouldAutoHideFullscreenUi(this.state) && !cursorVisible;
    const showTips = !hideFullscreenUi;
    return (
      <div className={clsx('App', { 'hide-cursor': hideFullscreenUi })}>
        {hideFullscreenUi && <div className="cursor-hide-overlay" aria-hidden="true" />}
        <div
          className={clsx('clock', { negative: isNegative, paused, 'show-cursor': showCursor })}
          onDoubleClick={() => this.toggleFullScreen()}
        >
          {isNegative && <span className="sign">-</span>}
          {showHours && (
            <>
              <span className={clsx('time hour', { editing: editing === 'hour' })}>{formatHour(hour)}</span>
              <span className="separator">:</span>
            </>
          )}
          <span className={clsx('time minute', { editing: editing === 'minute' })}>{pad(minute)}</span>
          <span className="seconds-group">
            <span className="separator">:</span>
            <span className={clsx('time second', { editing: editing === 'second' })}>{pad(second)}</span>
          </span>
        </div>
        {showTimeInput && (
          <form
            className="time-input-panel"
            onSubmit={(event) => {
              event.preventDefault();
              this.submitTimeInput();
            }}
          >
            <label className="time-input-label" htmlFor="time-input">Set time</label>
            <input
              ref={this.timeInputRef}
              id="time-input"
              className={clsx('time-input', { invalid: timeInputError })}
              type="text"
              inputMode="numeric"
              placeholder="h:mm:ss"
              value={timeInputValue}
              onChange={this.handleTimeInputChange}
              aria-label="Time input"
            />
            <button type="submit">Set</button>
            <button type="button" onClick={this.closeTimeInput}>Cancel</button>
            {timeInputError && <span className="time-input-error">{timeInputError}</span>}
          </form>
        )}
        <ul className={clsx('tips', { hidden: !showTips })}>
          <li>
            <button onClick={this.toggleFullScreen}>F</button>
            -
            <span className="tip">{fullscreen ? 'exit' : 'enter'} fullscreen</span>
          </li>
          <li>
            <button onClick={() => this.handleCursorMove('left')}>←</button>
            <button onClick={() => this.handleCursorMove('right')}>→</button>
            <button onClick={() => this.handleCursorMove('up')}>↑</button>
            <button onClick={() => this.handleCursorMove('down')}>↓</button>
            -
            <span className="tip">edit timer</span>
          </li>
          <li>
            <button onClick={this.openTimeInput}>T</button>
            -
            <span className="tip">type a time directly</span>
          </li>
          <li>
            <button onClick={this.resetTimer}>R</button>
            -
            <span className="tip">reset timer</span>
          </li>
          <li>
            <button onClick={this.switchMode}>S</button>
            -
            {mode === 'countdown' ?
              <span className="tip"><span>countdown ✓</span> or <button onClick={() => this.switchMode('stopwatch')}>stopwatch</button></span>
              :
              <span className="tip"><button onClick={() => this.switchMode('countdown')}>countdown</button> or <span>stopwatch ✓</span></span>
            }
          </li>
          <li>
            <button onClick={this.pauseTimer}>Space</button>
            -
            <span className="tip">{paused ? 'start' : 'pause'} timer</span>
          </li>
        </ul>
      </div>
    );
  }
}

export default App;
