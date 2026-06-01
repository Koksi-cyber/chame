import { chromium } from 'playwright';

const url = 'http://127.0.0.1:8765/index.html';
const viewports = [
  { name: 'iPhone SE', width: 375, height: 667 },
  { name: 'iPhone 14 Pro Max', width: 430, height: 932 },
  { name: 'iPad', width: 768, height: 1024 },
  { name: 'Desktop', width: 1920, height: 1080 },
];

const browser = await chromium.launch({ headless: true });
const results = [];
const jsErrors = [];

for (const vp of viewports) {
  const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height } });
  page.on('pageerror', (err) => jsErrors.push({ viewport: vp.name, message: err.message }));

  const response = await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);

  const metrics = await page.evaluate(() => {
    const overflowX = document.documentElement.scrollWidth - window.innerWidth;
    const images = [...document.images].every((img) => img.complete && img.naturalWidth > 0);
    const logo = document.querySelector('.hero__visual img')?.getAttribute('src') || '';
    const noParticles = !document.querySelector('#particles');
    return {
      overflowX,
      images,
      hasLogo: logo.includes('chamelion-logo'),
      noParticles,
      hasMain: !!document.querySelector('main'),
    };
  });

  results.push({
    viewport: vp.name,
    status: response?.status() ?? 0,
    pass:
      (response?.status() ?? 0) === 200 &&
      metrics.overflowX <= 1 &&
      metrics.images &&
      metrics.hasLogo &&
      metrics.hasMain &&
      metrics.noParticles,
    ...metrics,
  });

  await page.close();
}

await browser.close();
console.log(JSON.stringify({ results, jsErrors }, null, 2));
if (results.some((r) => !r.pass) || jsErrors.length) process.exitCode = 1;
