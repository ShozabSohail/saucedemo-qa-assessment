// Exploratory probe: tests each risk hypothesis against the live site
// and saves screenshot evidence to ../evidence. Run: node exploration/probe.mjs
import { chromium } from '@playwright/test';
import fs from 'node:fs';

const BASE = 'https://www.saucedemo.com';
const OUT = new URL('../evidence/', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const results = {};
const log = (k, v) => { results[k] = v; console.log(`${k}:`, JSON.stringify(v)); };

async function login(page, user = 'standard_user') {
  await page.goto(BASE);
  await page.fill('[data-test="username"]', user);
  await page.fill('[data-test="password"]', 'secret_sauce');
  await page.click('[data-test="login-button"]');
  await page.waitForURL('**/inventory.html', { timeout: 60000 });
}
const fresh = async () => { const ctx = await browser.newContext(); return [ctx, await ctx.newPage()]; };

// H1: checkout possible with an empty cart
{
  const [ctx, page] = await fresh();
  await login(page);
  await page.click('[data-test="shopping-cart-link"]');
  const checkoutEnabled = await page.isEnabled('[data-test="checkout"]');
  await page.click('[data-test="checkout"]');
  await page.fill('[data-test="firstName"]', 'A');
  await page.fill('[data-test="lastName"]', 'B');
  await page.fill('[data-test="postalCode"]', '1');
  await page.click('[data-test="continue"]');
  const total = await page.textContent('[data-test="total-label"]');
  await page.screenshot({ path: OUT + 'D1-empty-cart-overview.png' });
  await page.click('[data-test="finish"]');
  const header = await page.textContent('[data-test="complete-header"]');
  await page.screenshot({ path: OUT + 'D1-empty-cart-order-complete.png' });
  log('H1_emptyCartCheckout', { checkoutEnabled, total, header });
  await ctx.close();
}

// H2: checkout form accepts whitespace-only / invalid input
{
  const [ctx, page] = await fresh();
  await login(page);
  await page.click('[data-test="add-to-cart-sauce-labs-backpack"]');
  await page.goto(BASE + '/checkout-step-one.html');
  await page.fill('[data-test="firstName"]', '   ');
  await page.fill('[data-test="lastName"]', '   ');
  await page.fill('[data-test="postalCode"]', '!!@@##');
  await page.screenshot({ path: OUT + 'D5-whitespace-form-input.png' });
  await page.click('[data-test="continue"]');
  const url = page.url();
  await page.screenshot({ path: OUT + 'D5-whitespace-form-accepted.png' });
  // very long input
  await page.goto(BASE + '/checkout-step-one.html');
  await page.fill('[data-test="firstName"]', 'x'.repeat(5000));
  const len = (await page.inputValue('[data-test="firstName"]')).length;
  log('H2_formValidation', { urlAfterWhitespace: url, maxlenAccepted: len });
  await ctx.close();
}

// H3: Reset App State leaves stale "Remove" buttons
{
  const [ctx, page] = await fresh();
  await login(page);
  await page.click('[data-test="add-to-cart-sauce-labs-backpack"]');
  await page.click('[data-test="add-to-cart-sauce-labs-bike-light"]');
  const badgeBefore = await page.textContent('[data-test="shopping-cart-badge"]');
  await page.click('#react-burger-menu-btn');
  await page.click('[data-test="reset-sidebar-link"]');
  await page.click('#react-burger-cross-btn');
  await page.locator('.bm-menu-wrap').waitFor({ state: 'hidden' });
  const badgeAfter = await page.locator('[data-test="shopping-cart-badge"]').count();
  const removeButtons = await page.locator('button:has-text("Remove")').count();
  await page.screenshot({ path: OUT + 'D4-reset-state-stale-buttons.png' });
  // does clicking a stale "Remove" do anything?
  await page.click('[data-test="remove-sauce-labs-backpack"]');
  const badgeAfterClick = await page.locator('[data-test="shopping-cart-badge"]').count();
  await page.reload();
  const removeAfterReload = await page.locator('button:has-text("Remove")').count();
  log('H3_resetAppState', { badgeBefore, badgeAfter, removeButtons, badgeAfterClick, removeAfterReload });
  await ctx.close();
}

// H4: cart persists across logout -> visible to next user on the same browser
{
  const [ctx, page] = await fresh();
  await login(page, 'standard_user');
  await page.click('[data-test="add-to-cart-sauce-labs-onesie"]');
  await page.click('#react-burger-menu-btn');
  await page.click('[data-test="logout-sidebar-link"]');
  const ls = await page.evaluate(() => ({ ...localStorage }));
  await login(page, 'performance_glitch_user'); // normal layout, unlike visual_user
  const badge = await page.locator('[data-test="shopping-cart-badge"]').textContent().catch(() => null);
  await page.click('[data-test="shopping-cart-link"]');
  const items = await page.locator('[data-test="inventory-item-name"]').allTextContents();
  await page.screenshot({ path: OUT + 'D3-cart-leaks-between-users.png' });
  log('H4_cartAcrossUsers', { localStorageAfterLogout: ls, badgeForNextUser: badge, items });
  await ctx.close();
}

// H5: auth is a client-side cookie -> forge it to bypass login
{
  const [ctx, page] = await fresh();
  await ctx.addCookies([{ name: 'session-username', value: 'standard_user', url: BASE }]);
  await page.goto(BASE + '/inventory.html');
  const onInventory = await page.locator('[data-test="inventory-list"]').isVisible();
  await page.screenshot({ path: OUT + 'OBS-forged-cookie-bypass.png' });
  // without cookie
  const [ctx2, page2] = await fresh();
  await page2.goto(BASE + '/inventory.html');
  const err = await page2.textContent('[data-test="error"]');
  // locked_out_user via cookie
  const [ctx3, page3] = await fresh();
  await ctx3.addCookies([{ name: 'session-username', value: 'locked_out_user', url: BASE }]);
  await page3.goto(BASE + '/inventory.html');
  const lockedBypass = await page3.locator('[data-test="inventory-list"]').isVisible();
  await page3.screenshot({ path: OUT + 'OBS-locked-out-cookie-blocked.png' });
  const cookies = await (async () => { const [c, p] = await fresh(); await login(p); const ck = await c.cookies(); await c.close(); return ck; })();
  log('H5_cookieAuth', { onInventory, directAccessError: err, lockedBypass, cookies: cookies.map(c => ({ name: c.name, httpOnly: c.httpOnly, secure: c.secure, expires: c.expires })) });
  await ctx.close(); await ctx2.close(); await ctx3.close();
}

// H6: sort selection is not preserved after visiting a product and returning
{
  const [ctx, page] = await fresh();
  await login(page);
  await page.selectOption('[data-test="product-sort-container"]', 'lohi');
  const first = await page.locator('[data-test="inventory-item-name"]').first().textContent();
  await page.locator('[data-test="inventory-item-name"]').first().click();
  await page.click('[data-test="back-to-products"]');
  const sortAfter = await page.inputValue('[data-test="product-sort-container"]');
  const firstAfter = await page.locator('[data-test="inventory-item-name"]').first().textContent();
  // verify sorting correctness
  await page.selectOption('[data-test="product-sort-container"]', 'hilo');
  const prices = (await page.locator('[data-test="inventory-item-price"]').allTextContents()).map(p => +p.slice(1));
  const sortedDesc = prices.every((p, i) => i === 0 || prices[i - 1] >= p);
  log('H6_sort', { first, sortAfter, firstAfter, pricesHiLo: prices, sortedDesc });
  await ctx.close();
}

// H7: invalid product id, footer year, totals/tax math, login edge cases
{
  const [ctx, page] = await fresh();
  await login(page);
  await page.goto(BASE + '/inventory-item.html?id=999');
  const name = await page.textContent('[data-test="inventory-item-name"]').catch(() => null);
  const price = await page.textContent('[data-test="inventory-item-price"]').catch(() => null);
  const addBtn = await page.locator('button[data-test^="add-to-cart"]').count();
  await page.screenshot({ path: OUT + 'D2-invalid-product-page.png' });
  let addedInvalid = null;
  if (addBtn) {
    await page.locator('button[data-test^="add-to-cart"]').click();
    addedInvalid = await page.locator('[data-test="shopping-cart-badge"]').textContent().catch(() => null);
    await page.goto(BASE + '/cart.html');
    await page.screenshot({ path: OUT + 'D2-badge-cart-mismatch.png' });
    addedInvalid = { badge: addedInvalid, cartItems: await page.locator('[data-test="inventory-item-name"]').allTextContents() };
  }
  const footer = await page.textContent('[data-test="footer-copy"]');
  log('H7_invalidProduct', { name, price, addBtn, addedInvalid, footer });
  await ctx.close();
}
{
  const [ctx, page] = await fresh();
  await login(page);
  for (const id of ['sauce-labs-backpack', 'sauce-labs-bolt-t-shirt', 'sauce-labs-fleece-jacket']) await page.click(`[data-test="add-to-cart-${id}"]`);
  await page.goto(BASE + '/checkout-step-one.html');
  await page.fill('[data-test="firstName"]', 'A'); await page.fill('[data-test="lastName"]', 'B'); await page.fill('[data-test="postalCode"]', '1');
  await page.click('[data-test="continue"]');
  const prices = (await page.locator('[data-test="inventory-item-price"]').allTextContents()).map(p => +p.slice(1));
  const sub = await page.textContent('[data-test="subtotal-label"]');
  const tax = await page.textContent('[data-test="tax-label"]');
  const total = await page.textContent('[data-test="total-label"]');
  const qty = await page.locator('[data-test="item-quantity"]').allTextContents();
  log('H8_totals', { prices, sum: prices.reduce((a, b) => a + b, 0), sub, tax, total, qty });
  // H9: back button after finish
  await page.click('[data-test="finish"]');
  await page.goBack();
  const backUrl = page.url();
  const backItems = await page.locator('[data-test="inventory-item-name"]').count();
  await page.screenshot({ path: OUT + 'OBS-back-after-finish.png' });
  log('H9_backAfterFinish', { backUrl, backItems });
  await ctx.close();
}
{
  const [ctx, page] = await fresh();
  await page.goto(BASE);
  const attempt = async (u, p) => {
    await page.fill('[data-test="username"]', u); await page.fill('[data-test="password"]', p);
    await page.click('[data-test="login-button"]');
    await page.waitForTimeout(300);
    const ok = page.url().includes('inventory');
    const err = ok ? null : await page.textContent('[data-test="error"]');
    if (ok) { await page.goto(BASE); }
    return { ok, err };
  };
  log('H10_login', {
    trailingSpace: await attempt('standard_user ', 'secret_sauce'),
    upperCase: await attempt('STANDARD_USER', 'secret_sauce'),
    emptyPwd: await attempt('standard_user', ''),
    lockedOut: await attempt('locked_out_user', 'secret_sauce'),
    passwordType: await page.getAttribute('[data-test="password"]', 'type'),
  });
  // H11: logout then back button
  await page.fill('[data-test="username"]', 'standard_user'); await page.fill('[data-test="password"]', 'secret_sauce');
  await page.click('[data-test="login-button"]'); await page.waitForURL('**/inventory.html');
  await page.click('#react-burger-menu-btn'); await page.click('[data-test="logout-sidebar-link"]');
  await page.goBack();
  await page.waitForTimeout(500);
  log('H11_backAfterLogout', { url: page.url(), error: await page.textContent('[data-test="error"]').catch(() => null) });
  await ctx.close();
}
// H12: accessibility quick checks
{
  const [ctx, page] = await fresh();
  await page.goto(BASE);
  const loginLabels = await page.locator('label').count();
  await login(page);
  const imgsNoAlt = await page.locator('img:not([alt]), img[alt=""]').count();
  const cartLinkName = await page.locator('[data-test="shopping-cart-link"]').evaluate(e => ({ text: e.textContent.trim(), aria: e.getAttribute('aria-label') }));
  const burgerName = await page.locator('#react-burger-menu-btn').evaluate(e => e.textContent.trim() || e.getAttribute('aria-label'));
  const lang = await page.getAttribute('html', 'lang');
  log('H12_a11y', { loginLabels, imgsNoAlt, cartLinkName, burgerName, lang });
  await ctx.close();
}

fs.writeFileSync(OUT + 'probe-results.json', JSON.stringify(results, null, 2));
await browser.close();
