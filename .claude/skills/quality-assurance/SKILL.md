---
name: quality-assurance
description: >
  Comprehensive QA skill with two modes: (1) Test Case Generation — reads design specs
  and generates end-user flow test cases (not unit tests) from a QA team perspective,
  covering e2e normal/exception flows, performance, and reliability. Auto-generates
  reusable fake/seed data so nothing is blocked. (2) Test Execution — runs tests via
  Playwright MCP with snapshots, detailed evaluations (never just pass/fail), and UI/UX
  clarity checks. Produces a final QA report with test case summary, bug summary,
  suggestion summary tables, and Mermaid charts. Use when asked to: generate test cases,
  write QA tests, create test plans, run QA tests, execute test cases, verify a feature,
  do quality assurance, test a user story, or validate UI/UX.
---

# Quality Assurance

Two-mode QA workflow: generate end-user flow test cases from design specs, then execute them with visual verification. All tests are from the QA team perspective — focus on what end users do, not internal implementation.

## Mode Selection

- **"generate test cases"** / **"define test cases"** / **"write tests for"** → Mode 1
- **"run tests"** / **"execute QA"** / **"test the feature"** / **"verify"** → Mode 2
- **"QA this feature"** (no existing test cases) → Mode 1 then Mode 2
- **"QA this feature"** (test cases exist) → Mode 2

## Mode 1: Test Case Generation

### Input Discovery

1. Read the design spec: `specs/{feature-id}/spec.md`
2. Read the design spec: `design-specification/*.md`
3. Read existing test cases: `test/testcases/user_story_{XX}_test.md`
4. Scan frontend components and backend routes relevant to the feature
5. As end user to define the test cases.

### End-User Flow Principle

**Every test case must represent a real end-user journey, not an isolated unit test.**

- Think: "What does the user want to accomplish?" not "What does this function do?"
- Each test case = one complete user goal (e.g., "Create a new quotation and download PDF")
- Steps follow the user's natural workflow from start to finish
- Group related actions into meaningful flows rather than testing individual buttons/fields

### Test Data Strategy — No Blocked Tests

**CRITICAL: Never mark tests as BLOCKED due to missing data. Always generate seed data.**

Before writing test cases:
1. **Identify all data requirements** for the feature under test
2. **Ask the user** if any specific data constraints or business rules apply
3. **Generate a reusable seed data file** at `test/qa/{feature-id}/test-data/seed-data.md`

The seed data file must include:
- All fake data needed across all test cases (users, records, configurations)
- API calls or SQL statements to seed the data
- A setup script or step-by-step seeding instructions
- Data that is realistic and internally consistent (proper IDs, valid relationships)

```markdown
# Seed Data — {feature-id}

## Overview
{Brief description of what data is generated and why}

## Data Sets

### {Entity Name} (e.g., Companies, Products, Users)
| Field | Value | Used By |
|-------|-------|---------|
| {field} | {value} | {TC-IDs} |

## Setup Instructions
{API calls, SQL, or UI steps to seed this data}

## Cleanup Instructions
{How to reset to clean state after testing}
```

**Data generation rules:**
- Use realistic but obviously fake data (e.g., "Acme Corp", "Jane Tester", "test@example.com")
- Ensure data covers normal, edge, and boundary scenarios
- Include data for empty states, single items, and bulk items
- Make data reusable across future test runs — use deterministic values, not random
- If external services are needed (API keys, etc.), ask the user during test case generation

### Output Structure

Create test case files at `test/qa/{feature-id}/test-cases/`:

| File | Category | ID Format |
|------|----------|-----------|
| `int-normal-tests.md` | Integration — Normal Flows | `QA-{US}-INT-N-{NNN}` |
| `int-exception-tests.md` | Integration — Exception Flows | `QA-{US}-INT-E-{NNN}` |
| `perf-tests.md` | Performance | `QA-{US}-PERF-{NNN}` |
| `rel-tests.md` | Reliability | `QA-{US}-REL-{NNN}` |

Also create: `test/qa/{feature-id}/test-data/seed-data.md`

See [references/test-case-templates.md](references/test-case-templates.md) for complete templates.

### Test Case Writing Rules

Each test case must have:
- **Unique ID** following the format above
- **User Goal** — one sentence describing what the end user wants to accomplish
- **Precondition** stating the required starting state (referencing seed data)
- **Step table** with columns: Step | Action | Expected Result | Actual Result | Screenshot | Fail Log | Status
- Every step = ONE atomic user action
- Every expected result must specify:
  - What is visually visible (exact text, layout, colors)
  - What state change occurred (URL, count, data)
  - Specific values when deterministic

**Bad**: "Page loads correctly"
**Good**: "Page shows 'Review Queue' heading (h1), subtitle '3 pending items awaiting review', four filter tabs (All / Agents / Skills / MCP Servers) visible below heading"

### Ground Truth (GT) Validation for Logic Testing

For test cases that involve business logic, calculations, data transformations, or any operation with a deterministic correct answer, define **Ground Truth (GT)** values upfront in the test case.

**When to use GT validation:**
- Price calculations (unit price × quantity, discounts, tax, totals)
- Data aggregations (counts, sums, averages displayed in dashboards)
- Status transitions (e.g., "Draft" → "Submitted" → "Approved")
- Filtering/sorting results (expected order, expected items shown/hidden)
- Search results (exact matches expected for given query)
- Date/time formatting and calculations
- Any computed or derived value shown to the user

**How to define GT in test cases:**

Add a `**Ground Truth**` section to any test case that involves logic validation:

```markdown
**Ground Truth**:
| Field | GT Value | Source |
|-------|----------|--------|
| Subtotal | $1,250.00 | 5 × $250.00 (from seed data: Product A, qty 5) |
| Tax (10%) | $125.00 | $1,250.00 × 0.10 |
| Total | $1,375.00 | $1,250.00 + $125.00 |
| Line items count | 3 | Seed data has 3 products added |
```

**During execution**, compare actual displayed values against GT:
```
**GT Validation**: {MATCH | MISMATCH}
  - Subtotal: GT=$1,250.00, Actual=$1,250.00 ✓
  - Tax: GT=$125.00, Actual=$125.00 ✓
  - Total: GT=$1,375.00, Actual=$1,375.00 ✓
```

**Rules:**
- GT values must be computed from seed data — document the calculation in the "Source" column
- Any GT mismatch is an automatic FAIL regardless of UI appearance
- Include GT validation in the step evaluation between "Component Inspection" and "UI Clarity"
- For non-deterministic values (timestamps, auto-IDs), define the expected format/range instead

### Coverage Requirements

For each user story in the spec:
- **INT-N**: At least 1 test per end-user goal + 1 per distinct user journey
- **INT-E**: At least 1 test per error scenario + boundary cases
- **PERF**: At least 1 test per page load + 1 per key user operation
- **REL**: At least 1 test per stateful user workflow (refresh, navigate away, rapid clicks)

## Mode 2: Test Execution

### Prerequisites

Verify before starting:
1. Frontend running (check with `browser_navigate` to app URL)
2. Backend running (check API health)
3. **Seed data**: Execute the setup instructions from `test/qa/{feature-id}/test-data/seed-data.md`
4. If any external resource is truly unavailable (e.g., third-party API down), ask the user how to proceed — do NOT silently skip or block

### Execution Procedure

For each test case:

1. **Announce** the test ID and title
2. **Set up** preconditions (navigate, verify seed data is present)
3. **For each step**:
   a. Perform the action (click, type, navigate using Playwright MCP tools)
   b. Call `browser_snapshot` — primary observation tool
   c. Call `browser_take_screenshot` — visual evidence (save as `{TC-ID}-step-{N}.png`)
   d. **Write the evaluation** (MANDATORY — see below)
   e. Fill in Actual Result, Screenshot, Status in the test case table

### Step Evaluation Format (MANDATORY)

Never write just "PASS" or "FAIL". Every step must include:

```
**What I see**: {Describe exactly what is on screen in 2-3 sentences. Include
text content, layout positions, colors, interactive elements visible.}

**Component Inspection**: {Check EVERY visible component in detail}
  - Data accuracy: Are displayed values correct and meaningful (not placeholder/dummy)?
  - Completeness: Are all expected fields/columns/sections present?
  - Labels: Are labels descriptive and unambiguous? Would a new user understand them?
  - Counts/badges: Do counts match actual data? (e.g., "3 items" but only 2 shown = FAIL)
  - Relationships: Do linked values resolve correctly? (e.g., agent references valid model)
  - Empty fields: Are any fields blank that should have data?

**GT Validation** (if test case has Ground Truth):
  - {Field}: GT={expected}, Actual={actual} {✓|✗}
  - {Field}: GT={expected}, Actual={actual} {✓|✗}

**UI Clarity**: {CLEAR | UNCLEAR | ISSUE}
  {If UNCLEAR/ISSUE: explain what a user would find confusing and why}

**UI Nits**: {List EVERY visual imperfection, no matter how minor}
  - {category}: {description} | Severity: {Minor/Enhancement}

**Functional Match**: {MATCH | MISMATCH}
  - Expected: {quote from test case expected result}
  - Actual: {what actually appeared, with specific values}

**Verdict**: {PASS | FAIL | ISSUE}
  {One sentence explaining why}
```

### Ultra-Picky UI Scrutiny (MANDATORY)

**Be extremely critical of every UI detail. Even the smallest inconsistency must be highlighted.**

A test case can still PASS functionally, but every UI imperfection MUST be recorded as a UI Observation in the report. Act like the pickiest designer on the team — nothing gets a free pass.

Flag and document ALL of the following, no matter how minor:
- **Alignment**: Elements off by even 1-2px, inconsistent padding/margins between similar components
- **Spacing**: Uneven gaps between cards, list items, buttons, or sections
- **Typography**: Mixed font sizes/weights where they should be consistent, orphaned words, awkward line breaks
- **Color**: Slight shade mismatches, inconsistent use of theme colors, low-contrast text
- **Icons**: Missing icons, wrong icon for the action, inconsistent icon sizes or styles
- **Borders/Shadows**: Inconsistent border-radius, missing/extra shadows, mismatched border colors
- **Responsive**: Content that overflows, awkward wrapping, elements that don't scale proportionally
- **Loading/Empty states**: Missing skeleton loaders, blank areas instead of empty-state messages
- **Hover/Focus states**: Missing hover effects on clickable items, no focus indicators for accessibility
- **Text content**: Typos, grammatical errors, unclear labels, raw field names shown to users (e.g., "created_at" instead of "Created At")
- **Consistency**: Same concept styled differently across pages, inconsistent button styles for similar actions
- **Polish**: Anything that makes the UI feel "unfinished" or "developer-grade" rather than "production-ready"

**Recording format** — For each UI observation, add to the step evaluation:
```
**UI Nit**: {category} — {description of the issue} | Severity: {Minor/Enhancement}
```

Even when the step verdict is PASS, list ALL UI nits found. The final report's UI/UX Observations section must aggregate every nit across all test steps.

### UI/UX Failure Criteria

Mark FAIL even if functionally correct when:
- User cannot determine current state or available actions
- Text is unreadable, truncated, or misleading
- Interactive elements look like static content (or vice versa)
- Error messages don't explain problem or recovery
- Empty states are blank instead of helpful
- Layout broken (overlap, missing sections, unwanted scroll)
- Inconsistent with design system
- Information hierarchy unclear (primary info not prominent)

See [references/ui-evaluation-criteria.md](references/ui-evaluation-criteria.md) for the full UI clarity checklist.

### Console Error Monitoring

After each page navigation, check `browser_console_messages` with level "error". Log any errors found as issues regardless of test case outcome.

## Reporting — Final QA Report

After execution, generate: `test/qa/{feature-id}/qa-report.md`

See [references/execution-workflow.md](references/execution-workflow.md) for the complete report template.

The final report MUST include these sections:

### 1. Executive Summary
- Overall quality assessment (2-3 sentences)
- Key metrics table (total/pass/fail/issue counts, pass rate)

### 2. Test Case Summary Table
| ID | Test Case | User Goal | Category | Status | Key Finding |
|----|-----------|-----------|----------|--------|-------------|

### 3. Bug Summary Table
| Bug ID | Severity | Test Case | Description | Steps to Reproduce | Screenshot |
|--------|----------|-----------|-------------|-------------------|------------|

### 4. Suggestion Summary Table
| Sug ID | Area | Current Behavior | Suggested Improvement | Priority | Impact |
|--------|------|-----------------|----------------------|----------|--------|

### 5. Visual Charts (Mermaid)
Include at minimum:
- **Test Results Pie Chart**: Pass/Fail/Issue distribution
- **Bug Severity Bar Chart**: Count by severity (Critical/Major/Minor/Enhancement)
- **Category Coverage Chart**: Results breakdown by test category (INT-N/INT-E/PERF/REL)

```mermaid
pie title Test Results
    "Pass" : {N}
    "Fail" : {N}
    "Issue" : {N}
```

```mermaid
xychart-beta
    title "Bugs by Severity"
    x-axis ["Critical", "Major", "Minor", "Enhancement"]
    y-axis "Count"
    bar [{N}, {N}, {N}, {N}]
```

```mermaid
xychart-beta
    title "Results by Category"
    x-axis ["INT-N", "INT-E", "PERF", "REL"]
    y-axis "Count"
    bar [{pass}, {pass}, {pass}, {pass}]
    bar [{fail}, {fail}, {fail}, {fail}]
```

### 6. Detailed Results by Category
Full results tables with actual observation summaries per category.

### 7. Recommendations
Prioritized list of actionable improvements.

Also update `test/testcases/user_story_{XX}_test.md` with the QA Browser Tests section.

## Issue Severity

| Severity | Definition | Test Impact |
|----------|-----------|-------------|
| **Critical** | Cannot complete task; data loss risk | FAIL |
| **Major** | Task completable but significant confusion | FAIL |
| **Minor** | Cosmetic or mild confusion; workaround obvious | ISSUE |
| **Enhancement** | Working fine, could be improved | PASS with note |
