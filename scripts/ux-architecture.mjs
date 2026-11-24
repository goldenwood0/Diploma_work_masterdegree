// ПР4 architecture, version 2: sitemap, user flow and wireframes that match the current site.
// Writes SVG boards, design.json and a Figma import plugin to docs/ux-architecture/.
// The submitted ПР4 files in output/practical_4_5 are left untouched.
// Usage: node scripts/ux-architecture.mjs   (PNG export: see docs/ux-architecture/README.md)
import { mkdir, writeFile } from 'node:fs/promises';

const OUT = 'docs/ux-architecture';
const G = { ink: '#222222', soft: '#555555', line: '#AAAAAA', fill: '#EEEEEE', white: '#FFFFFF', mid: '#DDDDDD', dark: '#333333' };
const boards = [];

class Board {
  constructor(name, group, w, h) { Object.assign(this, { name, group, w, h, bg: G.white, items: [] }); boards.push(this); }
  rect(x, y, w, h, fill = G.white, stroke = G.line, r = 0, name = 'Блок') { this.items.push({ type: 'rect', x, y, w, h, fill, stroke, r, name }); }
  text(x, y, text, size = 22, color = G.ink, bold = false, name) { this.items.push({ type: 'text', x, y, text, size, color, bold, name: name ?? text.slice(0, 55) }); }
  line(x, y, x2, y2, arrow = false) { this.items.push({ type: 'line', x, y, x2, y2, color: G.line, arrow, name: arrow ? 'Переход' : 'Линия' }); }
  diamond(x, y, w, h, label) { this.items.push({ type: 'diamond', x, y, w, h, fill: G.fill, stroke: G.soft, name: label }); this.text(x + 50, y + h / 2 - 14, label, 22, G.ink, true); }
  node(x, y, w, h, title, detail, terminal = false, size = 22) {
    this.rect(x, y, w, h, G.white, G.line, terminal ? h / 2 : 10, title);
    this.text(x + 18, y + (detail ? 12 : h / 2 - size * 0.6), title, size, G.ink, true);
    if (detail) this.text(x + 18, y + 44, detail, 17, G.soft);
  }
  button(x, y, text, w, primary = true) { this.rect(x, y, w, 56, primary ? G.dark : G.white, primary ? null : G.line, 10, 'Кнопка ' + text); this.text(x + 20, y + 16, text, 21, primary ? G.white : G.ink, true); }
}

// ── Sitemap ─────────────────────────────────────────────────────────────────────────────────
{
  const b = new Board('Sitemap_v2', '00_Architecture_v2', 1600, 1230);
  b.text(48, 32, 'ZhPath · карта сайта (версия 2, как на сайте 24.11.2026)', 36, G.ink, true);
  b.text(48, 86, '5 разделов основной навигации · ИИ-помощник доступен с любого экрана · отдельный раздел для преподавателя', 21, G.soft);
  b.node(600, 140, 400, 76, 'ZhPath', 'Шапка: разделы, поиск уроков, ИИ, профиль');
  const sections = [
    ['Главная', ['Следующее действие', 'Сегодня, уровень, очки', '→ Весь прогресс']],
    ['Курсы', ['Каталог, поиск, фильтры', '«Ничего не найдено»', 'Урок: разминка, блоки', 'Тест: «Проверить»', 'Результат, пересдача', 'Тест модуля']],
    ['Повторение', ['Очередь карточек', 'Мои карточки']],
    ['Словарь', ['Поиск слова', 'Карточка слова']],
    ['Профиль', ['Прогресс', 'Настройки']],
  ];
  b.line(800, 216, 800, 256); b.line(176, 256, 1424, 256);
  sections.forEach(([title, children], i) => {
    const x = 40 + i * 312;
    b.line(x + 136, 256, x + 136, 296, true);
    b.node(x, 296, 272, 70, title);
    children.forEach((child, j) => {
      const y = 420 + j * 92;
      b.line(x + 136, j === 0 ? 366 : y - 30, x + 136, y, true);
      b.node(x, y, 272, 62, child, null, false, 19);
    });
  });
  b.text(40, 976, 'Тест урока и результат открываются внутри страницы урока; «Курсы» возвращают к тому же поиску и фильтрам.', 19, G.soft);
  b.node(40, 1020, 740, 76, 'ИИ-помощник · кнопка в шапке, панель поверх экрана', '5 режимов; «Объясни ошибку» в тесте; «Разобрать ошибки с ИИ» в результате');
  b.node(820, 1020, 740, 76, 'Доступ', 'Вход · регистрация · подтверждение email · восстановление пароля');
  b.node(40, 1120, 740, 76, 'Служебные', '404 · ошибка сохранения теста · нет связи с сервером');
  b.node(820, 1120, 740, 76, 'Преподаватель и администратор (по роли)', 'Управление уроками · медиатека · пользователи и роли');
}

// ── User flow ───────────────────────────────────────────────────────────────────────────────
{
  const b = new Board('User_Flow_v2', '00_Architecture_v2', 1600, 2240);
  b.text(48, 32, 'User Flow · пройти урок и сдать тест (версия 2)', 36, G.ink, true);
  const X = 460, W = 650, C = X + W / 2;
  const flow = (y, t, d, terminal) => b.node(X, y, W, 70, t, d, terminal);
  const diamond = (y, t) => b.diamond(560, y, 450, 130, t);
  const down = (y1, y2) => b.line(C, y1, C, y2, true);
  const yes = y => b.text(C + 14, y, 'Да', 18, G.soft);
  const side = (y, title, detail, backTo) => {
    b.node(30, y, 350, 90, title, detail);
    b.line(560, y + 45, 380, y + 45, true); b.text(400, y + 12, 'Нет', 18, G.soft);
    if (backTo !== undefined) { b.line(205, y, 205, backTo); b.line(205, backTo, X, backTo, true); }
  };
  flow(100, '00 Вход · почта и пароль', null, true); down(170, 210);
  diamond(210, 'D1 Вход выполнен?'); side(230, 'Ошибка входа', 'Исправить данные', 135); down(340, 390); yes(350);
  flow(390, '01 Главная', '«Продолжить урок» или «Курсы»'); down(460, 510);
  flow(510, '02 Каталог · запрос и фильтры', 'Поиск из шапки ведёт сюда же'); down(580, 620);
  diamond(620, 'D2 Урок найден?'); side(640, '07 Ничего не найдено', '«Сбросить фильтры»', 545); down(750, 800); yes(760);
  flow(800, '04 Урок · разминка → материал', 'Блоки по порядку, затем «К тесту»'); down(870, 920);
  flow(920, '05 Тест · выбрать ответ → «Проверить»', 'Один вопрос на экран'); down(990, 1030);
  diamond(1030, 'D3 Ответ верный?');
  b.node(30, 1050, 350, 110, 'Неверно', 'Правильный ответ и объяснение;');
  b.text(48, 1120, 'по желанию «Объясни ошибку» (ИИ)', 17, G.soft);
  b.line(560, 1095, 380, 1095, true); b.text(400, 1062, 'Нет', 18, G.soft);
  b.line(205, 1160, 205, 1245); b.line(205, 1245, X, 1245, true);
  down(1160, 1210); yes(1170);
  flow(1210, '«Дальше»', 'После «Верно!» или «Неверно»; ответ зафиксирован'); down(1280, 1320);
  diamond(1320, 'D4 Это последний вопрос?');
  b.line(1010, 1385, 1250, 1385); b.line(1250, 1385, 1250, 955); b.line(1250, 955, X + W, 955, true); b.text(1030, 1352, 'Нет', 18, G.soft);
  down(1450, 1500); yes(1460);
  flow(1500, '05 «Завершить тест»', 'Отправка всех ответов'); down(1570, 1610);
  diamond(1610, 'D5 Результат сохранён?'); side(1630, '08 Ошибка сохранения', '«Повторить отправку»', 1535); down(1740, 1790); yes(1750);
  diamond(1790, 'D6 Тест сдан (≥ 80%)?');
  b.node(1170, 1810, 400, 90, 'Не сдан', '«Пройти заново» или разбор с ИИ');
  b.line(1010, 1855, 1170, 1855, true); b.text(1030, 1822, 'Нет', 18, G.soft);
  b.line(1370, 1810, 1370, 970); b.line(1370, 970, X + W, 970, true);
  down(1920, 1970); yes(1930);
  flow(1970, '06 Результат · следующий урок открыт', 'Очки на главной, слова — в повторении', true);
  b.node(1170, 760, 400, 90, 'Альтернативный путь', 'Главная → «Продолжить урок»');
  b.line(X + W, 425, 1370, 425); b.line(1370, 425, 1370, 760, true); b.line(1170, 835, X + W, 835, true);
  b.text(48, 2090, 'Назад: из теста — «К материалу»; из урока — «Курсы» (тот же поиск и фильтры);', 20, G.soft);
  b.text(48, 2124, 'из результата — «Открыть каталог». ИИ-помощник открывается кнопкой в шапке на любом шаге.', 20, G.soft);
}

// ── Wireframes ──────────────────────────────────────────────────────────────────────────────
function header(b, active) {
  b.rect(0, 0, 1440, 72, G.white, G.line, 0, 'Header');
  b.rect(96, 16, 40, 40, G.dark, null, 8); b.text(106, 22, '中', 24, G.white, true); b.text(148, 24, 'ZhPath', 24, G.ink, true);
  let x = 320;
  for (const t of ['Главная', 'Курсы', 'Повторение', 'Словарь']) {
    if (t === active) b.rect(x - 12, 14, t.length * 12 + 26, 44, G.fill, null, 10);
    b.text(x, 26, t, 19, G.ink, t === active); x += t.length * 12 + 40;
  }
  b.rect(840, 14, 380, 44, G.white, G.line, 10); b.text(860, 26, 'Поиск уроков', 18, G.soft);
  b.rect(1244, 14, 44, 44, G.mid, null, 22); b.text(1257, 24, '✦', 20, G.ink, true);
  b.rect(1300, 14, 44, 44, G.fill, null, 22); b.text(1310, 26, 'ДУ', 17, G.ink, true);
}
{
  const b = new Board('Wireframe_05_Тест_проверка', '01_Wireframe_v2', 1440, 1024);
  header(b, 'Курсы');
  b.text(96, 100, 'КУРСЫ / МЕНЯ ЗОВУТ… / ТЕСТ УРОКА', 17, G.soft);
  b.text(96, 132, 'Тест урока', 34, G.ink, true);
  b.text(96, 186, 'Вопрос 1 / 6', 20, G.soft, true); b.text(1180, 186, 'Верно: 0/1', 20, G.ink, true);
  for (let i = 0; i < 6; i++) b.rect(96 + i * 210, 222, 198, 8, i === 0 ? G.dark : G.fill, null, 4);
  b.text(96, 262, 'Как сказать «Меня зовут Анна»?', 30, G.ink, true);
  [['我叫安娜。', false], ['你叫安娜。', true], ['安娜叫我。', false]].forEach(([t, picked], i) => {
    b.rect(96, 322 + i * 76, 1248, 62, picked ? G.fill : G.white, picked ? G.dark : G.line, 10);
    b.text(120, 340 + i * 76, (picked ? '● ' : '○ ') + t, 22, G.ink, picked);
  });
  b.rect(96, 568, 1248, 210, G.fill, G.dark, 12, 'Результат проверки');
  b.text(124, 590, '✕ Неверно', 26, G.ink, true);
  b.text(124, 636, 'Правильный ответ: 我叫安娜。', 21, G.ink, true);
  b.text(124, 672, 'О себе говорят через 我: 我 + 叫 + имя.', 20, G.soft);
  b.button(124, 700, '✦ Объясни ошибку', 260, false);
  b.button(96, 810, 'Дальше', 260); b.button(380, 810, '← К материалу', 240, false);
  b.text(96, 900, 'Ответ заблокирован после «Проверить»; до проверки кнопка называется «Проверить», на последнем вопросе — «Завершить тест».', 18, G.soft);
}
{
  const b = new Board('Mobile_Тест_проверка', '01_Wireframe_v2', 390, 844);
  b.rect(0, 0, 390, 64, G.white, G.line, 0); b.text(16, 20, '中 ZhPath', 21, G.ink, true); b.text(296, 20, '⌕  ✦', 21, G.ink, true);
  b.text(16, 84, 'Вопрос 1 / 6', 17, G.soft, true); b.text(268, 84, 'Верно: 0/1', 17, G.ink, true);
  for (let i = 0; i < 6; i++) b.rect(16 + i * 61, 112, 55, 6, i === 0 ? G.dark : G.fill, null, 3);
  b.text(16, 136, 'Как сказать', 24, G.ink, true); b.text(16, 168, '«Меня зовут Анна»?', 24, G.ink, true);
  [['○ 我叫安娜。', false], ['● 你叫安娜。', true], ['○ 安娜叫我。', false]].forEach(([t, picked], i) => {
    b.rect(16, 214 + i * 66, 358, 56, picked ? G.fill : G.white, picked ? G.dark : G.line, 10); b.text(30, 230 + i * 66, t, 19, G.ink, picked);
  });
  b.rect(16, 418, 358, 170, G.fill, G.dark, 12); b.text(30, 432, '✕ Неверно', 22, G.ink, true);
  b.text(30, 470, 'Правильный ответ: 我叫安娜。', 17, G.ink, true); b.text(30, 500, 'О себе: 我 + 叫 + имя.', 16, G.soft);
  b.button(30, 524, '✦ Объясни ошибку', 260, false);
  b.rect(0, 616, 390, 140, G.white, G.line, 0, 'Закреплённые кнопки'); b.button(16, 630, 'Дальше', 358); b.text(118, 706, '← К материалу', 18, G.ink, true);
  b.rect(0, 772, 390, 72, G.white, G.line, 0);
  [['Главная', 8], ['Курсы', 92], ['Повтор', 166], ['Словарь', 236], ['Профиль', 314]].forEach(([t, x]) => b.text(x, 798, t, 14, G.ink, t === 'Курсы'));
}
{
  const b = new Board('Wireframe_09_Профиль', '01_Wireframe_v2', 1440, 1024);
  header(b, '');
  b.rect(96, 100, 1248, 120, G.white, G.line, 16); b.rect(124, 124, 72, 72, G.mid, null, 36); b.text(146, 144, 'Д', 28, G.ink, true);
  b.text(220, 128, 'Демо Ученик', 28, G.ink, true); b.text(220, 170, 'student.demo@zhpath.local · Email подтверждён', 19, G.soft);
  b.text(96, 250, 'Прогресс', 30, G.ink, true);
  b.rect(96, 300, 600, 90, G.white, G.line, 12); b.text(124, 322, 'Уровень 2', 24, G.ink, true); b.text(500, 326, 'Очки: 140', 20, G.soft);
  b.rect(720, 300, 624, 90, G.white, G.line, 12); b.text(748, 322, 'Серия: 3 дня · Неделя: ■ ■ ■ □ □ □ □', 21, G.ink, true);
  b.rect(96, 410, 1248, 220, G.white, G.line, 12); b.text(124, 432, 'Точность по темам и навыкам', 22, G.ink, true);
  [['Приветствия', '5 / 6 · 83%'], ['Числа', '4 / 6 · 67%'], ['Семья', '6 / 6 · 100%']].forEach(([t, v], i) => { b.text(124, 482 + i * 44, t, 20); b.text(1100, 482 + i * 44, v, 20, G.soft); });
  b.text(96, 670, 'Настройки', 30, G.ink, true);
  b.rect(96, 720, 1248, 220, G.white, G.line, 12);
  [['Тема', 'Системная'], ['Язык интерфейса и объяснений', 'Русский'], ['Цель на день', '10 мин'], ['Напоминания', 'Выкл.']].forEach(([t, v], i) => { b.text(124, 744 + i * 46, t, 20); b.text(1100, 744 + i * 46, v, 20, G.soft); });
  b.text(96, 968, 'Безопасность аккаунта: «Выйти», «Выйти со всех устройств»', 19, G.soft);
}

// ── Output: SVG, design.json, Figma plugin ─────────────────────────────────────────────────
const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
function svg(b) {
  const out = [`<svg xmlns="http://www.w3.org/2000/svg" width="${b.w}" height="${b.h}" viewBox="0 0 ${b.w} ${b.h}"><rect width="100%" height="100%" fill="${b.bg}"/>`];
  for (const a of b.items) {
    if (a.type === 'rect') out.push(`<rect x="${a.x}" y="${a.y}" width="${a.w}" height="${a.h}" rx="${a.r}" fill="${a.fill}" stroke="${a.stroke ?? 'none'}" stroke-width="2"/>`);
    else if (a.type === 'text') out.push(`<text x="${a.x}" y="${a.y + a.size * 0.83}" font-family="Inter, 'Segoe UI', Arial, 'Microsoft YaHei', sans-serif" font-size="${a.size}" font-weight="${a.bold ? 700 : 400}" fill="${a.color}">${esc(a.text)}</text>`);
    else if (a.type === 'diamond') { const { x, y, w, h } = a; out.push(`<polygon points="${x + w / 2},${y} ${x + w},${y + h / 2} ${x + w / 2},${y + h} ${x},${y + h / 2}" fill="${a.fill}" stroke="${a.stroke}" stroke-width="2"/>`); }
    else {
      out.push(`<path d="M${a.x} ${a.y} L${a.x2} ${a.y2}" stroke="${a.color}" stroke-width="3" fill="none"/>`);
      if (a.arrow) { const ang = Math.atan2(a.y2 - a.y, a.x2 - a.x); const p = d => [a.x2 - 14 * Math.cos(ang + d), a.y2 - 14 * Math.sin(ang + d)].map(v => v.toFixed(1)).join(','); out.push(`<polygon points="${a.x2},${a.y2} ${p(-0.45)} ${p(0.45)}" fill="${a.color}"/>`); }
    }
  }
  return out.join('') + '</svg>';
}
const plugin = `// Generated by scripts/ux-architecture.mjs. Adds a new page; existing pages are not changed.
const BOARDS=${JSON.stringify(boards.map(({ name, group, w, h, bg, items }) => ({ name, group, w, h, bg, items })))};
const rgb=h=>({r:parseInt(h.slice(1,3),16)/255,g:parseInt(h.slice(3,5),16)/255,b:parseInt(h.slice(5,7),16)/255});
const paint=h=>[{type:'SOLID',color:rgb(h)}];
function vector(parent,points,closed,fill,stroke,weight,name){
  const xs=points.map(p=>p[0]),ys=points.map(p=>p[1]);const minX=Math.min(...xs),minY=Math.min(...ys);
  const v=figma.createVector();parent.appendChild(v);v.name=name;
  v.vectorPaths=[{windingRule:'NONZERO',data:points.map((p,i)=>(i?'L ':'M ')+(p[0]-minX)+' '+(p[1]-minY)).join(' ')+(closed?' Z':'')}];
  v.x=minX;v.y=minY;v.fills=fill?paint(fill):[];v.strokes=stroke?paint(stroke):[];v.strokeWeight=weight;return v;
}
async function main(){
  await figma.loadFontAsync({family:'Inter',style:'Regular'});await figma.loadFontAsync({family:'Inter',style:'Bold'});
  const page=figma.createPage();page.name='ПР4 · v2 (как на сайте)';await figma.setCurrentPageAsync(page);
  let y=0;
  for(const group of [...new Set(BOARDS.map(b=>b.group))]){
    const section=figma.createSection();page.appendChild(section);section.name=group;section.x=0;section.y=y;
    let x=48,maxH=0;
    for(const b of BOARDS.filter(b=>b.group===group)){
      const f=figma.createFrame();section.appendChild(f);f.name=b.name;f.resize(b.w,b.h);f.x=x;f.y=80;f.fills=paint(b.bg);f.clipsContent=true;
      f.exportSettings=[{format:'PNG',constraint:{type:'SCALE',value:1}}];
      for(const a of b.items){
        if(a.type==='rect'){const r=figma.createRectangle();f.appendChild(r);r.name=a.name;r.x=a.x;r.y=a.y;r.resize(Math.max(a.w,0.01),Math.max(a.h,0.01));r.cornerRadius=a.r;r.fills=paint(a.fill);r.strokes=a.stroke?paint(a.stroke):[];r.strokeWeight=2;}
        else if(a.type==='text'){const t=figma.createText();f.appendChild(t);t.fontName={family:'Inter',style:a.bold?'Bold':'Regular'};t.fontSize=a.size;t.characters=a.text;t.name=a.name;t.fills=paint(a.color);t.x=a.x;t.y=a.y;}
        else if(a.type==='diamond'){vector(f,[[a.x+a.w/2,a.y],[a.x+a.w,a.y+a.h/2],[a.x+a.w/2,a.y+a.h],[a.x,a.y+a.h/2]],true,a.fill,a.stroke,2,a.name);}
        else{vector(f,[[a.x,a.y],[a.x2,a.y2]],false,null,a.color,3,a.name);
          if(a.arrow){const g=Math.atan2(a.y2-a.y,a.x2-a.x);vector(f,[[a.x2,a.y2],[a.x2-14*Math.cos(g-.45),a.y2-14*Math.sin(g-.45)],[a.x2-14*Math.cos(g+.45),a.y2-14*Math.sin(g+.45)]],true,a.color,null,0,'Стрелка');}}
      }
      x+=b.w+80;maxH=Math.max(maxH,b.h);
    }
    section.resizeWithoutConstraints(x,maxH+160);y+=maxH+260;
  }
  figma.viewport.scrollAndZoomIntoView(page.children);figma.closePlugin('ZhPath ПР4 v2: создано досок — '+BOARDS.length);
}
main().catch(e=>figma.closePlugin('Ошибка: '+e.message));
`;
const manifest = { name: 'ZhPath ПР4 v2 import', id: 'zhpath-pr4-v2-import', api: '1.0.0', main: 'code.js', editorType: ['figma'], documentAccess: 'dynamic-page', networkAccess: { allowedDomains: ['none'] } };

await mkdir(`${OUT}/svg`, { recursive: true }); await mkdir(`${OUT}/figma-plugin`, { recursive: true });
for (const b of boards) await writeFile(`${OUT}/svg/${b.name}.svg`, svg(b));
await writeFile(`${OUT}/design.json`, JSON.stringify(boards.map(({ name, group, w, h }) => ({ name, group, w, h })), null, 2) + '\n');
await writeFile(`${OUT}/figma-plugin/code.js`, plugin);
await writeFile(`${OUT}/figma-plugin/manifest.json`, JSON.stringify(manifest, null, 2) + '\n');
console.log(boards.map(b => `${b.group}/${b.name} ${b.w}×${b.h}`).join('\n'));
