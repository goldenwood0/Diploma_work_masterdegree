// Read public Commons metadata only. No application/database changes.
import { mkdir, writeFile } from 'node:fs/promises';
const directory = 'docs/hsk1-audit/audio';
await mkdir(directory, { recursive: true });
const api = async params => {
  const url = new URL('https://commons.wikimedia.org/w/api.php');
  url.search = new URLSearchParams({ action: 'query', format: 'json', ...params });
  const response = await fetch(url, { headers: { 'User-Agent': 'ZhPathPilotAudioAudit/1.0 (educational content attribution)' }, signal: AbortSignal.timeout(30000) });
  if (!response.ok) throw new Error(`Commons HTTP ${response.status}`);
  const data = await response.json();
  if (data.error) throw new Error(data.error.info);
  return Object.values(data.query?.pages ?? {});
};
const titles = ['Zh-nǐ.ogg','Zh-hǎo.ogg','Zh-wǒ.ogg','Zh-jiào.ogg','Zh-míngzi.ogg','Zh-shénme.ogg','Zh-xièxie.ogg','Zh-zàijiàn.ogg','Zh_nǐ_hǎo.ogg'];
const pages = await api({ titles: titles.map(t => 'File:' + t).join('|'), prop: 'imageinfo|revisions', iiprop: 'url|extmetadata|size|sha1', rvprop: 'ids|timestamp' });
const searches = [];
for (const term of ['不客气 filetype:audio','"你叫什么名字" filetype:audio','"我叫安娜" filetype:audio','"你好" "dialogue" filetype:audio','"谢谢" "不客气" filetype:audio']) {
  const results = await api({ generator: 'search', gsrsearch: term, gsrnamespace: '6', gsrlimit: '15', prop: 'imageinfo|revisions', iiprop: 'url|extmetadata|size|sha1', rvprop: 'ids|timestamp' });
  searches.push({ term, pages: results });
}
await writeFile(`${directory}/commons-discovery.json`, JSON.stringify({ checkedAt: new Date().toISOString(), pages, searches }, null, 2) + '\n');
for (const page of [...pages, ...searches.flatMap(s => s.pages)]) {
  const info = page.imageinfo?.[0];
  console.log(JSON.stringify({ title: page.title, missing: !info, license: info?.extmetadata?.LicenseShortName?.value, duration: info?.duration }));
}
