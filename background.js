const SCRIPT_ID = "wa-scanner";

async function syncContentScripts() {
  const [{ enabled = true }, hasPermission] = await Promise.all([
    chrome.storage.sync.get({ enabled: true }),
    chrome.permissions.contains({ origins: ["<all_urls>"] }),
  ]);

  try {
    await chrome.scripting.unregisterContentScripts({ ids: [SCRIPT_ID] });
  } catch {
    // not registered yet
  }

  if (enabled !== false && hasPermission) {
    await chrome.scripting.registerContentScripts([
      {
        id: SCRIPT_ID,
        matches: ["<all_urls>"],
        js: ["phone.js", "content.js"],
        css: ["content.css"],
        runAt: "document_idle",
      },
    ]);
  }
}

chrome.runtime.onInstalled.addListener(syncContentScripts);
chrome.runtime.onStartup.addListener(syncContentScripts);
chrome.permissions.onAdded.addListener(syncContentScripts);
chrome.permissions.onRemoved.addListener(syncContentScripts);
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "sync" && changes.enabled) syncContentScripts();
});
