// Shared phone parsing — loaded in content script and popup.
const WA_MIN_DIGITS = 7;
const WA_MAX_DIGITS = 15;

// ponytail: pragmatic regex, not libphonenumber — may miss exotic formats or rare false positives
const PHONE_PATTERN =
  /\+?(?:\d[\s().-]?){6,14}\d|\b(?:\(\d{2,4}\)\s*|\d{2,4}[\s.-])?\d{3,4}[\s.-]\d{3,4}[\s.-]?\d{2,6}\b/g;

const COUNTRY_PREFIXES = [
  { code: "+1", label: "US / Canada (+1)" },
  { code: "+44", label: "United Kingdom (+44)" },
  { code: "+966", label: "Saudi Arabia (+966)" },
  { code: "+971", label: "UAE (+971)" },
  { code: "+20", label: "Egypt (+20)" },
  { code: "+91", label: "India (+91)" },
  { code: "+49", label: "Germany (+49)" },
  { code: "+33", label: "France (+33)" },
  { code: "+34", label: "Spain (+34)" },
  { code: "+39", label: "Italy (+39)" },
  { code: "+61", label: "Australia (+61)" },
  { code: "+81", label: "Japan (+81)" },
  { code: "+86", label: "China (+86)" },
  { code: "+55", label: "Brazil (+55)" },
  { code: "+52", label: "Mexico (+52)" },
  { code: "+27", label: "South Africa (+27)" },
  { code: "+962", label: "Jordan (+962)" },
  { code: "+961", label: "Lebanon (+961)" },
  { code: "+965", label: "Kuwait (+965)" },
  { code: "+974", label: "Qatar (+974)" },
  { code: "+973", label: "Bahrain (+973)" },
  { code: "+968", label: "Oman (+968)" },
];

function digitsOnly(text) {
  return text.replace(/\D/g, "");
}

function hasInternationalPrefix(text) {
  return text.trim().startsWith("+");
}

function isValidPhoneLength(digits) {
  return digits.length >= WA_MIN_DIGITS && digits.length <= WA_MAX_DIGITS;
}

function stripNationalTrunk(digits) {
  return digits.replace(/^0+/, "");
}

/**
 * Convert a matched phone string to wa.me digits (no + or spaces).
 * Uses the number's own + prefix when present; otherwise prepends defaultPrefix.
 */
function toWhatsAppNumber(match, defaultPrefix) {
  const trimmed = match.trim();
  const digits = digitsOnly(trimmed);

  if (hasInternationalPrefix(trimmed)) {
    return digits;
  }

  const prefixDigits = digitsOnly(defaultPrefix || "+1");
  const local = stripNationalTrunk(digits);
  return prefixDigits + local;
}

function buildWaMeUrl(digits) {
  return `https://wa.me/${digits}`;
}

function findPhoneMatches(text) {
  const results = [];
  const re = new RegExp(PHONE_PATTERN.source, PHONE_PATTERN.flags);
  let m;
  while ((m = re.exec(text)) !== null) {
    const raw = m[0];
    const digits = digitsOnly(raw);
    if (!isValidPhoneLength(digits)) continue;
    // Skip year-like or short numeric runs without phone structure
    if (!hasInternationalPrefix(raw) && digits.length < 9 && !/[\s().-]/.test(raw)) continue;
    results.push({ raw, index: m.index, digits });
  }
  return results;
}

// ponytail: runnable self-check — fails if prefix logic breaks
if (typeof globalThis !== "undefined" && globalThis.__WA_PHONE_SELF_CHECK) {
  const assert = (cond, msg) => {
    if (!cond) throw new Error(msg);
  };
  assert(toWhatsAppNumber("+966 50 123 4567", "+1") === "966501234567", "+ prefix");
  assert(toWhatsAppNumber("050 123 4567", "+966") === "966501234567", "default prefix + trunk 0");
  assert(toWhatsAppNumber("(555) 123-4567", "+1") === "15551234567", "US local");
  assert(findPhoneMatches("call +44 20 7946 0958 or 0501234567").length === 2, "find matches");
}
