# /triage-issue

Triage a single GitHub issue in `silvertakana/worldwideview` per the project's [TRIAGE.md](../../TRIAGE.md) intake rules. Classifies the issue, recommends a disposition, and executes it after explicit user confirmation.

**Usage:** `/triage-issue <issue-number>`

`$ARGUMENTS` = the issue number to triage.

## Procedure

### 1. Fetch the issue

```bash
gh issue view $ARGUMENTS --repo silvertakana/worldwideview --json number,title,body,labels,comments,author
```

### 2. Classify

Determine the type from the title prefix and body:

| Signal | Type |
|---|---|
| `[PLUGIN]`, "data source", "show X on the globe" | **plugin-request** |
| `[FEATURE]`, "feature request", capability not tied to a data source | **enhancement** |
| `[BUG]`, error, stack trace, "doesn't work" | **bug** |
| Open-ended question, no actionable ask | **question** |

### 3. Apply the TRIAGE.md rule

- **plugin-request:** vet the API first (dispatch the `plugin-researcher` agent if the source is unknown). Then apply the build/do-not-build rule (free API + renders something meaningful + fits the demo).
  - Viable -> propose: add a checklist line to #4, label `plugin-request` + `good first issue` + `help wanted`, close standalone with "Tracked in #4."
  - Not viable -> propose: close with the specific reason.
- **enhancement:** propose: label `enhancement`, add a one-line ROADMAP backlog entry, keep open.
- **bug:** propose: label `bug`, reproduce, then fix inline or route to the `debugger` agent.
- **question:** draft a reply; propose answer-then-close.

### 4. Confirm before any state change

Present the classification and proposed actions as a short summary. **Do not** comment, label, pin, close, or edit anything until the user explicitly approves (per the project's "explicit user authorization before any state-changing action" rule). Comments are posted from the owner account, so they read as owner triage notes - keep them accurate and neutral.

### 5. Execute

On approval, run the `gh` commands for the approved actions only. Report each result with its URL.

## Notes

- Issue #4 (Plugin Wishlist) is the canonical pinned funnel for plugin ideas - never create a competing wishlist.
- Never promise dates on `enhancement` issues.
- See [TRIAGE.md](../../TRIAGE.md) for the full rationale and the build/do-not-build test.
