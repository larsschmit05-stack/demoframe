let sessionState = {
  recording: false,
  paused: false,
  tabId: null,
  eventCount: 0,
  elementCount: 0,
  estimatedSize: 0
};
let popupPort = null;
async function saveState() {
  try {
    await chrome.storage.session.set({ demoframeState: sessionState });
  } catch {
  }
}
async function loadState() {
  try {
    const result = await chrome.storage.session.get("demoframeState");
    if (result.demoframeState) {
      sessionState = result.demoframeState;
    }
  } catch {
  }
}
chrome.runtime.onConnect.addListener((port) => {
  if (port.name === "demoframe-content") {
    port.onMessage.addListener((msg) => {
      handleContentMessage(msg);
    });
    port.onDisconnect.addListener(() => {
    });
  }
  if (port.name === "demoframe-popup") {
    popupPort = port;
    port.postMessage({
      type: "STATE_SYNC",
      ...sessionState
    });
    port.onMessage.addListener((msg) => {
      handlePopupMessage(msg);
    });
    port.onDisconnect.addListener(() => {
      popupPort = null;
    });
  }
});
function handleContentMessage(msg) {
  switch (msg.type) {
    case "STATUS_UPDATE":
      sessionState.eventCount = msg.eventCount ?? 0;
      sessionState.elementCount = msg.elementCount ?? 0;
      sessionState.estimatedSize = msg.estimatedSize ?? 0;
      saveState();
      popupPort?.postMessage(msg);
      break;
    case "RECORDING_COMPLETE": {
      const recording = msg.recording;
      chrome.storage.local.set({ lastRecording: recording }, () => {
        sessionState.recording = false;
        sessionState.paused = false;
        sessionState.tabId = null;
        sessionState.eventCount = 0;
        sessionState.elementCount = 0;
        sessionState.estimatedSize = 0;
        saveState();
        popupPort?.postMessage({
          type: "RECORDING_SAVED"
        });
      });
      break;
    }
    case "SIZE_WARNING":
      popupPort?.postMessage(msg);
      break;
    case "SIZE_LIMIT_REACHED":
      popupPort?.postMessage(msg);
      break;
  }
}
async function handlePopupMessage(msg) {
  switch (msg.type) {
    case "START_RECORDING":
      await startRecording();
      break;
    case "PAUSE_RECORDING":
      await pauseRecording();
      break;
    case "RESUME_RECORDING":
      await resumeRecording();
      break;
    case "STOP_RECORDING":
      await stopRecording();
      break;
    case "GET_STATE":
      popupPort?.postMessage({
        type: "STATE_SYNC",
        ...sessionState
      });
      break;
  }
}
async function startRecording() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return;
  const tabId = tab.id;
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ["content.js"]
    });
  } catch (err) {
    popupPort?.postMessage({
      type: "ERROR",
      error: `Failed to inject content script: ${err}`
    });
    return;
  }
  await new Promise((resolve) => setTimeout(resolve, 100));
  try {
    await chrome.tabs.sendMessage(tabId, { type: "START_RECORDING" });
  } catch (err) {
    popupPort?.postMessage({
      type: "ERROR",
      error: `Failed to start recording: ${err}`
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
  popupPort?.postMessage({
    type: "STATE_SYNC",
    ...sessionState
  });
}
async function pauseRecording() {
  if (!sessionState.tabId) return;
  try {
    await chrome.tabs.sendMessage(sessionState.tabId, { type: "PAUSE_RECORDING" });
    sessionState.paused = true;
    await saveState();
    popupPort?.postMessage({
      type: "STATE_SYNC",
      ...sessionState
    });
  } catch (err) {
    popupPort?.postMessage({
      type: "ERROR",
      error: `Failed to pause: ${err}`
    });
  }
}
async function resumeRecording() {
  if (!sessionState.tabId) return;
  try {
    await chrome.tabs.sendMessage(sessionState.tabId, { type: "RESUME_RECORDING" });
    sessionState.paused = false;
    await saveState();
    popupPort?.postMessage({
      type: "STATE_SYNC",
      ...sessionState
    });
  } catch (err) {
    popupPort?.postMessage({
      type: "ERROR",
      error: `Failed to resume: ${err}`
    });
  }
}
async function stopRecording() {
  if (!sessionState.tabId) return;
  try {
    await chrome.tabs.sendMessage(sessionState.tabId, { type: "STOP_RECORDING" });
  } catch (err) {
    sessionState.recording = false;
    sessionState.paused = false;
    sessionState.tabId = null;
    await saveState();
    popupPort?.postMessage({
      type: "STATE_SYNC",
      ...sessionState
    });
    popupPort?.postMessage({
      type: "ERROR",
      error: `Failed to stop cleanly: ${err}`
    });
  }
}
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === "SET_AUTH_TOKEN") {
    chrome.storage.local.set({ supabaseToken: message.token }, () => {
      sendResponse({ ok: true });
    });
    return true;
  }
  if (message.type === "GET_AUTH_TOKEN") {
    chrome.storage.local.get("supabaseToken", (result) => {
      sendResponse({ token: result.supabaseToken || null });
    });
    return true;
  }
});
loadState();
console.log("[Demoframe] Background service worker loaded");
//# sourceMappingURL=background.js.map
