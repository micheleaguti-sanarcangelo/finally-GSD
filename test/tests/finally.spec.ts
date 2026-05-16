import { test, expect } from '@playwright/test';

test.beforeAll(async ({ request }) => {
  await request.post('/api/test/reset');
});

test('TEST-01: fresh start shows default watchlist and $10k balance', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('text=AAPL', { timeout: 10000 });

  for (const ticker of ['AAPL', 'GOOGL', 'MSFT', 'AMZN', 'TSLA', 'NVDA', 'META', 'JPM', 'V', 'NFLX']) {
    await expect(page.getByText(ticker).first()).toBeVisible();
  }

  // Locale-agnostic: parse the cash display numerically
  await expect(page.getByTestId('header-cash')).toBeVisible({ timeout: 10000 });
  const cashText = await page.getByTestId('header-cash').textContent();
  const cashValue = parseFloat((cashText ?? '0').replace(/[^0-9.]/g, ''));
  expect(cashValue).toBeCloseTo(10000, 0);

  await expect(page.locator('td').filter({ hasText: /^\$\d+\.\d{2}$/ }).first()).toBeVisible();
});

test('TEST-02: add and remove a ticker from the watchlist', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('text=AAPL', { timeout: 10000 });

  await page.getByTestId('watchlist-ticker-input').fill('BABA');
  await page.getByTestId('watchlist-add-btn').click();
  await expect(page.getByText('BABA').first()).toBeVisible({ timeout: 5000 });

  const babaRow = page.getByRole('row').filter({ hasText: 'BABA' });
  await babaRow.getByRole('button').click();
  await expect(page.getByText('BABA').first()).not.toBeVisible({ timeout: 5000 });
});

test('TEST-03: buy shares decreases cash and creates position', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('text=AAPL', { timeout: 10000 });

  // Wait for portfolio to load (cash shows real value, not the 0 default)
  await expect(page.getByTestId('header-cash')).toBeVisible({ timeout: 10000 });
  await expect(page.getByText('No positions — buy something from the trade bar')).toBeVisible({ timeout: 5000 });

  await page.getByTestId('trade-ticker-input').fill('AAPL');
  await page.getByTestId('trade-qty-input').fill('5');
  await page.getByTestId('trade-buy-btn').click();

  // Position appeared — trade executed (portfolio total stays ~$10k so don't assert on it)
  await expect(page.getByText('No positions — buy something from the trade bar')).not.toBeVisible({ timeout: 5000 });

  // Cash balance decreased (portfolio value stays flat; cash is the right metric)
  const cashText = await page.getByTestId('header-cash').textContent();
  const cash = parseFloat((cashText ?? '0').replace(/[$,]/g, ''));
  expect(cash).toBeLessThan(10000);
});

test('TEST-04: sell shares increases cash', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('text=AAPL', { timeout: 10000 });

  // Setup: buy 5 shares
  await page.getByTestId('trade-ticker-input').fill('AAPL');
  await page.getByTestId('trade-qty-input').fill('5');
  await page.getByTestId('trade-buy-btn').click();
  await expect(page.getByText('No positions — buy something from the trade bar')).not.toBeVisible({ timeout: 5000 });

  // Record cash immediately after buy
  await page.waitForTimeout(500);
  const cashAfterBuyText = await page.getByTestId('header-cash').textContent();
  const cashAfterBuy = parseFloat((cashAfterBuyText ?? '0').replace(/[$,]/g, ''));

  // Sell 3 shares
  await page.getByTestId('trade-ticker-input').fill('AAPL');
  await page.getByTestId('trade-qty-input').fill('3');
  await page.getByTestId('trade-sell-btn').click();

  // Wait for cash display to update, then assert it increased
  await page.waitForTimeout(1000);
  const cashAfterSellText = await page.getByTestId('header-cash').textContent();
  const cashAfterSell = parseFloat((cashAfterSellText ?? '0').replace(/[$,]/g, ''));
  expect(cashAfterSell).toBeGreaterThan(cashAfterBuy);
});

test('TEST-05: portfolio heatmap and P&L chart render after trade', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('text=AAPL', { timeout: 10000 });

  await page.getByTestId('trade-ticker-input').fill('AAPL');
  await page.getByTestId('trade-qty-input').fill('1');
  await page.getByTestId('trade-buy-btn').click();
  await expect(page.getByText('No positions — buy something from the trade bar')).not.toBeVisible({ timeout: 5000 });

  await expect(page.getByText('No positions yet')).not.toBeVisible({ timeout: 5000 });
  await expect(page.locator('svg').first()).toBeVisible();

  await expect(page.getByText('Portfolio history will appear after first trade')).not.toBeVisible({ timeout: 10000 });
  await expect(page.getByText('Portfolio Value (USD)')).toBeVisible();
});

test('TEST-06: AI chat (mocked) sends message and shows trade confirmation', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('text=AAPL', { timeout: 10000 });

  await page.getByTestId('chat-input').fill('Buy me some AAPL');
  await page.getByTestId('chat-send-btn').click();

  await expect(page.getByText('Thinking...')).toBeVisible({ timeout: 5000 });

  await expect(page.getByText(/Mock:/)).toBeVisible({ timeout: 10000 });

  await expect(page.getByText(/Executed buy 1 AAPL/i)).toBeVisible({ timeout: 10000 });
});

test('TEST-07: SSE disconnect and reconnect restores live prices', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('text=AAPL', { timeout: 10000 });

  // Initially connected
  await expect(page.getByTestId('connection-status')).toHaveAttribute('title', 'OPEN', { timeout: 5000 });

  // Block SSE route before next connection, then reload so EventSource connects through the blocked route
  await page.route('/api/stream/prices', route => route.abort());
  await page.reload();

  // After reload, EventSource immediately tries to connect but gets aborted → not OPEN
  await expect(page.getByTestId('connection-status')).not.toHaveAttribute('title', 'OPEN', { timeout: 10000 });

  // Unblock — EventSource auto-reconnects
  await page.unroute('/api/stream/prices');

  await expect(page.getByTestId('connection-status')).toHaveAttribute('title', 'OPEN', { timeout: 15000 });
});
