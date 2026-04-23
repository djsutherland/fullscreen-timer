import React, { Component } from 'react';
import clsx from 'clsx';
import './App.css';

const pad = (n) => (n < 10) ? `0${n}` : n;
const formatHour = (n) => (n < 10) ? `${n}` : pad(n);
const formatClockTime = (totalSeconds) => {
  const hour = parseInt(totalSeconds / 3600, 10);
  const minute = parseInt((totalSeconds % 3600) / 60, 10);
  const second = totalSeconds % 60;
  return {
    hour,
    minute,
    second,
    text: `${formatHour(hour)}:${pad(minute)}:${pad(second)}`,
  };
};
const parseTimeInput = (value) => {
  const segments = value.trim().split(':');
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

  return (hour * 3600) + (minute * 60) + second;
};

class App extends Component {
  constructor(props) {
    super(props);
    this.state = {
      t: 0,
      paused: true,
      mode: 'stopwatch',
      fullscreen: false,
      adjusting: false,
      editing: null, // hour, minute, second, null
      showCursor: false,
      showTimeInput: false,
      timeInputValue: '0:00:00',
      timeInputError: '',
    };
    this.timer = null;
    this.wakeLock = null;
    this.timeInputRef = React.createRef();
  }

  componentDidMount() {
    this.timer = setInterval(() => {
      this.tick();
    }, 500);
    window.addEventListener('keydown', this.handleKeyDown);
    document.addEventListener('fullscreenchange', this.handleFullscreenChange);
  }

  componentWillUnmount() {
    clearInterval(this.timer);
    window.removeEventListener('keydown', this.handleKeyDown);
    document.removeEventListener('fullscreenchange', this.handleFullscreenChange);
    this.releaseWakeLock();
  }

  componentDidUpdate(prevProps, prevState) {
    if (!prevState.showTimeInput && this.state.showTimeInput && this.timeInputRef.current) {
      this.timeInputRef.current.focus();
      this.timeInputRef.current.select();
    }
  }

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

  tick() {
    const { mode, paused, showCursor, editing } = this.state;
    if (editing) {
      this.setState({ showCursor: !showCursor });
    }
    if (paused) return;
    this.setState((prevState) => {
      const t = prevState.t + (mode === 'countdown' ? -1 : 1) * 0.5;
      if (t <= 0) {
        return {
          t: 0,
          paused: true,
        };
      } else {
        return { t };
      }
    });
  }

  handleFullscreenChange = () => {
    const fullscreen = Boolean(document.fullscreenElement);
    this.setState({ fullscreen });

    if (fullscreen) {
      this.requestWakeLock();
    } else {
      this.releaseWakeLock();
    }
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
    this.setState({
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
      showTimeInput,
      timeInputValue,
      timeInputError,
    } = this.state;
    const totalSeconds = parseInt(t, 10);
    const { hour, minute, second } = formatClockTime(totalSeconds);
    return (
      <div className="App">
        <div
          className={clsx('clock', { 'show-cursor': showCursor })}
          onDoubleClick={() => this.toggleFullScreen()}
        >
          <span className={clsx('time hour', { editing: editing === 'hour' })}>{formatHour(hour)}</span>
          <span className="separator">:</span>
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
        <ul className="tips">
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
