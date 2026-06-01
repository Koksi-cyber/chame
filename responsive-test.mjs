import { chromium, devices } from 'playwright';

const url = 'http://127.0.0.1:8765/index.html';
const viewports = [
  { name: 'iPhone SE', width: 375, height: 667 },
  { name: 'iPhone 14 Pro Max', width: 430, height: 932 },
  { name: 'iPad', width: 768, height: 1024 },
  { name: 'iPad Pro', width: 1024, height: 1366 },
  { name: 'Laptop', width: 1366, height: 768 },
  { name: 'Desktop', width: 1920, height: 1080 },
];

const browser = await chromium.launch({ headless: true });
const results = [];
const jsErrors = [];

for (const vp of viewports) {
  const context = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();

  page.on('pageerror', (err) => {
    jsErrors.push({ viewport: vp.name, message: err.message });
  });

  const response = await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);

  const metrics = await page.evaluate(() => {
    const doc = document.documentElement;
    const body = document.body;
    const overflowX = Math.max(
      body.scrollWidth,
      doc.scrollWidth,
      body.offsetWidth,
      doc.offsetWidth,
      doc.clientWidth
    ) - window.innerWidth;

    const images = [...document.images].map((img) => ({
      src: img.getAttribute('src'),
      complete: img.complete,
      naturalWidth: img.naturalWidth,
      naturalHeight: img.naturalHeight,
    }));

    const hasPatternBg = !!document.querySelector('.scene__patterns');
    const patternBg = getComputedStyle(document.querySelector('.scene__patterns') || document.body).backgroundImage;
    const hasTinyPatterns = hasPatternBg && patternBg.includes('gradient');

    const hiddenContent = [...document.querySelectorAll('.reveal')].filter(
      (el) => !el.classList.contains('show')
    ).length;

    const topbar = document.querySelector('.topbar');
    const hero = document.querySelector('.hero');
    const finale = document.querySelector('.finale');

    return {
      overflowX,
      images,
      hiddenContent,
      hasMain: !!document.querySelector('main.shell'),
      topbarVisible: topbar ? topbar.getBoundingClientRect().width <= window.innerWidth : false,
      heroStacked: hero
        ? window.getComputedStyle(hero).gridTemplateColumns.split(' ').filter(Boolean).length === 1
        : null,
      finaleInView: finale
        ? finale.getBoundingClientRect().top < window.innerHeight
        : false,
      canvasSize: {
        width: document.getElementById('particles')?.width ?? 0,
        height: document.getElementById('particles')?.height ?? 0,
      },
      hasTinyPatterns,
      logoCount: images.filter((img) => img.src?.includes('chamelion-logo')).length,
    };
  });

  results.push({
    viewport: vp.name,
    size: `${vp.width}x${vp.height}`,
    status: response?.status() ?? 0,
    overflowX: metrics.overflowX,
    imagesOk: metrics.images.every((img) => img.complete && img.naturalWidth > 0),
    images: metrics.images,
    hiddenRevealCount: metrics.hiddenContent,
    heroStacked: metrics.heroStacked,
    canvasMatchesViewport:
      metrics.canvasSize.width === vp.width && metrics.canvasSize.height === vp.height,
    hasTinyPatterns: metrics.hasTinyPatterns,
    logoCount: metrics.logoCount,
    pass:
      (response?.status() ?? 0) === 200 &&
      metrics.overflowX <= 1 &&
      metrics.images.every((img) => img.complete && img.naturalWidth > 0) &&
      metrics.hasMain &&
      metrics.hasTinyPatterns &&
      metrics.logoCount >= 2 &&
      metrics.canvasSize.width === vp.width,
  });

  await context.close();
}

await browser.close();

console.log(JSON.stringify({ results, jsErrors }, null, 2));

const failed = results.filter((r) => !r.pass);
if (failed.length || jsErrors.length) {
  process.exitCode = 1;
}
