const assert = require('node:assert/strict');
const { chromium, webkit, devices } = require('playwright');
const { sample } = require('../test_custom_sections');

const baseURL = process.env.BRTA_TEST_URL || 'http://127.0.0.1:8822/';
const competition = sample();
competition.ratingModel = 'V3';
competition.singlesBestOf = 3;
for (const round of competition.rounds) {
  for (const rubber of round.fixtures[0].rubbers) {
    if (rubber.type === 'Singles') rubber.sets = [
      { h: 6, a: 4 }, { h: 4, a: 6 }, { h: 10, a: 8, mt: true }
    ];
  }
}

async function openCompetition(page) {
  await page.addInitScript(() => { localStorage.setItem('brta-rating-model', 'RM3'); localStorage.setItem('brta-onboarding-v1', '1'); });
  await page.goto(baseURL);
  await page.locator('.result-match').first().waitFor();
  await page.evaluate(async section => {
    CustomSections.openBackup({ format: 'brta-custom-sections', version: 1, sections: [section] });
    close('#customAdminOverlay');
    if (!(await loadSection(section.id))) throw Error('Could not load the custom fixture set');
    switchPage('results');
  }, competition);
}

async function viewportPosition(locator) {
  return locator.evaluate(element => element.getBoundingClientRect().top);
}

async function checkPrediction(page) {
  await page.getByRole('button', { name: 'Fixtures', exact: true }).click();
  await page.locator('.fixture-match[data-predict-id]').first().click();
  const sheet = page.locator('#predictionOverlay .prediction-sheet');
  const player = sheet.locator('[data-predict-side="home"]:checked').first();
  await player.scrollIntoViewIfNeeded();
  const name = await player.getAttribute('data-predict-player');
  const control = sheet.locator('[data-predict-side="home"][data-predict-player=' + JSON.stringify(name) + ']');
  await control.focus();
  const top = await viewportPosition(control);
  assert(await sheet.evaluate(element => element.scrollTop) > 40, 'Prediction test must start down the sheet');
  await control.press('Space');
  assert.equal(await control.isChecked(), false);
  assert(await sheet.evaluate(element => element.scrollTop) > 40, 'Prediction must stay scrolled after a change');
  assert(Math.abs(await viewportPosition(control) - top) <= 3, 'Prediction must keep the edited player in place');
  assert(await control.evaluate(element => element === document.activeElement), 'Prediction must restore focus');
  await page.locator('#predictionClose').click();
}

async function checkScorecardAndEditor(page) {
  await page.getByRole('button', { name: 'Results', exact: true }).click();
  const result = page.locator('.result-match[data-match-id]').first();
  const fixtureId = await result.getAttribute('data-match-id');
  await result.focus();
  await result.click();
  const sheet = page.locator('#resultOverlay .result-scroll');
  const scores = sheet.locator('.rubber-score-854 strong');
  await scores.first().waitFor();
  const texts = await scores.allTextContents();
  assert(texts.some(score => score.includes('6-4, 4-6')), 'Expected a comma-separated multi-set score');
  assert(await scores.evaluateAll(elements => elements.every(element => {
    const range = document.createRange();
    range.selectNodeContents(element);
    return range.getClientRects().length === 1 && element.scrollWidth <= element.clientWidth + 1;
  })), 'Score text must fit on one line');
  const bodyScroll = await page.evaluate(() => window.scrollY);
  const scroll = await sheet.evaluate(element => {
    element.scrollTop = 80;
    return element.scrollTop;
  });
  assert(scroll > 0, 'Scoresheet must be independently scrollable');
  assert.equal(await page.evaluate(() => window.scrollY), bodyScroll, 'Scoresheet must leave the page in place');
  await page.locator('#resultClose').click();
  assert.equal(await page.locator(':focus').getAttribute('data-match-id'), fixtureId);

  await result.click();
  await page.locator('#resultFixtureEdit').click();
  const editor = page.locator('#caBody');
  const detail = editor.locator('.ca-match-details').last();
  await detail.locator('summary').click();
  const status = detail.locator('[data-ca="match-status"]');
  await status.scrollIntoViewIfNeeded();
  await status.focus();
  const top = await viewportPosition(status);
  assert(await editor.evaluate(element => element.scrollTop) > 40, 'Editor test must start down the fixture');
  await status.selectOption('Unfinished');
  assert.equal(await status.inputValue(), 'Unfinished');
  assert(await editor.evaluate(element => element.scrollTop) > 40, 'Editor must stay scrolled after a change');
  assert(Math.abs(await viewportPosition(status) - top) <= 3, 'Editor must keep the edited match in place');
  assert(await status.evaluate(element => element === document.activeElement), 'Editor must restore focus');
}

(async () => {
  for (const [engine, device] of [[chromium, 'Pixel 7'], [webkit, 'iPhone 13']]) {
    const browser = await engine.launch();
    try {
      const page = await browser.newPage({ ...devices[device], serviceWorkers: 'block' });
      page.setDefaultTimeout(12000);
      await openCompetition(page);
      await checkPrediction(page);
      await checkScorecardAndEditor(page);
      console.log(device + ': prediction, scoresheet and custom editor scroll checks passed');
    } finally {
      await browser.close();
    }
  }
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
/* BRTA Power Ratings 9.9g */
