import { test, expect } from "@playwright/test";

test.describe("Kapruka Flow AI Smoke Tests", () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to local dev server
    await page.goto("http://localhost:3000/");
  });

  test("1. Guest builds cart and reviews catalog", async ({ page }) => {
    // Fill the intent canvas text area
    const textarea = page.locator("textarea, input[placeholder*='tea'], input[placeholder*='need']").first();
    await expect(textarea).toBeVisible();
    await textarea.fill("Need a gift pack of flowers and chocolates under 10000 LKR");

    // Click build cart
    const buildBtn = page.locator("button:has-text('Build My Cart'), button:has-text('Compose'), button[type='submit']").first();
    await buildBtn.click();

    // Verify it transitions to workspace or cart page state
    await expect(page.locator("text=Cart, text=Curation Story, .flow-card").first()).toBeVisible({ timeout: 15000 });
  });

  test("2. Logged-in user profile shows correct name/email", async ({ page }) => {
    // Click account login button
    const loginBtn = page.locator("button:has-text('Sign In'), button:has-text('Login'), button:has-text('Sign in')").first();
    if (await loginBtn.isVisible()) {
      await loginBtn.click();

      // Fill mock login credentials
      await page.locator("input[type='email']").fill("customer@kapruka.com");
      await page.locator("input[type='password']").fill("password123");
      await page.locator("button[type='submit']:has-text('Login'), button:has-text('Sign in')").click();
    }

    // Verify profile shows correct user info
    const accountBtn = page.locator("button:has-text('Account'), button[aria-label='My account']").first();
    await expect(accountBtn).toBeVisible();
    await accountBtn.click();

    // Verify email/name in profile modal
    await expect(page.locator("text=customer@kapruka.com, text=Order history")).toBeVisible();
  });

  test("3. Language switch updates cart + checkout text", async ({ page }) => {
    // Change language to Sinhala
    const langSelector = page.locator("button:has-text('Sinhala'), button:has-text('සිංහල')").first();
    if (await langSelector.isVisible()) {
      await langSelector.click();
    } else {
      // Look for a language dropdown/menu
      const langTrigger = page.locator("button:has-text('English')").first();
      await langTrigger.click();
      await page.locator("button:has-text('සිංහල')").click();
    }

    // Verify UI updates text dynamically (e.g. check for 'කරත්ත ඉතිහාසය' or 'සංසන්දනය')
    await expect(page.locator("text=කරත්ත ඉතිහාසය, text=ඔබ සඳහා, text=සංසන්දනය").first()).toBeVisible();
  });

  test("4. Suggestion click updates cart", async ({ page }) => {
    // Verify suggestions list is rendered
    const suggestionPill = page.locator(".chat-sugg-card, button:has-text('Add chocolates'), button:has-text('Add flowers')").first();
    await expect(suggestionPill).toBeVisible();
    
    // Store cart count
    const cartCountBefore = await page.locator("button[aria-label*='Cart'], button[title='Cart']").first().innerText();
    
    // Click a suggestion
    await suggestionPill.click();
    
    // Verify it updates or sends request
    await page.waitForTimeout(2000);
    const cartCountAfter = await page.locator("button[aria-label*='Cart'], button[title='Cart']").first().innerText();
    expect(cartCountAfter).not.toEqual(cartCountBefore);
  });

  test("5. Checkout empty form shows validation errors", async ({ page }) => {
    // Open checkout modal
    const checkoutBtn = page.locator("button:has-text('Review & Checkout'), button:has-text('Checkout')").first();
    await checkoutBtn.click();

    // Verify modal is visible
    const submitBtn = page.locator("button[type='submit']:has-text('Continue to Payment'), button:has-text('Payment')").first();
    await expect(submitBtn).toBeVisible();

    // Click submit without entering values
    await submitBtn.click();

    // Verify field-level error messages are shown
    await expect(page.locator("text=Sender name is required, text=Recipient name is required").first()).toBeVisible();
  });

  test("6. Compare Versions opens/closes", async ({ page }) => {
    // Open Compare Versions modal
    const compareBtn = page.locator("button:has-text('Compare Versions'), button:has-text('සංසන්දනය')").first();
    await expect(compareBtn).toBeVisible();
    await compareBtn.click();

    // Verify PlanComparisonMatrix modal is open
    const modalHeader = page.locator("h3:has-text('Compare Versions'), h3:has-text('සංසන්දනය')").first();
    await expect(modalHeader).toBeVisible();

    // Close the modal
    const closeBtn = page.locator("button[aria-label='Close'], button:has-text('✕')").first();
    await closeBtn.click();

    // Verify modal is closed
    await expect(modalHeader).not.toBeVisible();
  });

  test("7. Category menu does not hang and loads fallback categories", async ({ page }) => {
    // Click category menu trigger
    const categoryTrigger = page.locator("button:has-text('All Categories'), button:has-text('සියලුම කාණ්ඩ')").first();
    await expect(categoryTrigger).toBeVisible();
    await categoryTrigger.click();

    // Verify category list loads within reasonable time and doesn't remain in perpetual loading state
    const categoriesList = page.locator("div:has-text('Flowers'), div:has-text('Cakes'), div:has-text('Groceries')").first();
    await expect(categoriesList).toBeVisible({ timeout: 5000 });
  });
});
