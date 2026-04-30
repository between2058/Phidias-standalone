# Test Case Templates

## Test Case Document Structure

Output file: `test/qa/{feature-id}/test-cases/{category}-tests.md`

### Header
```markdown
# {CATEGORY} Tests — {feature-id}

Generated: {date}
Feature: {feature-name} ({user-story-id})

## Seed Data Reference

All test cases in this file use seed data from `../test-data/seed-data.md`. Ensure setup instructions have been executed before running tests.

| Data Set | Description | Used By |
|----------|-------------|---------|
| {data set name} | {what it contains} | {TC-IDs} |
```

### Test Case Format

Each test case follows this structure:

```markdown
## {TC-ID}: {Short descriptive title}

**Category**: Integration-Normal | Integration-Exception | Performance | Reliability
**Priority**: P1 | P2 | P3
**User Goal**: {What the end user wants to accomplish — e.g., "Create a new quotation for a customer and download it as PDF"}
**Precondition**: {What must be true before test starts — reference seed data}

| Step | Action | Expected Result | Actual Result | Screenshot | Fail Log | Status |
|------|--------|-----------------|---------------|------------|----------|--------|
| 1    | {action} | {expected} | | | | PENDING |
| 2    | {action} | {expected} | | | | PENDING |

---
```

## Seed Data Template

Output file: `test/qa/{feature-id}/test-data/seed-data.md`

```markdown
# Seed Data — {feature-id}

Generated: {date}
Feature: {feature-name}

## Overview
{Brief description of all data sets and their purpose}

## Data Sets

### {Entity Name} (e.g., Companies)
Purpose: {Why this data is needed}
Used by: {TC-IDs}

| Field | Value 1 | Value 2 | Value 3 |
|-------|---------|---------|---------|
| name | Acme Corp | Globex Inc | Initech Ltd |
| email | contact@acme.test | info@globex.test | admin@initech.test |
| ... | ... | ... | ... |

### {Entity Name} (e.g., Products)
...

## Setup Instructions

### Option A: Via API
\```bash
# Create companies
curl -X POST http://localhost:8000/api/companies -d '{"name": "Acme Corp", ...}'
...
\```

### Option B: Via UI Steps
1. Navigate to {page}
2. Click {button}
3. Fill in {fields}
...

### Option C: Via Database
\```sql
INSERT INTO companies (name, email) VALUES ('Acme Corp', 'contact@acme.test');
...
\```

## Cleanup Instructions
{How to reset data to clean state for re-running tests}

## Data Reuse Notes
{Guidelines for reusing this data in future test runs — e.g., deterministic IDs, no random values}
```

## Test Categories

### 1. Integration Testing — Normal Flows (INT-N)

Test complete end-user journeys through the happy path. Each test = one user goal accomplished.

**ID format**: `QA-{US}-INT-N-{NNN}`

**What to test** (as end-user flows):
- Complete user workflows from start to finish (e.g., "User creates a quotation, adds line items, and exports PDF")
- Multi-page journeys (e.g., "User navigates from dashboard, searches for a product, adds to cart")
- Form submissions with valid data as part of a larger goal
- CRUD operations framed as user goals ("User updates their company profile")
- State transitions the user triggers (e.g., "User submits quotation for approval")
- Data display verification within the user's workflow
- UI feedback (success toasts, loading states, empty states)
- Cross-component interactions (sidebar badge updates, filter tab counts)

**Step detail requirements**:
- Each step = one atomic user action (click, type, navigate, scroll)
- Expected result must describe BOTH visual state AND data state
- Include what text/values should be visible
- Include layout expectations (position, visibility, order)

### 2. Integration Testing — Exception Flows (INT-E)

Test what happens when users make mistakes or encounter errors during their journey.

**ID format**: `QA-{US}-INT-E-{NNN}`

**What to test** (as end-user experiences):
- User submits a form with missing required fields
- User enters invalid data (wrong format, too long, special characters)
- User encounters a network error during an operation
- User tries to access something they shouldn't
- User double-clicks a submit button
- User sees empty state when no data exists yet
- User hits boundary values (very long name, 0 items, 999+ items)
- User navigates back/forward during a multi-step flow
- User's session expires mid-flow

**Step detail requirements**:
- Specify the exact invalid input used (from seed data)
- Expected result must describe error message text, position, and styling
- Verify the system remains in a usable state after the error
- Verify no data corruption occurred

### 3. Performance Testing (PERF)

Test response times and responsiveness from the user's perspective.

**ID format**: `QA-{US}-PERF-{NNN}`

**What to test**:
- Page initial load time (< 2s for first meaningful paint)
- API response times for key operations (< 500ms for reads, < 2s for writes)
- List rendering with large datasets (50+, 100+, 500+ items)
- Search/filter responsiveness (< 200ms for UI update)
- File upload sizes (small, medium, large)
- Scroll performance with virtualized lists

**Step detail requirements**:
- Specify measurement method (network tab, performance API, visual timing)
- Include specific thresholds (e.g., "< 500ms", "no visible jank")
- Note baseline measurements for comparison

### 4. Reliability Testing (REL)

Test system stability during real-world usage patterns.

**ID format**: `QA-{US}-REL-{NNN}`

**What to test**:
- User refreshes page mid-operation (data persists or recovers)
- User rapidly clicks buttons (no duplicate entries, no crashes)
- User navigates away and returns (state preserved correctly)
- User opens multiple browser tabs with same page
- User continues working after backend restarts
- User encounters stale data (another user modified same resource)
- Graceful degradation when optional services unavailable

**Step detail requirements**:
- Describe the disruption/stress action clearly
- Expected result must confirm system integrity after disruption
- Verify data consistency across page refreshes
