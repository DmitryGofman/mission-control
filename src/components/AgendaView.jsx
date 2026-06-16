import React, { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { S, MUTED, GOLD } from "../lib/styles.js";
import {
  STATUSES, ASSEMBLIES, PRIORITIES, readable, initials,
  dueToDate, dateToDue, startOfToday, addDays,
} from "../lib/constants.js";

// ----- date grouping (Todoist-style buckets) -----
function bucketOf(t, today) {
  const d = dueToDate(t.due);
  if (!d) return "none";
  const diff = Math.round((d - today) / 86400000);
  if (diff < 0) return "overdue";
  if (diff === 0) return "today";
  if (diff === 1) return "tomorrow";
  if (diff <= 7) return "week";
  return "later";
}

const GROUPS = [
  { key: "overdue", label: "באיחור", color: "#F85149" },
  { key: "today", label: "היום", color: "#E8C547" },
  { key: "tomorrow", label: "מחר", color: "#58A6FF" },
  { key: "week", label: "7 הימים הקרובים", color: "#BC8CFF" },
  { key: "later", label: "בהמשך", color: "#8B97A8" },
  { key: "none", label: "ללא תאריך", color: "#5A6573" },
];

function memberColor(members, name) {
  return members.find((m) => m.name === name)?.color || GOLD;
}

// Swipe gesture wrapper: drag right → complete, drag left → postpone.
function SwipeRow({ onComplete, onPostpone, onClick, children }) {
  const [dx, setDx] = useState(0);
  const [dragging, setDragging] = useState(false);
  const startX = useRef(null);
  const moved = useRef(false);
  const THRESH = 95;
  const MAX = 130;

  function down(e) {
    if (e.target.closest("[data-noswipe]")) return;
    startX.current = e.clientX;
    moved.current = false;
    setDragging(true);
    e.currentTarget.setPointerCapture?.(e.pointerId);
  }
  function move(e) {
    if (startX.current == null) return;
    let d = e.clientX - startX.current;
    if (Math.abs(d) > 6) moved.current = true;
    d = Math.max(-MAX, Math.min(MAX, d));
    setDx(d);
  }
  function up() {
    if (startX.current == null) return;
    const d = dx;
    startX.current = null;
    setDragging(false);
    setDx(0);
    if (d >= THRESH) onComplete?.();
    else if (d <= -THRESH) onPostpone?.();
  }
  function click() {
    if (!moved.current) onClick?.();
  }

  const past = Math.abs(dx) >= THRESH;
  return (
    <div style={S.swipeOuter}>
      <div style={{ ...S.swipeAction, ...S.swipeActionL, opacity: dx > 4 ? 1 : 0 }}>
        ✓ {past && dx > 0 ? "שחרר לסיום" : "בוצע"}
      </div>
      <div style={{ ...S.swipeAction, ...S.swipeActionR, opacity: dx < -4 ? 1 : 0 }}>
        {past && dx < 0 ? "שחרר לדחייה" : "דחה למחר"} 📅
      </div>
      <div
        className={dragging ? undefined : "swipe-snap"}
        style={{ ...S.agendaRow, transform: `translateX(${dx}px)` }}
        onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}
        onClick={click}>
        {children}
      </div>
    </div>
  );
}

// Inline month calendar (no native picker, so it can't be dismissed early).
const DOW = ["א", "ב", "ג", "ד", "ה", "ו", "ש"];
function InlineCalendar({ onPick }) {
  const t = startOfToday();
  const [view, setView] = useState({ y: t.getFullYear(), m: t.getMonth() });
  const first = new Date(view.y, view.m, 1);
  const daysInMonth = new Date(view.y, view.m + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < first.getDay(); i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  const prev = () => setView((v) => (v.m === 0 ? { y: v.y - 1, m: 11 } : { y: v.y, m: v.m - 1 }));
  const next = () => setView((v) => (v.m === 11 ? { y: v.y + 1, m: 0 } : { y: v.y, m: v.m + 1 }));
  const isToday = (d) => view.y === t.getFullYear() && view.m === t.getMonth() && d === t.getDate();

  return (
    <div style={S.calWrap}>
      <div style={S.calHead}>
        <button style={S.calNav} onClick={prev} aria-label="חודש קודם">›</button>
        <span>{first.toLocaleDateString("he-IL", { month: "long", year: "numeric" })}</span>
        <button style={S.calNav} onClick={next} aria-label="חודש הבא">‹</button>
      </div>
      <div style={S.calGrid}>
        {DOW.map((d) => <span key={d} style={S.calDow}>{d}</span>)}
        {cells.map((d, i) => d
          ? <button key={i} className="cal-day" style={{ ...S.calDay, ...(isToday(d) ? S.calToday : {}) }}
              onClick={() => onPick(dateToDue(new Date(view.y, view.m, d)))}>{d}</button>
          : <span key={i} />)}
      </div>
    </div>
  );
}

// Quick reschedule popover (Today / Tomorrow / Weekend / In a week / no date /
// pick a date). Rendered via a portal with fixed positioning so it isn't
// clipped by the swipe container's overflow or the row's transform.
function Reschedule({ anchor, onPick, onClose }) {
  const [showCal, setShowCal] = useState(false);
  const today = startOfToday();
  // Israeli work week is Sun–Thu, so "end of week" is the upcoming Thursday
  // (getDay 4). If today is already Thursday, jump to next week's Thursday.
  const dToThu = (4 - today.getDay() + 7) % 7;
  const endOfWeek = addDays(today, dToThu === 0 ? 7 : dToThu);

  const opts = [
    { label: "היום", icon: "📌", date: today },
    { label: "מחר", icon: "☀️", date: addDays(today, 1) },
    { label: "סוף שבוע", icon: "🛋️", date: endOfWeek },
    { label: "בעוד שבוע", icon: "📆", date: addDays(today, 7) },
    { label: "ללא תאריך", icon: "🚫", date: null },
  ];

  const W = 230;
  const H = showCal ? 380 : 270;
  const left = Math.max(8, Math.min(anchor.right - W, window.innerWidth - W - 8));
  const top = window.innerHeight - anchor.bottom > H + 12
    ? anchor.bottom + 6
    : Math.max(8, anchor.top - H - 6);

  return createPortal(
    <>
      <div style={S.popScrim} onClick={onClose} />
      <div style={{ ...S.popoverFixed, width: W, left, top }} onClick={(e) => e.stopPropagation()}>
        <div style={S.popTitle}>תזמון מחדש</div>
        {opts.map((o) => (
          <button key={o.label} className="pop-item" style={S.popItem}
            onClick={() => { onPick(o.date ? dateToDue(o.date) : ""); onClose(); }}>
            <span>{o.icon}</span>{o.label}
            {o.date && <span style={S.popItemDate}>{dateToDue(o.date)}</span>}
          </button>
        ))}
        {!showCal
          ? <button className="pop-item" style={S.popItem} onClick={() => setShowCal(true)}>
              <span>🗓️</span>בחר תאריך…
            </button>
          : <InlineCalendar onPick={(due) => { onPick(due); onClose(); }} />}
      </div>
    </>,
    document.body
  );
}

export default function AgendaView({ tasks, members, onPick, onComplete, onReschedule }) {
  const [resched, setResched] = useState(null); // { task, rect }
  const today = startOfToday();

  // Active (non-completed) tasks bucketed by due date.
  const active = tasks.filter((t) => t.status !== "בוצע");
  const buckets = {};
  for (const t of active) (buckets[bucketOf(t, today)] ||= []).push(t);
  // Within a group, sort by due date ascending (no-date keeps insertion order).
  for (const k of Object.keys(buckets)) {
    buckets[k].sort((a, b) => (dueToDate(a.due) || 0) - (dueToDate(b.due) || 0));
  }

  const anything = GROUPS.some((g) => buckets[g.key]?.length);

  return (
    <div style={S.agenda}>
      {!anything && <div style={S.empty}>אין משימות פעילות. הוסף משימה עם תג״ב כדי לראות אותה כאן.</div>}
      {GROUPS.map((g) => {
        const items = buckets[g.key];
        if (!items?.length) return null;
        return (
          <div key={g.key} style={S.agendaGroup}>
            <div style={{ ...S.agendaHead, color: g.color }}>
              <span style={{ ...S.qdot, background: g.color }} /> {g.label}
              <span style={S.agendaCount}>{items.length}</span>
            </div>
            {items.map((t) => (
              <SwipeRow key={t.id}
                onComplete={() => onComplete(t)}
                onPostpone={() => onReschedule(t, dateToDue(addDays(today, 1)))}
                onClick={() => onPick(t)}>
                <span style={{ ...S.qdot, background: STATUSES[t.status].color }} />
                <span style={{ ...S.qAsm, background: ASSEMBLIES[t.asm], color: readable(ASSEMBLIES[t.asm]) }}>{t.asm}</span>
                <span style={S.qTask}>{t.task}</span>
                <span style={{ ...S.ava, width: 20, height: 20, background: memberColor(members, t.who) }}>{initials(t.who)}</span>
                {t.due && <span style={{ ...S.qDue, color: g.key === "overdue" ? "#F85149" : MUTED, fontWeight: g.key === "overdue" ? 700 : 400 }}>{t.due}</span>}
                <button data-noswipe style={S.reschedBtn} title="תזמון מחדש"
                  onClick={(e) => { e.stopPropagation(); setResched({ task: t, rect: e.currentTarget.getBoundingClientRect() }); }}>📅</button>
              </SwipeRow>
            ))}
          </div>
        );
      })}
      {resched && (
        <Reschedule anchor={resched.rect} onClose={() => setResched(null)}
          onPick={(due) => onReschedule(resched.task, due)} />
      )}
    </div>
  );
}
