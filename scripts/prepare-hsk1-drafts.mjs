// Offline review artifacts only: no database/API writes, no publication.
import { readFile, writeFile } from 'node:fs/promises';
import { draftSchema } from '../dist-server/content.schema.js';
const snapshot = JSON.parse(await readFile('docs/hsk1-audit/content-snapshot.json', 'utf8'));
if (snapshot.lessons.map(l => l.slug).join(',') !== 'hsk1-greetings,hsk1-my-name,hsk1-your-name,hsk1-courtesy,hsk1-module-test') throw new Error('Unexpected pilot structure; review the snapshot before preparing drafts');
const l = (ru, kk, en) => ({ ru, kk, en });
const text = (id, kind, prompt, answer, explanation, topic = 'introductions') => ({ id, kind, prompt, accepted: [answer], explanation, topic, skill: kind === 'gap' ? 'grammar' : 'vocabulary' });
const order = (id, prompt, words, explanation, topic = 'introductions') => ({ id, kind: 'order', prompt,
  options: words.map((w, i) => ({ id: String(i), text: l(w,w,w) })).reverse(), correct: words.map((_,i) => String(i)), explanation, topic, skill: 'grammar' });
const choice = (id, prompt, options, explanation, topic, skill = 'reading') => ({ id, kind: 'choice', prompt,
  options: options.map((value, i) => ({ id: String(i), text: value })), correct: '0', explanation, topic, skill });
const additions = [
  [
    text('you-input', 'input', l('Напишите «ты» иероглифом.', '«Сен» сөзін иероглифпен жазыңыз.', 'Write “you” in Chinese.'), '你', l('你 (nǐ) — ты. 好 означает «хороший; хорошо».', '你 (nǐ) — сен. 好 — «жақсы».', '你 (nǐ) means you. 好 means good or well.'), 'greetings'),
    text('good-input', 'input', l('Напишите «хороший; хорошо» иероглифом.', '«Жақсы» сөзін иероглифпен жазыңыз.', 'Write “good; well” in Chinese.'), '好', l('好 (hǎo) — хороший; хорошо. В 你好 это второй иероглиф.', '好 (hǎo) — жақсы. 你好 сөзінде бұл екінші иероглиф.', '好 (hǎo) means good or well. It is the second character in 你好.'), 'greetings'),
    order('hello-order', l('Соберите приветствие.', 'Сәлемдесуді құрастырыңыз.', 'Build the greeting.'), ['你','好'], l('Порядок: 你好, nǐ hǎo.', 'Реті: 你好, nǐ hǎo.', 'The order is 你好, nǐ hǎo.'), 'greetings'),
    choice('hello-reading', l('A: 你好！ B: 你好！ Что делают собеседники?', 'A: 你好！ B: 你好！ Олар не істеп жатыр?', 'A: 你好！ B: 你好！ What are they doing?'), [l('Здороваются','Сәлемдесіп жатыр','Greeting each other'),l('Называют имена','Есімдерін айтып жатыр','Giving their names')], l('Обе реплики — приветствие 你好.', 'Екі реплика да 你好 сәлемдесуі.', 'Both lines use the greeting 你好.'), 'greetings'),
  ],
  [
    text('i-input','input',l('Напишите «я» иероглифом.','«Мен» сөзін иероглифпен жазыңыз.','Write “I” in Chinese.'),'我',l('我 (wǒ) — я; 你 — ты.','我 (wǒ) — мен; 你 — сен.','我 (wǒ) means I; 你 means you.')),
    order('intro-order',l('Соберите «Меня зовут Анна».','«Менің атым Анна» сөйлемін құрастырыңыз.','Build “My name is Anna”.'),['我','叫','安娜'],l('我 + 叫 + имя: 我叫安娜。','我 + 叫 + есім: 我叫安娜。','我 + 叫 + name: 我叫安娜。')),
    text('name-word','input',l('Напишите «имя» иероглифами.','«Есім» сөзін иероглифтермен жазыңыз.','Write “name” in Chinese.'),'名字',l('名字 (míngzi) — имя; 叫 — зваться.','名字 (míngzi) — есім; 叫 — аталу.','名字 (míngzi) means name; 叫 means to be called.')),
    choice('intro-reading',l('Прочитайте: 我叫安娜。 Как зовут говорящего?','Оқыңыз: 我叫安娜。 Сөйлеушінің аты кім?','Read: 我叫安娜。 What is the speaker’s name?'),[l('Анна','Анна','Anna'),l('Имя не названо','Есімі айтылмаған','No name is given')],l('安娜 — имя после 我叫.','安娜 — 我叫 сөзінен кейінгі есім.','安娜 is the name after 我叫.'),'introductions'),
  ],
  [
    text('what-input','input',l('Напишите «что; какой» по-китайски.','«Не; қандай» сөзін қытайша жазыңыз.','Write “what” in Chinese.'),'什么',l('什么 (shénme) запрашивает неизвестную информацию.','什么 (shénme) белгісіз ақпаратты сұрайды.','什么 (shénme) asks for unknown information.')),
    text('question-gap','gap',l('Вставьте «что»: 你叫___名字？','«Не» сөзін қойыңыз: 你叫___名字？','Insert “what”: 你叫___名字？'),'什么',l('你叫什么名字？ — вопрос об имени.','你叫什么名字？ — есім туралы сұрақ.','你叫什么名字？ asks for a name.')),
    order('answer-order',l('Ответьте «Меня зовут Анна».','«Менің атым Анна» деп жауап беріңіз.','Answer “My name is Anna”.'),['我','叫','安娜'],l('В ответе говорим о себе: 我叫安娜。','Жауапта өзіміз туралы айтамыз: 我叫安娜。','Use 我 to speak about yourself: 我叫安娜。')),
    choice('question-reading',l('A: 你叫什么名字？ B: 我叫安娜。 Кто представился?','A: 你叫什么名字？ B: 我叫安娜。 Кім өзін таныстырды?','A: 你叫什么名字？ B: 我叫安娜。 Who gave their name?'),[l('B','B','B'),l('A','A','A')],l('A спрашивает; B отвечает 我叫安娜.','A сұрайды; B 我叫安娜 деп жауап береді.','A asks; B answers 我叫安娜.'),'introductions'),
  ],
  [
    text('thanks-input','input',l('Напишите «спасибо» иероглифами.','«Рақмет» сөзін иероглифтермен жазыңыз.','Write “thank you” in Chinese.'),'谢谢',l('谢谢 (xièxie) — благодарность; 不客气 — ответ на неё.','谢谢 (xièxie) — алғыс; 不客气 — оған жауап.','谢谢 (xièxie) expresses thanks; 不客气 responds to thanks.'),'courtesy'),
    text('courtesy-gap','gap',l('Дополните ответ на 谢谢: 不___。','谢谢 сөзіне жауапты толықтырыңыз: 不___。','Complete the response to 谢谢: 不___。'),'客气',l('Целая реплика: 不客气 — пожалуйста в ответ на благодарность.','Толық реплика: 不客气 — алғысқа жауап ретінде «оқасы жоқ».','The full response is 不客气 — you are welcome.'),'courtesy'),
    order('farewell-order',l('Соберите «до свидания».','«Сау болыңыз» сөзін құрастырыңыз.','Build “goodbye”.'),['再','见'],l('再见 (zàijiàn) — прощание; порядок 再, затем 见.','再见 (zàijiàn) — қоштасу; алдымен 再, содан кейін 见.','再见 (zàijiàn) means goodbye: 再 followed by 见.'),'courtesy'),
    choice('thanks-reading',l('A: 谢谢！ B: 不客气！ Что делает B?','A: 谢谢！ B: 不客气！ B не істеп жатыр?','A: 谢谢！ B: 不客气！ What does B do?'),[l('Отвечает на благодарность','Алғысқа жауап береді','Responds to thanks'),l('Спрашивает имя','Есімін сұрайды','Asks for a name')],l('不客气 — ответ на 谢谢, а вопрос об имени — 你叫什么名字？','不客气 — 谢谢 сөзіне жауап, ал есім туралы сұрақ — 你叫什么名字？','不客气 responds to 谢谢; 你叫什么名字？ asks for a name.'),'courtesy'),
  ],
];
const goals = [
  l('Цель: поздороваться и распознать 你好. Предварительных знаний не требуется. Прочитайте слова и правило, послушайте запись, затем выполните тест.', 'Мақсат: сәлемдесу және 你好 сөзін тану. Алдын ала білім қажет емес. Сөздер мен ережені оқып, жазбаны тыңдаңыз, содан кейін тестті орындаңыз.', 'Goal: greet someone and recognize 你好. No prior knowledge is needed. Read the words and rule, listen, then take the quiz.'),
  l('Цель: представиться по образцу 我叫… . Сначала завершите урок «Приветствие». 安娜 (Ānnà) — имя Анна, пример для тренировки; замените его своим именем в устной практике.', 'Мақсат: 我叫… үлгісімен өзіңізді таныстыру. Алдымен «Сәлемдесу» сабағын аяқтаңыз. 安娜 (Ānnà) — жаттығуға арналған Анна есімі; ауызша жаттығуда өз есіміңізді қолданыңыз.', 'Goal: introduce yourself with 我叫… . Complete Greetings first. 安娜 (Ānnà) is the example name Anna; use your own name in speaking practice.'),
  l('Цель: спросить имя и ответить. Нужны 我叫… и слова прошлого урока. Прочитайте правило и диалог, разыграйте обе роли, затем выполните тест.', 'Мақсат: есімін сұрау және жауап беру. 我叫… үлгісі мен өткен сабақтың сөздері қажет. Ереже мен диалогты оқып, екі рөлді де ойнап, тестті орындаңыз.', 'Goal: ask and answer about names. Use 我叫… and the previous vocabulary. Read the rule and dialogue, play both roles, then take the quiz.'),
  l('Цель: поблагодарить, ответить на благодарность и попрощаться. Повторите приветствие и знакомство. Прочитайте реплики, разыграйте разговор, затем выполните тест.', 'Мақсат: алғыс айту, алғысқа жауап беру және қоштасу. Сәлемдесу мен танысуды қайталаңыз. Репликаларды оқып, әңгімелесуді ойнап, тестті орындаңыз.', 'Goal: thank someone, respond to thanks and say goodbye. Review greetings and introductions. Read the lines, act out a conversation, then take the quiz.'),
];
const lessons = snapshot.lessons.map((source, i) => {
  const draft = { title: source.title, minutes: source.minutes, blocks: structuredClone(source.blocks),
    quiz: { kind: source.quiz.kind, passPercent: source.quiz.passPercent, questions: structuredClone(source.quiz.questions) } };
  if (i < 4) {
    const phrase = draft.blocks.find(b => b.kind === 'reading').content;
    draft.blocks.unshift({ kind: 'reading', content: { title: l('Цель и порядок работы','Мақсат және жұмыс реті','Goal and sequence'), text: goals[i], hanzi: phrase.hanzi, pinyin: phrase.pinyin, translation: phrase.translation } });
    draft.quiz.questions.push(...additions[i]);
  } else {
    draft.quiz.questions.push(structuredClone(snapshot.lessons[3].quiz.questions[0]), structuredClone(snapshot.lessons[2].quiz.questions[1]), additions[1][3], additions[1][1]);
    draft.blocks[0].content.text = l('В тесте 10 заданий по четырём урокам. Для зачёта нужны 8 верных ответов (80%). После отправки доступны объяснения и пересдача. Это итог пилотного модуля, не экзамен HSK 1.', 'Тестте төрт сабақ бойынша 10 тапсырма бар. Өту үшін 8 дұрыс жауап (80%) қажет. Жібергеннен кейін түсіндірмелер мен қайта тапсыру қолжетімді. Бұл HSK 1 емтиханы емес, пилоттық модульдің қорытындысы.', 'There are 10 questions covering four lessons. You need 8 correct answers (80%) to pass. Explanations and retakes are available after submission. This is a pilot module assessment, not an HSK 1 exam.');
  }
  // Avoid introducing lesson-four distractors before they have been taught.
  const greeting = draft.quiz.questions.find(q => q.id === 'greeting-choice');
  if (greeting) Object.assign(greeting, choice('greeting-choice', l('Что означает 你好?', '你好 нені білдіреді?', 'What does 你好 mean?'), [l('Здравствуйте; привет','Сәлеметсіз бе; сәлем','Hello'),l('Ты','Сен','You'),l('Хороший; хорошо','Жақсы','Good; well')], l('你好 — приветствие целиком. 你 отдельно означает «ты», 好 — «хороший; хорошо».', '你好 — толық сәлемдесу. 你 жеке тұрғанда «сен», 好 — «жақсы».', '你好 is a greeting as a whole. 你 alone means you; 好 means good or well.'), 'greetings', 'vocabulary'));
  return { slug: source.slug, baseRevision: source.revision, baseEditVersion: source.editVersion, draft: draftSchema.parse(draft) };
});
await writeFile('docs/hsk1-audit/proposed-content.json', JSON.stringify({ status: 'DRAFT_REQUIRES_HUMAN_REVIEW', basis: snapshot.capturedAt, publish: false, lessons }, null, 2) + '\n');
console.log('Prepared offline drafts: ' + lessons.map(l => `${l.slug}: ${l.draft.quiz.questions.length}`).join(', '));
const lines = ['# Учебный черновик: содержание для проверки', '', 'НЕ ОПУБЛИКОВАНО. Автоматически подготовлено; приёмка преподавателем и ru/kk/en-редакторами не выполнена.', '', 'Исходник: proposed-content.json. Аудиопробелы и решения по языку: AUDIO_AND_REVIEW.md.', ''];
const local = value => { for (const lang of ['ru','kk','en']) lines.push(`- ${lang}: ${value[lang]}`); lines.push(''); };
for (const { slug, draft } of lessons) {
  lines.push(`## ${slug}`, ''); local(draft.title);
  for (const [i, block] of draft.blocks.entries()) {
    lines.push(`### Блок ${i + 1}: ${block.kind}`, ''); local(block.content.title);
    if (block.content.text) local(block.content.text);
    for (const phrase of block.content.words ?? [block.content]) {
      lines.push(`${phrase.hanzi} — ${phrase.pinyin}`, ''); local(phrase.translation);
    }
    if (block.content.audioUrl) lines.push(`Аудио: ${block.content.audioUrl}`, '');
  }
  lines.push(`### Тест: ${draft.quiz.questions.length} вопросов, порог ${draft.quiz.passPercent}%`, '');
  for (const q of draft.quiz.questions) {
    lines.push(`#### ${q.id} (${q.kind})`, ''); local(q.prompt);
    for (const field of ['options','left','right']) if (q[field]) {
      lines.push(`${field}:`, '');
      for (const o of q[field]) { lines.push(`Ключ ${o.id}:`, ''); local(o.text); }
    }
    lines.push(`Ответ (ключи в порядке, для match — по left): ${JSON.stringify(q.correct ?? q.accepted)}`, '', 'Объяснение:', ''); local(q.explanation);
  }
}
await writeFile('docs/hsk1-audit/REVIEW_CONTENT.md', lines.join('\n') + '\n');
