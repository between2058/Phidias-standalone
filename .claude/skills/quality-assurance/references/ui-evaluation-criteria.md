# UI/UX Evaluation Criteria

## Overview

**Be ultra-picky about UI quality. Flag even the smallest visual inconsistency.**

Every test step that involves viewing UI must be evaluated with extreme scrutiny. A test case can PASS functionally, but every UI imperfection — no matter how small — must be documented as a UI Nit observation. A test step can FAIL even if functionally correct if the UI is unclear, confusing, or unusable from a user's perspective.

**Mindset**: Act as the pickiest designer on the team. If something looks "off" even slightly, flag it. If spacing feels wrong, flag it. If a color shade doesn't match the design system, flag it. Nothing gets a free pass.

## UI Clarity Checklist (apply at every snapshot)

### 1. Information Hierarchy
- [ ] Primary information is visually prominent (larger, bolder, higher contrast)
- [ ] Secondary information is visually subordinate
- [ ] User can identify the page purpose within 2 seconds
- [ ] Headings clearly describe the section content
- [ ] No orphaned or unlabeled data

### 2. Readability
- [ ] Text has sufficient contrast against background (WCAG AA: 4.5:1 for normal text)
- [ ] Font size is readable (body >= 14px, labels >= 12px)
- [ ] Line length is comfortable (45-75 characters)
- [ ] No text truncation that hides critical information
- [ ] Numbers and dates are formatted consistently

### 3. Affordance & Interactivity
- [ ] Clickable elements look clickable (cursor, hover state, visual cue)
- [ ] Disabled elements are visually distinct and not confusable with enabled
- [ ] Form fields have visible labels or placeholders
- [ ] Required vs optional fields are distinguishable
- [ ] Action buttons have clear, verb-based labels ("Save", "Delete", not "OK", "Yes")

### 4. Feedback & Status
- [ ] Loading states are visible during async operations
- [ ] Success/error messages are clearly visible and appropriately styled
- [ ] Progress indicators show for operations > 1 second
- [ ] Empty states have helpful messaging (not blank or broken)
- [ ] Toast/notification messages are readable before they disappear

### 5. Layout & Spacing
- [ ] Elements are aligned consistently
- [ ] Adequate spacing between interactive elements (min 8px)
- [ ] No overlapping elements
- [ ] Content fits viewport without unexpected horizontal scroll
- [ ] Modal/overlay doesn't obscure critical context

### 6. Consistency
- [ ] Styling matches the design system (colors, fonts, spacing)
- [ ] Similar actions use similar UI patterns across pages
- [ ] Icons are consistent and meaningful
- [ ] Terminology is consistent (same concept = same word everywhere)

### 7. Data Accuracy & Completeness
- [ ] Displayed values match actual backend/database state
- [ ] All fields that should have data are populated (no unexpected blanks)
- [ ] Summary counts match detail counts (badge "3" = 3 items shown)
- [ ] Referenced items resolve correctly (linked model/agent/skill exists)
- [ ] Labels are human-readable (not raw field names like "review_status")
- [ ] Dates, numbers, and IDs are formatted consistently
- [ ] No placeholder/dummy data visible in production views

### 8. Error & Edge Case Quality
- [ ] Error messages explain WHAT went wrong (not just "Error" or "Failed")
- [ ] Error messages suggest HOW to fix (actionable recovery guidance)
- [ ] Validation errors appear near the field that caused them
- [ ] Empty states explain why empty AND suggest what to do next
- [ ] Boundary displays work correctly (very long names, special characters, 0 items, 999+ items)

### 9. Ultra-Picky Visual Polish (flag as UI Nits even if step passes)
- [ ] Pixel-level alignment — elements in the same row/column are perfectly aligned
- [ ] Consistent spacing — same gap between similar elements everywhere
- [ ] Color fidelity — all colors match the design system exactly (no off-shade variants)
- [ ] Border consistency — same border-radius, width, and color for similar components
- [ ] Shadow consistency — matching shadow depth and spread across similar cards/panels
- [ ] Icon sizing — icons are proportional to their context and consistent across the app
- [ ] Hover/focus — every interactive element has a visible hover and focus state
- [ ] Typography hierarchy — headings, body, labels use consistent and correct font sizes/weights
- [ ] Text overflow — long text wraps or truncates with ellipsis gracefully, never breaks layout
- [ ] Transition/animation — no janky, instant, or inconsistent transitions between states
- [ ] Whitespace balance — no cramped or overly sparse areas that feel "off"
- [ ] Platform conventions — scrollbars, cursors, selections behave as expected

### 10. Ground Truth (GT) Validation for Logic
- [ ] All computed/derived values match pre-calculated GT values
- [ ] Counts, totals, averages, percentages are mathematically correct
- [ ] Status transitions follow the defined state machine
- [ ] Filter/sort results contain exactly the expected items in the expected order
- [ ] Search results match the expected GT set for the given query
- [ ] Date calculations and formatting are correct

## Severity Classification

When a UI issue is found, classify it:

| Severity | Definition | Impact on Test |
|----------|-----------|----------------|
| **Critical** | User cannot complete the task; data loss risk | FAIL — blocks functionality |
| **Major** | User can complete task but with significant confusion | FAIL — unacceptable UX |
| **Minor** | Cosmetic or mild confusion; workaround obvious | ISSUE — note but pass step |
| **Enhancement** | Working fine but could be improved | PASS — note suggestion |

## Snapshot Evaluation Template

For each step during test execution, capture and evaluate:

```markdown
**Step {N} — {action description}**
- **Screenshot**: {filename}
- **What I see**: {Describe exactly what is visible on screen in 2-3 sentences}
- **Component Inspection**:
  - Data accuracy: {Are values correct and meaningful? Check each field.}
  - Completeness: {Are all expected fields/columns/sections present?}
  - Labels: {Are labels clear and descriptive? Would a new user understand?}
  - Counts: {Do summary numbers match actual items shown?}
  - Relationships: {Do linked references (model, agent, skill) resolve?}
- **GT Validation** (if test case has Ground Truth):
  - {Field}: GT={expected}, Actual={actual} {✓|✗}
- **UI Clarity**: {CLEAR | UNCLEAR | ISSUE}
  - {If UNCLEAR/ISSUE: describe what is confusing and why}
- **UI Nits**: {List EVERY visual imperfection, no matter how minor}
  - {category}: {description} | Severity: {Minor/Enhancement}
- **Functional Match**: {MATCH | MISMATCH}
  - Expected: {from test case}
  - Actual: {what actually appeared}
- **Verdict**: PASS | FAIL | ISSUE
  - {If FAIL: reason in one sentence}
```
