import type { ScreenSnapshot } from './utils/recording-format';

// ── Types ──────────────────────────────────────────────────────────

interface SessionState {
  screens: ScreenSnapshot[];
  capturing: boolean;
  demoName: string;
  appUrl: string;
}

interface Message {
  type: string;
  [key: string]: unknown;
}

// ── State ──────────────────────────────────────────────────────────

let sessionState: SessionState = {
  screens: [],
  capturing: false,
  demoName: '',
  appUrl: '',
};

let popupPort: chrome.runtime.Port | null = null;

// ── Persistence ────────────────────────────────────────────────────

async function saveState(): Promise<void> {
  try {
    // Store screen metadata (not full HTML) in session storage for UI
    const screensMeta = sessionState.screens.map((s) => ({
      name: s.name,
      sourceUrl: s.sourceUrl,
      sizeBytes: s.sizeBytes,
      capturedAt: s.capturedAt,
      elementCount: s.interactiveElements.length,
    }));

    await chrome.storage.session.set({
      demoframeState: {
        screenCount: sessionState.screens.length,
        capturing: sessionState.capturing,
        demoName: sessionState.demoName,
        appUrl: sessionState.appUrl,
        screensMeta,
      },
    });
  } catch {
    // storage.session may not be available in all contexts
  }
}

async function loadState(): Promise<void> {
  try {
    const result = await chrome.storage.session.get('demoframeState');
    if (result.demoframeState) {
      sessionState.capturing = result.demoframeState.capturing ?? false;
      sessionState.demoName = result.demoframeState.demoName ?? '';
      sessionState.appUrl = result.demoframeState.appUrl ?? '';
      // Note: full screen data is stored in chrome.storage.local
    }
  } catch {
    // Ignore
  }
}

// ── Port Management ────────────────────────────────────────────────

chrome.runtime.onConnect.addListener((port) => {
  if (port.name === 'demoframe-popup') {
    popupPort = port;

    // Send current state
    sendStateToPopup();

    port.onMessage.addListener((msg: Message) => {
      handlePopupMessage(msg);
    });

    port.onDisconnect.addListener(() => {
      popupPort = null;
    });
  }
});

function sendStateToPopup(): void {
  const screensMeta = sessionState.screens.map((s) => ({
    name: s.name,
    sourceUrl: s.sourceUrl,
    sizeBytes: s.sizeBytes,
    capturedAt: s.capturedAt,
    elementCount: s.interactiveElements.length,
  }));

  popupPort?.postMessage({
    type: 'STATE_SYNC',
    screenCount: sessionState.screens.length,
    capturing: sessionState.capturing,
    demoName: sessionState.demoName,
    appUrl: sessionState.appUrl,
    screensMeta,
  });
}

// ── Popup Messages ─────────────────────────────────────────────────

async function handlePopupMessage(msg: Message): Promise<void> {
  switch (msg.type) {
    case 'CAPTURE_SCREEN':
      await captureScreen();
      break;

    case 'REMOVE_SCREEN': {
      const index = msg.index as number;
      if (index >= 0 && index < sessionState.screens.length) {
        sessionState.screens.splice(index, 1);
        await saveState();
        sendStateToPopup();
      }
      break;
    }

    case 'SET_DEMO_NAME':
      sessionState.demoName = (msg.name as string) || '';
      await saveState();
      break;

    case 'FINISH_DEMO':
      await finishAndUpload();
      break;

    case 'DISCARD_ALL':
      sessionState.screens = [];
      sessionState.demoName = '';
      sessionState.appUrl = '';
      await chrome.storage.local.remove('capturedScreens');
      await saveState();
      sendStateToPopup();
      break;

    case 'GET_STATE':
      sendStateToPopup();
      break;
  }
}

// ── Capture Screen ────────────────────────────────────────────────

async function captureScreen(): Promise<void> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id || !tab.url) {
    popupPort?.postMessage({
      type: 'ERROR',
      error: 'No active tab found',
    });
    return;
  }

  sessionState.capturing = true;
  sendStateToPopup();

  // Inject content script
  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['content.js'],
    });
  } catch (err) {
    sessionState.capturing = false;
    popupPort?.postMessage({
      type: 'ERROR',
      error: `Failed to inject content script: ${err}`,
    });
    sendStateToPopup();
    return;
  }

  // Wait for content script to initialize
  await new Promise((resolve) => setTimeout(resolve, 200));

  // Request snapshot from content script
  try {
    const response = await chrome.tabs.sendMessage(tab.id, {
      type: 'CAPTURE_SCREEN',
    });

    if (response?.ok && response.snapshot) {
      const snapshot = response.snapshot as ScreenSnapshot;

      // Set app URL from first screen
      if (sessionState.screens.length === 0) {
        try {
          sessionState.appUrl = new URL(snapshot.sourceUrl).origin;
        } catch {
          sessionState.appUrl = snapshot.sourceUrl;
        }
      }

      sessionState.screens.push(snapshot);

      // Persist full screen data to local storage
      await chrome.storage.local.set({
        capturedScreens: sessionState.screens,
      });

      await saveState();

      popupPort?.postMessage({
        type: 'SCREEN_CAPTURED',
        screenIndex: sessionState.screens.length - 1,
        screenName: snapshot.name,
        sizeBytes: snapshot.sizeBytes,
      });
    } else {
      popupPort?.postMessage({
        type: 'ERROR',
        error: response?.error || 'Capture failed',
      });
    }
  } catch (err) {
    popupPort?.postMessage({
      type: 'ERROR',
      error: `Capture failed: ${err}`,
    });
  }

  sessionState.capturing = false;
  sendStateToPopup();
}

// ── Finish & Upload ───────────────────────────────────────────────

async function finishAndUpload(): Promise<void> {
  if (sessionState.screens.length === 0) {
    popupPort?.postMessage({
      type: 'ERROR',
      error: 'No screens captured',
    });
    return;
  }

  // Get auth token
  const tokenResult = await chrome.storage.local.get('supabaseToken');
  if (!tokenResult.supabaseToken) {
    popupPort?.postMessage({
      type: 'ERROR',
      error: 'Not authenticated. Please visit the dashboard to log in.',
    });
    return;
  }

  const token = tokenResult.supabaseToken as string;
  const demoName = sessionState.demoName || `Demo - ${new Date().toLocaleDateString()}`;

  popupPort?.postMessage({
    type: 'UPLOAD_STARTED',
    totalScreens: sessionState.screens.length,
  });

  try {
    // 1. Create the demo
    const demoResponse = await fetch('http://localhost:3000/api/demos', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        name: demoName,
        app_url: sessionState.appUrl,
      }),
    });

    if (!demoResponse.ok) {
      const errorData = await demoResponse.json().catch(() => ({ error: 'Unknown error' }));
      if (demoResponse.status === 402) {
        popupPort?.postMessage({
          type: 'ERROR',
          error: `Demo limit reached. ${errorData.error}`,
        });
      } else {
        popupPort?.postMessage({
          type: 'ERROR',
          error: errorData.error || `Failed to create demo: ${demoResponse.statusText}`,
        });
      }
      return;
    }

    const demo = await demoResponse.json();

    // 2. Upload each screen
    for (let i = 0; i < sessionState.screens.length; i++) {
      const screen = sessionState.screens[i];

      popupPort?.postMessage({
        type: 'UPLOAD_PROGRESS',
        currentScreen: i + 1,
        totalScreens: sessionState.screens.length,
        screenName: screen.name,
      });

      const screenResponse = await fetch(
        `http://localhost:3000/api/demos/${demo.id}/screens/upload`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({
            name: screen.name,
            source_url: screen.sourceUrl,
            html_content: screen.html,
            viewport_width: screen.viewport.width,
            viewport_height: screen.viewport.height,
            interactive_elements: screen.interactiveElements,
            is_start_screen: i === 0,
          }),
        }
      );

      if (!screenResponse.ok) {
        const errorData = await screenResponse.json().catch(() => ({ error: 'Unknown error' }));
        popupPort?.postMessage({
          type: 'ERROR',
          error: `Failed to upload screen "${screen.name}": ${errorData.error || screenResponse.statusText}`,
        });
        return;
      }
    }

    // 3. Success — clear captured data
    sessionState.screens = [];
    sessionState.demoName = '';
    sessionState.appUrl = '';
    await chrome.storage.local.remove('capturedScreens');
    await saveState();

    popupPort?.postMessage({
      type: 'UPLOAD_COMPLETE',
      demoId: demo.id,
      demoName: demo.name,
    });

    sendStateToPopup();
  } catch (err) {
    popupPort?.postMessage({
      type: 'ERROR',
      error: `Upload failed: ${err}`,
    });
  }
}

// ── Auth Token Management ─────────────────────────────────────────

chrome.runtime.onMessage.addListener((message: Message, _sender, sendResponse) => {
  if (message.type === 'SET_AUTH_TOKEN') {
    chrome.storage.local.set({ supabaseToken: message.token }, () => {
      sendResponse({ ok: true });
    });
    return true;
  }

  if (message.type === 'GET_AUTH_TOKEN') {
    chrome.storage.local.get('supabaseToken', (result) => {
      sendResponse({ token: result.supabaseToken || null });
    });
    return true;
  }

  if (message.type === 'CAPTURE_PROGRESS') {
    // Relay capture progress to popup
    popupPort?.postMessage({
      type: 'CAPTURE_PROGRESS',
      phase: message.phase,
      detail: message.detail,
    });
    return false;
  }
});

// ── Init ───────────────────────────────────────────────────────────

// Restore screens from local storage on startup
async function init(): Promise<void> {
  await loadState();

  try {
    const result = await chrome.storage.local.get('capturedScreens');
    if (result.capturedScreens) {
      sessionState.screens = result.capturedScreens;
    }
  } catch {
    // Ignore
  }

  console.log('[Demoframe] Background service worker loaded (snapshot mode)');
}

init();
