---
engine: patch
---
`prism3-build-ui` asks an agent to render its build and look at it before the ledger (#4613): in light and dark, at a phone width and at a desktop width, fixing what is visibly wrong first. Each view it couldn't render goes under Unsure in the ledger. The skills gate holds the step, so removing it fails by its own name. No emitted artifact changes.
