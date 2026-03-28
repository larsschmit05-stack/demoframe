// ── Types ──────────────────────────────────────────────────────────

interface SessionState {
  recording: boolean;
  paused: boolean;
  tabId: number | null;
  eventCount: number;
  elementCount: number;
  estimatedSize: number;
}

interface Message {
  type: string;
  [key: string]: unknown;
}

// ── State ──────────────────────────────────────────────────────────

let sessionState: SessionState = {
  recording: false,
  paused: false,
  tabId: null,
  eventCount: 0,
  elementCount: 0,
  estimatedSize: 0,
};

let contentPort: chrome.runtime.Port | null = null;
let popupPort: chrome.runtime.Port | null = null;

// ── Persistence ────────────────────────────────────────────────────

async function saveState(): Promise<void> {
  try {
    await chrome.storage.session.set({ demoframeState: sessionState });
  } catch {
    // storage.session may not be available in all contexts
  }
}

async function loadState(): Promise<void> {
  try {
    const result = await chrome.storage.session.get('demoframeState');
    if (result.demoframeState) {
      sessionState = result.demoframeState;
    }
  } catch {
    // Ignore
  }
}

// ── Port Management ────────────────────────────────────────────────

chrome.runtime.onConnect.addListener((port) => {
  if (port.name === 'demoframe-content') {
    contentPort = port;

    port.onMessage.addListener((msg: Message) => {
      handleContentMessage(msg);
    });

    port.onDisconnect.addListener(() => {
      contentPort = null;
    });
  }

  if (port.name === 'demoframe-popup') {
    popupPort = port;

    // Send current state immediately
    port.postMessage({
      type: 'STATE_SYNC',
      ...sessionState,
    });

    port.onMessage.addListener((msg: Message) => {
      handlePopupMessage(msg);
    });

    port.onDisconnect.addListener(() => {
      popupPort = null;
    });
  }
});

// ── Content Script Messages ────────────────────────────────────────

function handleContentMessage(msg: Message): void {
  switch (msg.type) {
    case 'STATUS_UPDATE':
      sessionState.eventCount = (msg.eventCount as number) ?? 0;
      sessionState.elementCount = (msg.elementCount as number) ?? 0;
      sessionState.estimatedSize = (msg.estimatedSize as number) ?? 0;
      saveState();

      // Relay to popup
      popupPort?.postMessage(msg);
      break;

    case 'RECORDING_COMPLETE': {
      const recording = msg.recording;
      // Store recording in local storage
      chrome.storage.local.set({ lastRecording: recording }, () => {
        sessionState.recording = false;
        sessionState.paused = false;
        sessionState.tabId = null;
        sessionState.eventCount = 0;
        sessionState.elementCount = 0;
        sessionState.estimatedSize = 0;
        saveState();
        
        // Notify popup
        popupPort?.postMessage({
          type: 'RECORDING_SAVED',
        });
      });
      break;
    }

    case 'SIZE_WARNING':
      popupPort?.postMessage(msg);
      break;

    case 'SIZE_LIMIT_REACHED':
      popupPort?.postMessage(msg);
      break;
  }
}

// ── Popup Messages ─────────────────────────────────────────────────

async function handlePopupMessage(msg: Message): Promise<void> {
  switch (msg.type) {
    case 'START_RECORDING':
      await startRecording();
      break;

    case 'PAUSE_RECORDING':
      await pauseRecording();
      break;

    case 'RESUME_RECORDING':
      await resumeRecording();
      break;

    case 'STOP_RECORDING':
      await stopRecording();
      break;

    case 'GET_STATE':
      popupPort?.postMessage({
        type: 'STATE_SYNC',
        ...sessionState,
      });
      break;
  }
}

// ── Recording Actions ──────────────────────────────────────────────

async function startRecording(): Promise<void> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return;

  const tabId = tab.id;

  // Inject content script
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['content.js'],
    });
  } catch (err) {
    popupPort?.postMessage({
      type: 'ERROR',
      error: `Failed to inject content script: ${err}`,
    });
    return;
  }

  // Wait a moment for the content script to initialize
  await new Promise((resolve) => setTimeout(resolve, 100));

  // Send START to content script
  try {
    await chrome.tabs.sendMessage(tabId, { type: 'START_RECORDING' });
  } catch (err) {
    popupPort?.postMessage({
      type: 'ERROR',
      error: `Failed to start recording: ${err}`,
    });
    return;
  }

  sessionState.recording = true;
  sessionState.paused = false;
  sessionState.tabId = tabId;
  sessionState.eventCount = 0;
  sessionState.elementCount = 0;
  sessionState.estimatedSize = 0;
  await saveState();
  // Port connection keeps service worker alive during recording

  popupPort?.postMessage({
    type: 'STATE_SYNC',
    ...sessionState,
  });
}

async function pauseRecording(): Promise<void> {
  if (!sessionState.tabId) return;

  try {
    await chrome.tabs.sendMessage(sessionState.tabId, { type: 'PAUSE_RECORDING' });
    sessionState.paused = true;
    await saveState();

    popupPort?.postMessage({
      type: 'STATE_SYNC',
      ...sessionState,
    });
  } catch (err) {
    popupPort?.postMessage({
      type: 'ERROR',
      error: `Failed to pause: ${err}`,
    });
  }
}

async function resumeRecording(): Promise<void> {
  if (!sessionState.tabId) return;

  try {
    await chrome.tabs.sendMessage(sessionState.tabId, { type: 'RESUME_RECORDING' });
    sessionState.paused = false;
    await saveState();

    popupPort?.postMessage({
      type: 'STATE_SYNC',
      ...sessionState,
    });
  } catch (err) {
    popupPort?.postMessage({
      type: 'ERROR',
      error: `Failed to resume: ${err}`,
    });
  }
}

async function stopRecording(): Promise<void> {
  if (!sessionState.tabId) return;

  try {
    await chrome.tabs.sendMessage(sessionState.tabId, { type: 'STOP_RECORDING' });
    // State will be updated when RECORDING_COMPLETE arrives from content
  } catch (err) {
    // If we can't reach content script, clean up anyway
    sessionState.recording = false;
    sessionState.paused = false;
    sessionState.tabId = null;
    await saveState();
    
    popupPort?.postMessage({
      type: 'STATE_SYNC',
      ...sessionState,
    });
    popupPort?.postMessage({
      type: 'ERROR',
      error: `Failed to stop cleanly: ${err}`,
    });
  }
}

// ── Init ───────────────────────────────────────────────────────────

loadState();
console.log('[Demoframe] Background service worker loaded');
