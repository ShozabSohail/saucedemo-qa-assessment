// Follow-up checks for the invalid-product finding and the cart link's accessible name.
import { chromium } from '@playwright/test';

const BASE = 'https://www.saucedemo.com';
const browser = await chromium.launch();
const page = await (await browser.newContext()).newPage();
page.on('pageerror', e => console.log('PAGEERROR:', e.message));
page.on('console', m => { if (m.type() === 'error') console.log('CONSOLE.ERROR:', m.text().slice(0, 200)); });
await page.goto(BASE);
await page.fill('[data-test="username"]', 'standard_user');
await page.fill('[data-test="password"]', 'secret_sauce');
await page.click('[data-test="login-button"]');

await page.click('[data-test="add-to-cart-sauce-labs-backpack"]');
console.log('cart aria after add:', await page.getAttribute('[data-test="shopping-cart-link"]', 'aria-label'));

await page.goto(BASE + '/inventory-item.html?id=999');
await page.locator('button[data-test^="add-to-cart"]').click();
console.log('badge with phantom:', await page.textContent('[data-test="shopping-cart-badge"]'));
console.log('localStorage cart:', await page.evaluate(() => localStorage.getItem('cart-contents')));
await page.goto(BASE + '/cart.html');
console.log('cart rows:', await page.locator('[data-test="inventory-item-name"]').allTextContents());
await page.click('[data-test="checkout"]');
await page.fill('[data-test="firstName"]', 'A'); await page.fill('[data-test="lastName"]', 'B'); await page.fill('[data-test="postalCode"]', '1');
await page.click('[data-test="continue"]');
console.log("url:", page.url(), "error:", await page.locator("[data-test=error]").textContent().catch(()=>null));
await page.waitForLoadState("networkidle");
console.log("body text length:", (await page.locator("body").innerText()).length);
await page.screenshot({ path: "evidence/D2-checkout-white-screen.png" });
await browser.close();
