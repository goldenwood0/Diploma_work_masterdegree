import { readFile, writeFile } from 'node:fs/promises';
const root = 'docs/hsk1-audit/audio';
const manifest = JSON.parse(await readFile(`${root}/manifest.json`, 'utf8'));
const esc = s => String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const cards = manifest.assets.map(a => `<article data-key="${a.key}">
  <div class="heading"><h2 lang="zh-CN">${a.hanzi}</h2><span>${a.duration.toFixed(2)} с · WAV</span></div>
  <p class="pinyin">${esc(a.pinyin)}</p>
  <dl>${['ru','kk','en'].map(lang => `<div><dt>${lang.toUpperCase()}</dt><dd lang="${lang}">${esc(a.translation[lang])}</dd></div>`).join('')}</dl>
  ${a.downloaded ? `<audio controls preload="metadata" src="${a.wavPath}" aria-label="Произношение ${a.hanzi}"></audio><p class="playback" role="status">Проверка загрузки…</p>` : '<p class="playback">Файл ещё не загружен</p>'}
  <p class="credit">${esc(a.metadata.author)}<br><a href="${esc(a.metadata.sourceUrl)}" target="_blank" rel="noreferrer">Источник</a> · <a href="${esc(a.metadata.licenseUrl)}" target="_blank" rel="noreferrer">${esc(a.metadata.license)}</a> · <a href="${a.originalPath}" download>Оригинал</a> · <a href="${a.wavPath}" download>WAV</a></p>
  <p class="note">Конвертация в PCM 16-bit WAV. Без обрезки и изменения скорости, высоты тона или громкости.</p>
  <label>Проверка преподавателем<select name="${a.key}"><option value="pending">Не проверено</option><option value="approved">Соответствует тексту и произношению</option><option value="changes_requested">Требует исправления</option></select></label>
  <label>Комментарий<textarea name="note-${a.key}" rows="2" placeholder="Тоны, слышимость, перевод…"></textarea></label>
</article>`).join('\n');
const data = JSON.stringify(manifest.assets.map(a => ({key:a.key,hanzi:a.hanzi,pinyin:a.pinyin,sha256:a.wavSha256}))).replaceAll('<','\\u003c');
await writeFile(`${root}/index.html`, `<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>ZhPath · проверка аудио HSK 1</title>
<style>*{box-sizing:border-box}body{margin:0;background:#f4f7f3;color:#18372c;font:16px/1.55 system-ui,sans-serif}main{max-width:1080px;margin:auto;padding:32px 20px 64px}h1{font-size:clamp(26px,5vw,38px);line-height:1.2;margin:10px 0 18px}h2{font-size:40px;margin:0;font-weight:500}p{margin:10px 0}a{color:#145a43;text-underline-offset:3px}.badge{display:inline-block;background:#e5edcf;padding:5px 12px;border-radius:30px;font-size:13px;font-weight:700}.banner{background:#fff7df;border:1px solid #d9bd6c;padding:16px 20px;border-radius:12px;margin:24px 0}.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:20px}article{background:white;border:1px solid #cad8ce;border-radius:16px;padding:22px;min-width:0}.heading{display:flex;justify-content:space-between;align-items:center;gap:12px}.heading span,.note,.credit{font-size:13px;color:#4d6258}.pinyin{font-size:22px;color:#286448}dl div{display:flex;gap:12px;margin:8px 0}dt{width:28px;font-size:12px;color:#647468;flex-shrink:0}dd{margin:0}audio{width:100%;margin-top:12px}.playback{font-size:13px}label{display:block;margin:16px 0 6px;font-size:14px}input,select,textarea{display:block;width:100%;margin-top:6px;padding:10px;border:1px solid #a9bcb0;border-radius:7px;background:white;color:#18372c;font:inherit}button{padding:12px 18px;border:0;border-radius:8px;background:#205a42;color:white;font:inherit;cursor:pointer}button:focus-visible,a:focus-visible,select:focus-visible{outline:3px solid #da9c38;outline-offset:3px}.review{margin-top:28px;border-top:1px solid #cad8ce;padding-top:20px}.review input{max-width:460px}.review button{margin-top:16px}@media(max-width:640px){.grid{grid-template-columns:1fr}main{padding:24px 14px}article{padding:18px}}</style></head><body><main>
<span class="badge">ZhPath · HSK 1 · ЧЕРНОВИК</span><h1>Аудио для первых фраз</h1>
<p>Словарные записи: ${manifest.assets.filter(a=>a.downloaded).length} из ${manifest.assets.length}. Оригиналы, WAV, переводы и атрибуция собраны для проверки.</p>
<p><a href="CREDITS.md">Авторы и лицензии</a> · <a href="manifest.json" download>Реестр файлов</a> · <a href="proposed-content-with-audio.json" download>Черновики уроков</a></p>
<div class="banner"><strong>Не опубликовано. Приёмка преподавателем не выполнена.</strong><p>Четыре диалога ещё требуют записи целиком. Эти файлы озвучивают отдельные слова. Автоматическая проверка загрузки подтверждает только доступность файла.</p><p>Прослушайте тон, нейтральные слоги и соответствие подписи. «Не проверено» изменяет только человек; экспорт не публикует материалы.</p></div>
<section class="grid" aria-label="Аудиозаписи">${cards}</section>
<section class="review"><h2 style="font-size:24px">Лист проверки</h2><label>Имя проверяющего<input id="reviewer" autocomplete="name" placeholder="Заполните после прослушивания"></label><button id="export" type="button">Скачать результаты проверки</button><p id="export-status" role="status">Форма не отправляет данные на сервер. Перед закрытием страницы скачайте результат.</p></section>
</main><script>
const assets=${data};
for(const player of document.querySelectorAll('audio')){
 const status=player.nextElementSibling;
 player.addEventListener('loadedmetadata',()=>{status.textContent='Файл доступен · '+player.duration.toFixed(2)+' с. Произношение ещё не принято.';});
 player.addEventListener('error',()=>{status.textContent='Не удалось загрузить файл. Проверьте папку wav рядом с этой страницей.';});
 player.addEventListener('play',()=>{for(const other of document.querySelectorAll('audio'))if(other!==player)other.pause();});
}
document.getElementById('export').addEventListener('click',()=>{
 const reviewer=document.getElementById('reviewer').value.trim();
 const status=document.getElementById('export-status');
 if(!reviewer){status.textContent='Укажите имя проверяющего. Автоматическая проверка не заменяет преподавателя.';return;}
 const result={reviewer,reviewedAt:new Date().toISOString(),published:false,items:assets.map(a=>({...a,decision:document.querySelector('select[name="'+a.key+'"]').value,note:document.querySelector('textarea[name="note-'+a.key+'"]').value}))};
 const url=URL.createObjectURL(new Blob([JSON.stringify(result,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='hsk1-audio-human-review.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);status.textContent='Лист проверки скачан. Материалы не опубликованы.';
});
</script></body></html>`);
console.log('Prepared offline audio review page.');
