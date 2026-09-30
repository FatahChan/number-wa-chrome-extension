const prefixSelect = document.getElementById("prefix");
const customInput = document.getElementById("custom-prefix");
const enabledCheckbox = document.getElementById("enabled");
const autoScanCheckbox = document.getElementById("auto-scan");
const scanPageBtn = document.getElementById("scan-page");
const preview = document.getElementById("preview");
const status = document.getElementById("status");
const saveBtn = document.getElementById("save");

const ALL_URLS = { origins: ["<all_urls>"] };

function populatePrefixSelect() {
  for (const { code, label } of COUNTRY_PREFIXES) {
    const opt = document.createElement("option");
    opt.value = code;
    opt.textContent = label;
    prefixSelect.appendChild(opt);
  }
  const customOpt = document.createElement("option");
  customOpt.value = "__custom__";
  customOpt.textContent = "Custom…";
  prefixSelect.appendChild(customOpt);
}

function getSelectedPrefix() {
  if (prefixSelect.value === "__custom__") {
    const raw = customInput.value.trim();
    return raw.startsWith("+") ? raw : `+${raw}`;
  }
  return prefixSelect.value;
}

function updatePreview() {
  const prefix = getSelectedPrefix();
  const example = toWhatsAppNumber("050 123 4567", prefix);
  preview.textContent = `Example: 050 123 4567 → wa.me/${example}`;
}

function setStatus(text, type = "ok") {
  status.textContent = text;
  status.className = `status ${type}`;
}

async function refreshAutoScanState() {
  autoScanCheckbox.checked = await chrome.permissions.contains(ALL_URLS);
}

function loadSettings() {
  chrome.storage.sync.get({ defaultPrefix: "+1", enabled: true }, (data) => {
    enabledCheckbox.checked = data.enabled !== false;

    const known = COUNTRY_PREFIXES.some((c) => c.code === data.defaultPrefix);
    if (known) {
      prefixSelect.value = data.defaultPrefix;
      customInput.value = "";
    } else {
      prefixSelect.value = "__custom__";
      customInput.value = data.defaultPrefix;
    }
    updatePreview();
  });
  refreshAutoScanState();
}

function saveSettings() {
  const prefix = getSelectedPrefix();
  if (!/^\+\d{1,4}$/.test(prefix)) {
    setStatus("Prefix must look like +966", "error");
    return;
  }

  chrome.storage.sync.set(
    { defaultPrefix: prefix, enabled: enabledCheckbox.checked },
    () => setStatus("Settings saved.")
  );
}

async function scanCurrentPage() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id || tab.url?.startsWith("chrome://")) {
    setStatus("Cannot scan this page.", "error");
    return;
  }

  try {
    await chrome.scripting.insertCSS({ target: { tabId: tab.id }, files: ["content.css"] });
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["phone.js", "content.js"],
    });
    setStatus("Current page scanned.");
  } catch {
    setStatus("Could not scan this page.", "error");
  }
}

autoScanCheckbox.addEventListener("change", async () => {
  if (autoScanCheckbox.checked) {
    const granted = await chrome.permissions.request(ALL_URLS);
    if (!granted) {
      autoScanCheckbox.checked = false;
      setStatus("Permission denied. Use Scan this page instead.", "error");
      return;
    }
    setStatus("Auto-scan enabled on all pages.");
  } else {
    await chrome.permissions.remove(ALL_URLS);
    setStatus("Auto-scan disabled. Use Scan this page when needed.");
  }
});

populatePrefixSelect();
loadSettings();

prefixSelect.addEventListener("change", updatePreview);
customInput.addEventListener("input", updatePreview);
saveBtn.addEventListener("click", saveSettings);
scanPageBtn.addEventListener("click", scanCurrentPage);
