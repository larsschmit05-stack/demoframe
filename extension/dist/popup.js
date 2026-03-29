let state = {
  screenCount: 0,
  capturing: false,
  demoName: "",
  appUrl: "",
  screensMeta: [],
  error: null,
  progressText: null
};
let port = null;
function $(id) {
  return document.getElementById(id);
}
function connectToBackground() {
  port = chrome.runtime.connect({ name: "demoframe-popup" });
  port.onMessage.addListener((msg) => {
    switch (msg.type) {
      case "STATE_SYNC":
        state.screenCount = msg.screenCount ?? 0;
        state.capturing = msg.capturing ?? false;
        state.demoName = msg.demoName ?? "";
        state.appUrl = msg.appUrl ?? "";
        state.screensMeta = msg.screensMeta ?? [];
        renderUI();
        break;
      case "SCREEN_CAPTURED":
        state.capturing = false;
        state.error = null;
        state.progressText = null;
        renderUI();
        break;
      case "CAPTURE_PROGRESS":
        state.progressText = `Capturing: ${msg.phase}${msg.detail ? ` - ${msg.detail}` : ""}...`;
        renderUI();
        break;
      case "UPLOAD_STARTED":
        state.progressText = `Uploading... (0/${msg.totalScreens} screens)`;
        renderUI();
        break;
      case "UPLOAD_PROGRESS":
        state.progressText = `Uploading... (${msg.currentScreen}/${msg.totalScreens}) ${msg.screenName}`;
        renderUI();
        break;
      case "UPLOAD_COMPLETE":
        state.progressText = null;
        state.error = null;
        state.screenCount = 0;
        state.screensMeta = [];
        state.demoName = "";
        renderUI();
        showSuccess(`Demo "${msg.demoName}" uploaded!`);
        break;
      case "ERROR":
        state.capturing = false;
        state.progressText = null;
        state.error = msg.error;
        renderUI();
        break;
    }
  });
  port.onDisconnect.addListener(() => {
    port = null;
  });
}
function captureScreen() {
  state.error = null;
  state.progressText = "Starting capture...";
  renderUI();
  port?.postMessage({ type: "CAPTURE_SCREEN" });
}
function removeScreen(index) {
  port?.postMessage({ type: "REMOVE_SCREEN", index });
}
function finishAndUpload() {
  const nameInput = $("demo-name");
  const name = nameInput.value.trim();
  if (name) {
    port?.postMessage({ type: "SET_DEMO_NAME", name });
  }
  port?.postMessage({ type: "FINISH_DEMO" });
}
function discardAll() {
  state.error = null;
  state.progressText = null;
  port?.postMessage({ type: "DISCARD_ALL" });
}
function renderUI() {
  const statusDot = $("status-dot");
  const statusText = $("status-text");
  const captureBtn = $("capture-btn");
  const uploadBtn = $("upload-btn");
  const discardBtn = $("discard-btn");
  const screensContainer = $("screens-container");
  const progressEl = $("progress");
  const errorEl = $("error");
  const demoNameInput = $("demo-name");
  if (state.capturing) {
    statusDot.className = "status-dot capturing";
    statusText.textContent = "Capturing...";
  } else if (state.screenCount > 0) {
    statusDot.className = "status-dot ready";
    statusText.textContent = `${state.screenCount} screen${state.screenCount !== 1 ? "s" : ""} captured`;
  } else {
    statusDot.className = "status-dot idle";
    statusText.textContent = "Ready to capture";
  }
  if (!demoNameInput.matches(":focus") && state.demoName && !demoNameInput.value) {
    demoNameInput.value = state.demoName;
  }
  captureBtn.disabled = state.capturing || !!state.progressText;
  captureBtn.textContent = state.capturing ? "Capturing..." : state.screenCount > 0 ? "Capture Another Screen" : "Capture This Screen";
  uploadBtn.disabled = state.screenCount === 0 || state.capturing || !!state.progressText;
  discardBtn.style.display = state.screenCount > 0 ? "block" : "none";
  if (state.screensMeta.length === 0) {
    screensContainer.innerHTML = '<div class="empty-state">No screens captured yet</div>';
  } else {
    screensContainer.innerHTML = state.screensMeta.map(
      (screen, index) => `
        <div class="screen-item">
          <div class="screen-info">
            <div class="screen-name">${escapeHtml(screen.name)}</div>
            <div class="screen-meta">${formatBytes(screen.sizeBytes)} &middot; ${screen.elementCount} elements</div>
          </div>
          <button class="screen-remove" data-index="${index}" title="Remove">&times;</button>
        </div>
      `
    ).join("");
    screensContainer.querySelectorAll(".screen-remove").forEach((btn) => {
      btn.addEventListener("click", () => {
        const index = parseInt(btn.dataset.index || "0", 10);
        removeScreen(index);
      });
    });
  }
  if (state.progressText) {
    progressEl.textContent = state.progressText;
    progressEl.style.display = "block";
  } else {
    progressEl.style.display = "none";
  }
  if (state.error) {
    errorEl.textContent = state.error;
    errorEl.style.display = "block";
  } else {
    errorEl.style.display = "none";
  }
}
function showSuccess(message) {
  const el = document.createElement("div");
  el.textContent = message;
  el.style.cssText = "position: fixed; top: 10px; left: 10px; right: 10px; background: #22c55e; color: white; padding: 8px 12px; border-radius: 6px; font-size: 13px; font-weight: 600; z-index: 9999; text-align: center;";
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3e3);
}
function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}
document.addEventListener("DOMContentLoaded", () => {
  connectToBackground();
  $("capture-btn").onclick = captureScreen;
  $("upload-btn").onclick = finishAndUpload;
  $("discard-btn").onclick = discardAll;
  renderUI();
});
//# sourceMappingURL=popup.js.map
