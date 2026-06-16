// ============================== design tokens & styles ==============================
export const BG = "#0B0E14", PANEL = "#141A24", PANEL2 = "#1B2230",
  LINE = "#283041", INK = "#E6EDF3", MUTED = "#8B97A8", GOLD = "#E8B84B";

export const S = {
  boot: { background: BG, color: GOLD, minHeight: "100vh", display: "grid", placeItems: "center", fontFamily: "system-ui", fontSize: 16 },
  app: { background: `radial-gradient(900px 500px at 85% -10%, rgba(88,166,255,.06), transparent), ${BG}`, color: INK, minHeight: "100vh", fontFamily: "'Heebo',system-ui,sans-serif", display: "flex", flexDirection: "column" },
  head: { borderBottom: `1px solid ${LINE}`, padding: "8px 12px", background: "rgba(13,17,23,.6)", backdropFilter: "blur(6px)", position: "sticky", top: 0, zIndex: 10 },
  titleRow: { display: "flex", alignItems: "center", gap: 9, flexWrap: "wrap" },
  crest: { width: 28, height: 28, borderRadius: 8, display: "grid", placeItems: "center", color: GOLD, fontSize: 13, background: "linear-gradient(145deg,#1C2230,#0D1117)", border: `1px solid ${LINE}`, boxShadow: "inset 0 0 0 1px rgba(232,184,75,.15)", flexShrink: 0 },
  h1: { fontSize: 15, fontWeight: 800, margin: 0, letterSpacing: "-.3px", lineHeight: 1.1 },
  sub: { fontSize: 10.5, color: MUTED, marginTop: 1 },
  headRight: { marginInlineStart: "auto", display: "flex", gap: 6, alignItems: "center", flexShrink: 0 },
  ghostBtn: { font: "inherit", fontSize: 12, fontWeight: 600, color: INK, background: PANEL2, border: `1px solid ${LINE}`, borderRadius: 8, padding: "6px 10px", cursor: "pointer", display: "flex", alignItems: "center", gap: 5, whiteSpace: "nowrap" },
  controlsRow: { display: "flex", gap: 7, alignItems: "center", marginTop: 7 },
  tabs: { display: "flex", gap: 3, background: PANEL, border: `1px solid ${LINE}`, borderRadius: 9, padding: 3, flexShrink: 0 },
  tab: { font: "inherit", fontSize: 12, fontWeight: 600, color: MUTED, background: "none", border: "none", padding: "5px 10px", borderRadius: 6, cursor: "pointer", whiteSpace: "nowrap" },
  tabOn: { background: PANEL2, color: INK },
  search: { flex: "1 1 100px", minWidth: 0, background: PANEL, border: `1px solid ${LINE}`, borderRadius: 8, padding: "6px 10px", color: INK, font: "inherit", fontSize: 12.5, outline: "none" },
  // compact summary strip (replaces the big KPI deck)
  summaryBar: { display: "flex", alignItems: "center", gap: 7, marginTop: 11, flexWrap: "wrap" },
  sumChip: { display: "inline-flex", alignItems: "center", gap: 6, background: PANEL, border: `1px solid ${LINE}`, borderRadius: 20, padding: "3px 10px", fontSize: 11.5, color: MUTED },
  sumDot: { width: 7, height: 7, borderRadius: "50%", flexShrink: 0 },
  sumN: { fontWeight: 800, fontFamily: "'JetBrains Mono',monospace", fontSize: 12.5 },
  // three-dots icon button
  iconBtn: { font: "inherit", fontSize: 16, fontWeight: 700, color: INK, background: PANEL2, border: `1px solid ${LINE}`, borderRadius: 8, width: 32, height: 30, cursor: "pointer", display: "grid", placeItems: "center", lineHeight: 1, flexShrink: 0 },
  // options side panel sections
  panelSection: { padding: "14px 16px", borderBottom: `1px solid ${LINE}` },
  panelTitle: { fontSize: 11, fontWeight: 700, color: MUTED, marginBottom: 10, letterSpacing: ".3px" },
  sumRow: { display: "flex", alignItems: "center", gap: 9, padding: "6px 0", fontSize: 13.5 },
  sumRowN: { marginInlineStart: "auto", fontWeight: 800, fontFamily: "'JetBrains Mono',monospace", fontSize: 15 },
  panelBtn: { display: "flex", alignItems: "center", gap: 10, width: "100%", textAlign: "start", background: PANEL2, border: `1px solid ${LINE}`, borderRadius: 10, padding: "11px 13px", color: INK, font: "inherit", fontSize: 13.5, fontWeight: 600, cursor: "pointer", marginBottom: 8 },
  panelBtnIcon: { fontSize: 17, flexShrink: 0 },
  panelBtnSub: { fontSize: 11, color: MUTED, fontWeight: 400, marginTop: 1 },
  panelHint: { fontSize: 11.5, color: MUTED, lineHeight: 1.6, background: PANEL2, border: `1px dashed ${LINE}`, borderRadius: 10, padding: 11 },
  body: { flex: 1, display: "flex", minHeight: 0 },
  main: { flex: 1, padding: 16, overflow: "auto", paddingBottom: 90 },
  board: { display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12 },
  col: { background: "rgba(20,26,36,.5)", border: `1px solid ${LINE}`, borderRadius: 13, padding: 11, minHeight: 180 },
  colHead: { display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 600, color: MUTED, marginBottom: 11 },
  dot: { width: 9, height: 9, borderRadius: "50%" },
  cnt: { marginInlineStart: "auto", fontFamily: "'JetBrains Mono',monospace", fontSize: 12, background: PANEL2, padding: "1px 8px", borderRadius: 20, color: INK },
  card: { background: PANEL, border: `1px solid ${LINE}`, borderRadius: 10, padding: 11, marginBottom: 9, cursor: "pointer", position: "relative", transition: ".14s" },
  pri: { position: "absolute", insetInlineEnd: 9, top: 9, fontSize: 10, fontWeight: 800, padding: "2px 7px", borderRadius: 6, border: "1px solid" },
  cardTask: { fontSize: 13.5, fontWeight: 600, lineHeight: 1.4, marginBottom: 9, paddingInlineEnd: 42 },
  cardMeta: { display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: MUTED, flexWrap: "wrap" },
  asmPill: { fontSize: 10, fontWeight: 700, padding: "1px 7px", borderRadius: 20 },
  ava: { width: 20, height: 20, borderRadius: "50%", display: "grid", placeItems: "center", fontSize: 10, fontWeight: 700, color: "#0D1117", background: GOLD, flexShrink: 0 },
  who: {},
  due: { marginInlineStart: "auto", fontFamily: "'JetBrains Mono',monospace" },
  overdue: { color: "#F85149", fontWeight: 700 },
  clip: { display: "inline-flex", alignItems: "center", gap: 3, fontSize: 10.5, color: MUTED },
  empty: { color: "#5A6373", fontSize: 12, textAlign: "center", padding: "16px 0" },
  // agenda (date-grouped) view
  agenda: { maxWidth: 760 },
  agendaGroup: { marginBottom: 18 },
  agendaHead: { display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 800, marginBottom: 9, paddingBottom: 6, borderBottom: `1px solid ${LINE}` },
  agendaCount: { marginInlineStart: "auto", fontFamily: "'JetBrains Mono',monospace", fontSize: 11.5, color: MUTED, fontWeight: 600 },
  swipeOuter: { position: "relative", borderRadius: 10, overflow: "hidden", marginBottom: 8 },
  swipeAction: { position: "absolute", top: 0, bottom: 0, left: 0, right: 0, display: "flex", alignItems: "center", gap: 6, padding: "0 16px", fontSize: 13, fontWeight: 800, color: "#fff" },
  swipeActionL: { justifyContent: "flex-start", background: "#2E7D46" },
  swipeActionR: { justifyContent: "flex-end", background: "#1F6FEB" },
  popoverFixed: { position: "fixed", zIndex: 56, background: PANEL2, border: `1px solid ${LINE}`, borderRadius: 12, padding: 8, boxShadow: "0 18px 50px rgba(0,0,0,.6)", width: 210 },
  agendaRow: { position: "relative", display: "flex", alignItems: "center", gap: 10, background: PANEL, border: `1px solid ${LINE}`, borderRadius: 10, padding: "11px 12px", cursor: "pointer", touchAction: "pan-y", userSelect: "none", willChange: "transform" },
  reschedBtn: { background: PANEL2, border: `1px solid ${LINE}`, borderRadius: 8, color: MUTED, fontSize: 14, cursor: "pointer", padding: "4px 8px", lineHeight: 1, flexShrink: 0 },
  popScrim: { position: "fixed", inset: 0, zIndex: 55 },
  popover: { position: "absolute", zIndex: 56, background: PANEL2, border: `1px solid ${LINE}`, borderRadius: 12, padding: 8, boxShadow: "0 18px 50px rgba(0,0,0,.6)", width: 210 },
  popTitle: { fontSize: 10.5, color: MUTED, fontWeight: 700, padding: "4px 8px 7px" },
  popItem: { display: "flex", alignItems: "center", gap: 9, width: "100%", textAlign: "start", background: "none", border: "none", color: INK, font: "inherit", fontSize: 13, padding: "8px 9px", borderRadius: 8, cursor: "pointer" },
  popItemDate: { marginInlineStart: "auto", fontSize: 11, color: MUTED, fontFamily: "'JetBrains Mono',monospace" },
  popDateRow: { display: "flex", alignItems: "center", gap: 7, padding: "6px 8px", borderTop: `1px solid ${LINE}`, marginTop: 4 },
  // filter view
  fv: { maxWidth: 760 },
  fvHead: { display: "flex", alignItems: "center", gap: 12, marginBottom: 16, flexWrap: "wrap" },
  fvLabel: { fontWeight: 700, fontSize: 14 },
  fvSelect: { background: GOLD, color: "#0D1117", fontWeight: 700, border: "none", borderRadius: 8, padding: "8px 12px", fontSize: 14, cursor: "pointer", font: "inherit" },
  fvStats: { display: "flex", gap: 8, marginInlineStart: "auto" },
  fvStat: { textAlign: "center", background: PANEL, border: `1px solid ${LINE}`, borderRadius: 9, padding: "6px 12px", fontSize: 10, color: MUTED, display: "flex", flexDirection: "column" },
  qrow: { display: "flex", alignItems: "center", gap: 10, background: PANEL, border: `1px solid ${LINE}`, borderRadius: 10, padding: "11px 12px", marginBottom: 8, cursor: "pointer", transition: ".14s" },
  qdot: { width: 9, height: 9, borderRadius: "50%", flexShrink: 0 },
  qAsm: { fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 20, flexShrink: 0 },
  qTask: { fontSize: 13.5, fontWeight: 600, flex: 1 },
  qDue: { fontSize: 11, color: MUTED, fontFamily: "'JetBrains Mono',monospace" },
  // FAB
  fab: { position: "fixed", insetInlineEnd: 16, bottom: 16, zIndex: 40, display: "flex", alignItems: "center", gap: 9, background: "linear-gradient(145deg,#2A2A12,#141A24)", color: GOLD, border: `1px solid ${GOLD}66`, borderRadius: 30, padding: "13px 20px", cursor: "pointer", font: "inherit", fontSize: 14, fontWeight: 800, boxShadow: "0 8px 28px rgba(0,0,0,.5), 0 0 0 1px rgba(232,184,75,.12) inset" },
  fabPlus: { fontSize: 18, lineHeight: 1 },
  // modal
  scrim: { position: "fixed", inset: 0, background: "rgba(5,8,12,.72)", backdropFilter: "blur(3px)", display: "grid", placeItems: "center", padding: 20, zIndex: 50, overflow: "auto" },
  modal: { background: PANEL, border: `1px solid ${LINE}`, borderRadius: 16, maxWidth: 560, width: "100%", padding: 22, position: "relative", boxShadow: "0 30px 80px rgba(0,0,0,.6)", margin: "auto", maxHeight: "92vh", overflow: "auto" },
  close: { position: "absolute", insetInlineEnd: 16, top: 14, background: "none", border: "none", color: MUTED, fontSize: 22, cursor: "pointer", lineHeight: 1 },
  asmTag: { display: "inline-block", fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 20, marginBottom: 8 },
  modalTitle: { fontSize: 18, margin: "0 0 16px", paddingInlineEnd: 28 },
  titleInput: { width: "100%", background: PANEL2, border: `1px solid ${LINE}`, borderRadius: 10, padding: "10px 12px", color: INK, font: "inherit", fontSize: 16, fontWeight: 700, outline: "none", marginBottom: 14 },
  fields: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 },
  field: { background: PANEL2, border: `1px solid ${LINE}`, borderRadius: 10, padding: "9px 11px" },
  fieldLabel: { fontSize: 10.5, color: MUTED, display: "block", marginBottom: 4 },
  modalInput: { width: "100%", background: "transparent", border: "none", color: INK, font: "inherit", fontSize: 14, fontWeight: 600, outline: "none" },
  notesWrap: { background: PANEL2, border: `1px solid ${LINE}`, borderRadius: 10, padding: 11, marginBottom: 14 },
  notes: { width: "100%", background: "transparent", border: "none", color: "#C9D4E0", font: "inherit", fontSize: 13, lineHeight: 1.6, outline: "none", resize: "vertical" },
  // attachments
  attachWrap: { background: PANEL2, border: `1px solid ${LINE}`, borderRadius: 10, padding: 11, marginBottom: 14 },
  attachHeadRow: { display: "flex", alignItems: "center", gap: 8, marginBottom: 10 },
  attachBtns: { marginInlineStart: "auto", display: "flex", gap: 6 },
  attachBtn: { font: "inherit", fontSize: 12, fontWeight: 600, color: INK, background: PANEL, border: `1px solid ${LINE}`, borderRadius: 8, padding: "6px 10px", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 5 },
  thumbGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(84px,1fr))", gap: 8, marginBottom: 8 },
  thumb: { position: "relative", aspectRatio: "1", borderRadius: 9, overflow: "hidden", border: `1px solid ${LINE}`, background: PANEL, cursor: "pointer" },
  thumbImg: { width: "100%", height: "100%", objectFit: "cover", display: "block" },
  thumbX: { position: "absolute", top: 3, insetInlineEnd: 3, width: 18, height: 18, borderRadius: "50%", border: "none", background: "rgba(0,0,0,.65)", color: "#fff", fontSize: 12, cursor: "pointer", lineHeight: 1, display: "grid", placeItems: "center" },
  fileRow: { display: "flex", alignItems: "center", gap: 9, background: PANEL, border: `1px solid ${LINE}`, borderRadius: 9, padding: "8px 10px", marginBottom: 6 },
  fileIcon: { fontSize: 16, flexShrink: 0 },
  fileName: { fontSize: 12.5, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  fileSize: { fontSize: 10.5, color: MUTED, marginInlineStart: "auto", fontFamily: "'JetBrains Mono',monospace", flexShrink: 0 },
  fileX: { background: "none", border: "none", color: MUTED, fontSize: 18, cursor: "pointer", lineHeight: 1, flexShrink: 0 },
  // checklist
  checklistWrap: { background: PANEL2, border: `1px solid ${LINE}`, borderRadius: 10, padding: 11, marginBottom: 14 },
  checkBar: { height: 4, borderRadius: 4, background: LINE, overflow: "hidden", margin: "6px 0 10px" },
  checkBarFill: { height: "100%", background: "#3FB950", transition: "width .2s" },
  checkItem: { display: "flex", alignItems: "center", gap: 9, padding: "5px 0" },
  checkBox: { width: 18, height: 18, borderRadius: 5, border: `1.5px solid ${MUTED}`, display: "grid", placeItems: "center", cursor: "pointer", flexShrink: 0, fontSize: 12, fontWeight: 800 },
  checkBoxOn: { background: "#3FB950", borderColor: "#3FB950", color: "#0D1117" },
  checkText: { flex: 1, fontSize: 13, color: INK },
  checkTextDone: { textDecoration: "line-through", color: MUTED },
  checkInput: { flex: 1, background: PANEL, border: `1px solid ${LINE}`, borderRadius: 9, padding: "8px 11px", color: INK, font: "inherit", fontSize: 13, outline: "none" },
  // tags
  tagsWrap: { background: PANEL2, border: `1px solid ${LINE}`, borderRadius: 10, padding: 11, marginBottom: 14 },
  tagChips: { display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 },
  tag: { display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11.5, fontWeight: 700, padding: "3px 9px", borderRadius: 20, border: "1px solid" },
  tagX: { background: "none", border: "none", color: "inherit", cursor: "pointer", fontSize: 13, lineHeight: 1, padding: 0, opacity: .8 },
  cardTag: { fontSize: 10, fontWeight: 700, padding: "1px 7px", borderRadius: 20, border: "1px solid" },
  // comments
  commentsWrap: { background: PANEL2, border: `1px solid ${LINE}`, borderRadius: 10, padding: 11, marginBottom: 14 },
  comment: { display: "flex", gap: 9, marginBottom: 9 },
  commentBody: { flex: 1, background: PANEL, border: `1px solid ${LINE}`, borderRadius: 9, padding: "7px 10px" },
  commentHead: { display: "flex", alignItems: "center", gap: 6, marginBottom: 3 },
  commentAuthor: { fontSize: 12, fontWeight: 700 },
  commentTs: { fontSize: 10, color: MUTED, fontFamily: "'JetBrains Mono',monospace", marginInlineStart: "auto" },
  commentText: { fontSize: 12.5, color: "#C9D4E0", lineHeight: 1.5, whiteSpace: "pre-wrap" },
  commentX: { background: "none", border: "none", color: MUTED, fontSize: 15, cursor: "pointer", lineHeight: 1, alignSelf: "flex-start" },
  commentInputRow: { display: "flex", gap: 8, alignItems: "stretch", marginTop: 4 },
  commentSelect: { background: PANEL, border: `1px solid ${LINE}`, borderRadius: 9, padding: "0 8px", color: INK, font: "inherit", fontSize: 12, fontWeight: 700, cursor: "pointer", flexShrink: 0 },
  commentInput: { flex: 1, background: PANEL, border: `1px solid ${LINE}`, borderRadius: 9, padding: "9px 11px", color: INK, font: "inherit", fontSize: 13, outline: "none" },
  // procurement
  procTable: { display: "flex", flexDirection: "column", gap: 8 },
  procRow: { display: "grid", gridTemplateColumns: "1.6fr 1fr auto 1fr 1fr .8fr", gap: 10, alignItems: "center", background: PANEL, border: `1px solid ${LINE}`, borderRadius: 10, padding: "11px 13px", cursor: "pointer", transition: ".14s" },
  procHeadRow: { display: "grid", gridTemplateColumns: "1.6fr 1fr auto 1fr 1fr .8fr", gap: 10, padding: "0 13px 6px", fontSize: 10.5, color: MUTED, fontWeight: 700 },
  procItem: { fontSize: 13.5, fontWeight: 600 },
  procCell: { fontSize: 12, color: "#C9D4E0" },
  procDate: { fontSize: 11.5, color: MUTED, fontFamily: "'JetBrains Mono',monospace" },
  procStatus: { fontSize: 10.5, fontWeight: 800, padding: "3px 9px", borderRadius: 20, justifySelf: "start", whiteSpace: "nowrap" },
  procCost: { fontSize: 12.5, fontWeight: 700, fontFamily: "'JetBrains Mono',monospace", textAlign: "end" },
  // modal action row
  modalActions: { display: "flex", gap: 8, marginTop: 4 },
  primaryBtn: { flex: 1, background: GOLD, color: "#0D1117", fontWeight: 800, border: "none", borderRadius: 10, padding: "11px", cursor: "pointer", font: "inherit", fontSize: 14 },
  deleteBtn: { background: "transparent", color: "#F85149", border: `1px solid #F8514955`, borderRadius: 10, padding: "11px 14px", cursor: "pointer", font: "inherit", fontSize: 14, fontWeight: 700 },
  confirmRow: { display: "flex", gap: 8, alignItems: "center", background: "#2A1416", border: "1px solid #F8514955", borderRadius: 10, padding: "10px 12px", marginTop: 8, fontSize: 13 },
  // members
  memberRow: { display: "flex", alignItems: "center", gap: 10, background: PANEL2, border: `1px solid ${LINE}`, borderRadius: 10, padding: "9px 11px", marginBottom: 8 },
  memberName: { flex: 1, background: "transparent", border: "none", color: INK, font: "inherit", fontSize: 14, fontWeight: 600, outline: "none" },
  memberCount: { fontSize: 11, color: MUTED, fontFamily: "'JetBrains Mono',monospace" },
  swatch: { width: 22, height: 22, borderRadius: "50%", flexShrink: 0, cursor: "pointer", border: "2px solid rgba(255,255,255,.15)" },
  ctrlToggle: { font: "inherit", fontSize: 11, fontWeight: 700, color: MUTED, background: PANEL, border: `1px solid ${LINE}`, borderRadius: 20, padding: "4px 10px", cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0 },
  ctrlToggleOn: { color: "#0D1117", background: GOLD, borderColor: GOLD },
  dateInput: { width: "100%", background: "transparent", border: "none", color: INK, font: "inherit", fontSize: 14, fontWeight: 600, outline: "none", colorScheme: "dark" },
  addMemberRow: { display: "flex", gap: 8, marginTop: 12 },
  // audit log
  logRow: { display: "flex", gap: 10, padding: "9px 0", borderBottom: `1px solid ${LINE}`, fontSize: 12.5 },
  logTs: { color: MUTED, fontFamily: "'JetBrains Mono',monospace", fontSize: 11, flexShrink: 0, width: 96 },
  logAction: { fontWeight: 700, color: GOLD, flexShrink: 0 },
  logDetail: { color: "#C9D4E0" },
  // drawer (reused for audit + members on mobile)
  drawerScrim: { position: "fixed", inset: 0, background: "rgba(5,8,12,.55)", backdropFilter: "blur(2px)", zIndex: 44 },
  drawer: { position: "fixed", insetInlineStart: 0, top: 0, bottom: 0, width: "min(440px,100vw)", background: PANEL, borderInlineEnd: `1px solid ${LINE}`, display: "flex", flexDirection: "column", minHeight: 0, zIndex: 45, boxShadow: "12px 0 40px rgba(0,0,0,.5)" },
  railHead: { padding: "14px 16px", borderBottom: `1px solid ${LINE}`, fontWeight: 700, fontSize: 14, display: "flex", alignItems: "center", gap: 8 },
  drawerClose: { marginInlineStart: "auto", background: "none", border: "none", color: MUTED, fontSize: 24, cursor: "pointer", lineHeight: 1, padding: 0 },
  drawerBody: { flex: 1, overflow: "auto", padding: 16 },
  // lightbox
  lightbox: { position: "fixed", inset: 0, background: "rgba(0,0,0,.9)", display: "grid", placeItems: "center", zIndex: 60, padding: 24 },
  lightboxImg: { maxWidth: "100%", maxHeight: "100%", borderRadius: 10, boxShadow: "0 20px 60px rgba(0,0,0,.6)" },
};

export const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Heebo:wght@300;400;600;800&family=JetBrains+Mono:wght@500&display=swap');
* { box-sizing: border-box; }
body { margin: 0; }
.card:hover { border-color: #41506b !important; transform: translateY(-1px); }
.pop-item:hover { background: #243044; }
.swipe-snap { transition: transform .18s ease; }
.blink { animation: blink 1.2s infinite; }
@keyframes blink { 0%,100%{opacity:.4} 50%{opacity:1} }
::-webkit-scrollbar { width: 8px; height: 8px; }
::-webkit-scrollbar-thumb { background: #283041; border-radius: 8px; }
select option { background: #1B2230; }
input[type=date] { color-scheme: dark; }
input[type=date]::-webkit-calendar-picker-indicator { filter: invert(.8); opacity: .7; cursor: pointer; }
input::placeholder, textarea::placeholder { color: #5A6373; }

@media (max-width: 820px) {
  .mc-board { grid-template-columns: 1fr 1fr !important; }
}
@media (max-width: 560px) {
  .mc-board { grid-template-columns: 1fr !important; }
  .mc-tabs { overflow-x: auto; -webkit-overflow-scrolling: touch; }
  .mc-fields { grid-template-columns: 1fr !important; }
  .mc-fvstats { width: 100%; margin-inline-start: 0 !important; }
}
`;
