const assert = require('node:assert/strict');
const { chromium, webkit, devices } = require('playwright');
const base = process.env.BRTA_TEST_URL || 'http://127.0.0.1:8822/';

(async () => {
  for (const [engine, device] of [[chromium, 'Pixel 7'], [webkit, 'iPhone 13']]) {
    const browser = await engine.launch();
    try {
      const page = await browser.newPage({ ...devices[device], serviceWorkers: 'block' });
      page.setDefaultTimeout(20000);
      await page.addInitScript(() => localStorage.setItem('brta-rating-model', 'RM3'));
      await page.goto(base);
      const overlay = page.locator('#navigationOverlay');
      await overlay.getByRole('heading', { name: 'Welcome to BRTA Power Ratings' }).waitFor();
      await overlay.getByRole('option', { name: /Find my competition/ }).click();
      await overlay.getByRole('option').first().click();
      const chosen = await page.evaluate(() => DATA.catalog.find(row => row.competition_code === DATA.catalog[0].competition_code));
      await overlay.getByRole('option').first().click();
      await overlay.waitFor({ state: 'hidden' });
      assert.equal(await page.evaluate(() => localStorage.getItem('brta-default-section')), chosen.section_code);
      await page.goto(base);
      await page.locator('.result-match').first().waitFor();
      assert.equal(await page.evaluate(() => D.meta.section_code), chosen.section_code);
      assert.equal(await overlay.isVisible(), false);
      assert.equal(await page.locator('.section-picker-footer #exportSectionBtn').isVisible(), true);
      assert.equal(await page.locator('.section-picker-footer #provToggle').isVisible(), true);
      await page.getByRole('button', { name: 'Quick navigation', exact: true }).click();
      const search = overlay.getByRole('combobox');
      const searchFocused = () => search.evaluate(el => el === document.activeElement);
      assert.equal(await searchFocused(), false);
      await overlay.getByRole('option', { name: /^Current competitions/ }).click();
      assert.equal(await searchFocused(), false);
      await overlay.getByRole('button', { name: 'Back to navigation' }).click();
      assert.equal(await searchFocused(), false);
      const team = await page.evaluate(() => BRTATeamLab.teamNames(D)[0]);
      await search.fill(team);
      await overlay.getByRole('option').filter({ hasText: 'Team · ' }).first().click();
      assert.equal(await overlay.getByRole('heading', { name: team, exact: true }).isVisible(), true);
      await overlay.getByRole('option', { name: /^Results & fixtures/ }).click();
      assert.equal(await overlay.getByRole('heading', { name: team + ' results & fixtures', exact: true }).isVisible(), true);
      await overlay.getByRole('button', { name: 'Back to navigation' }).click();
      await overlay.getByRole('button', { name: 'Back to navigation' }).click();
      await search.fill('BLTC Bodley');
      await overlay.getByRole('option', { name: /^BLTC Bodley Team entries/ }).click();
      assert.equal(await overlay.getByRole('heading', { name: 'BLTC Bodley', exact: true }).isVisible(), true);
      await overlay.getByRole('button', { name: 'Back to navigation' }).click();
      await search.fill('standings');
      await search.press('Enter');
      await overlay.waitFor({ state: 'hidden' });
      await page.locator('#standingsBody').waitFor({ state: 'visible' });
      await page.keyboard.press('Control+Shift+P');
      await search.fill('zzzzzzzzzz');
      assert.equal(await overlay.getByRole('option').count(), 0);
      await search.press('ArrowDown');
      await search.press('Enter');
      await page.keyboard.press('Escape');
      await overlay.waitFor({ state: 'hidden' });
      assert.equal(await page.locator('#quickNavigationBtn').evaluate(el => el === document.activeElement), true);
      await page.keyboard.press('Shift+Alt+U');
      await search.waitFor();
      assert.equal(await page.locator('#vaultConsoleOverlay:not(.hidden)').count(), 0);
      await page.keyboard.press('Escape');

      const menu = page.getByRole('button', { name: 'Menu', exact: true });
      await menu.click();
      const header = page.getByRole('dialog', { name: 'Menu', exact: true });
      await header.getByRole('button', { name: 'Settings', exact: true }).click();
      await header.waitFor({ state: 'hidden' });
      const settings = page.locator('#settingsOverlay');
      await settings.getByRole('button', { name: 'Close', exact: true }).click();
      await page.getByRole('button', { name: 'Tutorial', exact: true }).click();
      await page.getByRole('button', { name: /^Quick navigation Search/ }).click();
      const tutorial = page.locator('#tutorialTour');
      await tutorial.getByRole('button', { name: 'Next', exact: true }).click();
      const finish = tutorial.getByRole('button', { name: 'Finish', exact: true });
      await finish.waitFor();
      assert.equal(await searchFocused(), false);
      assert.equal(await overlay.evaluate(el => el.inert), true);
      await tutorial.getByRole('button', { name: 'Exit tutorial' }).click();
      await overlay.waitFor({ state: 'hidden' });
      assert.equal(await page.locator('#page-standings').isVisible(), true);

      const route = await page.evaluate(() => BRTASiteRoutes.path(D.meta, 'results', {}));
      const shared = await browser.newPage({ ...devices[device], serviceWorkers: 'block' });
      await shared.addInitScript(() => localStorage.setItem('brta-rating-model', 'RM3'));
      await shared.goto(base + '?brta-route=' + encodeURIComponent(route));
      await shared.locator('.result-match').first().waitFor();
      assert.equal(await shared.locator('#navigationOverlay').isVisible(), false);
      console.log(device + ': first visit, defaults, keyboard navigation and shared links passed');
    } finally {
      await browser.close();
    }
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
