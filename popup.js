const prefixSelect = document.getElementById("prefix");
const customInput = document.getElementById("custom-prefix");
const enabledCheckbox = document.getElementById("enabled");
const preview = document.getElementById("preview");
const status = document.getElementById("status");
const saveBtn = document.getElementById("save");

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
}

function saveSettings() {
  const prefix = getSelectedPrefix();
  if (!/^\+\d{1,4}$/.test(prefix)) {
    status.textContent = "Prefix must look like +966";
    status.className = "status error";
    return;
  }

  chrome.storage.sync.set(
    { defaultPrefix: prefix, enabled: enabledCheckbox.checked },
    () => {
      status.textContent = "Saved — open tabs update automatically.";
      status.className = "status ok";
      updatePreview();
    }
  );
}

populatePrefixSelect();
loadSettings();

prefixSelect.addEventListener("change", updatePreview);
customInput.addEventListener("input", updatePreview);
saveBtn.addEventListener("click", saveSettings);
