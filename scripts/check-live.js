const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', error => console.log('PAGE ERROR:', error.message));
  page.on('requestfailed', request => console.log('REQUEST FAILED:', request.url(), request.failure().errorText));

  console.log("Navigating to https://aethertarot.cn/ ...");
  await page.goto('https://aethertarot.cn/', { waitUntil: 'networkidle' });
  
  const html = await page.evaluate(() => {
    const container = document.querySelector('.scroll-snap-container');
    if (!container) return 'NO CONTAINER';
    return {
      containerHeight: container.clientHeight,
      scrollHeight: container.scrollHeight,
      sections: Array.from(container.children).map(c => ({
        tag: c.tagName,
        className: c.className,
        height: c.clientHeight,
        offset: c.offsetTop,
        html: c.innerHTML.substring(0, 50)
      }))
    };
  });
  
  console.log("Container Info:");
  console.log(JSON.stringify(html, null, 2));

  await browser.close();
})();
