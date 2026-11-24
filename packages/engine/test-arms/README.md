# test-arms/

The named-arm registry `lint-test-arms.ts` reads (#1834). Each file is one arm: it is named
`<suite path, each / written __>__<NNNN>` and holds the one line `<suite path> #NNNN`.

- **Add arms** with `npx tsx packages/engine/lint-test-arms.ts --accept`. It writes a file for each new arm and never removes one.
- **Retire an arm** by deleting its file by hand, in the diff that removes the arm, so a reviewer sees it.

One file per arm, not one sorted list, so two PRs that each add an arm never conflict (#4455).
