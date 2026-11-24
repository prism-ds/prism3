---
engine: patch
---
Style guides draw what the page shows (#4480). With one collection chosen on Documentation › Style guides, the page's summary, its Draw and Update file's Style guides step count and draw only the tables ticked in that collection; tables ticked in another collection stay ticked, and Every collection draws them again. Update file's Style guides row now says how many tables the step will draw before it runs, for example "2 tables", counted from the same saved settings the step draws with. Opening Update file asks the plugin for the file's tables so the count is current. No committed artifact moves.
