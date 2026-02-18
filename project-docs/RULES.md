# RULES (how Claude/Codex must work)

## ALWAYS start a session by reading:
1) project-docs/STATE.md
2) The relevant doc (DATABASE/ARCHITECTURE/ROADMAP)

## After ANY meaningful change:
Update project-docs/STATE.md with:
- Current task
- What is done
- What is in progress
- Blockers
- Next exact step
- Definition of Done

## Scope control
- Only implement the CURRENT task from STATE.md.
- If something is missing, add it to Blockers and propose a next step.

## Output style for AI
- Make small, verifiable changes.
- Prefer incremental commits.
- If tests exist, run them; if not, provide manual test steps.

## End of session checklist
- STATE.md updated ✅
- App still runs ✅
- No breaking migrations ✅
