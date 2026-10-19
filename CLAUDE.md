## Reading files
- For files longer than ~500 lines, don't read the whole file. Use Bash with grep to locate the relevant section, then Read with offset and limit.
- Read a file in full only when you need the whole thing (editing most of it, reviewing it end to end).
- Never re-read a file you just edited to verify; the edit tool errors if it fails.

## File size
- Keep files under 500 lines of code. If a file needs more, split it into additional files or a folder of focused modules.
