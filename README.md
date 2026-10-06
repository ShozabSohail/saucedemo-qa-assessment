# SauceDemo – QA & AI Assessment

Practical QA assessment of <https://www.saucedemo.com/> (`standard_user`).

- **[SUBMISSION.md](SUBMISSION.md)**: the full write-up: AI prompt log (Task A), defect report (Task B), automation notes (Task C), AI-driven QA proposal (Task D), and tools used.
- **[tests/](tests/)** and **[pages/](pages/)**: the Playwright end-to-end checkout test (Task C).
- **[exploration/](exploration/)**: the scripts used to check each exploratory hypothesis against the live site. They regenerate the screenshots in [evidence/](evidence/).

## Prerequisites

- Node.js 18 or newer (tested with Node 20.16)
- Internet access to www.saucedemo.com

## Setup

```bash
npm ci                                 # or: npm install
npx playwright install chromium        # one-time browser download
```

## Run the automated test (Task C)

```bash
npm test                 # headless, all specs
npm run test:headed      # watch it run
npm run report           # open the HTML report from the last run
npm run typecheck        # strict TypeScript check
```

Optional environment variables:

| Variable | Default | Purpose |
|---|---|---|
| `BASE_URL` | `https://www.saucedemo.com` | Run the tests against another environment |
| `SAUCE_USERNAME` / `SAUCE_PASSWORD` | `standard_user` / `secret_sauce` | Test account |
| `PW_CHANNEL` | *(bundled Chromium)* | Set to `chrome` or `msedge` to use an installed browser |

Expected result: **3 passed**. One of these is `cannot place an order with an empty cart [known defect D1]`, which is marked `test.fail()`. It fails on purpose today and will be reported as an *unexpected pass* once defect D1 is fixed. The test list output shows it with an `x` marker, but it counts as passed.

## What the tests cover

| Test | Purpose |
|---|---|
| `login -> add products -> checkout -> order complete` | Main purchase journey. Checks the cart badge count, that the cart and the overview show exactly the selected items, the subtotal (sum of listing prices), tax (8%), total (subtotal + tax), the completion message, and that the cart is emptied. |
| `checkout information is required` | Negative test: a missing postal code blocks checkout and shows an error |
| `cannot place an order with an empty cart [known defect D1]` | Guard that fails once defect D1 is fixed (see SUBMISSION.md) |

Design choices:
- **Page objects** in `pages/pages.ts`.
- **Fixtures** in `tests/fixtures.ts`.
- **Selectors:** `data-test` attributes via `getByTestId` (set with `testIdAttribute`), and products located by visible name rather than by position.
- **Waiting:** no fixed waits; only Playwright's auto-waiting assertions.
- **Isolation:** each test gets a new browser context, so cart and localStorage state can't leak between tests.
- **Money:** amounts are compared in integer cents to avoid floating-point errors.

## Re-run the exploratory checks

```bash
npm run explore                        # prints the result of each hypothesis and refreshes evidence/*.png
node exploration/probe-followup.mjs    # D2: an invalid product in the cart crashes checkout
```
