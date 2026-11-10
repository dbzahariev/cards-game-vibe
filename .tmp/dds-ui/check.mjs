import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { chromium } from 'file:///C:/Users/ramsess/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright-core/index.mjs';

const root = process.env.DDS_TEST_OUTPUT || 'C:/projects/cards-game/.tmp/dds-ui';
await fs.mkdir(root, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, acceptDownloads: true });
  const errors = [];
  const badResponses = [];
  page.on('response', (response) => { if (response.status() >= 400) badResponses.push(response.url()); });
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => { if (message.type() === 'error') errors.push({ text: message.text(), url: message.location().url }); });
  await page.goto(process.env.DDS_TEST_URL || 'http://127.0.0.1:4174/cards-game-vibe/');
  await page.getByRole('heading', { name: 'Бридж раздавания', exact: true }).waitFor();
  await page.getByLabel('Брой раздавания', { exact: true }).fill('6');
  await page.getByLabel('Ограничения по точки и бои', { exact: true }).check();
  const south = page.getByRole('group', { name: 'Юг · Ти', exact: true });
  await south.getByLabel('Минимум HCP', { exact: true }).fill('15');
  await south.getByLabel('Максимум HCP', { exact: true }).fill('17');
  await page.getByLabel('Юг · Ти · Пики минимум', { exact: true }).fill('4');
  await page.getByLabel('Юг · Ти · Пики максимум', { exact: true }).fill('6');
  await page.getByLabel('Запази конкретни карти по посоки', { exact: true }).check();
  await page.getByRole('combobox').selectOption('0');
  await page.getByRole('button', { name: 'A · Пики', exact: true }).click();
  await page.getByRole('button', { name: 'Генерирай', exact: true }).click();
  await page.getByText('Показани раздавания: 6', { exact: true }).waitFor();
  const points = await page.locator('.deal .south .player-points').allTextContents();
  assert.equal(points.length, 6);
  points.forEach((text) => assert.ok(parseInt(text, 10) >= 15 && parseInt(text, 10) <= 17));
  const deals = await page.locator('.deal').evaluateAll((elements) => {
    const ids = { 'Пики': 'spades', 'Купи': 'hearts', 'Кари': 'diamonds', 'Спати': 'clubs' };
    return elements.map((element) => ['north','west','east','south'].map((seat) =>
      [...element.querySelectorAll(`.${seat} .card`)].map((card) => {
        const [rank, suit] = card.getAttribute('aria-label').split(' · ');
        return `${ids[suit]}-${rank}`;
      })));
  });
  deals.forEach((deal) => {
    assert.ok(deal[0].includes('spades-A'));
    assert.ok(deal[3].filter((card) => card.startsWith('spades-')).length >= 4);
    assert.ok(deal[3].filter((card) => card.startsWith('spades-')).length <= 6);
  });
  await fs.writeFile(`${root}/deals.json`, JSON.stringify(deals));
  const ddsExport = page.getByRole('button', { name: 'Експорт на DDS анализ', exact: true });
  const filePromise = page.waitForEvent('download', { timeout: 120000 });
  await ddsExport.click();
  const file = await filePromise;
  assert.equal(file.suggestedFilename(), 'bridge-razdavania-dds.docx');
  await file.saveAs(`${root}/conditioned-six.docx`);
  await page.locator('.dds-status').getByText('Word файлът с DDS анализа е готов.', { exact: true }).waitFor();
  console.log('PASS: generated 6 constrained deals with fixed card and downloaded exact DDS Word export');

  // A new batch must discard cached analyses; cancelling it must restore controls.
  await page.getByRole('button', { name: 'Генерирай', exact: true }).click();
  await page.getByRole('button', { name: 'Генерирай', exact: true }).waitFor();
  await ddsExport.click();
  await page.getByRole('button', { name: 'Прекрати анализа', exact: true }).click();
  await page.locator('.dds-status').getByText('DDS анализът е прекратен.', { exact: true }).waitFor();
  assert.ok(await ddsExport.isEnabled());
  assert.ok(await page.getByRole('button', { name: 'Генерирай', exact: true }).isEnabled());
  console.log('PASS: cancellation restores controls');

  await page.getByLabel('Запази конкретни карти по посоки', { exact: true }).uncheck();
  await page.getByLabel('Ограничения по точки и бои', { exact: true }).uncheck();
  await page.screenshot({ path: `${root}/desktop.png` });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: `${root}/mobile.png` });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  console.log(JSON.stringify({ errors, badResponses }));
  assert.deepEqual(badResponses.filter((url) => !url.endsWith('/favicon.ico')), []);
  assert.deepEqual(errors.filter((error) => !error.url?.endsWith('/favicon.ico')), []);
  console.log('PASS: desktop/mobile layout and no browser errors');
} finally {
  await browser.close();
}
