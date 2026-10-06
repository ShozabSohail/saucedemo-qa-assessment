import { test as base } from '@playwright/test';
import { CartPage, CheckoutPage, InventoryPage, LoginPage } from '../pages/pages';

export const USER = {
  username: process.env.SAUCE_USERNAME ?? 'standard_user',
  password: process.env.SAUCE_PASSWORD ?? 'secret_sauce',
};

type Pages = {
  loginPage: LoginPage;
  inventoryPage: InventoryPage;
  cartPage: CartPage;
  checkoutPage: CheckoutPage;
  /** Logs in through the UI; each test gets its own browser context, so cart state never leaks between tests. */
  loggedIn: InventoryPage;
};

export const test = base.extend<Pages>({
  loginPage: async ({ page }, use) => use(new LoginPage(page)),
  inventoryPage: async ({ page }, use) => use(new InventoryPage(page)),
  cartPage: async ({ page }, use) => use(new CartPage(page)),
  checkoutPage: async ({ page }, use) => use(new CheckoutPage(page)),
  loggedIn: async ({ loginPage, inventoryPage }, use) => {
    await loginPage.goto();
    await loginPage.login(USER.username, USER.password);
    await inventoryPage.expectLoaded();
    await use(inventoryPage);
  },
});

export { expect } from '@playwright/test';
