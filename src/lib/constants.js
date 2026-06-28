// ============================== domain constants ==============================
// Mirrors the data model in SPEC.md §3–§4.

export const STATUSES = {
  "בוצע": { color: "#3FB950", glow: "rgba(63,185,80,.35)" },
  "בעבודה": { color: "#E8C547", glow: "rgba(232,197,71,.30)" },
  "תקוע": { color: "#F85149", glow: "rgba(248,81,73,.35)" },
  "לבדיקה": { color: "#F778BA", glow: "rgba(247,120,186,.30)" },
};
// Board column order (SPEC §5).
export const STATUS_ORDER = ["בעבודה", "תקוע", "לבדיקה", "בוצע"];

// Default מכלול list. This is now an editable, persisted list (see STORE.assemblies);
// this object is just the seed/default.
export const ASSEMBLIES = {
  "כללי": "#5A6573", "פרופיל אב": "#E8B84B", "Sbru": "#58A6FF",
  "אלקטרוני": "#3FB950", "תחנה קדמית": "#F778BA", "תחנה אחורית": "#BC8CFF",
  "פולו/פוקר": "#F0883E", "בומרנג": "#56D4DD", "בייסבול": "#DB6D28", "בלנדר": "#A5D6A7",
};

// Color for an assembly name, falling back to a neutral gray for unknown ones.
export function asmColor(assemblies, name) {
  return (assemblies && assemblies[name]) || "#5A6573";
}

export const PRIORITIES = { "גבוה": "#FF7B72", "בינוני": "#E3B341", "נמוך": "#9AA5B1" };

// Procurement (בקרת רכש) — carried over from the original Excel workbook.
export const PROC_STATUSES = {
  "להזמין": "#F85149", "הוזמן": "#E8C547", "בדרך": "#58A6FF", "הגיע": "#3FB950",
};
export const PROC_STATUS_ORDER = ["להזמין", "הוזמן", "בדרך", "הגיע"];

export const PROC_SEED = [
  { id: 1, item: "פרופילי אלומיניום 40x40", supplier: "אלומיט", status: "הוזמן", orderDate: "10.6.26", eta: "24.6.26", cost: "₪3,200", notes: "" },
  { id: 2, item: "חלקים מודפסים (SLA)", supplier: "3DZone", status: "בדרך", orderDate: "12.6.26", eta: "19.6.26", cost: "₪880", notes: "עבור הרכבת מדגים." },
  { id: 3, item: "מחברים אלקטרוניים", supplier: "RS", status: "להזמין", orderDate: "", eta: "", cost: "", notes: "ממתין לאישור BOM." },
];

// Member colors cycle through this palette when a new member is added.
export const MEMBER_PALETTE = [
  "#E8B84B", "#58A6FF", "#3FB950", "#F778BA", "#BC8CFF",
  "#F0883E", "#56D4DD", "#DB6D28", "#A5D6A7", "#FF7B72",
];

// Default project members (seed). Editable in-app via the Members screen.
// `isController` marks members who can be assigned as a task controller (בקר).
export const DEFAULT_MEMBERS = [
  { id: "m1", name: "דימה", color: "#E8B84B", isController: true },
  { id: "m2", name: "אלון", color: "#58A6FF", isController: false },
  { id: "m3", name: "ליאב", color: "#3FB950", isController: false },
  { id: "m4", name: "אמיתי", color: "#F778BA", isController: false },
  { id: "m5", name: "אופק", color: "#BC8CFF", isController: false },
];

export const SEED = [
  { id: 1, asm: "Sbru", task: "תכן ארגזים עבור MD", pri: "גבוה", status: "בעבודה", who: "אופק", ctrl: "דימה", due: "22.6.26", notes: "נדחה מ-11.6.", attachments: [] },
  { id: 2, asm: "Sbru", task: "הרכבת מדגים", pri: "גבוה", status: "בעבודה", who: "אלון", ctrl: "דימה", due: "18.6.26", notes: "נדרשים חלקים מודפסים.", attachments: [] },
  { id: 3, asm: "אלקטרוני", task: "הגדרת טולרנסים לכל ממשק", pri: "בינוני", status: "תקוע", who: "דימה", ctrl: "", due: "", notes: "ממתין להחלטת תכן.", attachments: [] },
  { id: 4, asm: "אלקטרוני", task: "בחינת מכלולי ריתוך ייעודיים", pri: "נמוך", status: "לבדיקה", who: "ליאב", ctrl: "דימה", due: "", notes: "הצעות מספק.", attachments: [] },
  { id: 5, asm: "פרופיל אב", task: "שרשור רתמות בפרופילים", pri: "בינוני", status: "בעבודה", who: "ליאב", ctrl: "דימה", due: "20.4.26", notes: "", attachments: [] },
  { id: 6, asm: "פרופיל אב", task: "עדכון קונסטרוקציה – רידוד משקל", pri: "גבוה", status: "תקוע", who: "דימה", ctrl: "איבצן", due: "21.4.26", notes: "קריטי.", attachments: [] },
  { id: 7, asm: "תחנה קדמית", task: "ניסויי הרכבה ופירוק חוזרים", pri: "בינוני", status: "לבדיקה", who: "אלון", ctrl: "דימה", due: "", notes: "מדידת זמן הרכבה.", attachments: [] },
  { id: 8, asm: "כללי", task: "בניית BOM כללי מפורט", pri: "גבוה", status: "בוצע", who: "ליאב", ctrl: "דימה", due: "", notes: "", attachments: [] },
  { id: 9, asm: "בומרנג", task: "אפיון ממשק בקרה", pri: "בינוני", status: "בעבודה", who: "ליאב", ctrl: "דימה", due: "", notes: "", attachments: [] },
  { id: 10, asm: "בייסבול", task: "הרכבת תת-מכלול ראשוני", pri: "גבוה", status: "תקוע", who: "אלון", ctrl: "דימה", due: "", notes: "ממתין לחלקים.", attachments: [] },
];

// Storage keys (bumped to v2 per CHANGELOG).
export const STORE = {
  tasks: "mc:tasks:v2",
  members: "mc:members:v2",
  audit: "mc:auditlog:v2",
  procurement: "mc:procurement:v2",
  assemblies: "mc:assemblies:v1",
  project: "mc:project:v1",
};

// Choose readable text color on a colored chip by luminance.
export function readable(hex) {
  if (!hex) return "#fff";
  const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
  return 0.299 * r + 0.587 * g + 0.114 * b > 140 ? "#0D1117" : "#fff";
}

// Initials for an avatar bubble (first 2 chars works well for Hebrew names).
export function initials(name) {
  return (name || "?").trim().slice(0, 2);
}

// ----- due-date helpers -----
// Tasks store dates as "D.M.YY" (e.g. "22.6.26"). These convert to/from the
// ISO "YYYY-MM-DD" that <input type="date"> needs for the calendar picker.
export function dueToISO(due) {
  if (!due) return "";
  const m = String(due).match(/^(\d{1,2})\.(\d{1,2})\.(\d{2,4})$/);
  if (!m) return "";
  let [, d, mo, y] = m;
  y = +y < 100 ? 2000 + +y : +y;
  return `${y}-${String(+mo).padStart(2, "0")}-${String(+d).padStart(2, "0")}`;
}

export function isoToDue(iso) {
  if (!iso) return "";
  const m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return "";
  const [, y, mo, d] = m;
  return `${+d}.${+mo}.${String(+y).slice(2)}`;
}

// Date <-> "D.M.YY" for the agenda grouping & quick reschedule.
export function dateToDue(date) {
  return `${date.getDate()}.${date.getMonth() + 1}.${String(date.getFullYear()).slice(2)}`;
}

export function dueToDate(due) {
  const iso = dueToISO(due);
  if (!iso) return null;
  const [y, mo, d] = iso.split("-").map(Number);
  return new Date(y, mo - 1, d);
}

export function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

// Deterministic color for a free-text tag, so the same label always looks the same.
export function tagColor(label) {
  let h = 0;
  for (let i = 0; i < label.length; i++) h = (h * 31 + label.charCodeAt(i)) % 360;
  return `hsl(${h} 60% 62%)`;
}
