import { expect, type Locator, type Page } from '@playwright/test';

/** "$29.99" / "Item total: $29.99" -> 29.99 */
export const parsePrice = (text: string): number => Number(text.replace(/[^0-9.]/g, ''));

export type Product = { name: string; price: number };

export class LoginPage {
  constructor(private readonly page: Page) {}

  async goto() {
    await this.page.goto('/');
  }

  async login(username: string, password: string) {
    await this.page.getByTestId('username').fill(username);
    await this.page.getByTestId('password').fill(password);
    await this.page.getByTestId('login-button').click();
  }

  get error(): Locator {
    return this.page.getByTestId('error');
  }
}

export class InventoryPage {
  constructor(private readonly page: Page) {}

  get cartBadge(): Locator {
    return this.page.getByTestId('shopping-cart-badge');
  }

  async expectLoaded() {
    await expect(this.page).toHaveURL(/\/inventory\.html$/);
    await expect(this.page.getByTestId('inventory-list')).toBeVisible();
  }

  private card(name: string): Locator {
    return this.page.getByTestId('inventory-item').filter({
      has: this.page.getByTestId('inventory-item-name').getByText(name, { exact: true }),
    });
  }

  /** Adds a product by its visible name and returns the name/price shown on the listing. */
  async addToCart(name: string): Promise<Product> {
    const card = this.card(name);
    const price = parsePrice(await card.getByTestId('inventory-item-price').innerText());
    await card.getByRole('button', { name: 'Add to cart' }).click();
    await expect(card.getByRole('button', { name: 'Remove' })).toBeVisible();
    return { name, price };
  }

  async openCart() {
    await this.page.getByTestId('shopping-cart-link').click();
  }
}

export class CartPage {
  constructor(private readonly page: Page) {}

  get itemNames(): Locator {
    return this.page.getByTestId('inventory-item-name');
  }

  async checkout() {
    await this.page.getByTestId('checkout').click();
  }
}

export class CheckoutPage {
  constructor(private readonly page: Page) {}

  async fillInformation(info: { firstName: string; lastName: string; postalCode: string }) {
    await this.page.getByTestId('firstName').fill(info.firstName);
    await this.page.getByTestId('lastName').fill(info.lastName);
    await this.page.getByTestId('postalCode').fill(info.postalCode);
    await this.page.getByTestId('continue').click();
  }

  get error(): Locator {
    return this.page.getByTestId('error');
  }

  get itemNames(): Locator {
    return this.page.getByTestId('inventory-item-name');
  }

  async summary() {
    return {
      subtotal: parsePrice(await this.page.getByTestId('subtotal-label').innerText()),
      tax: parsePrice(await this.page.getByTestId('tax-label').innerText()),
      total: parsePrice(await this.page.getByTestId('total-label').innerText()),
    };
  }

  async finish() {
    await this.page.getByTestId('finish').click();
  }

  get completeHeader(): Locator {
    return this.page.getByTestId('complete-header');
  }
}
