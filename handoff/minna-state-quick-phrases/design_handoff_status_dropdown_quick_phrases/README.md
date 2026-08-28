# Handoff: Status Chip Dropdown + Quick Phrases

## Overview
Two additions to the feature journal view's header and compose area:
1. A hover dropdown on the status chip that offers legal state-transition actions (Pause/Close).
2. A "quick phrases" chip bar above the reply compose box, with phrases that vary by feature status, horizontal scroll with edge chevrons, and click-to-send into the thread.

## About the Design Files
The bundled file (`Minna Prototype.dc.html`) is a **design reference built in HTML** — a working prototype showing intended look and behavior, not production code to copy directly. The task is to recreate this in the target codebase's existing environment (React, etc.) using its established component patterns, state management, and styling system.

## Fidelity
**High-fidelity.** Colors, typography, spacing, and interaction states below are final; implement them as specified.

## Screens / Views
Both features live in the **Journal view** (single feature detail), in the header row and above the reply compose box.

### 1. Status chip dropdown
- **Position**: Journal header, top-right, first item in the header's right-aligned group (before the TASKS pill and details icon).
- **Trigger**: Mouse hover over the status chip. No click required; disappears on mouse-out of the chip+menu area.
- **Chip style** (unchanged from before): `padding: 5px 14px; border-radius: 4px; font: 700 12px 'JetBrains Mono'`, background/color per status (see Design Tokens).
- **Dropdown container**: Appears directly below the chip, flush (no visible gap — a 6px `padding-top` "bridge" sits between chip and menu inside the same hoverable wrapper so the cursor never crosses dead space and the menu doesn't disappear mid-move). White background, `1px solid #dbe0dd` border, `border-radius: 6px`, `box-shadow: 0 8px 24px rgba(0,0,0,.14)`, `min-width: 110px`, `padding: 4px`, `z-index: 30`.
- **Menu items**: stacked vertically, `gap: 2px`. Each item: `padding: 8px 10px`, `border-radius: 4px`, `font: 500 12px 'JetBrains Mono'`, `color: #0f1512`, hover background `#f3f5f4`.
- **Actions per status**:
  | Current status | Menu items shown |
  |---|---|
  | `parked` | Close |
  | `active` | Pause, Close |
  | `blocked` | Pause, Close |
  | `closed` | *(no dropdown — terminal state, hover does nothing)* |
- **Action effects**: `Close` sets status → `closed`. `Pause` sets status → `parked`. Clicking an action closes the menu immediately.

### 2. Quick phrases bar
- **Position**: Directly above the reply compose bar, below the message thread. Only rendered when the current feature's status has at least one quick phrase (i.e. not `closed`).
- **Container**: `border-top: 1px solid #dbe0dd`, `padding: 10px 24px 10px`, flex row, `align-items: center`, `gap: 6px`.
- **Chips**: flex-wrap disabled (single row), horizontally scrollable, `gap: 8px` between chips. Each chip: `border: 1px solid #dbe0dd`, `border-radius: 6px` (square-cornered chip, not a pill), `padding: 7px 12px`, `font: 500 12px 'JetBrains Mono'`, `color: #4a544d`, white background. Hover: background `#00F0FF`, text `#101614`, border `#00F0FF`.
- **Scroll behavior**: native horizontal scroll on the chip row, scrollbar hidden (`scrollbar-width: none` + `::-webkit-scrollbar{display:none}`).
- **Overflow chevrons**: 22px circular buttons, `border: 1px solid #dbe0dd`, white background, hover `#f3f5f4`. Each chevron is only *mounted* (not just hidden) when scrolling in that direction is possible — this means the chip row aligns flush against the compose bar's left edge when no left-scroll is available, and the chevron only takes up layout space (pushing chips over) once it's actually usable, never overlapping the chips. Recomputed on every scroll event and on status/feature change.
- **Chevron click behavior**: not a fixed-distance scroll. Clicking the right chevron scrolls so that the next chip that is only partially visible (or fully offscreen) snaps flush to the left edge of the visible area. Clicking the left chevron snaps back to the previous chip's left edge, symmetrically. (Implementation note: compute each chip's position relative to the scroll container via `getBoundingClientRect`, not `offsetLeft`, since `offsetLeft` is relative to the nearest positioned ancestor and can be wrong.)
- **Phrases per status**:
  | Status | Phrases |
  |---|---|
  | `parked` | "Start this feature." |
  | `active` | "What's the status?", "Show me the diff so far", "Any blockers I should know about?" |
  | `blocked` | "Help me unblock this", "What's blocking this?" |
  | `closed` | *(none — bar is not rendered)* |
- **Click behavior**: clicking a chip sends its exact label text into the thread as a new message (see Interactions below). It does not populate the compose textarea first — it sends immediately.

### 3. Compose bar (updated)
- Changed from a single-line `<input>` to a 2-row `<textarea>` (`rows="2"`, `resize: none`), same border/radius/font as before.
- `Enter` sends the message; `Shift+Enter` inserts a newline.
- Send button enlarged from 40×40 to **56×56**, still a perfect square, `border-radius: 4px`, background `#00c9d6`, hover `#00F0FF`. Icon enlarged from 18×18 to 24×24 accordingly.
- When the quick phrases bar is present, the compose bar has no top border/padding of its own (the quick phrases bar's own bottom padding, 10px, provides the separation — matching its top padding so the gap above and below the chip row is visually equal). When there are no quick phrases (status `closed`), the compose bar reverts to owning its own top border and 14px top padding, as before.

## Interactions & Behavior
- **Sending a message** (via Enter, the send button, or a quick phrase click) appends a new message to the feature's thread with `sender: 'you'`, aligned to the **right** side of the thread (row-reverse layout, right-aligned sender label), avatar background `#00c9d6` with `Y` initial, bubble background `#dff7f8` (light cyan tint, distinct from the existing `#e5e9e6` agent/Minna bubbles). Timestamp is the current local `HH:MM`.
- After sending, the thread auto-scrolls to the bottom.
- Switching to a different feature resets the quick-phrases scroll position to 0 and recomputes chevron visibility (phrase sets differ per status).

## State Management
New state needed (component/hook-local to the journal view):
- `statusChipHovered: boolean` — drives dropdown visibility.
- `quickPhrasesCanScrollLeft: boolean`, `quickPhrasesCanScrollRight: boolean` — drive chevron mount/unmount, recomputed on scroll/resize/status change.
- `replyText: string` — textarea value (existing).
- Feature status transitions (`Pause` → `parked`, `Close` → `closed`) mutate the selected feature's `status` field directly.
- Thread messages array gains a new possible `sender: 'you'` entry shape: `{ sender: 'you', time: string, text: string }`.

## Design Tokens
- Status chip colors (existing, unchanged): `parked` bg `#dbe0dd` / text `#4a544d`; `active` bg `#00F0FF` / text `#101614`; `blocked` bg `#7a1f30` / text `#fff`; `closed` bg `#2f9e44` / text `#fff`.
- Accent cyan: `#00c9d6` (send button, user avatar), hover accent `#00F0FF`.
- User message bubble: `#dff7f8`.
- Borders/dividers: `#dbe0dd`.
- Neutral text: `#4a544d` (chip text), `#0f1512` (menu item text), `#8f9a94` (muted labels).
- Fonts: `'JetBrains Mono'` for chips/menu/labels, `'IBM Plex Sans'` for message body text.
- Border radius: `6px` for chips and dropdown menu; `4px` for chip pill/buttons/compose elements; `50%` for chevrons.

## Assets
No new image/icon assets — chevrons and send icon are inline SVGs (stroke `currentColor` / `#101614`, `stroke-width: 2`).

## Files
- `Minna Prototype.dc.html` — contains both features. Relevant sections: the journal header (status chip + dropdown), and the compose area at the bottom of the journal view (quick phrases bar + textarea + send button). Search for `statusActions`, `quickPhrases`, `pushMessage`, `checkQuickScroll`, `scrollQuickLeft`/`scrollQuickRight` to locate the logic.
