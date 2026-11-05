## Task

Call Serena's `initial_instructions` once at the start of a coding task.

@.serena/memories/task_completion.md

## Code navigation (Serena)

- Use Serena's symbol tools for exploring and editing code: `get_symbols_overview`, `find_symbol`, `find_referencing_symbols`, `replace_symbol_body`, `insert_after_symbol`.
- Prefer them over Grep/Read on source files. Fall back to Grep/Read only for non-code files, plain-text searches, or when Serena can't resolve the symbol.
- If you really need to read a file, limit and grep your query
- Read a file in full only when you need the whole thing (editing most of it, reviewing it end to end).
- Never re-read a file you just edited to verify; the edit tool errors if it fails.

## Taste

- Complexity belongs at the adapter boundary. Orchestration stays pure, UI stays dumb.
- Kit components (`apps/web/src/components/ui`) own their look. Pick a `variant`, `size` or state prop; do not restyle one with `className`. If none fits and the look is a generic concept, add a variant or prop to the component; a look that belongs to one feature stays in that feature's own component, not in `components/ui`. A kit component's `className` takes layout and utility classes (size, flex, margin, padding, position, rounding, dividers, shadows, type size) but never color or a variant's look (text, background, border or fill colors, `--bg` overrides, hover/state colors). No lint rule checks this yet. See [Web UI](docs/internal/web.md).
- Sizes come from the theme. subtick/tailwind-scale` enforces both and autofixes the spacing.
- Inferred types over annotations. `any` is the enemy.
- Default to no comment. Write one only for a constraint, an external quirk, or an invariant the code can't show, in one line where you can and four at most. Don't restate names or signatures, narrate steps, record history, or explain the fix you just made; the PR carries that. `subtick/no-low-value-comments` enforces the length cap and the mechanical cases.
- Function bodies read top to bottom as values, then helper functions, then the return, with a blank line between each group. At module scope, keep a blank line around any multi-line statement. `subtick/statement-padding` enforces this and autofixes the blank lines; moving a value above the helpers is manual.
- React effects are for synchronizing with something outside React. Derive in render and act in handlers instead of syncing state, but don't hide real lifecycle work in refs or stores to dodge one. The `subtick/no-unreasoned-state-sync` lint rule reports every effect; one that stays states its reason with `// oxlint-disable-next-line subtick/no-unreasoned-state-sync -- <why>`.
- If a rule here fights the task in front of you, say so loudly and get a human sign-off before breaking it.
- Keep files under 500 lines of code. If a file needs more, split it into additional files or a folder of focused modules.

## Additional tips

- Don't verify with browsers or computer use unless the user explicitly agrees or requests it.
