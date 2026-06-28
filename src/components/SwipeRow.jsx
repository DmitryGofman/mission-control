import React, { useRef, useState } from "react";
import { S } from "../lib/styles.js";

// Pointer-based swipe row (touch + mouse): swipe right → complete, swipe left →
// postpone. A tap (no real movement) calls onClick. `rowStyle` lets each caller
// supply its own row look (agenda row vs. filter/list row). Elements marked
// [data-noswipe] (e.g. an inner button) don't start a swipe.
export default function SwipeRow({ onComplete, onPostpone, onClick, rowStyle, children }) {
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
  const base = { position: "relative", touchAction: "pan-y", userSelect: "none", willChange: "transform" };
  return (
    <div style={S.swipeOuter}>
      <div style={{ ...S.swipeAction, ...S.swipeActionL, opacity: dx > 4 ? 1 : 0 }}>
        ✓ {past && dx > 0 ? "שחרר לסיום" : "בוצע"}
      </div>
      <div style={{ ...S.swipeAction, ...S.swipeActionR, opacity: dx < -4 ? 1 : 0 }}>
        {past && dx < 0 ? "שחרר לדחייה" : "דחה למחר"} 📅
      </div>
      <div
        style={{
          ...base, ...(rowStyle || S.agendaRow), transform: `translateX(${dx}px)`,
          // Own the transition here (after rowStyle) so a caller's row style can't
          // animate the transform mid-drag: follow the finger instantly while
          // dragging, smooth snap-back on release. Same behavior in every view.
          transition: dragging ? "none" : "transform .18s ease",
        }}
        onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}
        onClick={click}>
        {children}
      </div>
    </div>
  );
}
