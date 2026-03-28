let state = {
  recording: false,
  paused: false,
  eventCount: 0,
  elementCount: 0,
  estimatedSize: 0,
  hasRecording: false,
  error: null
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
        state.recording = msg.recording ?? false;
        state.paused = msg.paused ?? false;
        state.eventCount = msg.eventCount ?? 0;
        state.elementCount = msg.elementCount ?? 0;
        state.estimatedSize = msg.estimatedSize ?? 0;
        renderUI();
        break;
      case "STATUS_UPDATE":
        state.eventCount = msg.eventCount ?? state.eventCount;
        state.elementCount = msg.elementCount ?? state.elementCount;
        state.estimatedSize = msg.estimatedSize ?? state.estimatedSize;
        renderUI();
        break;
      case "RECORDING_SAVED":
        state.recording = false;
        state.paused = false;
        state.hasRecording = true;
        renderUI();
        uploadRecording();
        break;
      case "SIZE_WARNING":
        state.error = `Recording is large (${formatBytes(msg.sizeBytes)}). Consider stopping soon.`;
        renderUI();
        break;
      case "SIZE_LIMIT_REACHED":
        state.error = "Size limit reached. Recording auto-stopped.";
        state.recording = false;
        state.paused = false;
        renderUI();
        break;
      case "ERROR":
        state.error = msg.error;
        renderUI();
        break;
    }
  });
  port.onDisconnect.addListener(() => {
    port = null;
  });
}
function startRecording() {
  state.error = null;
  port?.postMessage({ type: "START_RECORDING" });
}
function pauseRecording() {
  port?.postMessage({ type: "PAUSE_RECORDING" });
}
function resumeRecording() {
  port?.postMessage({ type: "RESUME_RECORDING" });
}
function stopRecording() {
  port?.postMessage({ type: "STOP_RECORDING" });
}
async function exportRecording() {
  try {
    const result = await chrome.storage.local.get("lastRecording");
    if (!result.lastRecording) {
      state.error = "No recording found to export.";
      renderUI();
      return;
    }
    const json = JSON.stringify(result.lastRecording, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `demoframe-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  } catch (err) {
    state.error = `Export failed: ${err}`;
    renderUI();
  }
}
async function uploadRecording() {
  try {
    state.error = null;
    renderUI();
    const result = await chrome.storage.local.get("lastRecording");
    if (!result.lastRecording) {
      state.error = "No recording found to upload.";
      renderUI();
      return;
    }
    const tokenResult = await chrome.storage.local.get("supabaseToken");
    if (!tokenResult.supabaseToken) {
      state.error = "Not authenticated. Please visit the dashboard to authenticate.";
      renderUI();
      return;
    }
    state.error = "Uploading...";
    renderUI();
    const recording = result.lastRecording;
    const response = await fetch("http://localhost:3000/api/recordings/upload", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${tokenResult.supabaseToken}`
      },
      body: JSON.stringify({
        name: recording.title || `Recording ${(/* @__PURE__ */ new Date()).toLocaleString()}`,
        app_url: recording.url || "Unknown",
        recording_data: recording,
        metadata: recording.metadata || {}
      })
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: "Unknown error" }));
      if (response.status === 402) {
        state.error = `Recording limit reached. ${errorData.error}`;
      } else {
        state.error = errorData.error || `Upload failed: ${response.statusText}`;
      }
      renderUI();
      return;
    }
    state.error = null;
    state.hasRecording = false;
    await chrome.storage.local.remove("lastRecording");
    renderUI();
    const successMsg = document.createElement("div");
    successMsg.textContent = "\u2713 Uploaded successfully!";
    successMsg.style.cssText = "position: fixed; top: 10px; left: 10px; background: #22c55e; color: white; padding: 8px 12px; border-radius: 4px; z-index: 9999;";
    document.body.appendChild(successMsg);
    setTimeout(() => successMsg.remove(), 3e3);
  } catch (err) {
    state.error = `Upload failed: ${err}`;
    renderUI();
  }
}
function renderUI() {
  const statusDot = $("status-dot");
  const statusText = $("status-text");
  const primaryBtn = $("primary-btn");
  const stopBtn = $("stop-btn");
  const exportBtn = $("export-btn");
  const uploadBtn = $("upload-btn");
  const stats = $("stats");
  const errorEl = $("error");
  if (state.recording && !state.paused) {
    statusDot.className = "status-dot recording";
    statusText.textContent = "Recording...";
  } else if (state.paused) {
    statusDot.className = "status-dot paused";
    statusText.textContent = "Paused";
  } else {
    statusDot.className = "status-dot idle";
    statusText.textContent = "Ready";
  }
  if (!state.recording && !state.paused) {
    primaryBtn.textContent = "Start Recording";
    primaryBtn.className = "btn btn-primary";
    primaryBtn.onclick = startRecording;
    primaryBtn.disabled = false;
  } else if (state.recording && !state.paused) {
    primaryBtn.textContent = "Pause";
    primaryBtn.className = "btn btn-warning";
    primaryBtn.onclick = pauseRecording;
    primaryBtn.disabled = false;
  } else if (state.paused) {
    primaryBtn.textContent = "Resume";
    primaryBtn.className = "btn btn-primary";
    primaryBtn.onclick = resumeRecording;
    primaryBtn.disabled = false;
  }
  stopBtn.disabled = !state.recording && !state.paused;
  stopBtn.style.opacity = stopBtn.disabled ? "0.4" : "1";
  stats.textContent = `Events: ${state.eventCount} | Elements: ${state.elementCount}`;
  exportBtn.style.display = state.hasRecording && !state.recording ? "block" : "none";
  uploadBtn.style.display = state.hasRecording && !state.recording ? "block" : "none";
  if (state.error) {
    errorEl.textContent = state.error;
    errorEl.style.display = "block";
  } else {
    errorEl.style.display = "none";
  }
}
function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
document.addEventListener("DOMContentLoaded", async () => {
  connectToBackground();
  try {
    const result = await chrome.storage.local.get("lastRecording");
    state.hasRecording = !!result.lastRecording;
  } catch {
  }
  $("stop-btn").onclick = stopRecording;
  $("export-btn").onclick = exportRecording;
  $("upload-btn").onclick = uploadRecording;
  renderUI();
});
//# sourceMappingURL=popup.js.map
