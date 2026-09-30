(function () {
  const SKIP_TAGS = new Set([
    "SCRIPT",
    "STYLE",
    "NOSCRIPT",
    "TEXTAREA",
    "INPUT",
    "SELECT",
    "OPTION",
    "CODE",
    "PRE",
    "SVG",
  ]);

  let defaultPrefix = "+1";
  let enabled = true;

  function loadSettings() {
    return new Promise((resolve) => {
      chrome.storage.sync.get({ defaultPrefix: "+1", enabled: true }, (data) => {
        defaultPrefix = data.defaultPrefix || "+1";
        enabled = data.enabled !== false;
        resolve();
      });
    });
  }

  function shouldSkipNode(node) {
    const parent = node.parentElement;
    if (!parent) return true;
    if (parent.closest(".wa-phone-wrap, .wa-link")) return true;
    let el = parent;
    while (el) {
      if (SKIP_TAGS.has(el.tagName)) return true;
      if (el.tagName === "A") {
        const href = el.getAttribute("href") || "";
        if (el.classList.contains("wa-link") || href.startsWith("https://wa.me/")) return true;
        // tel: links handled separately; other links skipped to avoid nesting
        return true;
      }
      if (el.isContentEditable) return true;
      el = el.parentElement;
    }
    return false;
  }

  function createWaLink(raw, waDigits) {
    const link = document.createElement("a");
    link.href = buildWaMeUrl(waDigits);
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.className = "wa-link";
    link.title = hasInternationalPrefix(raw)
      ? `Message ${raw.trim()} on WhatsApp`
      : `Message on WhatsApp (using ${defaultPrefix})`;
    link.setAttribute("aria-label", link.title);

    const icon = document.createElement("span");
    icon.className = "wa-link-icon";
    icon.textContent = "WA";
    link.appendChild(icon);
    return link;
  }

  function processTelLinks(root) {
    if (!root.querySelectorAll) return;

    root.querySelectorAll('a[href^="tel:"]').forEach((anchor) => {
      if (anchor.dataset.waProcessed || anchor.nextElementSibling?.classList.contains("wa-tel-sibling")) {
        return;
      }

      const tel = decodeURIComponent(anchor.getAttribute("href").replace(/^tel:/i, "").trim());
      const waDigits = toWhatsAppNumber(tel, defaultPrefix);
      const link = createWaLink(tel, waDigits);
      link.classList.add("wa-tel-sibling");
      anchor.insertAdjacentElement("afterend", link);
      anchor.dataset.waProcessed = "1";
    });
  }

  function processTextNode(node) {
    if (shouldSkipNode(node)) return;

    const text = node.textContent;
    const matches = findPhoneMatches(text);
    if (!matches.length) return;

    const parent = node.parentNode;
    const frag = document.createDocumentFragment();
    let lastIndex = 0;

    for (const { raw, index } of matches) {
      if (index > lastIndex) {
        frag.appendChild(document.createTextNode(text.slice(lastIndex, index)));
      }

      const wrap = document.createElement("span");
      wrap.className = "wa-phone-wrap";
      wrap.appendChild(document.createTextNode(raw));
      wrap.appendChild(createWaLink(raw, toWhatsAppNumber(raw, defaultPrefix)));
      frag.appendChild(wrap);

      lastIndex = index + raw.length;
    }

    if (lastIndex < text.length) {
      frag.appendChild(document.createTextNode(text.slice(lastIndex)));
    }

    parent.replaceChild(frag, node);
  }

  function visitRoots(root, fn) {
    fn(root);
    if (!root.querySelectorAll) return;
    root.querySelectorAll("*").forEach((el) => {
      if (el.shadowRoot) visitRoots(el.shadowRoot, fn);
    });
  }

  function collectTextNodes(root) {
    const nodes = [];
    visitRoots(root, (subRoot) => {
      if (!subRoot.nodeType) return;
      const walker = document.createTreeWalker(subRoot, NodeFilter.SHOW_TEXT, {
        acceptNode(node) {
          if (!node.textContent.trim()) return NodeFilter.FILTER_REJECT;
          if (shouldSkipNode(node)) return NodeFilter.FILTER_REJECT;
          return NodeFilter.FILTER_ACCEPT;
        },
      });
      while (walker.nextNode()) nodes.push(walker.currentNode);
    });
    return nodes;
  }

  function walkAndProcess(root) {
    if (!enabled) return;

    visitRoots(root, (subRoot) => {
      processTelLinks(subRoot);
    });

    for (const node of collectTextNodes(root)) {
      processTextNode(node);
    }
  }

  function unwrapProcessed(root = document.body) {
    visitRoots(root, (subRoot) => {
      if (!subRoot.querySelectorAll) return;
      subRoot.querySelectorAll(".wa-tel-sibling").forEach((el) => el.remove());
      subRoot.querySelectorAll("a[data-wa-processed]").forEach((el) => {
        delete el.dataset.waProcessed;
      });
      subRoot.querySelectorAll(".wa-phone-wrap").forEach((wrap) => {
        let phoneText = "";
        for (const child of wrap.childNodes) {
          if (child.nodeType === Node.TEXT_NODE) phoneText += child.textContent;
        }
        wrap.replaceWith(document.createTextNode(phoneText));
      });
    });
  }

  function rescanAll() {
    if (!document.body) return;
    unwrapProcessed();
    walkAndProcess(document.body);
  }

  let debounceTimer;
  function scheduleScan(roots) {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      if (!enabled || !document.body) return;

      if (!roots || !roots.length) {
        walkAndProcess(document.body);
        return;
      }

      for (const root of roots) {
        if (root.nodeType === Node.TEXT_NODE) {
          processTextNode(root);
        } else if (root.nodeType === Node.ELEMENT_NODE) {
          walkAndProcess(root);
        }
      }
    }, 300);
  }

  function collectMutationRoots(mutations) {
    const roots = new Set();
    for (const m of mutations) {
      if (m.type === "childList") {
        for (const node of m.addedNodes) {
          if (node.nodeType === Node.ELEMENT_NODE) roots.add(node);
          else if (node.nodeType === Node.TEXT_NODE && node.textContent.trim()) roots.add(node);
        }
      } else if (m.type === "characterData") {
        const node = m.target;
        if (node.nodeType === Node.TEXT_NODE && node.textContent.trim()) roots.add(node);
      }
    }
    return roots;
  }

  function hookSpaNavigation() {
    const onNavigate = () => {
      scheduleScan();
      setTimeout(() => scheduleScan(), 600);
    };

    window.addEventListener("popstate", onNavigate);
    window.addEventListener("hashchange", onNavigate);

    const { pushState, replaceState } = history;
    history.pushState = function (...args) {
      const result = pushState.apply(this, args);
      onNavigate();
      return result;
    };
    history.replaceState = function (...args) {
      const result = replaceState.apply(this, args);
      onNavigate();
      return result;
    };

    // ponytail: Slack-style modals/panels open on click without history changes
    document.addEventListener("click", onNavigate, true);
  }

  function init() {
    if (!document.body) return;
    walkAndProcess(document.body);

    const observer = new MutationObserver((mutations) => {
      const roots = collectMutationRoots(mutations);
      if (roots.size) scheduleScan(Array.from(roots));
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
    });

    hookSpaNavigation();
  }

  loadSettings().then(init);

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "sync") return;

    if (changes.defaultPrefix) {
      defaultPrefix = changes.defaultPrefix.newValue || "+1";
      rescanAll();
    }
    if (changes.enabled) {
      enabled = changes.enabled.newValue !== false;
      if (enabled) rescanAll();
      else unwrapProcessed();
    }
  });
})();
