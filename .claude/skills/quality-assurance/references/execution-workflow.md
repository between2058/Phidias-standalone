# Test Execution Workflow

## Phase 1: Test Case Generation

### Input
- Design specification (spec.md, plan.md, tasks.md)
- Existing test case files (test/testcases/)
- Existing codebase (frontend components, backend routes)

### Process

1. **Read the design spec** — Identify all user stories, acceptance scenarios, and UI components
2. **Inventory existing tests** — Check test/testcases/ and test/qa/ for already-covered cases
3. **Map end-user flows** — For each user story, trace every user-facing journey:
   - Normal path: User wants to {goal} → navigates to {page} → does {actions} → achieves {outcome}
   - Exception path: User tries {goal} with {bad input} → sees {error} → recovers via {recovery}
4. **Identify data requirements** — List all entities, relationships, and states needed for testing
5. **Ask clarifying questions** — Before generating, ask the user about:
   - Any specific data constraints or business rules
   - External service availability (API keys, third-party services)
   - Preferred test data values (company names, product names, etc.)
6. **Generate seed data** — Create `test/qa/{feature-id}/test-data/seed-data.md` with:
   - Realistic fake data for all entities
   - Setup instructions (API calls, SQL, or UI steps)
   - Cleanup instructions for re-running
   - Data reuse guidelines
7. **Generate test cases** by category:
   - Integration-Normal: One test case per distinct end-user goal
   - Integration-Exception: One test case per error/edge the user could encounter
   - Performance: One test case per measurable user-facing operation
   - Reliability: One test case per disruption scenario
8. **Write detailed steps** — Each step = one atomic action + one specific expected result
9. **Output files**:
   - `test/qa/{feature-id}/test-data/seed-data.md`
   - `test/qa/{feature-id}/test-cases/int-normal-tests.md`
   - `test/qa/{feature-id}/test-cases/int-exception-tests.md`
   - `test/qa/{feature-id}/test-cases/perf-tests.md`
   - `test/qa/{feature-id}/test-cases/rel-tests.md`

### Step Writing Rules

- **Action**: Start with a verb — Navigate, Click, Type, Verify, Scroll, Wait
- **Expected Result**: Must include:
  - What is visually visible (text, layout, color)
  - What state change occurred (URL, data, count)
  - Specific values when known (exact text, exact count, exact URL)
- Bad: "Page loads correctly"
- Good: "Page displays 'Review Queue' heading (h1), subtitle shows '3 pending items awaiting review', filter tabs (All/Agents/Skills/MCP Servers) visible below heading"

## Phase 2: Test Execution

### Prerequisites
- App running (frontend + backend)
- Browser automation available (Playwright MCP tools)
- Seed data loaded (run setup from seed-data.md)
- If external resources unavailable, ask user for alternatives — never silently block

### Execution Process

For each test case:

1. **Announce** — State which test case is being executed (ID + title + user goal)
2. **Setup preconditions** — Navigate to starting page, verify seed data is present
3. **Execute each step**:
   a. Perform the action (click, type, navigate)
   b. Take a snapshot (`browser_snapshot`) — this is the primary observation tool
   c. Take a screenshot (`browser_take_screenshot`) for visual evidence
   d. **Evaluate what you see** using the snapshot evaluation template:
      - Describe what is actually on screen (2-3 sentences minimum)
      - **Inspect every component in detail** — check data accuracy, label clarity, field completeness, counts matching actual data, relationships resolving correctly, no blank/placeholder fields
      - Assess UI clarity — Is the information clear to a user? Can they understand what happened?
      - Compare actual vs expected — Quote both, note any differences
      - Render verdict with reasoning
   e. Fill in the Actual Result, Screenshot, and Status columns
4. **Record issues** — Any UI/UX clarity problems get logged as issues even if functionally correct
5. **Move to next test case**

### Snapshot Evaluation (MANDATORY for every step)

Never write just "PASS" or "FAIL". Always provide:

```
**What I see**: The review queue page shows a table with 2 rows. Each row has a
purple "skill" badge, the skill name "qa-test-skill", a description, and green
Approve / red Reject buttons on the right side.

**UI Clarity**: CLEAR — The layout makes it immediately obvious what each item
is and what actions are available. Type badges use distinct colors.

**Functional Match**: MATCH
- Expected: Pending items displayed with approve/reject buttons
- Actual: 2 pending items shown with Approve (green) and Reject (red) buttons

**Verdict**: PASS — All expected elements present with clear, user-friendly layout
```

### UI/UX Failure Criteria

Mark a step as FAIL if ANY of these apply, even if functionally correct:
- User cannot tell what the current state is
- User cannot find the action they need to take
- Text is unreadable, truncated, or misleading
- Interactive elements are not visually distinguishable from static content
- Error messages don't explain what went wrong or how to fix it
- Empty states show blank areas instead of helpful messaging
- Layout is broken (overlapping elements, missing sections, unintended scroll)
- Inconsistent with design system (wrong colors, fonts, spacing)

### Data & Component Integrity Checks (MANDATORY at every step)

Beyond visual/theme checks, verify each component's **content** is correct:
- **Data accuracy**: Do displayed values match the actual backend state? (e.g., model count says "5" but only 3 exist = FAIL)
- **Label clarity**: Would a first-time user understand every label without explanation? (e.g., "review_status" shown raw instead of "Review Status" = ISSUE)
- **Field completeness**: Are all fields that should have values populated? (e.g., "Created" column showing "—" when a date exists = FAIL)
- **Meaningful data**: Are values real/useful or placeholder/dummy? (e.g., description "test" or "asdf" in production = ISSUE)
- **Relationship integrity**: Do referenced items resolve? (e.g., agent shows "Model: gpt-4" but that model doesn't exist = FAIL)
- **Count consistency**: Do summary counts match detail counts? (e.g., badge says "3 pending" but list shows 2 items = FAIL)
- **Error message quality**: Do errors explain the problem AND suggest recovery? (e.g., "Error" alone = FAIL; "Invalid API key — check your OpenAI key in Settings" = PASS)
- **Terminology consistency**: Same concept uses same word everywhere? (e.g., "Skill" vs "Plugin" for same thing = ISSUE)

## Phase 3: Final QA Report

### Report Structure

Output file: `test/qa/{feature-id}/qa-report.md`

```markdown
# QA Report: {US-ID} — {Feature Name} ({feature-id})

**Date**: {YYYY-MM-DD}
**Tester**: Claude QA Automation
**Feature**: {Feature Name}
**App URL**: {frontend URL} (frontend), {backend URL} (backend)
**Browser**: Chromium (Playwright MCP)

---

## Executive Summary

{2-3 sentence summary of overall quality, highlighting key findings}

| Metric | Value |
|--------|-------|
| Total Tests | {N} |
| Passed | {N} |
| Issues | {N} |
| Failed | {N} |
| Pass Rate | **{X}%** |
| Console Errors | {N} |
| UI/UX Issues | {N} |
| Bugs Found | {N} |
| Suggestions | {N} |

---

## Test Results Overview (Charts)

### Test Results Distribution

```mermaid
pie title Test Results
    "Pass" : {N}
    "Fail" : {N}
    "Issue" : {N}
```

### Bug Severity Distribution

```mermaid
xychart-beta
    title "Bugs by Severity"
    x-axis ["Critical", "Major", "Minor", "Enhancement"]
    y-axis "Count"
    bar [{N}, {N}, {N}, {N}]
```

### Results by Test Category

```mermaid
xychart-beta
    title "Results by Category"
    x-axis ["INT-N", "INT-E", "PERF", "REL"]
    y-axis "Count"
    bar [{pass_n}, {pass_e}, {pass_p}, {pass_r}]
    bar [{fail_n}, {fail_e}, {fail_p}, {fail_r}]
```

---

## Test Case Summary

| ID | Test Case | User Goal | Category | Status | Key Finding |
|----|-----------|-----------|----------|--------|-------------|
| {ID} | {title} | {user goal} | {INT-N/INT-E/PERF/REL} | {PASS/FAIL/ISSUE} | {1-sentence finding} |

---

## Bug Summary

| Bug ID | Severity | Test Case | Description | Steps to Reproduce | Screenshot |
|--------|----------|-----------|-------------|-------------------|------------|
| BUG-{NNN} | {Critical/Major/Minor} | {TC-ID} | {clear description} | {numbered steps} | {filename} |

---

## Suggestion Summary

| Sug ID | Area | Current Behavior | Suggested Improvement | Priority | Impact |
|--------|------|-----------------|----------------------|----------|--------|
| SUG-{NNN} | {UI/UX/Performance/Data} | {what it does now} | {what it should do} | {High/Med/Low} | {who benefits and how} |

---

## Detailed Results by Category

### INT-N — Integration Normal ({N} tests)

| ID | Test Case | Expected | Actual (Summary) | Screenshot | Status |
|----|-----------|----------|------------------|------------|--------|
| {ID} | {title} | {brief expected} | {2-3 sentence actual observation} | {filenames} | {status} |

### INT-E — Integration Exception ({N} tests)
{same table format}

### PERF — Performance ({N} tests)
{same table format}

### REL — Reliability ({N} tests)
{same table format}

---

## UI/UX Observations

{List any UI/UX findings — both issues and positive observations}

---

## Seed Data Used

{Reference to seed-data.md file and any modifications made during testing}

---

## Recommendations

{Prioritized list of actionable improvements, ordered by severity/impact}

1. **[Critical]** {recommendation}
2. **[Major]** {recommendation}
3. **[Minor]** {recommendation}
```

### Test Case Document Update

After execution, update the test case files with filled-in Actual Result, Screenshot, and Status columns. Also update `test/testcases/user_story_{XX}_test.md` with the QA section.
