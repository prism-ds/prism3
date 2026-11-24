/**
 * Image — content imagery (a photograph, an illustration, a product shot or a logo) in a frame whose box is known
 * BEFORE the file loads, with a written decision about its alt text (#4113, owner decisions OD-I1 to OD-I9 all A,
 * 2026-11-19; Q-AT2 on #4001). It is the upgrade of Image placeholder (#1316): OD-I1 A renamed `image-placeholder`
 * to `image` through the rename register, so a built set and its placed instances update in place.
 *
 * KB brief: `components/image.md`. Category `foundations`, the brief's, and Image placeholder's before it. The brief
 * was read as the proposal (#4113) quotes and paraphrases it: this lane had no checkout of the knowledge base.
 *
 * ── WHAT CARRIES OVER FROM IMAGE PLACEHOLDER (OD-I1 A) ──────────────────────────────────────────────
 *
 * The frame is the placeholder's frame, unchanged: seven ratios (`2:3` through `16:9`, #2345), one nominal width
 * (`container.narrow`, the veil idiom) and an aspect-ratio LOCK that derives the height, `clipsContent: true`, the
 * `color.background.secondary` fill, and the 180px "no image" marker that scales with the frame (#1340, #2345).
 *
 * THE ASPECT LOCK, AND WHY IT IS A LOCK RATHER THAN TWO DIMENSIONS (owner Option A, 2026-09-07). The ratio must stay
 * FIXED while the container's real width and height FLEX. A Figma node cannot hold two independent dimension bindings
 * while its aspect ratio is locked (the second `setBoundVariable` evicts the first), and two dimension tokens would
 * change the RATIO when a brand re-derived its dimensions. So the box binds ONE nominal dimension (`width`) and
 * declares `aspectRatio: 'ratio'`; the projector parses the member's own `ratio` value onto the plan, and both
 * executors resize the frame to that proportion and call `lockAspectRatio()`. The ratio is never a DTCG token.
 *
 * THE ONE THING THE OFFLINE BUILD CANNOT PROVE. That a `setBoundVariable` on the single axis makes Figma derive the
 * other at PASTE time is a live-file behavior no offline host can witness. The offline gates prove the lock carries
 * the right ratio (`test-roundtrip.ts` reads `targetAspectRatio` back); the derive-on-paste is filed for the
 * real-host arm (`tools/component-roundtrip/`).
 *
 * ── WHAT IS NEW: FOUR LOAD STATES ON A `status` AXIS (OD-I2 A) ──────────────────────────────────────
 *
 * `status` [empty, loading, loaded, error] REPLACES the Figma-only `marker` boolean. `empty` leads, so every placed
 * instance of the old set lands on the `empty` member and looks unchanged after the update. In code the status is
 * DERIVED from `src` and the load events, never a prop (owner decision Q163.4b A, carried over).
 *
 *   · empty   — the fill and the "no image" marker, the old placeholder.
 *   · loading — the fill under a nested Skeleton rect that fills the frame (OD-I4 A), still in Figma, pulsing in code.
 *   · loaded  — the frame alone: a designer drops the photo on as an image fill. No marker.
 *   · error   — the fill and a distinct "image unavailable" glyph (OD-I3 A), a component-owned glyph (the icon set has
 *               `image` and nothing for a failure): the `image` outline with a slash across it. No text in the frame.
 *
 * `states: []` stays: these are load states, not interaction states, and Image is not interactive.
 *
 * THE LOADING LAYER IS AN IN-FLOW `nest`, NOT THE PROPOSAL'S `absolute` (a build-time call, flagged in the PR). The
 * schema ties an `absolute` part to an interaction STATE (`when`), and Image has none; `presentWhen` on a variant
 * axis is the in-flow kinds' gate. At `status=loading` the Skeleton is the frame's one in-flow child (both glyphs are
 * out of the flow, and absent there), so `grow` across the row and `crossAxisFill` down it make it fill the frame
 * exactly, as an absolute at a zero inset would. What a designer sees is the same.
 *
 * ── THE ROLES IT BINDS ───────────────────────────────────────────────────────────────────────────
 *
 * `fill` → `color.background.secondary` and `icon` → `color.icon.tertiary`, both carried over: a filled media frame
 * one step off the page, and the most muted icon ink for a decorative marker. The frame radius binds `radius.none`
 * (OD-I9 A): the corners look as they did, but are now a token a host or a brand can rebind.
 *
 * ── STILL DEFERRED (#1316 residue) ───────────────────────────────────────────────────────────────
 *
 * The scrim over an image (Veil) and the play overlay are not built here, as before.
 */
import { ComponentDef } from '../component-schema';

export const image: ComponentDef = {
  id: 'image',
  name: 'Image',
  // Image placeholder's five, kept so a search for the old names still lands here, plus the brief's map (#4113).
  aliases: ['media-frame', 'image-frame', 'photo-placeholder', 'empty-image', 'image-slot', 'img', 'picture', 'thumbnail', 'figure'],
  category: 'foundations',
  status: 'draft',
  summary: 'Image in a frame locked to a ratio, with empty, loading, loaded and error states.',
  description:
    'Content imagery, such as a photograph, an illustration, a product shot or a logo, in a frame whose box is known before the file loads, so nothing shifts when it arrives. Pick a ratio (portrait 2:3, 3:4 or 4:5; square 1:1; landscape 4:3, 3:2 or 16:9) and the frame keeps that proportion while its size flexes to its container. It shows one of four states: empty, with a neutral fill and a "no image" marker; loading, with a skeleton; loaded, with the image; and error, with an "image unavailable" marker and no text. Every image needs a decision about its alt text: describe an informative image, and give a decorative one an empty alt.',

  props: [
    { name: 'src', type: 'string', required: false, description: 'The image file. With no source the frame shows its empty state.' },
    { name: 'alt', type: 'string', required: true, description: 'The text alternative. Describe what the image does, not what it shows; inside a link, name the destination. An empty string marks the image as decorative and hides it from assistive technology. Leaving it out is an error, because a screen reader may read the file name instead.' },
    { name: 'ratio', type: "enum: '2:3' | '3:4' | '4:5' | '1:1' | '4:3' | '3:2' | '16:9'", values: ['2:3', '3:4', '4:5', '1:1', '4:3', '3:2', '16:9'], default: '4:3', required: false, description: 'The width-to-height proportion the frame holds while its size flexes: portrait (2:3, 3:4, 4:5), square (1:1) or landscape (4:3, 3:2, 16:9). Pick it from the media the frame will hold.' },
    { name: 'width', type: 'number', required: false, description: 'The image file\'s intrinsic width, passed to the image element when it is known, so the browser reserves the box before the file loads.' },
    { name: 'height', type: 'number', required: false, description: 'The image file\'s intrinsic height, passed to the image element with the width.' },
    { name: 'fit', type: "enum: 'cover' | 'contain'", values: ['cover', 'contain'], default: 'cover', required: false, description: 'How the image fills the frame. Cover fills it and crops what falls outside; contain shows the whole image and leaves the fill around it.' },
    { name: 'position', type: 'string', default: 'center', required: false, description: 'The focal point a cropped image keeps in view, as a CSS object position.' },
    { name: 'loading', type: "enum: 'eager' | 'lazy'", values: ['eager', 'lazy'], default: 'eager', required: false, description: 'When the browser fetches the file. Lazy-load an image below the fold; leave the largest image at the top of the page eager.' },
    { name: 'fetchPriority', type: "enum: 'high' | 'low' | 'auto'", values: ['high', 'low', 'auto'], default: 'auto', required: false, description: 'How urgently the browser fetches the file. Give the page\'s hero image high.' },
    { name: 'srcSet', type: 'string', required: false, description: 'Candidate files at other widths or densities, passed through to the image element.' },
    { name: 'sizes', type: 'string', required: false, description: 'The width the image takes at each breakpoint, passed through with the candidate files.' },
    { name: 'onLoad', type: 'function', required: false, description: 'Called when the image has loaded.' },
    { name: 'onError', type: 'function', required: false, description: 'Called when the image fails to load, after the frame has switched to its error state.' },
  ],

  // `[]` — Image is not interactive. Its four load states are the `status` axis below, not interaction states; an
  // image that is a link takes the link's focus.
  states: [],

  variants: {
    // #2752 (owner decision Q347 A): `4:3` LEADS, the code default; the others run tallest to widest.
    ratio: ['4:3', '2:3', '3:4', '4:5', '1:1', '3:2', '16:9'],
    // OD-I2 A: `empty` LEADS, so an instance of the old set lands on the member that looks as it did.
    status: ['empty', 'loading', 'loaded', 'error'],
  },
  // `ratio` moves the box (the lock); `status` never does: every status member at one ratio is the same box.
  axisKinds: { ratio: 'authoring', status: 'runtime' },

  // ONE template answering both primary slots by name: the frame's `fill` and the glyphs' `icon` ink. Constant per
  // slot: neither axis repaints the frame (the loading layer's paint is Skeleton's own).
  paintKeys: ['{slot}'],

  tokens: {
    fill: 'color.background.secondary',
    icon: 'color.icon.tertiary',
    // THE SINGLE NOMINAL DIMENSION (the veil idiom, #1030/#1280): width alone; the aspect lock derives the height.
    'nominal-side': 'container.narrow',
    // OD-I9 A: the corners stay square, now through a token a host or a brand can rebind.
    'frame-radius': 'radius.none',
    // The photo's fade-in over the skeleton on load (carried by `motion`; code reads these names).
    'motion.reveal': 'motion.duration.fast',
    'motion.reveal-reduced': 'motion.duration-reduced.fast',
    'motion.reveal-easing': 'motion.easing-role.enter',
  },

  // ── ANATOMY — A CLIPPING BOX, TWO MARKERS AND A LOADING LAYER ───────────────────────────────────
  anatomy: {
    root: 'frame',
    parts: {
      frame: {
        kind: 'box',
        // `target`: the schema requires exactly one, and the frame is what a designer selects, resizes and drops an
        // image onto. Everything inside it is decorative.
        role: 'target',
        // THE ASPECT-RATIO LOCK, derived from the `ratio` axis value. One nominal dimension; the lock supplies the other.
        aspectRatio: 'ratio',
        width: 'nominal-side',
        radius: 'frame-radius',
        layout: { direction: 'row', align: 'center', justify: 'center', sizing: { x: 'fixed', y: 'fixed' } },
        // CLIPS, so a dropped photo the wrong size cannot spill past the frame edge.
        clipsContent: true,
        paintSlots: ['fill'],
        children: ['markerGlyph', 'errorGlyph', 'loadingLayer'],
        note: 'The media frame: a neutral fill, an aspect-ratio lock, and clipping so a dropped image stays inside. Its width is nominal (720px) and a designer resizes it; the ratio holds while the size flexes. Drop the photo on it as an image fill at the loaded state.',
      },
      markerGlyph: {
        kind: 'vector',
        glyph: 'image',
        // Present at `empty` only (OD-I2 A): the `status` axis replaced the `marker` boolean that used to hide it.
        presentWhen: { status: ['empty'] },
        // A LITERAL 180px SQUARE at the nominal width (#1340): 1/3 of the 4:3 frame's shorter side. A def-local
        // literal, so no token is minted. It scales from it on resize (`scaleWithParent`, #2345).
        glyphPx: 180,
        scaleWithParent: true,
        note: 'The centered "no image" marker, a muted glyph shown while the frame has no image. It scales with the frame, so it reads as the same proportion at any size.',
      },
      errorGlyph: {
        kind: 'vector',
        // OD-I3 A: a component-owned glyph, the `image` outline with a slash across it (`component-glyphs.ts`).
        glyph: 'image-unavailable',
        presentWhen: { status: ['error'] },
        // The marker's size and scaling, so the two states read as one frame with a different mark.
        glyphPx: 180,
        scaleWithParent: true,
        note: 'The centered "image unavailable" marker, the "no image" picture with a slash across it, shown when the image failed to load. It scales with the frame like the "no image" marker. The frame shows no text.',
      },
      loadingLayer: {
        kind: 'nest',
        nests: 'skeleton',
        // OD-I4 A: Skeleton's rect, so Image's loading matches every other skeleton. Its size axis is text-only; the
        // rect member is `size=medium`.
        nesting: { kind: 'nest-fixed', variant: { shape: 'rect', size: 'medium' } },
        presentWhen: { status: ['loading'] },
        // The frame's one in-flow child at `loading`: it grows across the row and stretches down it, so it fills the
        // frame at every ratio.
        grow: true,
        crossAxisFill: true,
        note: 'A skeleton that fills the frame while the image loads. It is still here and pulses in code.',
      },
    },
    codeOnly: [
      {
        class: 'live-geometry',
        disposition: 'lowered',
        description:
          'aspect-lock derive — the frame holds its RATIO while its real size flexes, and Figma expresses that as an aspect-ratio LOCK (`lockAspectRatio()`) that DERIVES the second dimension from the first. The engine binds ONE nominal dimension and locks the ratio; that a variable BINDING on the single axis makes Figma derive the other at PASTE time (as a resize does) is a live-file behavior no offline host can witness, filed for the real-host round-trip arm (`tools/component-roundtrip/`). What the offline gates hold is the lock capturing the right ratio, read back as `targetAspectRatio`. In code the frame is `aspect-ratio: <ratio>` on a box as wide as its container.',
      },
      {
        class: 'static-placeholder',
        disposition: 'lowered',
        description:
          'raster swap — dropping an actual photograph onto the frame is a NATIVE Figma action (an image fill on the loaded member), not a modeled slot or variant. Cover is Figma\'s native fill mode, so `fit` has no axis (OD-I6 A); a designer sets Fit on the image fill for contain.',
      },
      {
        class: 'static-placeholder',
        disposition: 'unsupported',
        description:
          'the load status — in code the status is derived, never a prop (owner decision Q163.4b A, carried over): no `src` is empty, a `src` not yet loaded is loading, the load event makes it loaded and the error event makes it error. Figma cannot tell that a fill is a photograph or watch a load, so the set carries the four statuses as a variant a designer picks (OD-I2 A); it replaced the Figma-only `marker` boolean.',
      },
      {
        class: 'motion',
        disposition: 'refused',
        description:
          'the reveal — on load the photo fades in over the skeleton on `var(--motion-duration-fast)` with `var(--motion-easing-role-enter)` (`var(--motion-duration-reduced-fast)` under reduced motion: an opacity fade is not vestibular, so it stays). No scale, zoom or parallax on load. Blur-up is the delivery layer\'s, not Image\'s. The skeleton\'s pulse is Skeleton\'s own, and stops under reduced motion. Figma holds the still frame.',
      },
      {
        class: 'semantics',
        disposition: 'refused',
        description:
          'the alt contract — `alt` is a required string that may be empty (OD-I5 A), stricter than HTML on purpose: an omitted alt can make a screen reader read the file name, and an empty one declares the image decorative. On error an informative image keeps its name on the fallback (`role="img"` with `aria-label` set to the alt); a decorative one stays hidden. Both markers and the skeleton are `aria-hidden`. The alt text is never drawn as visible text in the frame.',
      },
      {
        class: 'runtime-behavior',
        disposition: 'refused',
        description:
          'delivery — Image owns the frame, the fit, the focal point, the radius, the alt contract and the states (OD-I8 A). Responsive sources, art direction with `<picture>`, formats and the CDN are passed through (`srcSet`, `sizes`) or left to the framework\'s image component, which Image wraps rather than replaces. No lazy default (OD-I7 A): the platform\'s eager load stands, because a component cannot know which image is the page\'s largest paint.',
      },
      {
        class: 'right-to-left',
        disposition: 'unsupported',
        description:
          'right-to-left — Image does not mirror. A photo mirrored under RTL is wrong (real-world text, faces, products); directional artwork needs its own mirrored file, supplied by the consumer.',
      },
      {
        class: 'deferred',
        disposition: 'refused',
        description:
          'scrim/veil and play-circle overlays — DEFERRED to a follow-up (#1316 residue, owner-held). A wash for text over the image nests the `veil` component, and a video affordance nests the `play-circle` glyph; both are compositions this frame does not carry. Named here so the absence reads as a deferral rather than a gap.',
      },
      {
        class: 'live-geometry',
        disposition: 'lowered',
        description:
          'the ratio is a magnitude of SHAPE, not a state — 2:3 through 16:9 is a proportion a designer selects, carried by Figma as a variant coordinate, never a runtime state. Image has no interaction states at all (`states: []`).',
      },
    ],
  },

  figmaProperties: {
    // `ratio` (7) × `status` (4): 28 members. No `stateAxis` (no states), no swaps and no texts.
    variantAxes: ['ratio', 'status'],
    // THE BOX LEGITIMATELY MOVES ON `ratio` (#1515): the aspect lock derives a different height per ratio. `status`
    // is not listed: every status member at one ratio is the same box.
    footprintVaries: ['ratio'],
    // Stated empty (OD-I2 A): the `marker` boolean retired; the `status` axis shows and hides each marker.
    booleans: {},
  },

  accessibility: {
    role: 'img: an informative image takes an accessible name from its alt, and a decorative one an empty alt (`alt=""`), which removes it from the accessibility tree. The markers and the loading skeleton are decorative and hidden.',
    wcag: [
      '1.1.1 Non-text Content (targets: every image carries a decision about its text alternative, and a failed informative image keeps its name)',
      '1.4.5 Images of Text (targets: text in an image only for a logo)',
      '1.4.1 Use of Color (an image is never the only carrier of a status; each marker signals by shape)',
      '2.3.3 Animation from Interactions (targets: no zoom or parallax on load; the fade is opacity only)',
      '1.4.11 Non-text Contrast (only where the frame edge is a meaningful boundary)',
    ],
    focus: 'None of its own. An image that is a link takes the link\'s focus.',
    aria: 'Informative: an `<img>` whose alt describes the function, not the picture; inside a link, the alt names the destination. Never start it with "image of". Decorative: `alt=""`, which also hides the broken-image icon if it fails. On error, an informative image keeps its name on the fallback (`role="img"` with `aria-label` set to the alt); a decorative one stays hidden. Set `aria-hidden="true"` on both markers and on the loading skeleton. One image loading announces nothing; a region of many images loading carries its own status message. A chart or a diagram needs a long description beside it, not a longer alt. The alt is translatable text.',
  },

  content: {
    labelPattern: 'Image carries no visible text. Its alt text describes what the image does in context, in a short phrase: "Red running shoe, side view" for a product, the destination for a link. Leave out "image of" and "photo of".',
    errorPattern: 'The error state draws no text: the "image unavailable" marker is the visible cue, and an informative image keeps its alt as its accessible name.',
    emptyPattern: 'The empty state draws the "no image" marker and no text.',
  },

  docs: {
    usage: 'Use Image for content imagery: a card\'s media, a product shot, a hero, a gallery cell. Pick the ratio from the media it will hold (3:4, 4:5 or 2:3 for portrait product shots, 1:1 for square thumbnails, 4:3 or 3:2 for standard photography, 16:9 for video stills and wide banners); the frame keeps that proportion while it flexes to its container, so a row of cards stays aligned and nothing shifts when the files load. A thumbnail is a small Image, not a different component. Pick the state the mockup shows: empty before an image is chosen, loading while it arrives, loaded with the photo, and error when it fails. For the loaded state, drop the photo on the frame as an image fill. Decide the alt text for every image: describe an informative image and mark a decorative one empty.',
    do: [
      'Pick the ratio from the media the frame will hold, and let the lock keep it while the size flexes',
      'Show the loaded state with the photo dropped on the frame as an image fill',
      'Show the error state in a design that covers failures, so the frame is not left blank',
      'Write alt text that says what the image does in context; give a decorative image an empty alt',
      'Put a long description beside a chart or a diagram, not into the alt',
    ],
    dont: [
      'Hard-code a width and a height to fake a ratio: two fixed sizes fight the lock and break on resize',
      'Put text that matters inside an image, other than a logo',
      'Mirror a photo for a right-to-left layout; supply a mirrored file only for directional artwork',
      'Use Image for an icon (Icon), a person\'s picture (Avatar) or a decorative background',
      'Expect a play overlay or a scrim over the image yet; a legibility scrim over media is Veil',
    ],
    implementation: [
      'Render an `<img>` inside a frame that sets `aspect-ratio` to the ratio and clips what overflows it, and set `object-fit` from the fit prop; pass the intrinsic width and height through when they are known',
      'Make `alt` a required string prop that may be empty; never fall back to the file name',
      'Derive the status from the source and the load and error events; it is not a prop',
      'On error, keep an informative image\'s name with `role="img"` and `aria-label` on the fallback, and keep a decorative one hidden',
      'Set `aria-hidden="true"` on both markers and on the loading skeleton',
      'Fade the image in over the skeleton on `motion.duration.fast`, with opacity only',
      'Leave delivery (candidate files, sizes, `<picture>`, formats) to the framework\'s image component, which Image wraps',
    ],
    contentGuidelines: 'The frame holds no copy. Alt text describes the function, not the picture: a short phrase, no "image of", and the destination when the image is a link. Text baked into an image fails readers who zoom or translate, except for a logo.',
  },

  ai: {
    primaryPurpose: 'Show content imagery in a frame locked to a ratio, so the layout holds its box before the file loads, with empty, loading, loaded and error states and a required alt decision.',
    whenToUse: 'A layout shows a photograph, an illustration, a product shot or a logo: a card\'s media, a hero, a gallery cell, a thumbnail. Pick the ratio from the media (2:3, 3:4 or 4:5 portrait, 1:1, 4:3, 3:2 or 16:9 landscape) and the state the screen shows.',
    avoidWhen: 'The picture is a symbol for an action or a concept (use Icon), it stands for a person or an organization (use Avatar), it is a decorative background (a CSS background, not a component), it is a wash over a photo for legibility (use Veil), or the space is a loading placeholder for content other than an image (use Skeleton).',
    // `veil` sits over the image and is not nested; a list item is a common place for a thumbnail.
    commonPartners: ['veil', 'list-item'],
    triggerKeywords: ['image', 'img', 'picture', 'photo', 'thumbnail', 'figure', 'product image', 'hero image', 'media frame', 'image placeholder', 'aspect ratio', '16:9', '4:3', '3:2', '3:4', '4:5', '2:3', 'square image', 'empty image', 'image slot', 'no image', 'broken image', 'image error', 'image loading'],
    generationPriority: 3,
  },

  composition: {
    // The loading layer nests Skeleton; the markers are glyphs drawn in place, not nested Icons.
    composesWith: ['skeleton'],
    alternativeTo: ['icon', 'avatar'],
    replacesPatterns: [
      'a bare `<img>` with no reserved box, which shifts the layout when the file loads',
      'a hand-drawn rectangle with a fixed width and height standing in for an image, which breaks its ratio the moment it is resized',
      'an image that fails to a blank box or a browser broken-image icon',
    ],
    supersededBy: [],
  },

  motion: {
    enter: 'On load the image fades in over the skeleton on `motion.duration.fast` with `motion.easing-role.enter`. No scale, zoom or parallax.',
    exit: 'None of its own: the image stays until the frame is removed.',
    reduceMotion: 'The fade stays, on `motion.duration-reduced.fast`: it is opacity only, not vestibular motion. The skeleton\'s pulse stops, as Skeleton does everywhere.',
  },

  notes: {
    projection: [
      'Dropping an image fill onto the frame is a native Figma action, not a modeled slot. The fill mode is cover by default; contain is the image fill\'s own Fit setting, so `fit` projects no axis (OD-I6 A).',
      'The four statuses project as a variant axis because Figma cannot watch a load; in code they are derived (OD-I2 A, Q163.4b A).',
    ],
    contested: [
      'THE FILL SLOT IS `fill`, bound to `color.background.secondary`, a call rather than the only option. An empty media frame could read as the page (no fill), as a recessed well (`background.tertiary`), or as a distinct filled surface. The middle reads as a deliberate placeholder while staying quiet. Skeleton binds `background.tertiary` (OD-S4 A), so the loading member shows a recessed rect on the secondary frame: the two are distinct on purpose, so loading reads as different from empty.',
      'THE SKELETON\'S OWN CORNERS. The nested rect keeps Skeleton\'s `radius.md` inside a frame bound to `radius.none` (OD-I9 A), so the frame\'s fill shows in the four corners at `loading`. The proposal asked for the rect "filling the frame" and said nothing of its corners; matching them is an owner call (flagged in the PR).',
      'THE SINGLE NOMINAL DIMENSION IS `width`, not `height`, the natural axis for a media frame as wide as its column. A portrait-first layout would bind `height`; the aspect-lock capability accepts either (the validator refuses only binding BOTH).',
    ],
    unverified: [
      'THE PASTE-TIME DERIVE IS FIGMA-DOCUMENTED FOR RESIZE, NOT PROVEN FOR A BOUND VARIABLE. The offline gates prove the lock is captured with the right ratio (read back as `targetAspectRatio`); the derive-on-paste is filed for the real-host round-trip arm. If a pasted frame is ever found NOT deriving its height, the fallback is Option C — a nominal square plus the ratio carried in code and AI metadata only.',
      'THE MARKERS SCALE THROUGH A CONSTRAINT, AND THAT A RESIZED INSTANCE HONORS IT IS A LIVE-HOST FACT (#2345). Each marker is out of the auto-layout flow, centered, and constrained SCALE/SCALE, so it keeps its fraction of the frame: 180px at the 720px nominal width, 16px in a 64px thumbnail. Check it by placing a 4:3 instance and dragging it to 64px wide.',
      'THE LOADING SKELETON FILLS THROUGH GROW AND STRETCH, NOT THE LOCK. At a ratio the frame is fixed in both axes, so the nested rect fills it; that a resized instance keeps the rect filling it is the same live-host class as the markers.',
      'THE KB BRIEF WAS READ AS THE PROPOSAL (#4113) QUOTES IT. This lane had no checkout of the knowledge base, so a brief point the proposal did not carry is not in this component.',
    ],
    evolution: [
      'Built as `image-placeholder` (#1316): the empty-state frame alone, with a Figma-only `marker` boolean (#2345). Renamed `image` and given the `status` axis, the alt contract and the error glyph by #4113 (owner decisions OD-I1 to OD-I9 all A, 2026-11-19); the boolean retired with the rename.',
      'THE LOADING LAYER WAS PROPOSED AS AN `absolute` PART. Built as an in-flow `nest` gated on `status`, because the schema gates an absolute on an interaction state and Image has none; at `loading` the nest is the frame\'s only in-flow child, so it fills the frame as a zero-inset absolute would.',
    ],
  },
};
