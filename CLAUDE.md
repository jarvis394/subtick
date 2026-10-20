## Code navigation (Serena)

- Use Serena's symbol tools for exploring and editing code: `get_symbols_overview`, `find_symbol`, `find_referencing_symbols`, `replace_symbol_body`, `insert_after_symbol`.
- Prefer them over Grep/Read on source files. Fall back to Grep/Read only for non-code files, plain-text searches, or when Serena can't resolve the symbol.
- Call Serena's `initial_instructions` once at the start of a coding task.
- If you really need to read a file, limit and grep your query
- Read a file in full only when you need the whole thing (editing most of it, reviewing it end to end).
- Never re-read a file you just edited to verify; the edit tool errors if it fails.

## File size

- Keep files under 500 lines of code. If a file needs more, split it into additional files or a folder of focused modules.
