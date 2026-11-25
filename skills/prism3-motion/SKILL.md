---
name: prism3-motion
description: >-
  Decide how things move in a Prism3 product — what animates and what doesn't,
  which motion preset, duration, easing role or spring each change uses, how
  exits differ from entrances, and what reduced motion substitutes. Every rule
  binds to the brand's emitted motion tokens, never to a number, because the
  numbers move with the brand's tempo. Ten recipes cover dialog, accordion,
  tabs, toast and banner, the spinner's delayed show, progress, badge, the
  selection controls, the switch and segmented control, and focus; every other component follows the rules
  directly.
when_to_use: >-
  When adding a transition, an animation, a spring or a reduced-motion rule to UI
  built on a Prism3 token system, or when writing the `motion` field of a component
  definition. Read it with `prism3-build-ui`, which covers every other token family.
---

# prism3-motion — moving things with Prism3's motion tokens

You're animating UI that sits on a generated Prism3 token system. The brand's motion lives in its
`motion.*` tokens: twelve presets (`motion.preset.<name>`), the patterns that name them, and under them a duration ramp, easing roles,
curves, springs, delays, a distance and a stagger interval. **The values behind those names change per
brand**: the brand's tempo (`motionPersonality.tempo`) scales the duration ramp, all but the two loop
periods, and a brand can re-point any preset at another step, role, curve or spring. So a number you
type is right for one brand at most, and wrong for the next one the same code runs on. Name the token
and the brand supplies the value.

> **The one-line contract:** every timing is a `motion.*` token, every change has a reason to move,
> and reduced motion swaps movement for a fade instead of deleting the transition.

The rules ground in the practice knowledge base (KB `18-motion-foundations` and
`21-motion-spec-and-handoff`) and in decisions the engine already encodes. Each rule names its
grounding, so you can check the reason, not only the rule.

## The tokens you bind

Bind a **preset** where one fits the change, and otherwise the **role** a family offers, never the
shape or step behind it. The preset or role says why; the brand picks the value.

| Family | Roles | Use it for |
|---|---|---|
| `motion.preset.<name>` | `state`, `fade`, `crossfade`, `move`, `reveal`, `draw`, `surface`, `expand`, `step`, `settle`, `pop`, `press` | One kind of change, timed as a whole. Each preset has `.duration`, `.easing`, `.delay` and `.duration-reduced`, and `.transition` bundles the first three. Bind these first. |
| `motion.preset.<name>.exit` | on `fade`, `reveal`, `surface`, `settle`, `pop` | The closing half of an arriving preset, with the same five slots: one step shorter, on the exit role. Bind it for the leave, so a brand that re-times the leave changes it in one place. |
| `motion.duration.*` | `instant`, `fast`, `normal`, `moderate`, `slow`, `slower`, `long`, `longer`, `longest` | How long a change takes, shortest to longest. Scaled by the brand's tempo. |
| | `spin`, `sweep` | Loop periods: one spinner turn, one pass of an indeterminate progress bar. Not tempo-scaled. |
| `motion.duration-reduced.*` | the same role names | The twin of each duration under `prefers-reduced-motion`: a short fade that always shows. |
| `motion.easing-role.*` | `default`, `enter`, `exit`, `emphasized` | The curve, named by what the change does. |
| `motion.easing.*` | `linear`, `standard`, `decelerate`, `accelerate`, `expressive`, `calm`, and any curve the brand adds | Curve shapes. Reach for a shape only where no role fits, such as `motion.easing.linear` for a constant-speed loop. |
| `motion.spring.*` | `snappy`, `gentle`, `bouncy`, `effects` | Physical motion for things a person drags, flicks or releases. `effects` moves opacity and color and never overshoots. |
| `motion.spring-easing.*` | the same spring names | A spring as a CSS curve, for code that can't run a spring. |
| `motion.spring-duration.*` | the same spring names | How long that spring takes to settle. Play the curve over it. |
| `motion.delay.*` | `show`, `min-show`, `hide`, `skip` | How long a tooltip or a busy indicator waits before it shows, the least time a shown one stays, how long a tooltip waits before it hides, and the window in which the next tooltip shows at once. Not tempo-scaled. |
| `motion.distance.*` | `nudge` | The small offset an element travels as it enters or leaves, such as a toast sliding in. |
| `motion.stagger` | — | The interval between siblings that arrive in sequence. |

The `.ai.json` sidecar has one entry per motion token, with what it's for. Its `motion_presets` block
names each preset's tokens and, in `resolves_to`, what each slot points at for this brand, exit half
included. Read it when the table above doesn't settle a choice.

## Patterns: what a component's motion moves

A **pattern** is one component half that moves, such as `dialog/enter`. It lists its **tracks**: each
moves one element through one property group (opacity, transform, size or color) on a named preset,
with the element's own distance or start scale, and says what the track does under reduced motion.
A pattern holds no timing of its own, so the brand's presets still decide every value.

Read the patterns from the `.ai.json` sidecar's `motion_patterns` block, which carries the brand's
own: a brand can re-point a track's preset, distance, start scale or reduced kind, but never add or
drop a track. A component's docs list the patterns it plays. When you animate a component that has a
pattern, play its tracks as listed, on their presets; the recipes below are those patterns in words.

| Patterns | For |
|---|---|
| `dialog/enter`, `dialog/exit`, `dialog/bottom/enter`, `dialog/bottom/exit`, `dialog/end/enter`, `dialog/end/exit` | Dialog, per placement |
| `toast/enter`, `toast/exit` | Toast |
| `tooltip/show`, `tooltip/hide` | Tooltip |
| `popover/open`, `popover/close` | Popover and menu |
| `accordion/expand`, `accordion/collapse` | Accordion |
| `tabs/select`, `switch/toggle`, `segmented/select` | Tabs, switch, segmented control |
| `fade/in`, `fade/out`, `hover`, `pressed`, `pressed/release` | Any element that fades, and any control's hover and press |


## The rules

**R1. Every timing is a token.** A duration, a delay, a curve or a spring is a reference to a
`motion.*` token: a preset, a duration role, an easing role, a spring or a delay. A typed number or curve
is a defect, even when it matches today's value, because tomorrow's brand has a different tempo.
Where no token exists, don't invent one: say so in your report, and use the component's own spec
for that one value.
*Grounding:* KB `18-motion-foundations`, Tier 1 (motion tokens) and its failure mode where an agent
invents durations.

**R2. The easing follows the change.** A thing arriving takes `motion.easing-role.enter`, a thing
leaving takes `motion.easing-role.exit`, a change in place takes `motion.easing-role.default`, and a
deliberate hero moment takes `motion.easing-role.emphasized`. An entrance decelerates into place; an
exit accelerates away, so it reads as gone without being watched.
*Grounding:* KB `18-motion-foundations`, easing tokens; the role table `EASING_ROLE_DEFAULTS` in
`packages/engine/theme-motion.ts`.

**R3. Leaving is faster than arriving.** An exit runs shorter than its entrance. Each arriving preset
carries its exit half, `motion.preset.<name>.exit`: by default one step shorter, on the exit role, so
`motion.preset.fade.exit` follows a `fade` entrance. Bind the exit half, not a step and a role. Where a
change has no arriving preset, keep the exit at least one step shorter than the entrance. A person who dismissed something has already moved on. The
reduced twins are in order, so a reduced exit is never longer than its reduced entrance.
*Grounding:* KB `18-motion-foundations`, Tier 2, "exit faster by default".

**R4. Springs move what a person touches; curves move what the system starts.** A drag release, a
flick to dismiss and a swipe settle on a `motion.spring.*` token, because they continue a hand's
velocity. Anything the system triggers (an open, a load, a state change) takes a preset. Use
`motion.spring.snappy` by default, `motion.spring.gentle` for a large surface, and
`motion.spring.bouncy` only for a deliberately expressive moment. Opacity and color go on
`motion.spring.effects` when a touch drives them, and on a curve otherwise: the other three springs
are spatial. A preset the brand points at a spring plays for that spring's settle time, so bind its
`.duration` and `.easing` together.
In CSS, which can't run a spring, play `motion.spring-easing.<name>` over `motion.spring-duration.<name>`, with
the same name on both (#3510). A JavaScript animation library runs the spring itself from `motion.spring.*`.
*Grounding:* KB `18-motion-foundations`, decision frameworks (spring or curve) and the spatial and
effects split.

**R5. Animate transform and opacity.** Position, scale and opacity move without reflowing the
page. Animate size or layout only where the size change is the information: the accordion panel
opening, a banner collapsing as it's dismissed, toasts closing ranks. The accordion panel takes the
`expand` preset (its recipe below); the others enter on the `fade` preset and leave on
`motion.preset.fade.exit`, like any other change.
*Grounding:* KB `18-motion-foundations`, "May this animate layout?".

**R6. Chrome stays quick.** A state change on a control (hover, press, check, select) takes
`motion.duration.instant` or `motion.duration.fast`. An entrance or exit stays at or under
`motion.duration.moderate`. Keep `motion.duration.slow` and the steps above it for moments that
replace the whole screen. Motion a person sees dozens of times a session gets in the way when it's
slow.
*Grounding:* KB `18-motion-foundations`, duration roles.

**R7. Reduced motion substitutes; it doesn't delete.** Under `prefers-reduced-motion`:
- movement (a slide, a scale, a spring) becomes a fade;
- every duration takes its twin in `motion.duration-reduced.*`, and a preset takes its own
  `.duration-reduced`, a short fade that always shows;
- a spring becomes that short fade too: drop the spring and fade on the preset's `.duration-reduced`;
- a functional loop slows instead of stopping: the spinner turns on `motion.duration-reduced.spin`,
  the progress sweep on `motion.duration-reduced.sweep`.

A fade isn't vestibular motion, and it keeps the cue that something appeared or went. No reduced
duration is zero, so a reduced transition still ends, and code that waits for its end still hears it.
*Grounding:* KB `18-motion-foundations`, the reduce-motion contract; the engine's derived
`durationReduced` ramp and `SPIN_REDUCED_MS` in `packages/engine/theme-motion.ts`; WCAG 2.3.3.

**R8. Loops end.** A decorative animation runs a set number of times and stops. A functional loop
(the spinner, the indeterminate progress bar) runs on `motion.duration.spin` or
`motion.duration.sweep` and states what stops it: the work it reports finishing. Anything that moves
on its own for more than five seconds beside other content needs a way to pause, stop or hide it.
*Grounding:* KB `18-motion-foundations`, iterations; WCAG 2.2.2.

**R9. A repeated trigger doesn't queue.** When a person toggles, opens or switches again before a
transition finishes, the new change starts from where the element is now, on the same
preset or token. It never waits for the old one to play out, and a stack of repeats never
plays back in sequence.
*Grounding:* KB `18-motion-foundations`, skip on rapid repeat (a practice position).

**R10. Nothing grows from nothing.** A scale entrance starts a little smaller than full size, not
from zero, and fades in on the same `fade` preset. Growing from a point draws the
eye to the growth instead of the content.
*Grounding:* KB `18-motion-foundations`, the pop pattern.

**R11. Siblings stagger on one interval.** Items that arrive together, such as rows of a list,
start `motion.stagger` apart, each on the `fade` preset. Keep the sequence short: stagger the
first few and let the rest arrive together, so a long list doesn't make the last item wait.
*Grounding:* KB `18-motion-foundations`, choreography.

**R12. Under reduced motion, motion a person didn't start stays still.** Parallax, coasting after a
fling, a long scroll to an anchor and a chain of delayed steps are off, or collapse to their end
state, under `prefers-reduced-motion`. Parallax doesn't move, a fling stops where the finger leaves,
an anchor jump lands at once, and a chained sequence shows its last step on the preset's
`.duration-reduced`. These are the motions most likely to trigger vestibular symptoms, and a fade
can't stand in for them.
*Grounding:* owner decision Q-MP17 A (#2857); KB `18-motion-foundations`, the reduce-motion contract;
WCAG 2.3.3.

## Recipes

Each recipe names its tracks (what moves), its tokens and its reduced form. Every one follows the
rules above; where a recipe needs a value the tokens don't hold yet, it says which gap.

### Dialog

Patterns `dialog/enter` and `dialog/exit`, and `dialog/bottom/*` and `dialog/end/*` for the other placements.

| Track | Enter | Exit |
|---|---|---|
| Backdrop | opacity, on `motion.preset.surface` | opacity, on `motion.preset.surface.exit` |
| Panel, centered | opacity and a scale from a little under full size (R10), on the backdrop's preset | the reverse, on the backdrop's preset |
| Panel, bottom sheet or full screen | slides up from the bottom edge, on the backdrop's preset | slides back down, on the backdrop's preset |
| Panel, end panel | slides in from the end edge, on the backdrop's preset | slides back out, on the backdrop's preset |
| Content | fades in, on `motion.preset.fade` | fades out, on `motion.preset.fade.exit` |

The backdrop always plays on its panel's preset, so the two never drift apart.

**Reduced:** the backdrop and every panel placement fade only, with no slide and no scale, on
`motion.preset.surface.duration-reduced` opening and `motion.preset.surface.exit.duration-reduced`
closing; the content fades on `motion.preset.fade.duration-reduced` and
`motion.preset.fade.exit.duration-reduced`.

Move focus into the dialog when it opens, without waiting for the enter to finish.

### Accordion

Patterns `accordion/expand` and `accordion/collapse`.

| Track | Open | Close |
|---|---|---|
| Panel height (the R5 exception) and opacity | the `expand` preset | the `expand` preset |
| Indicator glyph turn | `motion.preset.move` | `motion.preset.move` |

The panel grows and shrinks where it already is, so it opens and closes on one preset, `expand`, on
the in-place curve (R2). Bind `motion.preset.expand.duration` and `motion.preset.expand.easing`, or
`motion.preset.expand.transition` for both. A brand can re-point the preset at another step, curve
or spring, and the panel follows. By default it plays on the `normal` step with the `default` role.

**Reduced:** the height changes at once; the panel's fade stays, on
`motion.preset.expand.duration-reduced` both ways (R3). The indicator swaps without turning.

### Tabs indicator

Pattern `tabs/select`.

| Track | On a selection change |
|---|---|
| Underline | travels from the old tab to the new one, as a transform, on `motion.preset.move` |
| Panels | the outgoing panel fades out under the incoming one, on `motion.preset.crossfade`. Panels never slide sideways. |

**Reduced:** the underline snaps to the new tab; the incoming panel fades in on
`motion.preset.crossfade.duration-reduced`.

### Toast and banner

Patterns `toast/enter` and `toast/exit`.

| Track | Enter | Exit |
|---|---|---|
| Toast | slides up by `motion.distance.nudge` and fades in, on the `fade` preset | fades out, on `motion.preset.fade.exit` |
| Banner | fades in, on the `fade` preset; its space is reserved first, so nothing below jumps | collapses its height and fades, on `motion.preset.fade.exit` (the R5 exception) |

A replacement toast plays the exit, then the enter.

**Reduced:** fades only, on `motion.preset.fade.duration-reduced` arriving and
`motion.preset.fade.exit.duration-reduced` leaving (R3). The banner's height changes at once.

### Spinner, delayed show

| Step | Tokens |
|---|---|
| The host waits before mounting it, so a quick response never flashes one | `motion.delay.show` |
| It fades in on mount | `motion.duration.fast`, `motion.easing-role.enter` |
| It turns, at constant speed, until the work ends | `motion.duration.spin` per turn, `motion.easing.linear` |

**Reduced:** it turns slower on `motion.duration-reduced.spin` and never stops while the work runs;
the fade-in stays, on `motion.duration-reduced.fast`.

### Progress

| Step | Tokens |
|---|---|
| The wait before it shows, so a fast task shows nothing, and the least time it stays once shown | `motion.delay.show` and `motion.delay.min-show` |
| The fill moves to each new value | `motion.duration.moderate`, `motion.easing-role.default` |
| An indeterminate bar sweeps its segment across the track, until the work ends | `motion.duration.sweep` per pass, `motion.easing.calm` |
| An indeterminate ring turns its arc, until the work ends | `motion.duration.sweep` per turn, `motion.easing.linear` |
| At complete or error, the fill's color crossfades | `motion.duration.fast`, `motion.easing-role.default` |

**Reduced:** the fill moves on `motion.duration-reduced.moderate`.
The sweep and the turn slow to `motion.duration-reduced.sweep` and never stop while the work runs
(R7, R8).

### Badge

| Track | Enter | Exit |
|---|---|---|
| Count or dot | fades in and scales up from a little under full size (R10), from the corner it is anchored to, on the `fade` preset | fades out and scales down toward its anchor, on `motion.duration.fast` with `motion.easing-role.exit` |
| A changed count | only the number changes, on `motion.duration.normal` with `motion.easing-role.default`; the pill doesn't move | — |
| Status label | no motion | no motion |

A badge doesn't pulse: none of its states loops (R8).

**Reduced:** a count or dot fades only, with no scale, on `motion.duration-reduced.normal` both
ways (R3); a changed count's number fades on the same role.

### Selection controls

| Control | Track | On a change |
|---|---|---|
| Checkbox | the check glyph draws in as a stroke while the fill crossfades | `motion.duration.fast`, `motion.easing-role.default` (R6) |
| Radio | the dot scales in from a little under full size (R10), the previous choice's dot scales out, and the ring's color crossfades | `motion.duration.fast`, `motion.easing-role.default` (R6) |

The focus ring on each of them, and on the switch and the segmented control, follows the focus
recipe below.

**Reduced:** nothing draws, scales or travels. The glyph, the dot, the thumb and the pill take their
new place at once, and the color change fades on `motion.duration-reduced.fast`.

### Switch and segmented control

Patterns `switch/toggle` and `segmented/select`.

| Control | Track | On a change |
|---|---|---|
| Switch | the thumb travels across the track as a transform, and the track's color crossfades with it | `motion.preset.move` |
| Segmented control | the pill travels to the new option as a transform, as the tabs underline does, and the labels change color with it | `motion.preset.move` |

**Reduced:** the thumb and the pill take their new place at once, and the color change fades on
`motion.preset.move.duration-reduced`.

### Focus

The focus ring appears at once and leaves at once. It never animates in. A keyboard user needs to
see where focus landed the moment it lands, and a fade or a grow delays that. No `motion.*` token
applies: the ring binds `focus.ring.width`, `focus.ring.offset` and `color.border.focus`, and none of
them transitions. The control under the ring keeps its own state change (R6).

## Gaps: what to do until a token exists

| Gap | Issue | Until it's filled |
|---|---|---|
| No Figma style per pattern: a designer can't apply a pattern on the canvas yet | #2857 phase 3 | Read the pattern from the `.ai.json` sidecar, or from the component's docs. |
| Breakpoint-specific timing | #2857, Q-MS9 | One timing at every width; a brand's per-mode overrides follow color modes, not breakpoints. |

Report a gap you hit; don't fill it with a number.

## Before you finish

1. Every duration, delay, curve and spring in your change is a `motion.*` name, a preset's where one
   fits. No unit, no curve function, no spring constant typed in.
2. Each moving thing has an easing role that matches its change: `enter`, `exit`, `default` or
   `emphasized`.
3. Each exit is shorter than its entrance, and so is its reduced twin: an arriving preset's exit binds
   its `.exit` half.
4. Only transform and opacity animate, except the declared layout cases (R5).
5. Under reduced motion, every movement became a fade on a `motion.duration-reduced.*` twin or a
   preset's `.duration-reduced`, every functional loop still runs, slower, and parallax, coasting,
   anchor scrolls and chained delays are off or at their end state (R12).
6. The focus ring has no transition.

This skill is gated by `packages/engine/lint-motion-literals.ts`: it fails when the skill types a
duration, a curve or a spring constant, and when a `motion.*` name here doesn't resolve in the
emitted tokens.
