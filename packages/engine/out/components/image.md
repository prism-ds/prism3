# Image

> Image in a frame locked to a ratio, with empty, loading, loaded and error states.

- **ID:** `image`
- **Category:** foundations
- **Status:** draft
- **Also known as:** media-frame, image-frame, photo-placeholder, empty-image, image-slot, img, picture, thumbnail, figure

## Overview

Content imagery, such as a photograph, an illustration, a product shot or a logo, in a frame whose box is known before the file loads, so nothing shifts when it arrives. Pick a ratio (portrait 2:3, 3:4 or 4:5; square 1:1; landscape 4:3, 3:2 or 16:9) and the frame keeps that proportion while its size flexes to its container. It shows one of four states: empty, with a neutral fill and a "no image" marker; loading, with a skeleton; loaded, with the image; and error, with an "image unavailable" marker and no text. Every image needs a decision about its alt text: describe an informative image, and give a decorative one an empty alt.

- **Purpose:** Show content imagery in a frame locked to a ratio, so the layout holds its box before the file loads, with empty, loading, loaded and error states and a required alt decision.
- **Use when:** A layout shows a photograph, an illustration, a product shot or a logo: a card's media, a hero, a gallery cell, a thumbnail. Pick the ratio from the media (2:3, 3:4 or 4:5 portrait, 1:1, 4:3, 3:2 or 16:9 landscape) and the state the screen shows.
- **Avoid when:** The picture is a symbol for an action or a concept (use Icon), it stands for a person or an organization (use Avatar), it is a decorative background (a CSS background, not a component), it is a wash over a photo for legibility (use Veil), or the space is a loading placeholder for content other than an image (use Skeleton).

## Anatomy

Shown on the default member: ratio `4:3`, status `empty`.

1. **Frame** — The media frame: a neutral fill, an aspect-ratio lock, and clipping so a dropped image stays inside. Its width is nominal (720px) and a designer resizes it; the ratio holds while the size flexes. Drop the photo on it as an image fill at the loaded state.
2. **Marker glyph** — The centered "no image" marker, a muted glyph shown while the frame has no image. It scales with the frame, so it reads as the same proportion at any size.
3. **Error glyph** — The centered "image unavailable" marker, the "no image" picture with a slash across it, shown when the image failed to load. It scales with the frame like the "no image" marker. The frame shows no text.
4. **Loading layer** — A skeleton that fills the frame while the image loads. It is still here and pulses in code.

## Styles

| Axis | Values | Changes | Description |
| --- | --- | --- | --- |
| `ratio` | `4:3`, `2:3`, `3:4`, `4:5`, `1:1`, `3:2`, `16:9` | once, when authored | The width-to-height proportion the frame holds while its size flexes: portrait (2:3, 3:4, 4:5), square (1:1) or landscape (4:3, 3:2, 16:9). Pick it from the media the frame will hold. |
| `status` | `empty`, `loading`, `loaded`, `error` | at runtime | — |

## Usage guidelines

Use Image for content imagery: a card's media, a product shot, a hero, a gallery cell. Pick the ratio from the media it will hold (3:4, 4:5 or 2:3 for portrait product shots, 1:1 for square thumbnails, 4:3 or 3:2 for standard photography, 16:9 for video stills and wide banners); the frame keeps that proportion while it flexes to its container, so a row of cards stays aligned and nothing shifts when the files load. A thumbnail is a small Image, not a different component. Pick the state the mockup shows: empty before an image is chosen, loading while it arrives, loaded with the photo, and error when it fails. For the loaded state, drop the photo on the frame as an image fill. Decide the alt text for every image: describe an informative image and mark a decorative one empty.

**In RTL.** The marker and error glyphs do not mirror.

### Do

- Pick the ratio from the media the frame will hold, and let the lock keep it while the size flexes
- Show the loaded state with the photo dropped on the frame as an image fill
- Show the error state in a design that covers failures, so the frame is not left blank
- Write alt text that says what the image does in context; give a decorative image an empty alt
- Put a long description beside a chart or a diagram, not into the alt

### Don't

- Hard-code a width and a height to fake a ratio: two fixed sizes fight the lock and break on resize
- Put text that matters inside an image, other than a logo
- Mirror a photo for a right-to-left layout; supply a mirrored file only for directional artwork
- Use Image for an icon (Icon), a person's picture (Avatar) or a decorative background
- Expect a play overlay or a scrim over the image yet; a legibility scrim over media is Veil

## Accessibility

- **Focus:** None of its own. An image that is a link takes the link's focus.
- **Screen readers:** img: an informative image takes an accessible name from its alt, and a decorative one an empty alt (`alt=""`), which removes it from the accessibility tree. The markers and the loading skeleton are decorative and hidden.

  Informative: an `<img>` whose alt describes the function, not the picture; inside a link, the alt names the destination. Never start it with "image of". Decorative: `alt=""`, which also hides the broken-image icon if it fails. On error, an informative image keeps its name on the fallback (`role="img"` with `aria-label` set to the alt); a decorative one stays hidden. Set `aria-hidden="true"` on both markers and on the loading skeleton. One image loading announces nothing; a region of many images loading carries its own status message. A chart or a diagram needs a long description beside it, not a longer alt. The alt is translatable text.

### WCAG

- 1.1.1 Non-text Content (targets: every image carries a decision about its text alternative, and a failed informative image keeps its name)
- 1.4.5 Images of Text (targets: text in an image only for a logo)
- 1.4.1 Use of Color (an image is never the only carrier of a status; each marker signals by shape)
- 2.3.3 Animation from Interactions (targets: no zoom or parallax on load; the fade is opacity only)
- 1.4.11 Non-text Contrast (only where the frame edge is a meaningful boundary)

### Motion

- **Enter:** On load the image fades in over the skeleton on `motion.duration.fast` with `motion.easing-role.enter`. No scale, zoom or parallax.
- **Exit:** None of its own: the image stays until the frame is removed.
- **Reduced motion:** The fade stays, on `motion.duration-reduced.fast`: it is opacity only, not vestibular motion. The skeleton's pulse stops, as Skeleton does everywhere.

## Content guidelines

The frame holds no copy. Alt text describes the function, not the picture: a short phrase, no "image of", and the destination when the image is a link. Text baked into an image fails readers who zoom or translate, except for a logo.

- **Labels:** Image carries no visible text. Its alt text describes what the image does in context, in a short phrase: "Red running shoe, side view" for a product, the destination for a link. Leave out "image of" and "photo of".
- **Errors:** The error state draws no text: the "image unavailable" marker is the visible cue, and an informative image keeps its alt as its accessible name.
- **Empty states:** The empty state draws the "no image" marker and no text.

## Related components

- **Built from:** `skeleton`
- **Instead, consider:** `icon`, `avatar`
- **Often used with:** `veil`, `list-item`
- **Replaces:**
  - a bare `<img>` with no reserved box, which shifts the layout when the file loads
  - a hand-drawn rectangle with a fixed width and height standing in for an image, which breaks its ratio the moment it is resized
  - an image that fails to a blank box or a browser broken-image icon

## Building it in code

- Render an `<img>` inside a frame that sets `aspect-ratio` to the ratio and clips what overflows it, and set `object-fit` from the fit prop; pass the intrinsic width and height through when they are known
- Make `alt` a required string prop that may be empty; never fall back to the file name
- Derive the status from the source and the load and error events; it is not a prop
- On error, keep an informative image's name with `role="img"` and `aria-label` on the fallback, and keep a decorative one hidden
- Set `aria-hidden="true"` on both markers and on the loading skeleton
- Fade the image in over the skeleton on `motion.duration.fast`, with opacity only
- Leave delivery (candidate files, sizes, `<picture>`, formats) to the framework's image component, which Image wraps

### Props

| Name | Type | Default | Required | Description |
| --- | --- | --- | --- | --- |
| `src` | string | — | no | The image file. With no source the frame shows its empty state. |
| `alt` | string | — | yes | The text alternative. Describe what the image does, not what it shows; inside a link, name the destination. An empty string marks the image as decorative and hides it from assistive technology. Leaving it out is an error, because a screen reader may read the file name instead. |
| `ratio` | enum: '2:3' \| '3:4' \| '4:5' \| '1:1' \| '4:3' \| '3:2' \| '16:9' | `4:3` | no | The width-to-height proportion the frame holds while its size flexes: portrait (2:3, 3:4, 4:5), square (1:1) or landscape (4:3, 3:2, 16:9). Pick it from the media the frame will hold. |
| `width` | number | — | no | The image file's intrinsic width, passed to the image element when it is known, so the browser reserves the box before the file loads. |
| `height` | number | — | no | The image file's intrinsic height, passed to the image element with the width. |
| `fit` | enum: 'cover' \| 'contain' | `cover` | no | How the image fills the frame. Cover fills it and crops what falls outside; contain shows the whole image and leaves the fill around it. |
| `position` | string | `center` | no | The focal point a cropped image keeps in view, as a CSS object position. |
| `loading` | enum: 'eager' \| 'lazy' | `eager` | no | When the browser fetches the file. Lazy-load an image below the fold; leave the largest image at the top of the page eager. |
| `fetchPriority` | enum: 'high' \| 'low' \| 'auto' | `auto` | no | How urgently the browser fetches the file. Give the page's hero image high. |
| `srcSet` | string | — | no | Candidate files at other widths or densities, passed through to the image element. |
| `sizes` | string | — | no | The width the image takes at each breakpoint, passed through with the candidate files. |
| `onLoad` | function | — | no | Called when the image has loaded. |
| `onError` | function | — | no | Called when the image fails to load, after the frame has switched to its error state. |

## Specs

Generated from the plan that builds the design-file component: 28 members. Values are token names; a px value appears only where the build writes a number.

### Anatomy

| Part | Kind | In |
| --- | --- | --- |
| `frame` | frame | every member |
| `frame/markerGlyph` | instance | status=empty |
| `frame/loadingLayer` | instance | status=loading |
| `frame/errorGlyph` | glyph | status=error |

### Spacing and size

Padding reads top / right / bottom / left when its sides differ.

Keyed by nothing: one row covers every member.

**every member**

| Part | Padding | Gap | Height | Width | Min width | Other |
| --- | --- | --- | --- | --- | --- | --- |
| `frame` | — | — | — | `container.narrow` | — | radius `radius.none` |

### Color

Keyed by `ratio`, `status`.

**ratio=4:3, status=empty**

| Part | Fill | Stroke | Ink | Icon |
| --- | --- | --- | --- | --- |
| `frame` | `color.background.secondary` | — | — | — |
| `frame/markerGlyph` | — | — | — | `color.icon.tertiary` |

**ratio=4:3, status=loading**

| Part | Fill | Stroke | Ink | Icon |
| --- | --- | --- | --- | --- |
| `frame` | `color.background.secondary` | — | — | — |

**ratio=4:3, status=loaded**

| Part | Fill | Stroke | Ink | Icon |
| --- | --- | --- | --- | --- |
| `frame` | `color.background.secondary` | — | — | — |

**ratio=4:3, status=error**

| Part | Fill | Stroke | Ink | Icon |
| --- | --- | --- | --- | --- |
| `frame` | `color.background.secondary` | — | — | — |
| `frame/errorGlyph` | — | — | — | `color.icon.tertiary` |

**ratio=2:3, status=empty**

| Part | Fill | Stroke | Ink | Icon |
| --- | --- | --- | --- | --- |
| `frame` | `color.background.secondary` | — | — | — |
| `frame/markerGlyph` | — | — | — | `color.icon.tertiary` |

**ratio=2:3, status=loading**

| Part | Fill | Stroke | Ink | Icon |
| --- | --- | --- | --- | --- |
| `frame` | `color.background.secondary` | — | — | — |

**ratio=2:3, status=loaded**

| Part | Fill | Stroke | Ink | Icon |
| --- | --- | --- | --- | --- |
| `frame` | `color.background.secondary` | — | — | — |

**ratio=2:3, status=error**

| Part | Fill | Stroke | Ink | Icon |
| --- | --- | --- | --- | --- |
| `frame` | `color.background.secondary` | — | — | — |
| `frame/errorGlyph` | — | — | — | `color.icon.tertiary` |

**ratio=3:4, status=empty**

| Part | Fill | Stroke | Ink | Icon |
| --- | --- | --- | --- | --- |
| `frame` | `color.background.secondary` | — | — | — |
| `frame/markerGlyph` | — | — | — | `color.icon.tertiary` |

**ratio=3:4, status=loading**

| Part | Fill | Stroke | Ink | Icon |
| --- | --- | --- | --- | --- |
| `frame` | `color.background.secondary` | — | — | — |

**ratio=3:4, status=loaded**

| Part | Fill | Stroke | Ink | Icon |
| --- | --- | --- | --- | --- |
| `frame` | `color.background.secondary` | — | — | — |

**ratio=3:4, status=error**

| Part | Fill | Stroke | Ink | Icon |
| --- | --- | --- | --- | --- |
| `frame` | `color.background.secondary` | — | — | — |
| `frame/errorGlyph` | — | — | — | `color.icon.tertiary` |

**ratio=4:5, status=empty**

| Part | Fill | Stroke | Ink | Icon |
| --- | --- | --- | --- | --- |
| `frame` | `color.background.secondary` | — | — | — |
| `frame/markerGlyph` | — | — | — | `color.icon.tertiary` |

**ratio=4:5, status=loading**

| Part | Fill | Stroke | Ink | Icon |
| --- | --- | --- | --- | --- |
| `frame` | `color.background.secondary` | — | — | — |

**ratio=4:5, status=loaded**

| Part | Fill | Stroke | Ink | Icon |
| --- | --- | --- | --- | --- |
| `frame` | `color.background.secondary` | — | — | — |

**ratio=4:5, status=error**

| Part | Fill | Stroke | Ink | Icon |
| --- | --- | --- | --- | --- |
| `frame` | `color.background.secondary` | — | — | — |
| `frame/errorGlyph` | — | — | — | `color.icon.tertiary` |

**ratio=1:1, status=empty**

| Part | Fill | Stroke | Ink | Icon |
| --- | --- | --- | --- | --- |
| `frame` | `color.background.secondary` | — | — | — |
| `frame/markerGlyph` | — | — | — | `color.icon.tertiary` |

**ratio=1:1, status=loading**

| Part | Fill | Stroke | Ink | Icon |
| --- | --- | --- | --- | --- |
| `frame` | `color.background.secondary` | — | — | — |

**ratio=1:1, status=loaded**

| Part | Fill | Stroke | Ink | Icon |
| --- | --- | --- | --- | --- |
| `frame` | `color.background.secondary` | — | — | — |

**ratio=1:1, status=error**

| Part | Fill | Stroke | Ink | Icon |
| --- | --- | --- | --- | --- |
| `frame` | `color.background.secondary` | — | — | — |
| `frame/errorGlyph` | — | — | — | `color.icon.tertiary` |

**ratio=3:2, status=empty**

| Part | Fill | Stroke | Ink | Icon |
| --- | --- | --- | --- | --- |
| `frame` | `color.background.secondary` | — | — | — |
| `frame/markerGlyph` | — | — | — | `color.icon.tertiary` |

**ratio=3:2, status=loading**

| Part | Fill | Stroke | Ink | Icon |
| --- | --- | --- | --- | --- |
| `frame` | `color.background.secondary` | — | — | — |

**ratio=3:2, status=loaded**

| Part | Fill | Stroke | Ink | Icon |
| --- | --- | --- | --- | --- |
| `frame` | `color.background.secondary` | — | — | — |

**ratio=3:2, status=error**

| Part | Fill | Stroke | Ink | Icon |
| --- | --- | --- | --- | --- |
| `frame` | `color.background.secondary` | — | — | — |
| `frame/errorGlyph` | — | — | — | `color.icon.tertiary` |

**ratio=16:9, status=empty**

| Part | Fill | Stroke | Ink | Icon |
| --- | --- | --- | --- | --- |
| `frame` | `color.background.secondary` | — | — | — |
| `frame/markerGlyph` | — | — | — | `color.icon.tertiary` |

**ratio=16:9, status=loading**

| Part | Fill | Stroke | Ink | Icon |
| --- | --- | --- | --- | --- |
| `frame` | `color.background.secondary` | — | — | — |

**ratio=16:9, status=loaded**

| Part | Fill | Stroke | Ink | Icon |
| --- | --- | --- | --- | --- |
| `frame` | `color.background.secondary` | — | — | — |

**ratio=16:9, status=error**

| Part | Fill | Stroke | Ink | Icon |
| --- | --- | --- | --- | --- |
| `frame` | `color.background.secondary` | — | — | — |
| `frame/errorGlyph` | — | — | — | `color.icon.tertiary` |

### Nesting and properties

- `frame/markerGlyph` nests `icon/image`
- `frame/loadingLayer` nests `skeleton` at `shape=rect, size=medium`

---

Generated from the `image` component definition.
