const express = require('express');
const puppeteer = require('puppeteer-core');

const app = express();
app.use(express.json({ limit: '5mb' }));

let browser;

async function getBrowser() {
  if (!browser || !browser.isConnected()) {
    browser = await puppeteer.launch({
      headless: 'new',
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/chromium',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--single-process'
      ]
    });
  }
  return browser;
}

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.post('/render', async (req, res) => {
  const {
    html,
    width = 760,
    height = 507,
    format = 'webp',
    quality = 80
  } = req.body;

  if (!html) {
    return res.status(400).json({ error: 'html is required' });
  }

  let page;
  try {
    const b = await getBrowser();
    page = await b.newPage();
    await page.setViewport({ width, height, deviceScaleFactor: 1 });
    await page.setContent(html, { waitUntil: 'networkidle0', timeout: 15000 });

    const screenshotOptions = {
      type: format === 'webp' ? 'webp' : 'png',
      fullPage: false,
      clip: { x: 0, y: 0, width, height }
    };

    if (format === 'webp') {
      screenshotOptions.quality = quality;
    }

    const screenshot = await page.screenshot(screenshotOptions);

    res.set('Content-Type', `image/${format === 'webp' ? 'webp' : 'png'}`);
    res.set('Content-Length', screenshot.length);
    res.send(screenshot);
  } catch (err) {
    console.error('Render error:', err.message);
    res.status(500).json({ error: err.message });
  } finally {
    if (page) await page.close().catch(() => {});
  }
});

const PORT = process.env.PORT || 3100;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`HTML-to-Image renderer listening on port ${PORT}`);
});

process.on('SIGTERM', async () => {
  if (browser) await browser.close();
  process.exit(0);
});
