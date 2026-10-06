import type { Product } from '../pages/pages';
import { expect, test } from './fixtures';

// Observed business rule (not from a spec): tax is 8% of the item total, rounded to cents.
const TAX_RATE = 0.08;
const toCents = (n: number) => Math.round(n * 100);

const SHOPPER = { firstName: 'Ada', lastName: 'Lovelace', postalCode: '10115' };
const PRODUCTS = ['Sauce Labs Backpack', 'Sauce Labs Bolt T-Shirt'];

test.describe('Checkout journey (standard_user)', () => {
  test('login -> add products -> checkout -> order complete', async ({ loggedIn, cartPage, checkoutPage, page }) => {
    const selected: Product[] = [];
    for (const name of PRODUCTS) selected.push(await loggedIn.addToCart(name));
    await expect(loggedIn.cartBadge).toHaveText(String(PRODUCTS.length));

    await test.step('cart contains exactly the selected products', async () => {
      await loggedIn.openCart();
      await expect(page).toHaveURL(/\/cart\.html$/);
      await expect(cartPage.itemNames).toHaveText(PRODUCTS);
    });

    await test.step('customer information is accepted', async () => {
      await cartPage.checkout();
      await checkoutPage.fillInformation(SHOPPER);
      await expect(page).toHaveURL(/\/checkout-step-two\.html$/);
    });

    await test.step('overview shows the same items and correct totals', async () => {
      await expect(checkoutPage.itemNames).toHaveText(PRODUCTS);
      const { subtotal, tax, total } = await checkoutPage.summary();
      // Compare in integer cents to avoid floating-point noise.
      const expectedSubtotal = selected.reduce((sum, p) => sum + toCents(p.price), 0);
      expect(toCents(subtotal)).toBe(expectedSubtotal);
      expect(toCents(tax)).toBe(Math.round(expectedSubtotal * TAX_RATE));
      expect(toCents(total)).toBe(toCents(subtotal) + toCents(tax));
    });

    await test.step('order completes and the cart is emptied', async () => {
      await checkoutPage.finish();
      await expect(page).toHaveURL(/\/checkout-complete\.html$/);
      await expect(checkoutPage.completeHeader).toHaveText('Thank you for your order!');
      await expect(loggedIn.cartBadge).toHaveCount(0);
    });
  });

  test('checkout information is required', async ({ loggedIn, cartPage, checkoutPage, page }) => {
    await loggedIn.addToCart(PRODUCTS[0]);
    await loggedIn.openCart();
    await cartPage.checkout();

    await checkoutPage.fillInformation({ ...SHOPPER, postalCode: '' });
    await expect(checkoutPage.error).toHaveText('Error: Postal Code is required');
    await expect(page).toHaveURL(/\/checkout-step-one\.html$/);
  });

  // Regression guard for defect D1. Marked test.fail() because it currently fails on purpose:
  // the suite stays green today and starts failing loudly ("unexpected pass") once the bug is
  // fixed, so the annotation gets removed deliberately.
  test('cannot place an order with an empty cart [known defect D1]', async ({ loggedIn, cartPage, page }) => {
    test.fail(true, 'D1: checkout with an empty cart completes a $0.00 order');
    await loggedIn.openCart();
    await expect(cartPage.itemNames).toHaveCount(0);
    await expect(page.getByTestId('checkout')).toBeDisabled({ timeout: 2_000 });
  });
});
