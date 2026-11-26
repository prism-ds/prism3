# Studio motion editor: proposal (#4571)

**Status: proposal, for the owner.** Nothing here is built, and nothing here is decided. #4571 asks for "a proposal for
the editor's information architecture and its interactions … as design decisions before any build". The questions are
in §7. Every name, label and string below is a **placeholder** unless a cited decision already fixed it.

**Read with:** #2857 (motion phases 1–3, merged as #4597, #4601 and #4608, with the owner's decisions recorded there),
`packages/engine/theme-motion.ts`, `packages/engine/motion-patterns.ts`, `packages/engine/figma-animation-styles.ts`,
`skills/prism3-motion/SKILL.md`, and Studio's Depth & motion page (`apps/studio/src/domains/depth.ts`,
`apps/studio/src/preview/depth.ts`). Source read at `main` `a02951c`.

**The short version.** The engine already accepts almost everything #4571 asks a designer to edit. Since phase 1 and 2,
`motionPersonality` takes the tempo, the easing roles, the brand's own curves, each preset's duration, easing and delay
(and an arriving preset's exit half), and each pattern track's preset, distance, start scale and reduced kind. Every one
is refused by name when it's wrong, and design.md carries every one losslessly (`lint-design-md-round-trip.ts`). Studio
exposes two of them: tempo and the four easing roles. So the editor is mostly **a surface over levers that exist**, plus
previews that play the engine's own pattern data. It needs no new token name, and no `CONTRACT_VERSION` change, unless
the owner opens a new lever (§2.3).

---

## 1. What a designer can do, before and after

### Before (today, on `main`)

In Studio, **Theme › Depth & motion**, under **Motion**:

- **Tempo**: three chips (Snappy, Standard, Relaxed), per mode. Light writes `motionPersonality.tempo`; another mode
  writes `modeLevers.<mode>.tempo`.
- **Easing per motion role**: one picker per role (default, enter, exit, emphasized), each listing the six curves,
  drawn. Per mode through `modeLevers.<mode>.easings`.
- **The preview**: the curves with the roles that use each, the duration ramp with each step's reduced value, the
  springs (read-only), and the "Presets" traces (Q-P5 A): each preset traced over its duration along its curve, with
  Play or Replay and a Slow motion choice. It plays once after a Motion edit, and never by itself under reduced motion
  (D9 A).

What a designer **can't** do in Studio today, though the engine accepts it:

- point a preset at another duration step, role, curve or spring, or give it a delay;
- change an arriving preset's exit half;
- add the brand's own curves (Q-MP3 D);
- change a pattern track's preset, distance, start scale or reduced kind (Q-PT15 A);
- see a component's motion play: the traces show timing along a curve, not a dialog opening;
- see reduced motion play unless their own OS asks for it;
- compare the brand's motion with Prism3's default.

All of that is reachable today only by hand-editing design.md and importing it.

### After

- **See** every preset and every component pattern play, at the brand's tempo, in the mode in view.
- **Point** each preset's duration, easing and delay at another target (§2.1). One edit re-times every pattern that
  names the preset, and the editor shows which ones before the edit lands.
- **Narrow** an edit to one element of one pattern: swap a track's preset, or change its distance, start scale or
  reduced kind.
- **Add** the brand's own curves, if the owner allows it in Studio (Q-ME6).
- **Preview** reduced motion on demand, whatever the OS says, and see each track's reduced kind (keep, fade or off).
- **Compare** side by side with Prism3's default (Q-ME5).
- **Export** it as today: design.md, tokens, the agent file, and in the plugin, Apply Theme's variables and animation
  styles. Nothing about export changes, because every edit lands in the brand input.

What doesn't change: a designer never types a duration in ms or a curve's numbers into a preset or a component.
#4571's "references, not literals" already holds in the engine (Q-MS2 A: a slot is always a path). The two numbers a
track may take, a px distance and a start scale, are element properties the owner put in pattern data (Q-PT9 A,
Q-PT10 A).

---

## 2. The model the editor edits

The motion stack, as built (Q-MS1 A, the clean break of 2026-11-24, phase 2):

```
primitives    motion.duration-ms.*   motion.easing.* (six + brand curves)   motion.spring.*   motion.delay.*
     ↓  tempo scales the duration ramp
scale/roles   motion.duration.<step> (+ duration-reduced)   motion.easing-role.<role> (four)
     ↓  each slot aliases one of the above
presets       motion.preset.<name>.{duration, easing, delay, duration-reduced, transition}  (+ .exit.* when arriving)
     ↓  each track names a preset (engine data, not tokens, Q-PT1 A)
patterns      dialog/enter: scrim·opacity → surface, panel·opacity → surface, panel·transform(scale 0.96) → surface, …
```

An edit at each tier reaches everything below it. The editor's job is to make that reach visible.

| Tier | One edit reaches | Example |
|---|---|---|
| Tempo | every duration, so every preset and pattern | Relaxed: every step ×1.3 |
| Easing role | every preset (and exit half) whose easing slot is that role | `enter` → `calm`: fade, reveal, surface, settle and pop all change |
| Preset slot | every track that names that preset, in every pattern | `surface` → `duration.slow`: all six dialog patterns, scrim and panel |
| Track | one element of one pattern | `toast/enter` toast·transform distance → 6px |

### 2.1 Already a lever (the editor only needs a control)

Every row below is in `BrandInput`, in `schema/theme-schema.json`, carried by design.md, validated by name, and emitted.
Only the first two have a Studio control today, and only `motionPersonality.tempo` has a manifest entry in
`levers.ts`. Each row the editor exposes needs a manifest entry so that it appears in Studio and the plugin alike
(docs/08 §4). The entry's label and description are copy, so they're the owner's.

| Lever (input path) | What it takes | Guardrail the engine already holds |
|---|---|---|
| `motionPersonality.tempo`, `modeLevers.<mode>.tempo` | snappy, standard, relaxed | enum |
| `motionPersonality.easingRoles.<role>`, `modeLevers.<mode>.easings` | any curve, the brand's included | a brand curve on `enter` must decelerate and on `exit` accelerate (`checkCurveForRole`) |
| `motionPersonality.curves.<name>` | `[x1, y1, x2, y2]` | no overshoot (overshoot is a spring's job), a name of its own, x and y in [0, 1] |
| `motionPersonality.presets.<name>.duration` | `duration.<step>` (nine steps), or `spring-duration.<spring>` | **the spring rule**: a spring-eased preset plays for that spring's settle time, so the two slots move together |
| `motionPersonality.presets.<name>.easing` | `easing-role.<role>`, `easing.<curve>`, `spring.<spring>` (Q-MS3 A) | refused by name if unknown |
| `motionPersonality.presets.<name>.delay` | `delay.show`, `delay.min-show`, `delay.hide`, `delay.skip` | refused by name if unknown |
| `motionPersonality.presets.<name>.exit.*` | the same three slots, for fade, reveal, surface, settle and pop only (Q-PT3 A) | an in-place preset has no exit half |
| `motionPersonality.patterns.<pattern>.<element.property>` | `preset` (a preset path), `distance` (a token path or px), `scale` (0–1], `reduced` (fade, keep, off) | a track that doesn't exist is refused (Q-PT15 A) |

Three behaviors the editor has to show, because a designer won't guess them:

1. **A preset pointed straight at a curve stops following its role.** Today `surface` follows `easing-role.enter`, so
   a mode's role re-point (`modeLevers.<mode>.easings`) or a brand-wide role change reaches it. Pointed at
   `easing.calm`, it no longer does. The control should say "follows *enter*" or "fixed to *calm*".
2. **An exit half follows its entrance unless it's set.** The default exit is one step shorter than the entrance as
   resolved (`exitStepOf`). Lengthen `surface` and its exit lengthens too, until the exit is set on its own.
3. **The delay steps are perception thresholds, not choreography.** They're 300–500ms, for a tooltip's show and hide.
   Pointing `surface` at `delay.show` makes every dialog wait 400ms before it opens. The engine allows it. The editor
   should say what it does, and the owner decides whether it's allowed (Q-ME1).

### 2.2 Fixed, and why

| Fixed | Why (decision) |
|---|---|
| The duration scale's steps and base values | One shared scale; a brand's timing snaps to it, and no per-preset value exists (Q-MS2 A, Q-MP7). Tempo is the brand's pace control. |
| The six built-in curves | Named for their shape; a brand adds its own beside them, never edits these (Q-MP3 D). |
| The four easing roles | No fifth role (Q-MP4 A, Q-MP25 A). A preset can point past the roles to a curve or spring instead (Q-MS3 A). |
| The four springs | Brand springs as preset targets come later, the way brand curves did (Q-P4 A). |
| The reduced duration | Derived from the duration slot, `min(full, 100ms)` (Q-MP17 A, Q-MS6 A). A designer chooses the reduced *kind* per track, not its length. |
| The delay values | Perception thresholds, the same at every tempo (G6 B, Q-PT13 A, Q-PT14 A). |
| The loop periods (spin, sweep) | Not steps of the ramp; slowed, never removed, under reduced motion (#1670, #2670). |
| Which presets exist, and which tracks a pattern has | The preset set is the owner's (Q-MP1, Q-MP2, Q-PT4, Q-PT7), and a brand overrides a track, never adds one (Q-PT15 A). |
| The brand-only group (`motion.brand.*`) | Code-only one-offs outside the guaranteed names (Q-MP7). Its fields are still DRAFT, so the editor shows it read-only, if at all. |

### 2.3 Would need a new lever (each one is the owner's)

None of these is proposed for the first build. They're listed so the owner can see where the edges are.

| Wanted | Why it isn't possible today | What it would take |
|---|---|---|
| A preset timed differently per mode (for example desktop vs mobile) | `modeLevers` re-points tempo and roles only, and modes are color modes, not breakpoints | Q-MP22 and Q-MS9 A: a mode on the preset variables once a breakpoint axis exists |
| A short choreography offset (content 50ms after its panel) | A track has no delay of its own, and the delay steps are thresholds (§2.1 item 3) | A choreography delay on the track or a short delay step. A new guaranteed name, so a `CONTRACT_VERSION` MINOR |
| A brand spring as a preset target | Presets target the four engine springs (Q-P4 A) | The filed follow-up, once the reference brand's spring is confirmed |
| A stagger cap | No starter pattern staggers (Q-PT12 A) | The field arrives with the first staggering pattern |
| A distance bound in Figma | No motion distance variable reaches Figma yet; styles write px | #4589 |
| A per-preset multiplier or a raw ms value | It would reverse Q-MS2 A | Not recommended (Q-ME2) |

---

## 3. Previews

All previews play **the engine's resolved data**: `theme.motion.presets` and `theme.motion.patterns`, resolved through
the token aliases in the mode in view. No preview carries a timing of its own. That's the rule a gate holds (§5, PR 3).
Every existing Studio preview rule still applies: the Slow motion divisor stays view state, an edit plays once, and
nothing plays by itself when the OS asks for reduced motion (D9 A).

### 3.1 Each preset on a specimen

A preset doesn't say *what* moves (the first question on #2857), so a preset can't play on its own. Two sources, in
order:

1. **The patterns that name it.** `surface` plays the centered dialog; `pop` plays the popover; `move` plays the tab
   underline; `expand` plays the accordion; `press` and `state` play a button pressed and released; `crossfade`
   plays the tabs panel. A preset named by several patterns shows a small "used by" list (Studio already has
   `preview/used-by.ts`), and a click picks which one plays.
2. **A plain specimen**, for the four presets no pattern names yet: `reveal`, `draw`, `step` and `settle`. A square
   that fades and rises for reveal and settle, a line drawn on for draw, a row of cards that advances for step. What
   each specimen does is visual design, so it's the owner's (wireframe A shows a draft).

Beside each preset: its slots as token names, the resolved ms and curve, and a small trace of the curve (today's
"Presets" trace, kept).

### 3.2 Each pattern in context

The starter set (Q-PT16 A) plays on Studio's own rendered components, in the brand's colors and shapes:

- **Arriving and leaving:** dialog (centered, bottom sheet, end panel), toast, tooltip, popover, the generic fade.
- **In place:** accordion expand and collapse, tabs select, switch toggle, segmented select.
- **State:** hover, pressed and release.

Each pattern plays over a small page backdrop, so a scrim and an end panel read at their real scale. Under the stage is
a **timeline**: one bar per track (element · property), its length the preset's duration, offset by its delay, labeled
with the preset's name. A bar is the handle for a track edit (§4.3).

### 3.3 Reduced motion

A **Reduced motion** toggle in the preview header plays everything as it plays under `prefers-reduced-motion`, without
the designer changing their OS:

- each track plays its reduced kind (`reducedKindOf`): **keep** on the preset's `duration-reduced`, **fade** as an
  opacity change on it, **off** jumping to its end;
- the timeline greys out an *off* track and relabels a *fade* track;
- the spinner and progress sweep play their slowed loop periods.

The toggle is view state, like Slow motion, never written to the brand. It also previews what phase 3's "… / reduced"
Figma styles hold, because both come from the same pattern data.

### 3.4 Side by side against the default

A **Compare** switch splits the stage in two: **this brand** and **Prism3's default**, playing in sync from one Play.
"Default" means the engine with no motion levers set (Q-ME5 decides which baseline). Edited slots carry a small
"changed" mark and a reset, the same Auto/reset pairing the tempo and easing controls already use.

---

## 4. How edits flow

### 4.1 Into the brand input

A Studio edit writes one path in `motionPersonality` through a state module, the way `state/depth-motion-input.ts`
writes tempo and easing today. The engine runs again (`brandTheme`), the previews repaint, and the working brand
persists as it does now. A refused value (an unknown target, a spring paired with a step) comes back as the engine's
own by-name message, and the last good render stays (Studio's existing last-good rule).

**Light vs another mode.** Tempo and easing roles already write per mode. Preset slots and pattern tracks have no
per-mode form (§2.3), so in another mode their controls show the brand value, read-only, with a line saying so. The
same pattern the derived modes already use.

**design.md.** The export already carries every path above, and the round-trip gate already proves it for each schema
property, `motionPersonality.presets` and `.patterns` included. A designer's motion edits leave Studio as design.md and
come back in unchanged.

### 4.2 On to every output

| Output | What a motion edit changes there | Already true? |
|---|---|---|
| Tokens (`<brand>.base.tokens.json`, per-mode overlays) | `motion.preset.*` aliases re-point; tempo changes `motion.duration.*`; brand curves appear as `motion.easing.<name>` | Yes |
| Shippable token CSS (`@prism3/tokens`, `check:package`) | The motion names are in the guaranteed contract, so they ship with their new values | Yes |
| Agent file (`.ai.json`) | `motion_presets` and `motion_patterns` name the new targets | Yes |
| Component docs | The generated Enter, Exit and Reduced lines follow the patterns (PT-B1 A) | Yes |
| Figma variables (plugin, Apply Theme) | A preset edit is an alias move on the published preset variable; the `motion` collection gains modes for per-mode tempo and roles | Yes |
| Figma animation styles (plugin) | Styles bind the preset variables (Q-MS1 A), so a preset edit needs no style rewrite. A track edit (distance, scale, reduced kind) rewrites the style's entries and keeps its key (#4608) | Yes. Whether a bound style's playback re-times live in Figma is **not verified** (#2857's opening list) |
| shadcn/ui and Tailwind themes (#2997) | Nothing: they carry no motion today | **No** (Q-ME8) |
| Contrast and every color contract | Nothing. `buildMotion` reads only `motionPersonality`, and no color rule reads motion | Yes, and PR 1 adds a gate that says so |

### 4.3 Override vs lever change

The editor offers the four scopes of §2 and always says which one an edit is:

- **A lever change** is tempo, an easing role or a preset slot. It's brand-wide, it re-times everything on that lever,
  and the "used by" list shows the reach before the edit lands.
- **A track override** is one element of one pattern. It's the narrow tool: "the toast slides 6px, everything else on
  `fade` stays".

When a designer opens a track and picks another preset for it, the editor asks the one question that matters, in
plain words: change this element only (a track override), or change the preset everywhere it plays (a lever change).
The wording is the owner's. There's no third, literal escape: the per-mode `overrides` map is color-only, and a motion
value is always a path (Q-MS2 A).

---

## 5. Phased build plan

Each PR merges on its own, off `main`, with no stacking. Each carries its progress fragment and its engine change
file. None adds a guaranteed token name, so none raises `CONTRACT_VERSION`. A Studio PR that changes the plugin's
bundled UI is checked by the plugin's gates too, because the plugin runs Studio whole.

| PR | What it adds | Gates it adds or extends |
|---|---|---|
| **1. Engine read model** | Pure helpers the editor reads: each slot's allowed targets (from the same lists `resolveHalf` checks), each preset's "used by" set from the resolved patterns, and whether a slot follows a role or is fixed. Manifest entries in `levers.ts` for presets and pattern tracks (copy DRAFT). | `test.ts` arms. A **motion-isolation gate**: a motion-only edit leaves every non-motion part of the emission byte-identical, compared across two independent emissions (mutation: make a color rule read tempo → fails by name). `lint-voice.ts` and `lint-us-english.ts` over the new copy. |
| **2. Preset editor** | The Motion levers for presets: one row per preset with duration, easing and delay pickers (the existing `step-picker.ts` and `value-picker.ts`), the exit half under arriving presets, "follows role" vs "fixed", reset. | `test-store.ts` arms (the write lands at the right path, per mode). A `test-chrome.mjs` section (and `test:chrome-shards`). `test:smoke`. `lint:live-css`. |
| **3. Preset and pattern previews** | §3.1 and §3.2: specimens, components in context, the timeline. | A **plays-the-data gate** in Chromium: each preview element's computed transition duration, curve and delay equal the value resolved from the emitted token tree, read independently of the preview's own helper (mutation: hard-code one duration in the preview → fails naming the pattern and track). |
| **4. Reduced motion and Compare** | §3.3 and §3.4. | The plays-the-data gate gains its reduced arm (each track's kind and `duration-reduced`). A chrome arm that the reduced toggle writes nothing to the brand. |
| **5. Track editor** | §4.3: a track's preset, distance, start scale and reduced kind, from the timeline, with the "this element or everywhere" choice. | `test-store.ts` arms. A round-trip arm: a track edit exported as design.md and imported back is the same brand. |
| **6. Brand curves** (if Q-ME6 A) | A curve editor that holds the engine's guardrails as the handle moves. | Arms that every guardrail the engine refuses is refused in the UI first, with the engine's own message. |
| **7. Plugin parity** (if Q-ME4 A) | The editor in the plugin panel. Apply Theme already writes the variables and styles. | `test:verdict` and `test:start` arms for the panel; `test:roundtrip` and `test:readback-parity` already cover what Apply Theme writes. The live re-time check in the Figma app, run once by the owner. |

---

## 6. Wireframes (in words)

### A. The Motion page, presets view

The page keeps Studio's two panes. **Left, the levers:** Tempo chips at the top, as today. Below, "Easing per role", as
today. Then a **Presets** list, one row per preset, in the engine's order: the preset's name, then three compact
pickers (duration, easing, delay), each showing a token name such as `duration.moderate` with its resolved value in
grey (300ms). An easing picker opens a list grouped as roles first, then curves, then springs, each drawn as a small
curve. A row whose easing is fixed to a curve shows a small "fixed" tag where it would say "follows enter". An arriving
preset has a disclosure, "Exit", that opens the same three pickers for its closing half, with "follows the entrance"
until it's set. Edited rows show a reset.

**Right, the preview:** a stage showing the selected preset playing on the first pattern that names it, a centered
dialog over a pale page for `surface`. Above the stage, the mode selector, Play, Slow motion, **Reduced motion** and
**Compare**. Under the stage, "Used by": chips for every pattern that names this preset (Dialog enter, Bottom sheet
enter, End panel enter …); a click plays that one. Turning on Compare splits the stage into "This brand" and "Default",
playing together.

### B. A pattern in context, with its timeline

Picking a pattern (from "Used by", or a pattern list) fills the stage with that component: for **Toast enter**, a toast
rising 8px into the corner of a small page as it fades in. Under it, the timeline: two bars, "toast · opacity" and
"toast · transform", each labeled `fade`, the same length, starting together, a faint ms ruler above. Clicking the
transform bar opens a small panel beside it: Preset (`fade`), Distance (`distance.nudge`, 8px, or a px field), Reduced
(fade, keep or off, with the default marked). Changing the preset here asks: "Change this toast only, or `fade`
everywhere it plays?" With Reduced motion on, the transform bar turns grey and reads "off", and the toast just fades,
in 100ms.

---

## 7. Owner questions

Answer on one line, for example `Q-ME1 A · Q-ME2 A · …`. The recommended option is listed first.

**Q-ME1 · What may an editor point a preset at?**
The engine accepts every step, role, curve, spring and delay step for a preset (Q-MS3 A), with the spring rule held.
- A. **Everything the engine accepts**, grouped roles first, then curves, then springs. The editor warns, without
  blocking, where a skill rule would object (an exit longer than its entrance, a surface on a tooltip's delay)
- B. A curated shortlist per preset (for example `surface` sees only the longer steps and the enter-shaped choices)
- C. Roles only in Studio; curves, springs and delays only through design.md

**Rec: A.** It's what #4571 asks for ("a wide variety of motion styles"), and the engine's guardrails already hold. A
shortlist would need a curation per preset, which is a new design call for each one.

**Q-ME2 · Are new per-preset levers allowed?**
- A. **No new levers for the first build.** The editor covers what exists (§2.1). Per-mode preset timing waits for the
  breakpoint axis (Q-MP22), and a choreography delay comes back as its own question when a pattern needs one
- B. Add per-mode preset slots now (`modeLevers.<mode>.presets`), keyed to the existing color modes
- C. Allow a per-preset multiplier or raw ms (reverses Q-MS2 A)

**Rec: A.** Every edge in §2.3 has a decision or an issue already, and none blocks the editor.

**Q-ME3 · Where does it live in Studio?**
- A. **Its own Theme tab, "Motion"**, beside a "Depth" tab, splitting today's Depth & motion page. Tab names DRAFT
- B. Inside Depth & motion, as more sections under Motion
- C. Presets under Theme, and each component's patterns in the Components area

**Rec: A.** The presets list, the stage and the timeline need the full preview pane, and today's page shares it with
shadows. C splits one model across two places.

**Q-ME4 · Is the plugin in scope?**
- A. **Yes, on the same UI.** The plugin runs Studio whole, so it comes nearly free; web first, then one parity PR,
  then Apply Theme writes the result as it does now
- B. Web only; the plugin hides the editor
- C. Plugin first, because that's where the animation styles are

**Rec: A.**

**Q-ME5 · "Compare against the default": which default?**
- A. **Prism3's default motion at this brand's tempo**, so Compare shows what the editor changed beyond tempo
- B. Prism3's default at Standard tempo
- C. The brand as it was last imported or exported

**Rec: A.**

**Q-ME6 · May a designer add the brand's own curves in Studio?**
- A. **Yes, in a later PR (§5 PR 6):** a curve editor that holds the engine's guardrails as you drag
- B. No. Brand curves come only through design.md; Studio lists them, read-only
- C. Pick from a library of named curves from the field, with no free editing

**Rec: A.** Brand curves are how a brand's own style gets in (Q-MP3 D), and the guardrails are already code.

**Q-ME7 · Are track overrides in the first build?**
- A. **Yes, from the timeline** (§5 PR 5), behind the "this element or everywhere" choice
- B. Presets only for now; tracks through design.md
- C. Tracks only behind Show advanced

**Rec: A.** The reference brand's specific distances live in tracks (Q-MP6 A, Q-PT9 A), so without them the editor
can't express that brand.

**Q-ME8 · The shadcn/ui and Tailwind themes carry no motion. In scope?**
- A. **Out of scope here.** File it as its own issue, so this arc stays on the editor
- B. Add the preset durations and curves to the Tailwind theme as part of this arc

**Rec: A.**

---

## 8. Not verified

- Whether a Figma animation style re-times live when the preset variable it binds is re-pointed (#2857's opening list;
  the Q-MS10 and phase 3 checks covered binding and units, not live playback after a change).
- Whether Studio can play the dialog and end-panel patterns at a readable scale inside the preview pane at the
  plugin's panel width. PR 3 measures it.
