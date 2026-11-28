# 37 — Block layout axes: the vocabulary, and the corpus it has to be derived from

> The tier above components is **blocks** — section-level compositions keyed to the page role
> they fill (`13` §8, KB `09` §1.36). This file holds the thing worth owning at that tier: not a
> catalogue of blocks, but the **axes** each block family varies along, and the rationale for
> which combinations are worth shipping. A list of blocks is a shopping list; the axes are a
> generator, and they are the composition-tier form of the move the engine already makes for
> color — ship levers, not swatches.
>
> **Status: second pass, 2026-11-28 (#693).** §2 is the first witness's hero pass, kept as
> written. §6–§12 are the corpus survey: six witnesses, four families read across them (navigation,
> footer, CTA, sign-up and log-in), commerce read from the one witness that ships it, and a family
> priority offered to the owner as a recommendation, not a decision (§10). It is still a vocabulary
> to argue with: three of the six witnesses are layout-only or names-only for every family, and §11
> lists the screenshots that would close each open axis. Do not build a gate against any count here.

---

## 1. Why the axes rather than the layouts

Twenty-two hero variants is not twenty-two designs. It is a handful of axes multiplied out, and
only some of the combinations get shipped. Capturing the twenty-two is inventory that ages the
moment the vendor adds a twenty-third; capturing the axes plus the pruning rationale is reusable
across engagements and survives the vendor entirely.

**The pruning is the POV.** An axis list alone says what is possible. What a practice is paid for
is which cells are worth filling, and why the empty ones are empty. Adobe states the sharpest
version of this rule for its own collection: a block earns inclusion by being **used on more than
half of all projects** (`adobe/aem-block-collection`). That criterion applies at both levels —
which families exist, and which combinations within a family.

## 2. Hero — axis vocabulary v0

Derived from 22 hero variants in one commercial library, read from screenshots on 2026-08-10.
**Two-thirds of what follows is the classification; the last third — the holes — is the part
worth reading.**

The 22 reduce to four arrangements:

- **Text beside media** — media trailing, or mirrored to leading
- **Centered, media below**
- **Centered, no media**
- **Split header** — headline in one column, body and actions in the other

With these slots layered on top:

| Axis | Values observed | Notes |
|---|---|---|
| Arrangement | beside / below / none / split-header | The four above |
| Media side | trailing · leading | Leading appears once in 22 — a mirror, not a peer |
| Media kind | image · video · portrait crop · multi-image (2 or 4) | Distinct from placement; a video slot is not an image slot with a play button |
| Content alignment | start · center | No end-aligned variant exists |
| Social proof | none · rating + avatar cluster · logo strip | **Two different slots, not one** — different positions, different jobs |
| Supporting list | none · checkmark bullets | Appears only in the beside-media arrangement |
| Action count | 1 · 2 (primary + text link) | Never more than two |
| Surface | light · dark · two-tone band | The band splits the section into text zone + media zone |

### What this witness does not contain, which is the more useful half

Empty cells, all confirmed absent across the full 22 — **and the annotations show what a second
witness did to them within a day:**

- **No background media.** Not one variant sets text over a full-bleed image or video. **Resolved 2026-08-11 — the axis is real and this vendor simply does not ship it:** Tailwind Plus names a hero variant *"Simple centered with background image."* The first pass drew the wrong conclusion from an absence, which is the trap a single witness sets.
- **No dark surface with media.** Both dark variants are media-free. **Resolved the same way:** Tailwind Plus pairs *every* hero variant light/dark, including the media-bearing ones, so dark-with-media is ordinary. Surface is confirmed as a real axis rather than an Initium quirk.
- **No form in the hero** — no email capture, no search entry. **Resolved 2026-11-28, same pattern as the first two:** Initium's own registry index describes Hero Section 4 and 5 *"with form fields"*, and daisyUI ships *"Hero with form"* (a log-in card in the hero). The first witness's 22 were never read for forms; they were read from screenshots before the index carried descriptions (§6).
- **No true 50/50 edge-to-edge split**, and no carousel or rotating hero. Still open; no witness read on 2026-11-28 names either in a hero. Background media gains a third witness the same day: daisyUI's *"Hero with overlay image"*.
- **Nothing commerce-shaped** — no price, no product, no availability, no add-to-cart. Still open here; Relume and Tailwind Plus both carry ecommerce sets and are the places to close it.

**And one axis value no witness had suggested:** Tailwind Plus ships *"Split with code example"* — a
code block occupying the media slot. `media kind` gains a value, from a vendor naming its own variants.

### What the exercise corrected in the hypothesis

Recorded because it is the argument for deriving from a corpus rather than from memory, and
because the same correction rate should be expected for every family that follows.

- **One axis invented that is not there** — background media.
- **One axis that needed splitting** — social proof is two slots.
- **Three axes missed entirely** — media kind, surface, and the split-header arrangement.

## 3. The corpus this has to be derived from

One witness cannot separate *the genre's grammar* from *one vendor's enumeration*. The known
libraries, and what each is good for:

| Library | Shape | Why it is in the corpus |
|---|---|---|
| Initium | 23 types / 197 blocks, React + Tailwind, shadcn registry | The first witness. Marketing-only; **no commerce at all** |
| Relume | 1k+ components, wireframe styling | Breadth, and the **Ecommerce set** — Product List Sections, Product Headers, Category Filters — plus an Application UI set |
| Tailwind Plus | Marketing ~180 across 23 groups; **Ecommerce 14 component groups + 7 page-example groups**; Application UI | **The highest-value witness per unit of effort** — see below |
| daisyUI (free) | ~68 CSS-class components; hero has **5** variants | A *component* library, not a section library. Thin for this purpose — included for its skill architecture, not its layouts |
| daisyUI Blueprint | **211 page architectures**, paid MCP | Not readable, and not a layout gallery — see below. Matters as evidence about the *artifact shape*, not as corpus |
| `adobe/aem-block-collection` | ~19 blocks: hero, columns, cards, header, footer, embed, fragment, table, video, accordion, breadcrumbs, carousel, modal, quote, search, tabs | **Page mechanics, not marketing sections** — no pricing, testimonial, logo wall, stats or CTA. Its value is the **membership rule** and real accessible source, not layout variants |

**Tailwind Plus is the highest-value witness and the cheapest, because it names its variants.**
*"Simple centered"*, *"Split with screenshot"*, *"Split with bordered screenshot"*, *"Split with code
example"*, *"Simple centered with background image"* — each paired light/dark. **The vendor has already
done the classification**, so the axes can be read straight off the catalogue with no markup and no
screenshots. The names alone resolved two of §2's holes and added a `media kind` value. Its markup *is*
paywalled beyond the first variant, but for axis derivation the markup is not the part we needed.

**The daisyUI figure `36` §2 cites is real, and it is not what it sounds like.** The *"211 page
architectures"* live inside **`daisyui-blueprint`**, a licensed MCP server (LICENSE + EMAIL env vars),
not the free library — whose public surface is ~68 CSS-class components with a 5-variant hero. So daisyUI
is **not** a layout corpus we can read. But the report's own description of what those 211 entries
contain is the most useful sentence in this file's sources: *"purpose, sections, content order, actions,
navigation, responsive behavior, interaction states, edge cases."* **That is not a layout gallery — it is
a page-level content model**, which is the second half §4 says a block definition needs and which no
screenshot can supply. Someone has built the artifact this file is describing, and sells it. Treat that
as validation of the shape and as a commercial datapoint, not as something to read.

**Commerce is not an append.** Initium's omission is invisible from a type list, and PDP work is
the practice's most common surface — the engine's own regression brand is a shoe PDP. Relume's
ecommerce set and Tailwind UI's are the two known sources; both need reading before any family
priority is set.

## 4. What blocks the derivation, measured

**Per-variant previews are not fetchable anonymously from the gated libraries.** Relume's preview URLs — the pattern
`relume.ai/preview?cid=<category>/section_<name><n>&context=react` — return *"The component you
were looking for could not be found"* both with and without the `context` parameter, tested
2026-08-10. The **category index is** fetchable, so the taxonomy (categories, and the ecommerce
split above) can be captured without a session; the individual layouts cannot. Initium's hero
index is worse — it returns 22 entries named *"Hero Section 1–22"* with no layout description of
any kind.

**The measured access matrix, 2026-08-11.** Re-test before relying on any row; every one of these is
a vendor's current business decision, not a property of the library.

| Library | Taxonomy | Variant names | Markup |
|---|---|---|---|
| `adobe/aem-block-collection` | yes | yes | **full source** — `carousel.js` pulled with its ARIA handling intact |
| daisyUI (free) | yes | yes | yes, per component page |
| Tailwind Plus | yes, with counts | **yes, descriptive** | gated past the first variant |
| Relume | yes, incl. Ecommerce | no | no — session-gated |
| Initium | screenshot only | numbered only (*"Hero Section 1–22"*) | no |

**Re-tested 2026-11-28 — three of five rows moved, which is why the note above says re-test:**

| Library | Taxonomy | Variant names | Markup |
|---|---|---|---|
| `adobe/aem-block-collection` | yes | yes | **full source**, read from the collection's published site (`main--aem-block-collection--adobe.aem.live/blocks/<name>/<name>.js`); the per-block doc pages on `aem.live` now redirect to a Sidekick library tool |
| daisyUI (free) | yes, 68 components (now including Megamenu and Drawer) | yes, descriptive | yes, per component page |
| Tailwind Plus | **no** — every catalog URL, the index included, serves the same login page | **no** | **no** |
| Relume | yes, incl. Ecommerce and Application UI | numbered only (*"Navbar 1–32"*), **but each category publishes filter facets** (§6) | no — preview URLs still return *"Component not found"* |
| Initium | **yes — a public registry index**, `app.initium.sh/r/registry.json`, 252 items, no auth | numbered titles, **plus a one-line description per block built from a shared facet vocabulary** (§6) | no — block items return 401 without a license |

So the capture divides cleanly, and the division is the plan:

- **Agent-side, no help needed:** taxonomy and counts from public indexes; full markup from the open libraries, which is also the only route to **landmark structure** and something approaching a **content model**.
- **Human-side, unavoidable:** per-variant layouts from the two session-gated libraries, as screenshots.

**A screenshot answers the layout axes and nothing else.** It cannot give spacing values, token
usage, breakpoint behavior, DOM landmark structure, or the content model — and two of those are
in scope for this tier (#693). Any family derived from screenshots alone carries those halves
unanswered, and the doc should say so per family rather than let the gap go unrecorded.

## 5. Method, so the next family is cheaper than this one

The practice already has a research convention and this should not invent a second one: the KB's
dual-agent run (`_research/README.md`) — one identical prompt against two agents, raw outputs
preserved unedited under `_inbound/`, synthesis separate, promotion into a numbered file. The
component tier's precedent is `28`, which derived button anatomy from a field survey rather than
from one system and recorded the decisions it closed.

Per family, the loop is:

1. Capture what the public indexes give (taxonomy, counts, names).
2. Read markup where it is open — landmarks and content model come only from here.
3. Take screenshots where it is gated, and mark those families as layout-only.
4. Classify into axes; **name the empty cells explicitly**, since they carry more than the filled ones.
5. Prune with a stated rule, Adobe's threshold being the sharpest available.
6. Record what the survey corrected in the going-in hypothesis — the correction rate is itself evidence about how much the next family needs surveying.

**Order families by our demand, not by the vendors' depth.** Hero and feature run deepest in the
commercial libraries because they sell; that is a fact about their market, not about ours.

## 6. The second pass: six witnesses, and what each one can answer (2026-11-28)

The survey reads what is agent-reachable and marks the rest. Each witness answers a different
question, and none answers all of them:

| Witness | What it gave this pass | What it cannot give |
|---|---|---|
| Initium | The public registry index (`app.initium.sh/r/registry.json`): 23 section categories carrying 192 blocks and 9 page categories carrying 27 pages (`13` §8 counted 197 and 28 on 2026-08-10), each with a one-line description built from a **shared facet vocabulary** of about 40 terms (*"media"*, *"two-column layout"*, *"background contrast section"*, *"primary and secondary CTAs"*, *"reversed column order"*, *"sticky elements"*) | Markup: block items return 401 without a license. The descriptions are uniform enough to read as generated (logo sections are tagged *"video aspect media"*), so they are weak evidence for any single block and useful mainly in aggregate |
| Relume | Category names and numbered counts, and per-category **filter facets** — the vendor's own statement of what varies (§7) | Per-variant layouts (previews return *"Component not found"*), markup, any description per variant |
| daisyUI (free) | Descriptive example names and **full markup** for navbar (10), footer (11), hero (5), drawer (5), and two log-in form examples | Sections: it is a component library, so it has no CTA, no commerce and no auth page |
| `adobe/aem-block-collection` | **Running source** for header, footer, cards, columns, carousel and the page decoration script; the membership rule; the Universal Editor model format | Marketing families: no CTA, pricing, testimonial or commerce block exists in it |
| Tailwind Plus | Nothing new. Every catalog URL now serves the login page. The 2026-08-11 reads in §2 and §3 stand as recorded | Everything, until a human with an account reads it (§11) |
| The practice's legacy template library | **Demand evidence**: which families the practice actually reached for, and how many sets each (below) | Layouts, until screenshots are taken (§11). The navigation, CTA and footer sets are component sets with `Breakpoint = Desktop \| Mobile` at 1440 and 375; the sign-up and log-in templates are desktop only |

**The practice's legacy template library**, read by the owner and summarized here without its name:
Navigation 22 sets (from a plain bar to mega-menu and drawer states; desktop heights 72–900), CTA 58
(from banner bands to full sections; desktop heights 320–1442), Footer 11, Sign-up page templates 9 and
Log-in page templates 8 (both desktop only), and one assembled log-in page. It has **no** hero,
features, pricing, testimonials, logo wall, stats, FAQ, blog, team, contact or commerce.

**One structural finding before any family: most axes are not per-family.** Initium's facet vocabulary
and Relume's filter panel are two independent witnesses, and both describe every family with the
**same** dimensions. Relume's are *Element*, *Columns*, *Content Alignment*, *Text Alignment* and
*Navigation Level*. Initium's most frequent terms are *"background contrast section"* (in 21 of the
index's 34 block categories), *"centered content"* (22), *"media"* (14), *"primary and secondary CTAs"* (15),
*"two-column layout"* (16) and *"reversed column order"* (5). So the vocabulary has two tiers:

- **Shared axes**, the same on every family: surface (default or contrast band), content alignment
  (start or center), column arrangement (one, two, three-up, bento), mirror (reversed order), media
  kind (§2's list), and action set.
- **Family axes**, which exist in one family only: navigation depth, the footer's link-column count,
  the CTA's scale, the product header's gallery kind.

§2 treated every hero axis as a hero axis. Six of its eight rows are shared axes. A recipe that
declares the shared tier once, and each family's own axes on top of it, is smaller than one that
repeats them per family, and it keeps a contrast band meaning the same thing on a CTA and on a footer.

## 7. Per-family axes

Each family lists its witnesses, the axes they support, and the **empty cells**: combinations no
readable witness ships. "Layout-only" means the axis comes from names, facets or the owner's
description, never from markup.

### 7.1 Navigation

**Witnesses:** Relume Navbars 1–32, with Topbars and Sidebars as separate Application UI categories;
Initium LP Navbars 1–10; daisyUI Navbar (10 examples), Megamenu and Drawer (5); the AEM header block
(source); and the practice library's 22 sets.

| Axis | Values | Source |
|---|---|---|
| Depth | 1 · 2 · 3 levels | Relume *Navigation Level 1/2/3*; AEM builds depth from nested lists in the nav document; daisyUI *"menu and submenu"* |
| Disclosure | inline links · dropdown · mega menu · drawer or sheet · hamburger on desktop | Relume *Element: Mega Menu, Hamburger Menu (Desktop)*; Initium *"navigation menu, three-column grid"* (8), *"mobile sheet menu"* (6); daisyUI Drawer and Megamenu as separate components |
| Logo position | start · center | Relume *Logo Left/Center*; daisyUI *"dropdown, center logo and icon"* |
| Link alignment | start · center · end | Relume *Menu Left/Center/Right* |
| Tools group | any of: search, account, cart with count, notifications, command palette, 0–2 actions | AEM names the group outright: the nav document's third section is `tools`, after `brand` and `sections`. daisyUI fills it with search plus avatar (5), and with a cart count plus a cart summary dropdown (6); Initium 9 adds a command palette |
| Behavior | static · sticky | Initium (sticky on 9 of 10) |
| Surface | shared axis | daisyUI *"Navbar with colors"* |
| State | closed · open | The practice library: a 72-high bar and a 900-high open mega menu are separate sets |

**Empty cells:** no logo-end variant in any witness; no two-tier bar (a utility or promo strip above
the main bar) in any readable witness; the cart and account tools appear only in daisyUI's example 6.
**Commerce navigation is the thinnest cell in the readable corpus**: Relume's Navbar facets have no
search or cart element, Initium is marketing-only, and Tailwind Plus's store navigation set is behind
its login.

**Open state is a state, not a variant.** The practice library draws an open mega menu as its own
900-high set. Treat open and closed as states of one recipe, the way a component carries hover, or
the set count grows by one for every menu.

### 7.2 Footer

**Witnesses:** Relume Footers 1–17; Initium Footers 1–9; daisyUI Footer (11, markup); the AEM footer
block (source); and the practice library's 11 sets.

| Axis | Values | Source |
|---|---|---|
| Link columns | 0 · 3 · 4 · 5+ · two rows of columns | Relume *Columns 3/4/5+*; daisyUI 3 and 6 columns (*"Footer with 2 rows"*) |
| Link depth | 1 · 2 · 3 | Relume *Navigation Level*, on footers as well as navbars |
| Brand block | none · logo with tagline | daisyUI (2, 4, 9, 11) |
| Newsletter | none · email form | Relume *Newsletter Sign Up*; Initium *"form fields"* (2, 8); daisyUI (3) |
| Social links | none · icon row | daisyUI (4, 6, 7, 9, 10, 11) |
| Contact details | none · present | Relume *Contact Details* |
| Arrangement | columns · centered stack · bento | daisyUI *"Centered footer"*; Initium *"bento-style grid"* (6–8) |
| Bands | one · two stacked | daisyUI *"Two footer"*. Initium reverses the column order on 8 of 9, without saying what moves |

**The legal row is an invariant, not an axis.** Every Initium footer is tagged *"site links and legal"*,
and every daisyUI footer has either link columns or a copyright line.

**Empty cells, and they are commerce cells:** no readable witness ships a language or region selector,
payment-method marks, or app-store badges. On a store footer those are ordinary content.

### 7.3 CTA

**Witnesses:** Relume CTA 1–67; Initium CTA 1–7; the
practice library's 58 sets, its deepest family. daisyUI has no CTA, and **AEM has no CTA block**:
on Edge Delivery a CTA is default content (a heading, text and buttons) in a section that a
Section Metadata `Style` row styles.

| Axis | Values | Source |
|---|---|---|
| Action kind | buttons (1 or 2) · form | Relume *Element: Buttons, Form*; Initium 4 *"form fields"*. A form is a peer of the buttons, not an addition to them |
| Media | none · image beside · background image · background video | Relume *Element: Image, Background Image, Background Video*; *Content Alignment: Image/Video Right* |
| Columns | 1 · 2 | Relume *Columns 1/2* |
| Content alignment | shared axis | Initium (*"centered content"* on 6 of 7) |
| Surface | shared axis, contrast band by default | Initium tags all 7 *"background contrast section"* |
| Scale | band · full section | The practice library: desktop heights from 320 to 1442 inside one family |
| Extras | logos · icons · cards | Relume *Element* |

**The CTA and banner boundary is drawn differently by different witnesses.** Relume and Initium keep
Banners (announcement strips, 16 and 6) separate from CTA. The practice library puts *"banner bands"*
inside CTA. A recipe has to pick one; the scale axis is how the practice library already expresses it.

**Empty cells:** no CTA with a price, a product or a countdown in any readable witness; Tailwind Plus's
ecommerce *Promo sections* group is the likely source and is behind its login.

### 7.4 Sign-up and log-in

**Witnesses:** Relume *Sign Up and Log In Pages* (Log In 1–8, Sign Up 1–9), plus *Sign Up and Log In
Modals*, *Onboarding Forms* and *Multi-step Forms*; the practice library's 9 sign-up and 8 log-in
templates and one assembled page; daisyUI's two log-in examples (markup). Initium has none. AEM's
form block is marked deprecated, and its docs class a form as a **widget, not a block**.

| Axis | Values | Source |
|---|---|---|
| Container | page · modal | Relume, two categories |
| Arrangement | form alone · form with media beside | Relume *Element: Image, Slider*; *Image/Video Right* |
| Media kind | image · slider | Relume |
| Logo position | start · center | Relume *Logo Left/Center* |
| Purpose | log in · sign up | Both witnesses split it this way |

**The counts coincide.** The practice library's 8 log-in and 9 sign-up templates are the same numbers
as Relume's Log In 1–8 and Sign Up 1–9. If the practice library descends from a commercial kit for
this family, it is **not an independent witness** for it (`34`: a comparison is only as strong as the
independence of the two things it compares). Screenshots settle it (§11).

**Empty cells:** no mobile variant in the practice library (desktop only, the one family without
`Breakpoint = Mobile`); no passwordless or one-time-code variant in any readable witness, though
daisyUI ships an OTP component.

### 7.5 Commerce

**Witnesses:** Relume's Ecommerce set only — Product List Sections 1–12, Product Headers 1–9, Category
Filters 1–6, 27 in all, **layout-only**. Tailwind Plus counted 14 ecommerce component groups and 7
page-example groups on 2026-08-11 and is unreadable now. daisyUI has a cart count and cart summary
inside a navbar example and nothing else. Initium, AEM's collection and the practice library have no
commerce.

Relume publishes one facet list for all three categories: *Buttons, Form, Multiple Images, Video
Lightbox, Image Lightbox, Slider, Modal, Tabs, Accordion, Search Bar, Filters.* Read against the three
categories, it suggests:

| Family | Axes the facets suggest | Confidence |
|---|---|---|
| Product header (the top of a PDP) | gallery kind (multiple images · slider · image lightbox · video lightbox); purchase form; details disclosure (tabs · accordion) | Layout-only, one witness |
| Product list | grid; filters present or not; modal (quick view) | Layout-only, one witness |
| Category filters | placement; search bar; modal (a filter sheet) | Layout-only, one witness |

**None of this is enough to build from.** Every row rests on one vendor's facet list, which is the
exact trap §2 records: a single witness's absences read as the genre's grammar. Commerce needs the
§11 screenshots before any axis here is treated as real.

## 8. Landmark structure and content model, where markup allows

Only two witnesses give markup, and they disagree on where landmarks belong.

**AEM puts page structure in the page shell, not in blocks.** The decoration script works on a document
that already has one `body > header`, one `main` and one `body > footer`. Each authored section becomes
a `div.section`, not a `<section>`, and each block is a `div`. So **a page assembled from blocks has no
section landmarks by construction** — the KB `components/section.md` rule is satisfied by default,
because the block tier cannot add a landmark. The header block builds a single `<nav id="nav">`
(unlabeled, which is correct while it is the page's only nav), turns each parent item into a button
with `aria-expanded`, and adds a hamburger button with `aria-controls="nav"`. The footer block loads
its fragment into a plain `div` inside the `<footer>`, with no `nav`. The carousel is the one block
that adds a landmark of its own: `role="region"` with `aria-roledescription`, and a labeled `nav` for
its slide controls.

**daisyUI puts landmarks inside blocks, and over-produces them.** Every footer example is a `<footer>`,
and every link group inside it is its own `<nav>`, titled by an `h6` but not labeled. A three-column
footer with a social row exposes four unlabeled navigation landmarks inside one contentinfo. The navbar,
by contrast, is a `div` in all ten examples, so the page's main navigation is **not** a landmark. The
hero is a `div`. Both log-in examples have labels with no `for` attribute, though the fieldset page
itself advises adding `id` and `for`.

**What this means for the recipe model.** A landmark is a property of the **page slot** a block fills,
not of the block. A navigation recipe placed in the header slot gets `header` and `nav`; the same
link-list content placed in a footer gets neither by default. A section-tier recipe (CTA, features)
gets no landmark unless the page asks for a labeled region. This is a proposal for the options paper
the owner asked for (#693, 2026-11-25), not a decision.

**The content model, from AEM's running source.**

- **Navigation** is a document with three positional sections: `brand`, `sections` (nested lists,
  so depth is list nesting) and `tools`. That is the same tools group §7.1 derived from the other
  witnesses, found independently in code.
- **Footer** is a free-form fragment; the docs recommend styling its sections by sequence.
- **Cards** turns each authored row into a list item, classifying each cell as image or body by
  whether it holds only a picture.
- **Columns** has no content model by design: rows × columns of default content, with the column
  count read from the first row.
- **Hero** ships no script at all (the file is empty); it is CSS over an authored image and heading.
- **Universal Editor models** declare fields with `component`, `valueType`, `name`, `label`,
  `required`, `multi` and `options`. Fields named with the suffixes `Alt`, `Text`, `Title`, `Type`
  or `MimeType` collapse into the field they qualify (`image` + `imageAlt`); an underscore groups
  fields into one element; `classes` and `classes_*` fields become block options, which is where
  variant axes land.

So the two halves of a recipe map onto two different things in the AEM projection: **axes become
block options** (`classes`), and **slots become fields**. A recipe that names only axes cannot produce
the field half, which is the constraint #693 states.

## 9. What the survey corrected

The going-in hypothesis per family was the reading a §2-informed reader brings: hero's axes carried
over, plus the genre picture of each family. **It was not committed before the reads**, so the tally
below is indicative, not a controlled measure. Each hypothesis item is marked confirmed, wrong (an
invented axis, or one that needed splitting or merging), or open (undecidable from what is readable).
Missed axes are counted separately.

| Family | Hypothesis | Confirmed | Wrong | Open | Missed |
|---|---|---|---|---|---|
| Navigation | logo position; link alignment; surface; an action count; mobile is a responsive collapse of the same block; mega menu is a variant | 3 | 3 — actions are a typed tools group; mobile disclosure is its own axis; mega menu is a value of disclosure, coupled to depth | 0 | 3 — depth, behavior, open state |
| Footer | link-column count; newsletter; legal row | 2 | 1 — the legal row is an invariant | 0 | 5 — brand block, social, contact details, arrangement, bands |
| CTA | alignment; media placement; surface; action count; social proof | 3 | 2 — action count splits into action kind (form vs buttons); social proof reduces to logos | 0 | 4 — background media, scale, the banner boundary, AEM's "not a block" |
| Sign-up and log-in | a page template, not a block; form alone vs form with media; the two differ only in fields | 1 | 1 — it is a page or a modal | 1 | 3 — logo position, media kind, AEM's "a widget, not a block" |
| Commerce | one family; the PDP header is a hero with a price | 0 | 1 — three families in Relume, 14 groups in Tailwind Plus | 1 — the PDP header as a hero with a price | not countable from one layout-only witness |
| **All** | **19** | **9** | **8** | **2** | **15** |

**Correction rate: nearly half of the decidable hypothesis was wrong in some way (8 of 17), and the missed
axes (15) nearly match the hypothesis (19) in number.** That is lower than hero's five of six, and the cause is visible:
hero's first pass had one witness, this one had up to five per family. Add the structural correction
in §6 (most axes are shared, not per-family), which no single family's tally shows. **The next family
needs the survey as much as these did.**

**And two corrections to the issue's own framing:**

- **Demand.** #693 orders families by "our demand", and states PDP work as the practice's most common
  surface. The practice's legacy library, the best record of what it reached for in templates, has
  **no commerce at all**: its demand is navigation, CTA, footer and auth. The two signals measure
  different things (engagement surfaces against a marketing template kit), and both are real. §10 has
  to weigh them; it cannot read one off the other.
- **Initium's depth.** §4 and `13` §8 record that Initium's hero index gives *"no layout description of
  any kind"*. Its registry index now gives one line per block. The 2026-08-10 reading was true then and
  is not now.

## 10. Family priority — a recommendation for the owner

**This is an owner decision.** What follows is a recommendation with its reasons, and two options.

**Inputs.** Which witnesses ship each family (✓ readable, ○ named but not readable now, ✗ absent):

| Family | Initium | Relume | daisyUI | AEM | Tailwind Plus | Practice library |
|---|---|---|---|---|---|---|
| Navigation | ✓ 10 | ✓ 32 | ✓ | ✓ boilerplate | ○ | ✓ 22 |
| Footer | ✓ 9 | ✓ 17 | ✓ 11 | ✓ boilerplate | ○ | ✓ 11 |
| CTA | ✓ 7 | ✓ 67 | ✗ | ✗ default content | ○ | ✓ 58 |
| Sign-up and log-in | ✗ | ✓ 17 + modals | partial | ✗ widget | ○ | ✓ 17 |
| Hero | ✓ 22 | ○ | ✓ 5 | ✓ boilerplate | ✓ names (§2) | ✗ |
| Commerce | ✗ | ✓ 27, layout-only | ✗ | ✗ | ○ 14 groups | ✗ |

AEM puts header and footer in its **boilerplate**, the tier for blocks *"used by the vast majority of
all AEM projects"* — a stricter bar than the collection's more-than-half rule. Navigation and footer
are the only families every readable witness ships.

**Option A (recommended): the shell first, commerce through it.** Order: **navigation → footer → CTA →
commerce (product header, product list, category filters) → sign-up and log-in → hero.**

- Navigation and footer clear every witness and the AEM boilerplate bar, and the practice library
  reached for both.
- They own the page landmarks (`header`, `nav`, `footer`), so building them first forces the §8
  landmark model to be settled before any section-tier recipe depends on it.
- They are where commerce enters first: the navigation tools group (search, account, cart with count)
  and the footer's region selector and payment marks are commerce cells (§7.1, §7.2), and they are on
  every PDP the practice builds.
- CTA is the practice library's deepest family (58 sets) and Relume's deepest here (67), with two
  readable witnesses.
- Commerce follows once the §11 screenshots exist, so its axes come from at least two witnesses.
- Hero is last: every vendor ships it and the practice library does not, which is §5's rule — order
  by our demand, not by vendor depth.

**Option B: commerce first.** Order: **product header → product list → category filters → navigation
(store tools) → footer → CTA.** It serves the PDP demand and the regression brand directly. The cost is
that it builds the least-witnessed families first: one layout-only witness today, so the first recipes
would rest on exactly the single-witness reading §2 warns against, and nothing could start before the
§11 commerce screenshots.

**A's commerce argument rests on one witness too.** The cart and account tools in the navigation come
from daisyUI's example 6 alone (§7.1), and the footer's region selector and payment marks have no
readable witness at all: they are the empty cells in §7.2. So A's first commerce cells stand on one
witness and on none, the same thinness B is marked down for. What A has that B lacks is the rest of
each family: navigation and footer are well witnessed without their commerce cells, so A can build
them now and add the commerce cells when the §11 screenshots arrive.

**Why A over B:** A reaches commerce through the shell in its first deliverable and holds the PDP
families until a second witness exists; B is faster to a PDP and slower to a correct one.

**The component backlog the families imply.** Navigation needs a disclosure button, a menu panel
(dropdown and mega), a drawer or sheet, and a cart indicator; footer needs a link group and a
newsletter form; CTA needs a form row; commerce needs a gallery, variant selectors and a filter panel.
None of these is briefed today. That list is input to the component tier's own priority, not part of
this decision.

## 11. Screenshots that would settle the open axes

A screenshot answers layout and nothing else (§4), so each request below names the question it closes.

**From the practice's legacy template library (owner):**

1. **Navigation:** the shortest desktop set (72 high) and the tallest (900), plus one desktop set from
   each distinct height in between. This settles depth, disclosure kind and the tools group. Also the
   Mobile variant of every set with a drawer state, which settles whether mobile disclosure is its
   own axis or a collapse of desktop.
2. **CTA:** the shortest (320) and tallest (1442) desktop sets; every set with a form field; every set
   with a background image or video; and the Mobile variant of the tallest. This settles scale, action
   kind, background media and the banner boundary.
3. **Footer:** all 11 desktop sets (they are short), and one Mobile. This settles link columns, brand
   block, newsletter, social, bands, and whether any has a region selector.
4. **Sign-up and log-in:** one sign-up and one log-in template with media beside the form (if any),
   one without, and the assembled log-in page. Compare them against Relume's Sign Up 1–9 and Log In
   1–8 order, which settles whether this family is an independent witness (§7.4).

**From Relume (a session-holding human):** all 27 ecommerce entries — Product Header 1–9, Product 1–12,
Filters 1–6 — at desktop and mobile. That moves §7.5 from facets to layouts. Also the mega-menu and
level-3 Navbars, found with the *Mega Menu* and *Navigation Level 3* filters.

**From Tailwind Plus (an account holder): names, not screenshots.** The vendor names its variants, so
the variant-name lists are enough, and names are facts rather than markup. Wanted: Ecommerce *Store
Navigation*, *Product Overviews*, *Product Lists*, *Category Filters*, *Shopping Carts* and *Promo
Sections*; Marketing *Headers*, *Footers*, *CTA Sections* and *Newsletter Sections*; Application UI
*Sign-in and Registration*.

**From Initium:** none. The registry index gives the facets, and its markup is licensed.

## 12. Gaps in this pass

- **The KB dual-agent convention was not followed.** The KB repository was attachable from this
  session but not attached, and the run used one reader per witness, not one identical prompt against
  two agents with raw outputs kept under `_inbound/`. A second identical-prompt run is owed before any
  of §6–§10 is promoted.
- **Tailwind Plus contributed nothing new**: the whole catalog is behind its login as of 2026-11-28.
- **AEM's per-block doc pages** now redirect to a Sidekick library tool and were not followed; header,
  footer, cards, columns, carousel and hero were read from the collection's published site instead.
- **Relume's counts** come from numbered cards, partly through a summary of truncated pages; treat
  each as best-effort, not exact. Its hero, header, pricing and Application UI counts were not read.
- **No family here has a content model beyond what AEM's source shows.** Initium, Relume and Tailwind
  Plus markup is gated, so the content model for CTA, auth and commerce is open.

---

*Sources: Initium hero set (22 variants, screenshots, 2026-08-10); Relume category index
(fetched 2026-08-10); `adobe/aem-block-collection` and `aem.live/developer/block-collection`;
daisyUI and Cloudscape figures via `36` §2. Second pass, all read 2026-11-28: Initium registry index
(`app.initium.sh/r/registry.json`); Relume `relume.ai/components`, `/ecommerce-components` and
`/categories/{navbars,footers,cta-sections,banners,signup-login-pages,forms,contact-sections}`; daisyUI
`daisyui.com/components/{navbar,footer,hero,drawer,menu,fieldset}` and `daisyui.com/blueprint`; AEM
`aem.live/developer/{block-collection,markup-sections-blocks,component-model-definitions}`,
`aem.live/developer/block-collection/{header,footer,modal,search,breadcrumbs}`, and source from
`main--aem-block-collection--adobe.aem.live` (`blocks/{header,footer,hero,cards,columns,carousel}`,
`scripts/aem.js`, `scripts/scripts.js`); Tailwind Plus `tailwindcss.com/plus/ui-blocks` (login page
only); the practice's legacy template library, as summarized by the owner. Cross-refs: `13` §8, `14`, `27` Idea 2, `28`, `35`,
`36` §2 row 6, KB `09` §1.36, KB `components/section.md`, #693.*
