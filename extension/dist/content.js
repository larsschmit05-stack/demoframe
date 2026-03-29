function generateSelector(el) {
  if (el.id) {
    return `#${CSS.escape(el.id)}`;
  }
  const testId = el.getAttribute("data-testid");
  if (testId) {
    return `[data-testid="${CSS.escape(testId)}"]`;
  }
  const parts = [];
  let current = el;
  let depth = 0;
  while (current && depth < 4) {
    if (current === document.documentElement) break;
    const tag = current.tagName.toLowerCase();
    if (current.id && depth > 0) {
      parts.unshift(`#${CSS.escape(current.id)}`);
      break;
    }
    const ancestorTestId = current.getAttribute("data-testid");
    if (ancestorTestId && depth > 0) {
      parts.unshift(`[data-testid="${CSS.escape(ancestorTestId)}"]`);
      break;
    }
    const parent = current.parentElement;
    if (parent) {
      const siblings = Array.from(parent.children).filter(
        (child) => child.tagName === current.tagName
      );
      if (siblings.length > 1) {
        const index = siblings.indexOf(current) + 1;
        parts.unshift(`${tag}:nth-of-type(${index})`);
      } else {
        parts.unshift(tag);
      }
    } else {
      parts.unshift(tag);
    }
    current = parent;
    depth++;
  }
  return parts.join(" > ");
}
async function captureSnapshot(onProgress) {
  const report = (phase, detail) => onProgress?.({ phase, detail });
  report("dom", "Cloning DOM tree");
  const docClone = document.documentElement.cloneNode(true);
  report("stylesheets", "Inlining CSS");
  await inlineStylesheets(docClone);
  report("images", "Inlining images");
  await inlineImages(docClone);
  report("fonts", "Inlining fonts");
  await inlineFontsInStyles(docClone);
  report("forms", "Capturing form state");
  serializeFormState(docClone);
  report("canvas", "Converting canvas elements");
  convertCanvasElements(docClone);
  report("cleanup", "Removing scripts");
  stripScripts(docClone);
  cleanupMeta(docClone);
  report("done");
  const doctype = "<!DOCTYPE html>";
  return `${doctype}
${docClone.outerHTML}`;
}
async function inlineStylesheets(root) {
  const cssTexts = [];
  for (const sheet of Array.from(document.styleSheets)) {
    try {
      const rules = Array.from(sheet.cssRules);
      const cssText = rules.map((r) => r.cssText).join("\n");
      cssTexts.push(cssText);
    } catch {
      if (sheet.href) {
        try {
          const response = await fetch(sheet.href);
          if (response.ok) {
            let cssText = await response.text();
            cssText = resolveRelativeUrls(cssText, sheet.href);
            cssTexts.push(cssText);
          }
        } catch {
        }
      }
    }
  }
  const liveStyles = document.querySelectorAll("style");
  liveStyles.forEach((style) => {
    cssTexts.push(style.textContent || "");
  });
  const cloneHead = root.querySelector("head");
  if (cloneHead) {
    cloneHead.querySelectorAll('link[rel="stylesheet"], style').forEach((el) => el.remove());
  }
  root.querySelectorAll("body style").forEach((el) => el.remove());
  if (cssTexts.length > 0 && cloneHead) {
    const styleEl = document.createElement("style");
    styleEl.setAttribute("data-demoframe", "captured-styles");
    styleEl.textContent = cssTexts.join("\n");
    cloneHead.appendChild(styleEl);
  }
}
function resolveRelativeUrls(css, baseUrl) {
  return css.replace(
    /url\(\s*['"]?(?!data:)(?!https?:)(?!\/\/)([^'")]+)['"]?\s*\)/g,
    (_match, relPath) => {
      try {
        const absolute = new URL(relPath, baseUrl).href;
        return `url("${absolute}")`;
      } catch {
        return _match;
      }
    }
  );
}
async function inlineImages(root) {
  const images = root.querySelectorAll("img");
  const liveImages = document.querySelectorAll("img");
  const promises = Array.from(images).map(async (clonedImg, index) => {
    const liveImg = liveImages[index];
    if (!liveImg) return;
    const src = liveImg.src;
    if (!src || src.startsWith("data:")) return;
    try {
      const dataUri = await imageToDataUri(liveImg, src);
      if (dataUri) {
        clonedImg.setAttribute("src", dataUri);
        clonedImg.removeAttribute("srcset");
        clonedImg.removeAttribute("loading");
      }
    } catch {
    }
  });
  await Promise.all(promises);
  root.querySelectorAll("picture source").forEach((el) => el.remove());
}
async function imageToDataUri(liveImg, src) {
  try {
    if (liveImg.complete && liveImg.naturalWidth > 0) {
      const canvas = document.createElement("canvas");
      canvas.width = liveImg.naturalWidth;
      canvas.height = liveImg.naturalHeight;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(liveImg, 0, 0);
        return canvas.toDataURL("image/png");
      }
    }
  } catch {
  }
  try {
    const response = await fetch(src);
    if (!response.ok) return null;
    const blob = await response.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}
async function inlineFontsInStyles(root) {
  const styles = root.querySelectorAll('style[data-demoframe="captured-styles"]');
  for (const style of Array.from(styles)) {
    let cssText = style.textContent || "";
    const fontUrlRegex = /@font-face\s*\{[^}]*url\(\s*['"]?(https?:\/\/[^'")]+)['"]?\s*\)[^}]*\}/g;
    const fontUrls = /* @__PURE__ */ new Set();
    let match;
    while ((match = fontUrlRegex.exec(cssText)) !== null) {
      fontUrls.add(match[1]);
    }
    for (const fontUrl of fontUrls) {
      try {
        const response = await fetch(fontUrl);
        if (!response.ok) continue;
        const blob = await response.blob();
        const dataUri = await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result);
          reader.onerror = () => resolve(fontUrl);
          reader.readAsDataURL(blob);
        });
        cssText = cssText.split(fontUrl).join(dataUri);
      } catch {
      }
    }
    style.textContent = cssText;
  }
}
function serializeFormState(root) {
  const clonedInputs = root.querySelectorAll("input, textarea, select");
  const liveInputs = document.querySelectorAll("input, textarea, select");
  clonedInputs.forEach((clonedEl, index) => {
    const liveEl = liveInputs[index];
    if (!liveEl) return;
    if (liveEl instanceof HTMLInputElement) {
      if (liveEl.type === "checkbox" || liveEl.type === "radio") {
        if (liveEl.checked) {
          clonedEl.setAttribute("checked", "");
        } else {
          clonedEl.removeAttribute("checked");
        }
      } else {
        clonedEl.setAttribute("value", liveEl.value);
      }
    } else if (liveEl instanceof HTMLTextAreaElement) {
      clonedEl.textContent = liveEl.value;
    } else if (liveEl instanceof HTMLSelectElement) {
      const clonedOptions = clonedEl.querySelectorAll("option");
      const liveOptions = liveEl.querySelectorAll("option");
      clonedOptions.forEach((opt, optIndex) => {
        const liveOpt = liveOptions[optIndex];
        if (liveOpt?.selected) {
          opt.setAttribute("selected", "");
        } else {
          opt.removeAttribute("selected");
        }
      });
    }
  });
  const clonedEditables = root.querySelectorAll('[contenteditable="true"]');
  const liveEditables = document.querySelectorAll('[contenteditable="true"]');
  clonedEditables.forEach((clonedEl, index) => {
    const liveEl = liveEditables[index];
    if (liveEl) {
      clonedEl.innerHTML = liveEl.innerHTML;
    }
  });
}
function convertCanvasElements(root) {
  const clonedCanvases = root.querySelectorAll("canvas");
  const liveCanvases = document.querySelectorAll("canvas");
  clonedCanvases.forEach((clonedCanvas, index) => {
    const liveCanvas = liveCanvases[index];
    if (!liveCanvas) return;
    try {
      const dataUrl = liveCanvas.toDataURL("image/png");
      const img = document.createElement("img");
      img.src = dataUrl;
      img.width = liveCanvas.width;
      img.height = liveCanvas.height;
      img.style.cssText = clonedCanvas.style.cssText;
      img.className = clonedCanvas.className;
      clonedCanvas.replaceWith(img);
    } catch {
    }
  });
}
function stripScripts(root) {
  root.querySelectorAll("script").forEach((el) => el.remove());
  root.querySelectorAll("noscript").forEach((el) => el.remove());
  const allElements = root.querySelectorAll("*");
  allElements.forEach((el) => {
    const attrs = Array.from(el.attributes);
    attrs.forEach((attr) => {
      if (attr.name.startsWith("on")) {
        el.removeAttribute(attr.name);
      }
    });
  });
}
function cleanupMeta(root) {
  const head = root.querySelector("head");
  if (!head) return;
  head.querySelectorAll('link[rel="preload"], link[rel="prefetch"], link[rel="modulepreload"]').forEach((el) => el.remove());
  head.querySelectorAll('meta[http-equiv="Content-Security-Policy"]').forEach((el) => el.remove());
  const meta = document.createElement("meta");
  meta.setAttribute("name", "demoframe-snapshot");
  meta.setAttribute("content", (/* @__PURE__ */ new Date()).toISOString());
  head.appendChild(meta);
}
const INTERACTIVE_SELECTORS = [
  "button",
  "a[href]",
  "input",
  "select",
  "textarea",
  '[role="button"]',
  '[role="link"]',
  '[role="checkbox"]',
  '[role="radio"]',
  '[role="tab"]',
  '[role="menuitem"]',
  '[tabindex]:not([tabindex="-1"])',
  "details > summary",
  "label[for]"
].join(", ");
class ElementDetector {
  elements = /* @__PURE__ */ new Map();
  scan() {
    const elements = document.querySelectorAll(INTERACTIVE_SELECTORS);
    elements.forEach((el) => {
      this.registerElement(el);
    });
  }
  registerElement(el) {
    const selector = generateSelector(el);
    if (this.elements.has(selector)) return;
    const rect = el.getBoundingClientRect();
    this.elements.set(selector, {
      selector,
      tag: el.tagName.toLowerCase(),
      type: this.classifyElement(el),
      text: (el.textContent || "").trim().slice(0, 100),
      rect: rect.width > 0 && rect.height > 0 ? { x: rect.x, y: rect.y, width: rect.width, height: rect.height } : null
    });
  }
  classifyElement(el) {
    const tag = el.tagName.toLowerCase();
    const role = el.getAttribute("role");
    if (tag === "button" || role === "button") return "button";
    if (tag === "a" || role === "link") return "link";
    if (tag === "select") return "select";
    if (tag === "input") {
      const inputType = el.type;
      if (inputType === "checkbox" || inputType === "radio") return "toggle";
      return "input";
    }
    if (tag === "textarea") return "input";
    if (role === "checkbox" || role === "radio") return "toggle";
    if (role === "tab") return "tab";
    if (role === "menuitem") return "button";
    return "other";
  }
  getDetectedElements() {
    return Array.from(this.elements.values());
  }
  getCount() {
    return this.elements.size;
  }
}
let capturing = false;
async function captureCurrentScreen() {
  if (capturing) return null;
  capturing = true;
  try {
    const detector = new ElementDetector();
    detector.scan();
    const html = await captureSnapshot((progress) => {
      chrome.runtime.sendMessage({
        type: "CAPTURE_PROGRESS",
        phase: progress.phase,
        detail: progress.detail
      }).catch(() => {
      });
    });
    const sizeBytes = new Blob([html]).size;
    const snapshot = {
      name: document.title || "Untitled Screen",
      sourceUrl: window.location.href,
      html,
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight
      },
      interactiveElements: detector.getDetectedElements(),
      capturedAt: (/* @__PURE__ */ new Date()).toISOString(),
      sizeBytes
    };
    return snapshot;
  } finally {
    capturing = false;
  }
}
chrome.runtime.onMessage.addListener(
  (message, _sender, sendResponse) => {
    switch (message.type) {
      case "CAPTURE_SCREEN":
        captureCurrentScreen().then((snapshot) => {
          if (snapshot) {
            sendResponse({ ok: true, snapshot });
          } else {
            sendResponse({ ok: false, error: "Capture already in progress" });
          }
        }).catch((err) => {
          sendResponse({ ok: false, error: String(err) });
        });
        return true;
      case "GET_PAGE_INFO":
        sendResponse({
          ok: true,
          title: document.title,
          url: window.location.href
        });
        break;
      default:
        sendResponse({ ok: false, error: "Unknown message type" });
    }
    return true;
  }
);
window.addEventListener("message", (event) => {
  if (event.source !== window) return;
  if (event.data.type === "DEMOFRAME_SEND_TOKEN" && event.data.token) {
    chrome.runtime.sendMessage(
      {
        type: "SET_AUTH_TOKEN",
        token: event.data.token
      },
      () => {
        window.postMessage(
          { type: "DEMOFRAME_TOKEN_STORED", ok: true },
          "*"
        );
      }
    );
  }
});
console.log("[Demoframe] Content script loaded (snapshot capture mode)");
//# sourceMappingURL=content.js.map
