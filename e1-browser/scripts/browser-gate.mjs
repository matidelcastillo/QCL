import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { chromium } from 'playwright';

const raw = readFileSync(new URL('../../.e1-operator/fixture-logins.txt', import.meta.url), 'utf8');
assert.match(raw, /mdytuysdombxyydqnsmj/);
const users = Object.fromEntries(['A', 'B', 'C'].map((name) => {
  const block = raw.match(new RegExp(`User ${name}\\s*\\n([\\s\\S]*?)(?=\\nUser [ABC]|$)`));
  assert.ok(block, `Missing fixture ${name}`);
  const field = (key) => {
    const match = block[1].match(new RegExp(`^\\s*${key}:\\s*(.+)$`, 'm'));
    assert.ok(match, `Missing ${key} for ${name}`);
    return match[1].trim();
  };
  return [name, { email: field('email'), password: field('password'), id: field('user_id') }];
}));

const browser = await chromium.launch({
  headless: true,
  ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE
    ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE }
    : {}),
});
const url = 'http://127.0.0.1:41773/';
const report = [];
async function signIn(page, user) {
  await page.getByRole('button', { name: 'Ingresar' }).waitFor({ state: 'visible' });
  await page.getByRole('button', { name: 'Ingresar' }).waitFor({ state: 'attached' });
  await page.waitForFunction(() => !document.querySelector('button[type="submit"]')?.disabled);
  await page.getByLabel('Email').fill(user.email);
  await page.getByLabel('Contraseña').fill(user.password);
  await page.getByRole('button', { name: 'Ingresar' }).click();
  await page.getByText(`Sesión: ${user.id}`).waitFor();
}
try {
  const a = await browser.newContext();
  const b = await browser.newContext();
  const pa = await a.newPage();
  const pb = await b.newPage();
  await Promise.all([pa.goto(url), pb.goto(url)]);
  await Promise.all([signIn(pa, users.A), signIn(pb, users.B)]);
  await Promise.all([
    pa.locator('section').getByText('E1 A original').waitFor(),
    pb.locator('section').getByText('E1 B original').waitFor(),
  ]);
  assert.equal(await pa.locator('section').textContent(), 'E1 A original');
  assert.equal(await pb.locator('section').textContent(), 'E1 B original');
  report.push('A/B isolated profiles: PASS');

  await pa.getByRole('button', { name: 'Salir' }).click();
  await pa.reload();
  assert.equal(await pa.getByRole('status').textContent(), 'Sesión cerrada');
  assert.equal(await pa.locator('section').count(), 0);
  report.push('logout + reload: PASS');

  const delayed = await browser.newContext();
  const pd = await delayed.newPage();
  await pd.goto(`${url}?delay=5000`);
  await signIn(pd, users.A);
  await pd.getByRole('button', { name: 'Salir' }).click();
  await pd.waitForTimeout(5500);
  assert.equal(await pd.locator('section').count(), 0);
  report.push('delayed A response after logout: PASS');

  await signIn(pd, users.A);
  await pd.getByRole('button', { name: 'Salir' }).click();
  await signIn(pd, users.B);
  await pd.locator('section').getByText('E1 B original').waitFor();
  assert.equal(await pd.locator('section').textContent(), 'E1 B original');
  report.push('delayed A response after B login: PASS');
  await Promise.all([a.close(), b.close(), delayed.close()]);
} finally {
  await browser.close();
}
for (const item of report) console.log(item);
console.log('JWT expiry + 35s: NOT RUN (requires waiting for genuine expiry)');
console.log('C deletion_pending: NOT RUN (operator transition required)');
