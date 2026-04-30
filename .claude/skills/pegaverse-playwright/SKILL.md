---
name: playwright-test-generation
description: |
  Provide specialized guidance for generating resilient,
  maintainable Playwright test code that strictly follows company
  testing philosophy and locator, action-state sync, assertion,
  POM, and maintenance rules. Use this Skill whenever asked to
  generate Playwright test code or review test generation guidelines.
---

## 1. Core Testing Philosophy

1. Test only **user-visible behavior**.

   * Ignore internal implementation, function names, CSS classes, or DOM nesting.
   * If DOM structure is unknown, **treat elements as independently locatable**; do not assume parent-child or sibling relationships.

2. Ensure **test isolation**.

   * Tests must be independent and must not share localStorage, sessionStorage, cookies, or backend state unless explicitly intended.

---

## 2. Locator Rules

### 1. Locator Priority

**DOM known (structure is clear)**

* Prefer **semantic locators** such as `getByRole`, `getByLabelText`, or `getByText`.
* Principle: choose the locator that is **closest to user-visible behavior** and can uniquely identify the element.
* If semantic locators cannot uniquely locate the element, fallback to `getByTestId` as a **stable backup**.

**Example:**

```js
// DOM known and semantic locators applicable
const usernameInput = page.getByLabelText('Username');
const submitButton = page.getByRole('button', { name: 'Submit' });

// If semantic locator cannot uniquely locate
const loginButton = page.getByTestId('login-button'); // AI or developer generated semantic testId
```

**DOM unknown or structure is unstable**

* Prefer **testId** or **semantic testId** to ensure locator stability.
* Avoid relying on `role`, `label`, or `text` that may break due to DOM changes.

**Example:**

```js
// DOM unknown, using semantic testId
const searchButton = page.getByTestId('search-button');
```

**Core Principles**

1. **Semantic first**: always use the locator that best reflects user actions.
2. **Stable fallback**: fallback to `testId` when semantic locators are insufficient.
3. **Context-aware**: choose strategy based on DOM knowledge, not a fixed priority order.

### 2. Explicit Contracts & Semantic testId Generation

* If an element **cannot be uniquely located** by role, text, or label:

  1. Generate a **semantic testId** based on component name, label, or purpose.
  2. Use `getByTestId('semantic-name')` in the test.
  3. Add a comment indicating the testId is AI-generated.
  4. Mark it as **stable**; do not rely on DOM structure.
* Example:

```js
// AI-generated semantic testId
const loginButton = page.getByTestId('login-button');
```

### 3. Forbidden Locator Patterns

* XPath
* CSS selectors relying on DOM nesting, sibling, or index (`nth-child`, `:first`, `:last`)
* Chaining or `.filter()` unless explicitly guaranteed by a **stable UI contract**

### 4. Uncertain locators

* If a stable locator **cannot be generated**, mark as `UNSTABLE` or `REQUIRES_UI_CONTRACT`.
* Never invent structure-based locators.
* Never weaken or skip test steps to compensate.

---

## 3. Action-State Synchronization

1. **All state-changing actions must include explicit wait for the next UI state**.

   * Includes: navigation, form submit, modal open/close, async data load, step/page transitions, tab/accordion switching.

2. **POM methods must guarantee completion of UI state** before resolving.

   * Invalid:

     ```js
     async submitForm() {
       await this.submitButton.click();
     }
     ```
   * Valid:

     ```js
     async submitForm() {
       await this.submitButton.click();
       await expect(this.successMessage).toBeVisible();
     }
     ```

3. **Assertions for synchronization must relate to the next action**.

   * Decorative or unrelated assertions do not count.

4. **Do not use arbitrary waits** (`waitForTimeout`, forced retries).

   * Prefer explicit, deterministic synchronization.

---

## 4. Web-First Assertions

1. Always use Playwright **web-first assertions**:

   * `toBeVisible()`, `toBeEnabled()`, `toHaveText()`, `waitForURL()`, `toBeHidden()`

2. Do not use synchronous, non-waiting patterns:

```js
expect(await page.isVisible()).toBe(true)
```

3. Use `expect.soft()` **only for reporting multiple failures intentionally**.

---

## 5. Page Object Model (POM)

1. **Responsibilities**

   * Define **locators based on stable UI contracts** (semantic testId preferred if necessary)
   * Expose intent-based methods (e.g., `submitOrder`, `loginAsUser`) that **guarantee completion of UI state**
   * Must not contain unrelated assertions or expose DOM structure

2. **Test responsibilities**

   * Call POM methods; do not define locators.
   * Contain assertions only for user-visible behavior.

3. **POM completion contract**

   * Methods **must not resolve until UI is ready** for the next interaction.

---

## 6. Hooks, Reuse, and Parallelism

* Use `beforeEach` / `afterEach` only for shared setup while maintaining isolation.
* Reuse authenticated state where applicable.
* Enable parallel execution for independent tests.

---

## 7. Debugging and Maintenance

1. Kiwi Test ID
* Every test case **must include a `kiwi_test_id`** to uniquely identify it.
* If the user provides a Kiwi Test ID, **use it explicitly** in a comment at the top of the test case.
* If the user does not provide a Kiwi Test ID, **use a comment `// kiwi_test_id: TO_BE_FILLED`** as a placeholder.
* After generating the test case, **remind the user to replace `TO_BE_FILLED` with a proper Kiwi Test ID**.

**Example:**

```js
// kiwi_test_id: TO_BE_FILLED
test('User can login successfully', async ({ page }) => {
  const usernameInput = page.getByLabelText('Username');
  const submitButton = page.getByRole('button', { name: 'Submit' });

  await usernameInput.fill('testuser');
  await submitButton.click();
  await expect(page.getByText('Welcome')).toBeVisible();
});


2. Tests and Page Objects are **long-term assets**.

   * Do not trade readability or correctness for short-term test passing.

3. **Do not weaken or remove steps to make tests pass.**

4. Fix issues at the correct layer:

   * Locator changes → Page Objects
   * Repeated actions → Page Objects
   * Flow changes → Test scenarios
   * Timing → Use proper assertions

5. **No architectural violations**

   * Tests must not define locators
   * Page Objects must not contain business assertions

6. **Minimal and intentional refactoring**

   * Preserve public POM APIs unless semantically incorrect.

7. **Stability over workarounds**

   * No `waitForTimeout`
   * No arbitrary delays or forced retries
