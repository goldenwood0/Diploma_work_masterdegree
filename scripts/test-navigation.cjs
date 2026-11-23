// Browser regression check against a local production preview; all APIs are isolated fixtures.
// NAV_QA_PLAYWRIGHT points to an installed playwright package when it is not in node_modules.
const { chromium } = require(process.env.NAV_QA_PLAYWRIGHT || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const out = 'outputs/navigation-audit'; fs.mkdirSync(out, { recursive: true });
const localized = { ru: 'Длинное название учебного материала для проверки переноса', kk: 'Оқу материалының ұзын атауын тасымалдауды тексеру', en: 'A long learning material title to check wrapping' };
const progress = { nextBlock: 0, revision: 1, completedAt: null };
const summary = { id: 'qa', slug: 'qa', title: localized, minutes: 10, blockCount: 1, locked: false, searchText: '', progress };
const catalog = { curricula: [{ id: 'qa', title: localized, levels: [{ id: 'qa', number: 1, units: [{ id: 'qa', title: localized, lessons: [summary] }] }] }] };
const now = '2026-10-16T00:00:00.000Z';
const stats = { timezone: 'Asia/Qyzylorda', serverNow: now, since: now, streak: 0, activeToday: false, week: Array.from({ length: 7 }, (_, i) => ({ date: `2026-10-${10 + i}`, active: false })), assessedQuestions: 0, topicAccuracy: [], skillAccuracy: [], unclassifiedTopics: 0, unclassifiedSkills: 0, studyTime: { todayMs: 0, weekMs: 0, totalMs: 0 }, mistakeLessonIds: [], weakAreas: [] };
const reviews = { cards: [], queue: [], newLimit: 10, remainingNew: 10, reviewedToday: 0, timezone: 'Asia/Qyzylorda', serverNow: now, history: [] };
(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const results = [];
  try {
    for (const language of ['ru', 'kk', 'en']) for (const width of [320, 375, 768, 1280]) {
      const context = await browser.newContext({ viewport: { width, height: 800 }, locale: language });
      const page = await context.newPage();
      const errors = []; page.on('pageerror', e => errors.push(e.message));
      await page.route('**/api/**', async route => {
        const path = new URL(route.request().url()).pathname;
        let data = {};
        if (path === '/api/auth/me') data = { user: { id: 'qa', name: 'Navigation QA', email: 'qa@example.test', role: 'STUDENT', emailVerifiedAt: now, settings: { uiLanguage: language, explanationLanguage: language, timezone: 'Asia/Qyzylorda', dailyGoalMinutes: 20, startLevel: 1, experience: 'beginner', goal: 'study', remindersEnabled: false, reminderTime: '19:00', onboardingCompletedAt: now } } };
        if (path === '/api/learning/catalog') data = catalog;
        if (path === '/api/learning/stats') data = stats;
        if (path === '/api/reviews') data = reviews;
        if (path === '/api/reviews/summary') data = { ...reviews, ready: 0, dueReviews: 0, availableNew: 0, deferredNew: 0, totalCards: 0, nextReviewAt: null };
        if (path === '/api/learning/lessons/qa') data = { id: 'qa', slug: 'qa', title: localized, revision: 1, progress, quiz: null, blocks: [{ id: 'reading', kind: 'reading', content: { title: localized, hanzi: '你好', pinyin: 'nǐ hǎo', translation: localized, text: Object.fromEntries(Object.entries(localized).map(([k, v]) => [k, Array(25).fill(v).join(' ')])) } }] };
        if (path === '/api/tutor/status') data = { provider: 'unconfigured' };
        await route.fulfill({ json: data });
      });
      const nav = page.locator('nav:visible');
      for (const [path, active] of [['/', 0], ['/courses', 1], ['/lessons/qa', 1], ['/reviews', 2], ['/profile', 3]]) {
        await page.goto(`http://127.0.0.1:8443/#${path}`);
        await nav.waitFor();
        await page.waitForTimeout(150);
        await page.evaluate(() => document.fonts.ready);
        assert.equal(await nav.locator('button').count(), 4);
        assert.equal(await nav.locator('button[aria-current="page"]').count(), 1);
        assert.equal(await nav.locator('button').nth(active).getAttribute('aria-current'), 'page');
        const layout = await page.evaluate(() => {
          const n = [...document.querySelectorAll('nav')].find(e => e.getBoundingClientRect().height);
          const buttons = [...n.querySelectorAll('button')].map(e => { const r = e.getBoundingClientRect(); return { w: r.width, h: r.height, overflow: e.scrollWidth > e.clientWidth, text: e.textContent }; });
          const ai = document.querySelector('[aria-haspopup="dialog"]').getBoundingClientRect();
          const header = document.querySelector('.app-header').getBoundingClientRect();
          return { width: document.documentElement.scrollWidth, viewport: innerWidth, buttons, aiInsideHeader: ai.top >= header.top && ai.bottom <= header.bottom, padding: parseFloat(getComputedStyle(document.querySelector('.app-shell')).paddingBottom), navHeight: document.querySelector('.mobile-nav').getBoundingClientRect().height };
        });
        assert.ok(layout.width <= layout.viewport, `${language}/${width}/${path}: horizontal overflow ${layout.width}`);
        assert.ok(layout.aiInsideHeader);
        assert.ok(layout.padding >= layout.navHeight);
        for (const b of layout.buttons) assert.ok(b.w >= 44 && b.h >= 44 && !b.overflow && b.text.trim(), JSON.stringify(b));
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
        const last = page.locator('main button').last();
        if (await last.count()) {
          await last.focus();
          const b = await last.boundingBox();
          const footer = await page.locator('.mobile-nav').boundingBox();
          assert.ok(!footer || b.y + b.height <= footer.y + 1, `${language}/${width}/${path}: focused control obscured`);
        }
        results.push(`${language} ${width} ${path}: labels/current/targets/overflow/content clearance OK`);
      }
      // Real keyboard events: logo, navigation, dialog trap, Escape, focus restoration.
      await page.goto('http://127.0.0.1:8443/#/profile'); await page.reload(); await nav.waitFor();
      await page.keyboard.press('Tab');
      assert.ok((await page.locator(':focus').getAttribute('aria-label')).startsWith('ZhPath'));
      assert.equal(await page.locator(':focus').evaluate(e => getComputedStyle(e).outlineStyle), 'solid');
      await page.keyboard.press('Enter'); await page.waitForURL('**/#/');
      await nav.locator('button').nth(3).focus();
      await page.keyboard.press('Space'); await page.waitForURL('**/#/profile');
      const ai = page.locator('[aria-haspopup="dialog"]'); await ai.focus(); await page.keyboard.press('Enter');
      const dialog = page.getByRole('dialog'); await dialog.waitFor();
      assert.ok(await dialog.locator('button').first().evaluate(e => e === document.activeElement));
      await page.keyboard.press('Shift+Tab');
      assert.ok(await dialog.locator('button').last().evaluate(e => e === document.activeElement));
      await page.keyboard.press('Tab');
      assert.ok(await dialog.locator('button').first().evaluate(e => e === document.activeElement));
      await page.keyboard.press('Escape'); await dialog.waitFor({ state: 'hidden' });
      assert.ok(await ai.evaluate(e => e === document.activeElement));
      // Tab through the real profile form, checking that focused controls stay above the footer.
      for (let i = 0; i < 24; i++) {
        await page.keyboard.press('Tab');
        const focus = await page.evaluate(() => {
          const e = document.activeElement;
          if (!e.closest('main')) return null;
          const r = e.getBoundingClientRect(), h = document.querySelector('.app-header').getBoundingClientRect(), n = document.querySelector('.mobile-nav').getBoundingClientRect();
          return { top: r.top, bottom: r.bottom, header: h.bottom, footer: n.height ? n.top : innerHeight, name: e.tagName };
        });
        if (focus) assert.ok(focus.top >= focus.header && focus.bottom <= focus.footer + 1, JSON.stringify({ language, width, focus }));
      }
      // Stress wrapped labels, 200% navigation label size, and a simulated 34px bottom inset.
      if (width < 1024) {
        await page.addStyleTag({ content: '.mobile-nav button > span:last-child { font-size: 24px; line-height: 32px; } .mobile-nav { padding-bottom: 34px; }' });
        await page.waitForTimeout(100);
        const stress = await page.evaluate(() => ({ width: document.documentElement.scrollWidth, viewport: innerWidth, nav: document.querySelector('.mobile-nav').getBoundingClientRect().height, padding: parseFloat(getComputedStyle(document.querySelector('.app-shell')).paddingBottom) }));
        assert.ok(stress.width <= stress.viewport, JSON.stringify({ language, width, stress }));
        assert.ok(stress.padding >= stress.nav);
        results.push(`${language} ${width}: 200% navigation labels and simulated 34px safe area OK`);
        await page.locator('head style').last().evaluate(e => e.remove());
      }
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.screenshot({ path: `${out}/${language}-${width}.png` });
      assert.deepEqual(errors, []);
      results.push(`${language} ${width}: keyboard Enter/Space/Tab/Shift+Tab/Escape, focus restore OK`);
      await context.close();
    }
    fs.writeFileSync(`${out}/results.txt`, results.join('\n') + '\n');
    console.log(`${results.length} checks passed. Screenshots and results in ${out}`);
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });

