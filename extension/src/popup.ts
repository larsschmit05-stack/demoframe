// ── State ──────────────────────────────────────────────────────────

interface PopupState {
  recording: boolean;
  paused: boolean;
  eventCount: number;
  elementCount: number;
  estimatedSize: number;
  hasRecording: boolean;
  error: string | null;
}

let state: PopupState = {
  recording: false,
  paused: false,
  eventCount: 0,
  elementCount: 0,
  estimatedSize: 0,
  hasRecording: false,
  error: null,
};

let port: chrome.runtime.Port | null = null;

// ── DOM Elements ───────────────────────────────────────────────────

function $(id: string): HTMLElement {
  return document.getElementById(id)!;
}

// ── Port Connection ────────────────────────────────────────────────

function connectToBackground(): void {
  port = chrome.runtime.connect({ name: 'demoframe-popup' });

  port.onMessage.addListener((msg) => {
    switch (msg.type) {
      case 'STATE_SYNC':
        state.recording = msg.recording ?? false;
        state.paused = msg.paused ?? false;
        state.eventCount = msg.eventCount ?? 0;
        state.elementCount = msg.elementCount ?? 0;
        state.estimatedSize = msg.estimatedSize ?? 0;
        renderUI();
        break;

      case 'STATUS_UPDATE':
        state.eventCount = msg.eventCount ?? state.eventCount;
        state.elementCount = msg.elementCount ?? state.elementCount;
        state.estimatedSize = msg.estimatedSize ?? state.estimatedSize;
        renderUI();
        break;

      case 'RECORDING_SAVED':
        state.recording = false;
        state.paused = false;
        state.hasRecording = true;
        renderUI();
        break;

      case 'SIZE_WARNING':
        state.error = `Recording is large (${formatBytes(msg.sizeBytes as number)}). Consider stopping soon.`;
        renderUI();
        break;

      case 'SIZE_LIMIT_REACHED':
        state.error = 'Size limit reached. Recording auto-stopped.';
        state.recording = false;
        state.paused = false;
        renderUI();
        break;

      case 'ERROR':
        state.error = msg.error as string;
        renderUI();
        break;
    }
  });

  port.onDisconnect.addListener(() => {
    port = null;
  });
}

// ── Actions ────────────────────────────────────────────────────────

function startRecording(): void {
  state.error = null;
  port?.postMessage({ type: 'START_RECORDING' });
}

function pauseRecording(): void {
  port?.postMessage({ type: 'PAUSE_RECORDING' });
}

function resumeRecording(): void {
  port?.postMessage({ type: 'RESUME_RECORDING' });
}

function stopRecording(): void {
  port?.postMessage({ type: 'STOP_RECORDING' });
}

async function exportRecording(): Promise<void> {
  try {
    const result = await chrome.storage.local.get('lastRecording');
    if (!result.lastRecording) {
      state.error = 'No recording found to export.';
      renderUI();
      return;
    }

    const json = JSON.stringify(result.lastRecording, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `demoframe-${Date.now()}.json`;
    a.click();

    URL.revokeObjectURL(url);
  } catch (err) {
    state.error = `Export failed: ${err}`;
    renderUI();
  }
}

// ── Render ─────────────────────────────────────────────────────────

function renderUI(): void {
  const statusDot = $('status-dot');
  const statusText = $('status-text');
  const primaryBtn = $('primary-btn') as HTMLButtonElement;
  const stopBtn = $('stop-btn') as HTMLButtonElement;
  const exportBtn = $('export-btn') as HTMLButtonElement;
  const stats = $('stats');
  const errorEl = $('error');

  // Status
  if (state.recording && !state.paused) {
    statusDot.className = 'status-dot recording';
    statusText.textContent = 'Recording...';
  } else if (state.paused) {
    statusDot.className = 'status-dot paused';
    statusText.textContent = 'Paused';
  } else {
    statusDot.className = 'status-dot idle';
    statusText.textContent = 'Ready';
  }

  // Primary button
  if (!state.recording && !state.paused) {
    primaryBtn.textContent = 'Start Recording';
    primaryBtn.className = 'btn btn-primary';
    primaryBtn.onclick = startRecording;
    primaryBtn.disabled = false;
  } else if (state.recording && !state.paused) {
    primaryBtn.textContent = 'Pause';
    primaryBtn.className = 'btn btn-warning';
    primaryBtn.onclick = pauseRecording;
    primaryBtn.disabled = false;
  } else if (state.paused) {
    primaryBtn.textContent = 'Resume';
    primaryBtn.className = 'btn btn-primary';
    primaryBtn.onclick = resumeRecording;
    primaryBtn.disabled = false;
  }

  // Stop button
  stopBtn.disabled = !state.recording && !state.paused;
  stopBtn.style.opacity = stopBtn.disabled ? '0.4' : '1';

  // Stats
  stats.textContent = `Events: ${state.eventCount} | Elements: ${state.elementCount}`;

  // Export button
  exportBtn.style.display = state.hasRecording && !state.recording ? 'block' : 'none';

  // Error
  if (state.error) {
    errorEl.textContent = state.error;
    errorEl.style.display = 'block';
  } else {
    errorEl.style.display = 'none';
  }
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ── Init ───────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', async () => {
  connectToBackground();

  // Check if there's an existing recording for export
  try {
    const result = await chrome.storage.local.get('lastRecording');
    state.hasRecording = !!result.lastRecording;
  } catch {
    // Ignore
  }

  // Wire up buttons
  $('stop-btn').onclick = stopRecording;
  $('export-btn').onclick = exportRecording;

  renderUI();
});
