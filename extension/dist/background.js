let sessionState = {
  screens: [],
  capturing: false,
  demoName: "",
  appUrl: ""
};
let popupPort = null;
async function saveState() {
  try {
    const screensMeta = sessionState.screens.map((s) => ({
      name: s.name,
      sourceUrl: s.sourceUrl,
      sizeBytes: s.sizeBytes,
      capturedAt: s.capturedAt,
      elementCount: s.interactiveElements.length
    }));
    await chrome.storage.session.set({
      demoframeState: {
        screenCount: sessionState.screens.length,
        capturing: sessionState.capturing,
        demoName: sessionState.demoName,
        appUrl: sessionState.appUrl,
        screensMeta
      }
    });
  } catch {
  }
}
async function loadState() {
  try {
    const result = await chrome.storage.session.get("demoframeState");
    if (result.demoframeState) {
      sessionState.capturing = result.demoframeState.capturing ?? false;
      sessionState.demoName = result.demoframeState.demoName ?? "";
      sessionState.appUrl = result.demoframeState.appUrl ?? "";
    }
  } catch {
  }
}
chrome.runtime.onConnect.addListener((port) => {
  if (port.name === "demoframe-popup") {
    popupPort = port;
    sendStateToPopup();
    port.onMessage.addListener((msg) => {
      handlePopupMessage(msg);
    });
    port.onDisconnect.addListener(() => {
      popupPort = null;
    });
  }
});
function sendStateToPopup() {
  const screensMeta = sessionState.screens.map((s) => ({
    name: s.name,
    sourceUrl: s.sourceUrl,
    sizeBytes: s.sizeBytes,
    capturedAt: s.capturedAt,
    elementCount: s.interactiveElements.length
  }));
  popupPort?.postMessage({
    type: "STATE_SYNC",
    screenCount: sessionState.screens.length,
    capturing: sessionState.capturing,
    demoName: sessionState.demoName,
    appUrl: sessionState.appUrl,
    screensMeta
  });
}
async function handlePopupMessage(msg) {
  switch (msg.type) {
    case "CAPTURE_SCREEN":
      await captureScreen();
      break;
    case "REMOVE_SCREEN": {
      const index = msg.index;
      if (index >= 0 && index < sessionState.screens.length) {
        sessionState.screens.splice(index, 1);
        await saveState();
        sendStateToPopup();
      }
      break;
    }
    case "SET_DEMO_NAME":
      sessionState.demoName = msg.name || "";
      await saveState();
      break;
    case "FINISH_DEMO":
      await finishAndUpload();
      break;
    case "DISCARD_ALL":
      sessionState.screens = [];
      sessionState.demoName = "";
      sessionState.appUrl = "";
      await chrome.storage.local.remove("capturedScreens");
      await saveState();
      sendStateToPopup();
      break;
    case "GET_STATE":
      sendStateToPopup();
      break;
  }
}
async function captureScreen() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id || !tab.url) {
    popupPort?.postMessage({
      type: "ERROR",
      error: "No active tab found"
    });
    return;
  }
  sessionState.capturing = true;
  sendStateToPopup();
  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["content.js"]
    });
  } catch (err) {
    sessionState.capturing = false;
    popupPort?.postMessage({
      type: "ERROR",
      error: `Failed to inject content script: ${err}`
    });
    sendStateToPopup();
    return;
  }
  await new Promise((resolve) => setTimeout(resolve, 200));
  try {
    const response = await chrome.tabs.sendMessage(tab.id, {
      type: "CAPTURE_SCREEN"
    });
    if (response?.ok && response.snapshot) {
      const snapshot = response.snapshot;
      if (sessionState.screens.length === 0) {
        try {
          sessionState.appUrl = new URL(snapshot.sourceUrl).origin;
        } catch {
          sessionState.appUrl = snapshot.sourceUrl;
        }
      }
      sessionState.screens.push(snapshot);
      await chrome.storage.local.set({
        capturedScreens: sessionState.screens
      });
      await saveState();
      popupPort?.postMessage({
        type: "SCREEN_CAPTURED",
        screenIndex: sessionState.screens.length - 1,
        screenName: snapshot.name,
        sizeBytes: snapshot.sizeBytes
      });
    } else {
      popupPort?.postMessage({
        type: "ERROR",
        error: response?.error || "Capture failed"
      });
    }
  } catch (err) {
    popupPort?.postMessage({
      type: "ERROR",
      error: `Capture failed: ${err}`
    });
  }
  sessionState.capturing = false;
  sendStateToPopup();
}
async function finishAndUpload() {
  if (sessionState.screens.length === 0) {
    popupPort?.postMessage({
      type: "ERROR",
      error: "No screens captured"
    });
    return;
  }
  const tokenResult = await chrome.storage.local.get("supabaseToken");
  if (!tokenResult.supabaseToken) {
    popupPort?.postMessage({
      type: "ERROR",
      error: "Not authenticated. Please visit the dashboard to log in."
    });
    return;
  }
  const token = tokenResult.supabaseToken;
  const demoName = sessionState.demoName || `Demo - ${(/* @__PURE__ */ new Date()).toLocaleDateString()}`;
  popupPort?.postMessage({
    type: "UPLOAD_STARTED",
    totalScreens: sessionState.screens.length
  });
  try {
    const demoResponse = await fetch("http://localhost:3000/api/demos", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify({
        name: demoName,
        app_url: sessionState.appUrl
      })
    });
    if (!demoResponse.ok) {
      const errorData = await demoResponse.json().catch(() => ({ error: "Unknown error" }));
      if (demoResponse.status === 402) {
        popupPort?.postMessage({
          type: "ERROR",
          error: `Demo limit reached. ${errorData.error}`
        });
      } else {
        popupPort?.postMessage({
          type: "ERROR",
          error: errorData.error || `Failed to create demo: ${demoResponse.statusText}`
        });
      }
      return;
    }
    const demo = await demoResponse.json();
    for (let i = 0; i < sessionState.screens.length; i++) {
      const screen = sessionState.screens[i];
      popupPort?.postMessage({
        type: "UPLOAD_PROGRESS",
        currentScreen: i + 1,
        totalScreens: sessionState.screens.length,
        screenName: screen.name
      });
      const screenResponse = await fetch(
        `http://localhost:3000/api/demos/${demo.id}/screens/upload`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
          },
          body: JSON.stringify({
            name: screen.name,
            source_url: screen.sourceUrl,
            html_content: screen.html,
            viewport_width: screen.viewport.width,
            viewport_height: screen.viewport.height,
            interactive_elements: screen.interactiveElements,
            is_start_screen: i === 0
          })
        }
      );
      if (!screenResponse.ok) {
        const errorData = await screenResponse.json().catch(() => ({ error: "Unknown error" }));
        popupPort?.postMessage({
          type: "ERROR",
          error: `Failed to upload screen "${screen.name}": ${errorData.error || screenResponse.statusText}`
        });
        return;
      }
    }
    sessionState.screens = [];
    sessionState.demoName = "";
    sessionState.appUrl = "";
    await chrome.storage.local.remove("capturedScreens");
    await saveState();
    popupPort?.postMessage({
      type: "UPLOAD_COMPLETE",
      demoId: demo.id,
      demoName: demo.name
    });
    sendStateToPopup();
  } catch (err) {
    popupPort?.postMessage({
      type: "ERROR",
      error: `Upload failed: ${err}`
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
  if (message.type === "CAPTURE_PROGRESS") {
    popupPort?.postMessage({
      type: "CAPTURE_PROGRESS",
      phase: message.phase,
      detail: message.detail
    });
    return false;
  }
});
async function init() {
  await loadState();
  try {
    const result = await chrome.storage.local.get("capturedScreens");
    if (result.capturedScreens) {
      sessionState.screens = result.capturedScreens;
    }
  } catch {
  }
  console.log("[Demoframe] Background service worker loaded (snapshot mode)");
}
init();
//# sourceMappingURL=background.js.map
