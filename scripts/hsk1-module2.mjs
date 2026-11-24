// HSK 1, module 2: lessons 5–12 and a module test. Offline content only: this script writes
// docs/hsk1-content/module2.json after schema validation; it never touches the database.
// Everything here is a DRAFT that needs a teacher's review of Chinese, pinyin, ru/kk/en.
// Usage (after server:build): node scripts/hsk1-module2.mjs
import { mkdir, writeFile } from 'node:fs/promises';
import { draftSchema } from '../dist-server/content.schema.js';

const l = (ru, kk, en) => ({ ru, kk, en });
const same = text => l(text, text, text);
const word = (hanzi, pinyin, ru, kk, en) => ({ hanzi, pinyin, translation: l(ru, kk, en) });
const vocabulary = words => ({ kind: 'vocabulary', content: { title: l('Новые слова', 'Жаңа сөздер', 'New words'), words } });
const reading = (title, text, hanzi, pinyin, translation) => ({ kind: 'reading', content: { title, text, hanzi, pinyin, translation } });
const goal = (text, hanzi, pinyin, translation) => reading(l('Цель и порядок работы', 'Мақсат және жұмыс реті', 'Goal and sequence'), text, hanzi, pinyin, translation);
const opt = (id, text) => ({ id, text: typeof text === 'string' ? same(text) : text });
const choice = (id, topic, skill, prompt, options, correct, explanation) => ({ id, kind: 'choice', topic, skill, prompt, options: options.map(([key, text]) => opt(key, text)), correct, explanation });
// Pairs are listed in the correct order; the right column is shown rotated by one.
const match = (id, topic, prompt, pairs, explanation) => {
  const left = pairs.map(([text], i) => opt(`l${i}`, text));
  const right = pairs.map(([, text], i) => opt(`r${i}`, text));
  return { id, kind: 'match', topic, skill: 'vocabulary', prompt, left, right: [...right.slice(1), right[0]], correct: pairs.map((_, i) => `r${i}`), explanation };
};
// Words are given in the correct order; the learner sees them reversed.
const order = (id, topic, prompt, words, explanation) => ({ id, kind: 'order', topic, skill: 'grammar', prompt,
  options: words.map((w, i) => opt(`w${i}`, w)).reverse(), correct: words.map((_, i) => `w${i}`), explanation });
const input = (id, topic, prompt, accepted, explanation, skill = 'writing') => ({ id, kind: 'input', topic, skill, prompt, accepted, explanation });
const gap = (id, topic, prompt, accepted, explanation) => ({ id, kind: 'gap', topic, skill: 'grammar', prompt, accepted, explanation });
const quiz = questions => ({ kind: 'lesson', passPercent: 80, questions });

const lessons = [];

// 5. Numbers 1–10 and up to 99.
lessons.push({ slug: 'hsk1-numbers', draft: { title: l('Числа', 'Сандар', 'Numbers'), minutes: 15, blocks: [
  goal(l('Цель: считать от 1 до 10 и составлять числа до 99. Прочитайте слова, разберите правило, затем посчитайте вслух и выполните тест.',
    'Мақсат: 1-ден 10-ға дейін санау және 99-ға дейінгі сандарды құрастыру. Сөздерді оқып, ережені талдаңыз, дауыстап санаңыз да, тестті орындаңыз.',
    'Goal: count from 1 to 10 and build numbers up to 99. Read the words, study the rule, count aloud, then take the quiz.'),
    '一、二、三', 'yī, èr, sān', l('один, два, три', 'бір, екі, үш', 'one, two, three')),
  vocabulary([
    word('一', 'yī', 'один', 'бір', 'one'), word('二', 'èr', 'два', 'екі', 'two'), word('三', 'sān', 'три', 'үш', 'three'),
    word('四', 'sì', 'четыре', 'төрт', 'four'), word('五', 'wǔ', 'пять', 'бес', 'five'), word('六', 'liù', 'шесть', 'алты', 'six'),
    word('七', 'qī', 'семь', 'жеті', 'seven'), word('八', 'bā', 'восемь', 'сегіз', 'eight'), word('九', 'jiǔ', 'девять', 'тоғыз', 'nine'),
    word('十', 'shí', 'десять', 'он', 'ten'),
  ]),
  reading(l('Числа до 99', '99-ға дейінгі сандар', 'Numbers up to 99'),
    l('Числа от 11 до 19: 十 + единицы (十一 = 11). Десятки: цифра + 十 (二十 = 20). Остальные: цифра + 十 + цифра (二十五 = 25).',
      '11-ден 19-ға дейінгі сандар: 十 + бірлік (十一 = 11). Ондықтар: цифр + 十 (二十 = 20). Қалғандары: цифр + 十 + цифр (二十五 = 25).',
      'Numbers 11–19: 十 + units (十一 = 11). Tens: digit + 十 (二十 = 20). Others: digit + 十 + digit (二十五 = 25).'),
    '十一　二十　二十五', 'shíyī　èrshí　èrshíwǔ', l('11　20　25', '11　20　25', '11　20　25')),
  reading(l('Считаем вместе', 'Бірге санаймыз', 'Counting together'),
    l('Прочитайте счёт вслух. Следите за тонами: yī — ровный высокий, èr — падающий, sān — ровный высокий.',
      'Санауды дауыстап оқыңыз. Тондарға назар аударыңыз: yī — биік тегіс, èr — төмендейтін, sān — биік тегіс.',
      'Read the count aloud. Watch the tones: yī is high and level, èr is falling, sān is high and level.'),
    '一、二、三、四、五，六、七、八、九、十。', 'Yī, èr, sān, sì, wǔ, liù, qī, bā, jiǔ, shí.', l('Один, два, три, четыре, пять, шесть, семь, восемь, девять, десять.', 'Бір, екі, үш, төрт, бес, алты, жеті, сегіз, тоғыз, он.', 'One, two, three, four, five, six, seven, eight, nine, ten.')),
], quiz: quiz([
  choice('five-choice', 'numbers', 'vocabulary', l('Что означает 五?', '五 нені білдіреді?', 'What does 五 mean?'), [['3', l('3', '3', '3')], ['5', l('5', '5', '5')], ['8', l('8', '8', '8')]], '5',
    l('五 (wǔ) — пять.', '五 (wǔ) — бес.', '五 (wǔ) means five.')),
  match('digits-match', 'numbers', l('Сопоставьте иероглифы и числа.', 'Иероглифтер мен сандарды сәйкестендіріңіз.', 'Match the characters and the numbers.'),
    [['三', '3'], ['七', '7'], ['九', '9'], ['四', '4']], l('三 — 3, 七 — 7, 九 — 9, 四 — 4.', '三 — 3, 七 — 7, 九 — 9, 四 — 4.', '三 is 3, 七 is 7, 九 is 9, 四 is 4.')),
  input('ten-input', 'numbers', l('Напишите иероглифом число 10.', '10 санын иероглифпен жазыңыз.', 'Write the number 10 as a character.'), ['十'],
    l('10 — 十 (shí).', '10 — 十 (shí).', '10 is 十 (shí).')),
  gap('twenty-gap', 'numbers', l('Дополните число 20: 二___', '20 санын толықтырыңыз: 二___', 'Complete the number 20: 二___'), ['十'],
    l('Десятки строятся так: цифра + 十. 二十 = 20.', 'Ондықтар былай құрылады: цифр + 十. 二十 = 20.', 'Tens are digit + 十. 二十 = 20.')),
  order('twentyfive-order', 'numbers', l('Соберите число 25.', '25 санын құрастырыңыз.', 'Build the number 25.'), ['二', '十', '五'],
    l('25 = 二 (2) + 十 (десятки) + 五 (5): 二十五.', '25 = 二 (2) + 十 (ондық) + 五 (5): 二十五.', '25 = 二 (2) + 十 (tens) + 五 (5): 二十五.')),
  choice('eighteen-choice', 'numbers', 'reading', l('Какое число записано: 十八?', '十八 қандай сан?', 'Which number is 十八?'), [['80', l('80', '80', '80')], ['18', l('18', '18', '18')], ['8', l('8', '8', '8')]], '18',
    l('十 + 八 = 10 + 8 = 18. Число 80 — это 八十.', '十 + 八 = 10 + 8 = 18. 80 саны — 八十.', '十 + 八 = 10 + 8 = 18. Eighty is 八十.')),
]) } });

// 6. Countries and nationalities.
lessons.push({ slug: 'hsk1-countries', draft: { title: l('Откуда ты?', 'Қай елдікісің?', 'Where are you from?'), minutes: 15, blocks: [
  goal(l('Цель: сказать, из какой вы страны, и задать вопрос с 吗. Нужны 我, 你 и 叫 из первого модуля.',
    'Мақсат: қай елден екеніңізді айту және 吗 арқылы сұрақ қою. Бірінші модульдегі 我, 你 және 叫 сөздері қажет.',
    'Goal: say which country you are from and ask a question with 吗. You need 我, 你 and 叫 from module one.'),
    '我是中国人。', 'Wǒ shì Zhōngguó rén.', l('Я китаец (китаянка).', 'Мен қытаймын.', 'I am Chinese.')),
  vocabulary([
    word('是', 'shì', 'быть, являться', 'болу, болып табылу', 'to be'),
    word('不', 'bù', 'не, нет', 'емес, жоқ', 'not, no'),
    word('吗', 'ma', 'вопросительная частица', 'сұраулық шылау', 'question particle'),
    word('呢', 'ne', 'а ты? (встречный вопрос)', 'ал сен ше? (қарсы сұрақ)', 'and you? (follow-up question)'),
    word('人', 'rén', 'человек', 'адам', 'person'),
    word('中国', 'Zhōngguó', 'Китай', 'Қытай', 'China'),
    word('哪', 'nǎ', 'какой, который', 'қай, қайсы', 'which'),
    word('国', 'guó', 'страна', 'ел, мемлекет', 'country'),
    word('哈萨克斯坦', 'Hāsàkèsītǎn', 'Казахстан (дополнительно, не из списка HSK 1)', 'Қазақстан (қосымша, HSK 1 тізімінде жоқ)', 'Kazakhstan (extra, not on the HSK 1 list)'),
  ]),
  reading(l('Предложения с 是 и вопрос с 吗', '是 сөйлемдері және 吗 сұрағы', 'Sentences with 是 and questions with 吗'),
    l('Схема: A 是 B — «A является B». Отрицание: 不是. Перед четвёртым тоном 不 читается вторым тоном: bú shì. Чтобы получить вопрос «да/нет», добавьте 吗 в конец. Страна + 人 = национальность: 中国人 — китаец.',
      'Үлгі: A 是 B — «A — B болып табылады». Болымсыз түрі: 不是. Төртінші тонның алдында 不 екінші тонмен оқылады: bú shì. «Иә/жоқ» сұрағы үшін сөйлем соңына 吗 қосыңыз. Ел + 人 = ұлт: 中国人 — қытай.',
      'Pattern: A 是 B — “A is B”. Negation: 不是. Before a fourth tone 不 is read in the second tone: bú shì. Add 吗 at the end to make a yes/no question. Country + 人 = nationality: 中国人 means Chinese.'),
    '你是中国人吗？　我不是中国人。', 'Nǐ shì Zhōngguó rén ma?　Wǒ bú shì Zhōngguó rén.', l('Ты китаец?　Я не китаец.', 'Сен қытайсың ба?　Мен қытай емеспін.', 'Are you Chinese?　I am not Chinese.')),
  reading(l('Диалог', 'Диалог', 'Dialogue'),
    l('Прочитайте диалог по ролям. 呢 в конце задаёт тот же вопрос собеседнику: «А ты?».',
      'Диалогты рөлге бөліп оқыңыз. Соңындағы 呢 сол сұрақты әңгімелесушіге қояды: «Ал сен ше?».',
      'Read the dialogue in roles. 呢 at the end asks the same question back: “And you?”.'),
    'A：你是中国人吗？\nB：不是，我是哈萨克斯坦人。你呢？\nA：我是中国人。', 'A: Nǐ shì Zhōngguó rén ma?\nB: Bú shì, wǒ shì Hāsàkèsītǎn rén. Nǐ ne?\nA: Wǒ shì Zhōngguó rén.',
    l('A: Ты китаец?\nB: Нет, я казахстанец. А ты?\nA: Я китаец.', 'A: Сен қытайсың ба?\nB: Жоқ, мен қазақстандықпын. Ал сен ше?\nA: Мен қытаймын.', 'A: Are you Chinese?\nB: No, I am from Kazakhstan. And you?\nA: I am Chinese.')),
], quiz: quiz([
  choice('ma-choice', 'countries', 'grammar', l('Что делает 吗 в конце предложения?', 'Сөйлем соңындағы 吗 не істейді?', 'What does 吗 do at the end of a sentence?'),
    [['question', l('Делает вопрос «да/нет»', '«Иә/жоқ» сұрағын жасайды', 'Makes a yes/no question')], ['negation', l('Делает отрицание', 'Болымсыз етеді', 'Makes a negation')], ['past', l('Указывает на прошлое', 'Өткен шақты білдіреді', 'Marks the past')]], 'question',
    l('吗 превращает утверждение в вопрос «да/нет». Отрицание делает 不.', '吗 хабарлы сөйлемді «иә/жоқ» сұрағына айналдырады. Болымсыздықты 不 жасайды.', '吗 turns a statement into a yes/no question. 不 makes a negation.')),
  gap('bushi-gap', 'countries', l('Вставьте отрицание: 我___是中国人。', 'Болымсыздықты қойыңыз: 我___是中国人。', 'Insert the negation: 我___是中国人。'), ['不'],
    l('Глагол 是 отрицается словом 不: 我不是中国人 — я не китаец.', '是 етістігі 不 арқылы болымсыз болады: 我不是中国人 — мен қытай емеспін.', '是 is negated with 不: 我不是中国人 means I am not Chinese.')),
  order('question-order', 'countries', l('Соберите вопрос «Ты китаец?»', '«Сен қытайсың ба?» сұрағын құрастырыңыз.', 'Build the question “Are you Chinese?”'), ['你', '是', '中国人', '吗'],
    l('Порядок: 你是中国人 + 吗 в конце.', 'Реті: 你是中国人 + соңында 吗.', 'Order: 你是中国人 with 吗 at the end.')),
  input('person-input', 'countries', l('Напишите иероглиф «человек».', '«Адам» иероглифін жазыңыз.', 'Write the character for “person”.'), ['人'],
    l('人 (rén) — человек. Страна + 人 обозначает национальность.', '人 (rén) — адам. Ел + 人 ұлтты білдіреді.', '人 (rén) means person. Country + 人 gives a nationality.')),
  choice('ne-choice', 'countries', 'reading', l('B: 我是哈萨克斯坦人。你呢？ Что спрашивает B?', 'B: 我是哈萨克斯坦人。你呢？ B не сұрайды?', 'B: 我是哈萨克斯坦人。你呢？ What is B asking?'),
    [['you', l('«А ты откуда?»', '«Ал сен қайдансың?»', '“And where are you from?”')], ['name', l('«Как тебя зовут?»', '«Атың кім?»', '“What is your name?”')], ['bye', l('«До свидания»', '«Сау бол»', '“Goodbye”')]], 'you',
    l('呢 повторяет тот же вопрос собеседнику: «А ты?» — то есть «А ты из какой страны?».', '呢 сол сұрақты әңгімелесушіге қайталайды: «Ал сен ше?» — яғни «Ал сен қай елденсің?».', '呢 asks the same question back: “And you?” — here, “Which country are you from?”.')),
  choice('which-choice', 'countries', 'vocabulary', l('Какое слово значит «какой, который»?', '«Қай, қайсы» деген қай сөз?', 'Which word means “which”?'), [['na', '哪'], ['guo', '国'], ['ren', '人']], 'na',
    l('哪 (nǎ) — какой. 你是哪国人？ — Из какой ты страны?', '哪 (nǎ) — қай. 你是哪国人？ — Қай елдікісің?', '哪 (nǎ) means which. 你是哪国人？ — Which country are you from?')),
]) } });

// 7. Age.
lessons.push({ slug: 'hsk1-age', draft: { title: l('Сколько тебе лет?', 'Нешедесің?', 'How old are you?'), minutes: 15, blocks: [
  goal(l('Цель: спросить возраст и ответить. Нужны числа и 呢 из прошлых уроков.',
    'Мақсат: жасын сұрау және жауап беру. Өткен сабақтардағы сандар мен 呢 қажет.',
    'Goal: ask and answer about age. You need numbers and 呢 from earlier lessons.'),
    '我二十岁。', 'Wǒ èrshí suì.', l('Мне двадцать лет.', 'Мен жиырма жастамын.', 'I am twenty years old.')),
  vocabulary([
    word('几', 'jǐ', 'сколько (обычно до 10)', 'неше (әдетте 10-ға дейін)', 'how many (usually under 10)'),
    word('岁', 'suì', 'год (о возрасте)', 'жас (жас туралы)', 'year of age'),
    word('多', 'duō', 'много; насколько', 'көп; қаншалықты', 'many; how (much)'),
    word('大', 'dà', 'большой; старший по возрасту', 'үлкен; жасы үлкен', 'big; old (of age)'),
    word('了', 'le', 'частица изменения ситуации', 'жағдай өзгерісінің шылауы', 'particle of change'),
  ]),
  reading(l('Как спросить возраст', 'Жасын қалай сұрайды', 'How to ask about age'),
    l('Ребёнка спрашивают 你几岁了？ Взрослого или ровесника — 你多大了？ Отвечают без 是: 我二十岁。 Ошибка: 我是二十岁.',
      'Баладан 你几岁了？ деп сұрайды. Ересектен немесе құрдастан — 你多大了？ Жауап 是 сөзінсіз беріледі: 我二十岁。 Қате: 我是二十岁.',
      'Ask a child 你几岁了？ Ask an adult or peer 你多大了？ Answer without 是: 我二十岁。 Wrong: 我是二十岁.'),
    '你多大了？　我十九岁。', 'Nǐ duō dà le?　Wǒ shíjiǔ suì.', l('Сколько тебе лет?　Мне девятнадцать.', 'Нешедесің?　Мен он тоғыздамын.', 'How old are you?　I am nineteen.')),
  reading(l('Диалог', 'Диалог', 'Dialogue'),
    l('Прочитайте по ролям и замените числа своим возрастом.', 'Рөлге бөліп оқып, сандарды өз жасыңызбен ауыстырыңыз.', 'Read in roles and replace the numbers with your own age.'),
    'A：你多大了？\nB：我十九岁。你呢？\nA：我二十岁。', 'A: Nǐ duō dà le?\nB: Wǒ shíjiǔ suì. Nǐ ne?\nA: Wǒ èrshí suì.',
    l('A: Сколько тебе лет?\nB: Мне девятнадцать. А тебе?\nA: Мне двадцать.', 'A: Нешедесің?\nB: Мен он тоғыздамын. Ал сен ше?\nA: Мен жиырмадамын.', 'A: How old are you?\nB: I am nineteen. And you?\nA: I am twenty.')),
], quiz: quiz([
  choice('child-choice', 'age', 'grammar', l('Как спросить возраст у ребёнка?', 'Баланың жасын қалай сұрайды?', 'How do you ask a child’s age?'), [['ji', '你几岁了？'], ['duo', '你多大了？'], ['name', '你叫什么名字？']], 'ji',
    l('几 используют, когда ожидают небольшое число, поэтому 你几岁了？ — вопрос к ребёнку.', '几 кіші сан күтілгенде қолданылады, сондықтан 你几岁了？ — балаға қойылатын сұрақ.', '几 expects a small number, so 你几岁了？ is the question for a child.')),
  input('sui-input', 'age', l('Напишите иероглиф «год (о возрасте)».', '«Жас» иероглифін жазыңыз.', 'Write the character for “year of age”.'), ['岁'],
    l('岁 (suì) ставится после числа: 二十岁 — двадцать лет.', '岁 (suì) саннан кейін қойылады: 二十岁 — жиырма жас.', '岁 (suì) follows the number: 二十岁 — twenty years old.')),
  gap('duoda-gap', 'age', l('Дополните вопрос к взрослому: 你多___了？', 'Ересекке қойылатын сұрақты толықтырыңыз: 你多___了？', 'Complete the question to an adult: 你多___了？'), ['大'],
    l('你多大了？ — Сколько тебе лет? 大 здесь означает возраст.', '你多大了？ — Нешедесің? 大 мұнда жасты білдіреді.', '你多大了？ — How old are you? Here 大 refers to age.')),
  order('age-order', 'age', l('Соберите «Мне двадцать лет».', '«Мен жиырма жастамын» сөйлемін құрастырыңыз.', 'Build “I am twenty years old”.'), ['我', '二十', '岁'],
    l('Порядок: 我 + число + 岁, без 是.', 'Реті: 我 + сан + 岁, 是 сөзінсіз.', 'Order: 我 + number + 岁, without 是.')),
  choice('correct-sentence', 'age', 'grammar', l('Какое предложение правильное?', 'Қай сөйлем дұрыс?', 'Which sentence is correct?'), [['shi', '我是二十岁。'], ['ok', '我二十岁。'], ['le', '我岁二十。']], 'ok',
    l('Возраст называют без 是: 我二十岁。 Слово 岁 стоит после числа.', 'Жас 是 сөзінсіз айтылады: 我二十岁。 岁 саннан кейін тұрады.', 'Age is stated without 是: 我二十岁。 岁 comes after the number.')),
  choice('dialogue-age', 'age', 'reading', l('A: 你多大了？ B: 我十九岁。 Сколько лет B?', 'A: 你多大了？ B: 我十九岁。 B нешеде?', 'A: 你多大了？ B: 我十九岁。 How old is B?'), [['19', l('19', '19', '19')], ['90', l('90', '90', '90')], ['9', l('9', '9', '9')]], '19',
    l('十九 = 10 + 9 = 19.', '十九 = 10 + 9 = 19.', '十九 = 10 + 9 = 19.')),
]) } });

// 8. Family.
lessons.push({ slug: 'hsk1-family', draft: { title: l('Моя семья', 'Менің отбасым', 'My family'), minutes: 15, blocks: [
  goal(l('Цель: назвать членов семьи и сказать, кто у вас есть. Нужны числа, 几 и 吗.',
    'Мақсат: отбасы мүшелерін атау және кімің бар екенін айту. Сандар, 几 және 吗 қажет.',
    'Goal: name family members and say who you have. You need numbers, 几 and 吗.'),
    '我有一个女儿。', 'Wǒ yǒu yí ge nǚ’ér.', l('У меня есть дочь.', 'Менің бір қызым бар.', 'I have a daughter.')),
  vocabulary([
    word('家', 'jiā', 'семья; дом', 'отбасы; үй', 'family; home'),
    word('爸爸', 'bàba', 'папа', 'әке', 'dad'),
    word('妈妈', 'māma', 'мама', 'ана', 'mom'),
    word('儿子', 'érzi', 'сын', 'ұл', 'son'),
    word('女儿', 'nǚ’ér', 'дочь', 'қыз (перзент)', 'daughter'),
    word('有', 'yǒu', 'иметь; есть', 'бар болу', 'to have; there is'),
    word('没有', 'méiyǒu', 'не иметь; нет', 'жоқ болу', 'not have; there is not'),
    word('的', 'de', 'притяжательная частица', 'тәуелдік шылау', 'possessive particle'),
    word('个', 'gè', 'счётное слово для людей и предметов', 'адамдар мен заттарға арналған мөлшер сөз', 'measure word for people and things'),
    word('他', 'tā', 'он', 'ол (ер адам)', 'he'),
    word('她', 'tā', 'она', 'ол (әйел адам)', 'she'),
  ]),
  reading(l('有, 没有 и счётное слово 个', '有, 没有 және 个 мөлшер сөзі', '有, 没有 and the measure word 个'),
    l('有 — «иметь». Отрицание только 没有, не 不有. Между числом и существительным нужно счётное слово: 一个女儿. Перед четвёртым тоном 一 читается yí: yí ge. 的 означает принадлежность: 我的家 — моя семья; с родственниками 的 часто опускают: 我妈妈.',
      '有 — «бар болу». Болымсыз түрі тек 没有, 不有 емес. Сан мен зат есімнің арасында мөлшер сөз керек: 一个女儿. Төртінші тонның алдында 一 yí болып оқылады: yí ge. 的 тәуелдікті білдіреді: 我的家 — менің отбасым; туыстар туралы 的 жиі түсіріледі: 我妈妈.',
      '有 means to have. Its negation is only 没有, never 不有. A measure word goes between a number and a noun: 一个女儿. Before a fourth tone 一 is read yí: yí ge. 的 marks possession: 我的家 — my family; with relatives 的 is often dropped: 我妈妈.'),
    '我有一个儿子。　我没有女儿。', 'Wǒ yǒu yí ge érzi.　Wǒ méiyǒu nǚ’ér.', l('У меня есть сын.　У меня нет дочери.', 'Менің бір ұлым бар.　Менің қызым жоқ.', 'I have a son.　I do not have a daughter.')),
  reading(l('Диалог', 'Диалог', 'Dialogue'),
    l('Прочитайте по ролям. Обратите внимание: в ответе о возрасте снова нет 是.', 'Рөлге бөліп оқыңыз. Назар аударыңыз: жас туралы жауапта тағы да 是 жоқ.', 'Read in roles. Notice again that the answer about age has no 是.'),
    'A：你有儿子吗？\nB：没有。我有一个女儿。\nA：你女儿几岁了？\nB：她五岁了。', 'A: Nǐ yǒu érzi ma?\nB: Méiyǒu. Wǒ yǒu yí ge nǚ’ér.\nA: Nǐ nǚ’ér jǐ suì le?\nB: Tā wǔ suì le.',
    l('A: У тебя есть сын?\nB: Нет. У меня есть дочь.\nA: Сколько лет твоей дочери?\nB: Ей пять лет.', 'A: Ұлың бар ма?\nB: Жоқ. Менің бір қызым бар.\nA: Қызың нешеде?\nB: Ол бес жаста.', 'A: Do you have a son?\nB: No. I have a daughter.\nA: How old is your daughter?\nB: She is five.')),
], quiz: quiz([
  match('family-match', 'family', l('Сопоставьте слова и переводы.', 'Сөздер мен аудармаларды сәйкестендіріңіз.', 'Match the words and translations.'),
    [['爸爸', l('папа', 'әке', 'dad')], ['妈妈', l('мама', 'ана', 'mom')], ['儿子', l('сын', 'ұл', 'son')], ['女儿', l('дочь', 'қыз', 'daughter')]],
    l('爸爸 — папа, 妈妈 — мама, 儿子 — сын, 女儿 — дочь.', '爸爸 — әке, 妈妈 — ана, 儿子 — ұл, 女儿 — қыз.', '爸爸 is dad, 妈妈 is mom, 儿子 is son, 女儿 is daughter.')),
  gap('meiyou-gap', 'family', l('Вставьте отрицание: 我___有儿子。', 'Болымсыздықты қойыңыз: 我___有儿子。', 'Insert the negation: 我___有儿子。'), ['没'],
    l('有 отрицается только словом 没: 我没有儿子. Вариант 不有 неверен.', '有 тек 没 арқылы болымсыз болады: 我没有儿子. 不有 — қате.', '有 is negated only with 没: 我没有儿子. 不有 is wrong.')),
  order('daughter-order', 'family', l('Соберите «У меня есть дочь».', '«Менің бір қызым бар» сөйлемін құрастырыңыз.', 'Build “I have a daughter”.'), ['我', '有', '一', '个', '女儿'],
    l('我 + 有 + число + 个 + существительное.', '我 + 有 + сан + 个 + зат есім.', '我 + 有 + number + 个 + noun.')),
  input('home-input', 'family', l('Напишите иероглиф «семья; дом».', '«Отбасы; үй» иероглифін жазыңыз.', 'Write the character for “family; home”.'), ['家'],
    l('家 (jiā) — семья, дом. 我的家 — моя семья.', '家 (jiā) — отбасы, үй. 我的家 — менің отбасым.', '家 (jiā) means family or home. 我的家 — my family.')),
  choice('measure-choice', 'family', 'grammar', l('Какое слово нужно в 三___儿子?', '三___儿子 ішіне қай сөз керек?', 'Which word goes in 三___儿子?'), [['ge', '个'], ['de', '的'], ['you', '有']], 'ge',
    l('Между числом и существительным ставится счётное слово 个: 三个儿子.', 'Сан мен зат есімнің арасына 个 мөлшер сөзі қойылады: 三个儿子.', 'A measure word goes between a number and a noun: 三个儿子.')),
  choice('family-reading', 'family', 'reading', l('A: 你有儿子吗？ B: 没有。我有一个女儿。 Кто есть у B?', 'A: 你有儿子吗？ B: 没有。我有一个女儿。 B-ның кімі бар?', 'A: 你有儿子吗？ B: 没有。我有一个女儿。 Who does B have?'),
    [['daughter', l('Дочь', 'Қызы', 'A daughter')], ['son', l('Сын', 'Ұлы', 'A son')], ['both', l('Сын и дочь', 'Ұлы мен қызы', 'A son and a daughter')]], 'daughter',
    l('没有 — сына нет; 我有一个女儿 — есть одна дочь.', '没有 — ұлы жоқ; 我有一个女儿 — бір қызы бар.', '没有 — no son; 我有一个女儿 — one daughter.')),
]) } });

// 9. Dates and weekdays.
lessons.push({ slug: 'hsk1-dates', draft: { title: l('Какое сегодня число?', 'Бүгін нешесі?', 'What is the date today?'), minutes: 15, blocks: [
  goal(l('Цель: назвать день недели и дату, спросить «какое сегодня число». Нужны числа и 几.',
    'Мақсат: апта күні мен күнді атау, «бүгін нешесі» деп сұрау. Сандар мен 几 қажет.',
    'Goal: name the weekday and date, and ask what the date is. You need numbers and 几.'),
    '今天星期一。', 'Jīntiān xīngqīyī.', l('Сегодня понедельник.', 'Бүгін дүйсенбі.', 'Today is Monday.')),
  vocabulary([
    word('今天', 'jīntiān', 'сегодня', 'бүгін', 'today'),
    word('明天', 'míngtiān', 'завтра', 'ертең', 'tomorrow'),
    word('昨天', 'zuótiān', 'вчера', 'кеше', 'yesterday'),
    word('星期', 'xīngqī', 'неделя', 'апта', 'week'),
    word('月', 'yuè', 'месяц', 'ай', 'month'),
    word('号', 'hào', 'число (дата)', 'күн (айдың күні)', 'day of the month'),
  ]),
  reading(l('Дни недели и даты', 'Апта күндері мен күндер', 'Weekdays and dates'),
    l('Дни недели: 星期 + номер. 星期一 — понедельник … 星期六 — суббота; воскресенье — 星期天. Месяцы: номер + 月 (十一月 — ноябрь). Дата идёт от большего к меньшему: 十一月二十三号. В ответе 是 обычно опускают: 今天星期三。',
      'Апта күндері: 星期 + нөмір. 星期一 — дүйсенбі … 星期六 — сенбі; жексенбі — 星期天. Айлар: нөмір + 月 (十一月 — қараша). Күн үлкеннен кішіге қарай жазылады: 十一月二十三号. Жауапта 是 әдетте түсіріледі: 今天星期三。',
      'Weekdays: 星期 + number. 星期一 is Monday … 星期六 is Saturday; Sunday is 星期天. Months: number + 月 (十一月 is November). Dates go from larger to smaller: 十一月二十三号. 是 is usually dropped: 今天星期三。'),
    '今天几月几号？　今天十一月二十三号。', 'Jīntiān jǐ yuè jǐ hào?　Jīntiān shíyī yuè èrshísān hào.', l('Какое сегодня число?　Сегодня 23 ноября.', 'Бүгін нешесі?　Бүгін 23 қараша.', 'What is the date today?　Today is November 23.')),
  reading(l('Диалог', 'Диалог', 'Dialogue'),
    l('Прочитайте по ролям и назовите сегодняшнюю дату.', 'Рөлге бөліп оқып, бүгінгі күнді атаңыз.', 'Read in roles and say today’s date.'),
    'A：今天几号？\nB：今天九号。\nA：明天星期几？\nB：明天星期五。', 'A: Jīntiān jǐ hào?\nB: Jīntiān jiǔ hào.\nA: Míngtiān xīngqī jǐ?\nB: Míngtiān xīngqīwǔ.',
    l('A: Какое сегодня число?\nB: Сегодня девятое.\nA: Какой завтра день недели?\nB: Завтра пятница.', 'A: Бүгін нешесі?\nB: Бүгін тоғызы.\nA: Ертең аптаның қай күні?\nB: Ертең жұма.', 'A: What is the date today?\nB: Today is the ninth.\nA: What day is tomorrow?\nB: Tomorrow is Friday.')),
], quiz: quiz([
  match('days-match', 'dates', l('Сопоставьте слова и переводы.', 'Сөздер мен аудармаларды сәйкестендіріңіз.', 'Match the words and translations.'),
    [['今天', l('сегодня', 'бүгін', 'today')], ['明天', l('завтра', 'ертең', 'tomorrow')], ['昨天', l('вчера', 'кеше', 'yesterday')]],
    l('今天 — сегодня, 明天 — завтра, 昨天 — вчера.', '今天 — бүгін, 明天 — ертең, 昨天 — кеше.', '今天 is today, 明天 is tomorrow, 昨天 is yesterday.')),
  choice('monday-choice', 'dates', 'vocabulary', l('Как сказать «понедельник»?', '«Дүйсенбі» қалай айтылады?', 'How do you say “Monday”?'), [['1', '星期一'], ['7', '星期天'], ['m1', '一月']], '1',
    l('星期一 — понедельник. 星期天 — воскресенье, 一月 — январь.', '星期一 — дүйсенбі. 星期天 — жексенбі, 一月 — қаңтар.', '星期一 is Monday. 星期天 is Sunday, 一月 is January.')),
  gap('hao-gap', 'dates', l('Дополните вопрос: 今天几___？ (какое число)', 'Сұрақты толықтырыңыз: 今天几___？ (айдың нешесі)', 'Complete the question: 今天几___？ (which day of the month)'), ['号'],
    l('今天几号？ — Какое сегодня число? 号 обозначает число месяца.', '今天几号？ — Бүгін нешесі? 号 айдың күнін білдіреді.', '今天几号？ asks the day of the month; 号 marks the date.')),
  order('date-order', 'dates', l('Соберите «Сегодня 1 октября».', '«Бүгін 1 қазан» сөйлемін құрастырыңыз.', 'Build “Today is October 1”.'), ['今天', '十月', '一号'],
    l('Дата от большего к меньшему: 今天 + 十月 + 一号.', 'Күн үлкеннен кішіге қарай: 今天 + 十月 + 一号.', 'Dates go from larger to smaller: 今天 + 十月 + 一号.')),
  input('month-input', 'dates', l('Напишите иероглиф «месяц».', '«Ай» иероглифін жазыңыз.', 'Write the character for “month”.'), ['月'],
    l('月 (yuè) — месяц: 三月 — март.', '月 (yuè) — ай: 三月 — наурыз.', '月 (yuè) means month: 三月 is March.')),
  choice('dates-reading', 'dates', 'reading', l('A: 明天星期几？ B: 明天星期五。 Какой день будет завтра?', 'A: 明天星期几？ B: 明天星期五。 Ертең қай күн?', 'A: 明天星期几？ B: 明天星期五。 What day is tomorrow?'),
    [['fri', l('Пятница', 'Жұма', 'Friday')], ['may', l('Май', 'Мамыр', 'May')], ['fifth', l('Пятое число', 'Бесінші күн', 'The fifth')]], 'fri',
    l('星期五 — пятница. Май — 五月, пятое число — 五号.', '星期五 — жұма. Мамыр — 五月, бесінші күн — 五号.', '星期五 is Friday. May is 五月 and the fifth is 五号.')),
]) } });

// 10. Food and drinks.
lessons.push({ slug: 'hsk1-food', draft: { title: l('Что ты хочешь съесть?', 'Не жегің келеді?', 'What would you like to eat?'), minutes: 15, blocks: [
  goal(l('Цель: сказать, что вы хотите съесть или выпить, и спросить собеседника. Нужны 什么 и 呢.',
    'Мақсат: не жегіңіз немесе ішкіңіз келетінін айту және әңгімелесушіден сұрау. 什么 және 呢 қажет.',
    'Goal: say what you want to eat or drink and ask others. You need 什么 and 呢.'),
    '我想喝茶。', 'Wǒ xiǎng hē chá.', l('Я хочу выпить чаю.', 'Мен шай ішкім келеді.', 'I would like to drink tea.')),
  vocabulary([
    word('吃', 'chī', 'есть (кушать)', 'жеу', 'to eat'),
    word('喝', 'hē', 'пить', 'ішу', 'to drink'),
    word('想', 'xiǎng', 'хотеть; думать', 'қалау; ойлау', 'to want; to think'),
    word('茶', 'chá', 'чай', 'шай', 'tea'),
    word('水', 'shuǐ', 'вода', 'су', 'water'),
    word('米饭', 'mǐfàn', 'варёный рис', 'пісірілген күріш', 'cooked rice'),
    word('菜', 'cài', 'блюдо; овощи', 'тағам; көкөніс', 'dish; vegetables'),
  ]),
  reading(l('想 + действие', '想 + әрекет', '想 + action'),
    l('想 перед глаголом означает «хотеть сделать»: 我想吃米饭 — я хочу поесть риса. Вопрос: 你想吃什么？ — Что ты хочешь съесть? 什么 стоит на месте ответа.',
      'Етістіктің алдындағы 想 «бір нәрсе істегісі келу» дегенді білдіреді: 我想吃米饭 — мен күріш жегім келеді. Сұрақ: 你想吃什么？ — Не жегің келеді? 什么 жауаптың орнында тұрады.',
      '想 before a verb means “want to do”: 我想吃米饭 — I want to eat rice. Question: 你想吃什么？ — What do you want to eat? 什么 stands where the answer goes.'),
    '你想吃什么？　我想吃米饭。', 'Nǐ xiǎng chī shénme?　Wǒ xiǎng chī mǐfàn.', l('Что ты хочешь съесть?　Я хочу поесть риса.', 'Не жегің келеді?　Мен күріш жегім келеді.', 'What do you want to eat?　I want to eat rice.')),
  reading(l('Диалог', 'Диалог', 'Dialogue'),
    l('Прочитайте по ролям и замените блюда своими.', 'Рөлге бөліп оқып, тағамдарды өзіңізге ұнайтынымен ауыстырыңыз.', 'Read in roles and swap in your own food and drinks.'),
    'A：你想吃什么？\nB：我想吃米饭。你呢？\nA：我想喝茶。\nB：我想喝水。', 'A: Nǐ xiǎng chī shénme?\nB: Wǒ xiǎng chī mǐfàn. Nǐ ne?\nA: Wǒ xiǎng hē chá.\nB: Wǒ xiǎng hē shuǐ.',
    l('A: Что ты хочешь съесть?\nB: Я хочу риса. А ты?\nA: Я хочу чаю.\nB: А я хочу воды.', 'A: Не жегің келеді?\nB: Мен күріш жегім келеді. Ал сен ше?\nA: Мен шай ішкім келеді.\nB: Мен су ішкім келеді.', 'A: What do you want to eat?\nB: I want rice. And you?\nA: I want tea.\nB: I want water.')),
], quiz: quiz([
  match('food-match', 'food', l('Сопоставьте слова и переводы.', 'Сөздер мен аудармаларды сәйкестендіріңіз.', 'Match the words and translations.'),
    [['茶', l('чай', 'шай', 'tea')], ['水', l('вода', 'су', 'water')], ['米饭', l('рис', 'күріш', 'rice')], ['菜', l('блюдо', 'тағам', 'dish')]],
    l('茶 — чай, 水 — вода, 米饭 — рис, 菜 — блюдо.', '茶 — шай, 水 — су, 米饭 — күріш, 菜 — тағам.', '茶 is tea, 水 is water, 米饭 is rice, 菜 is a dish.')),
  choice('drink-choice', 'food', 'vocabulary', l('Какой глагол нужен в 我想___茶?', '我想___茶 ішіне қай етістік керек?', 'Which verb fits 我想___茶?'), [['he', '喝'], ['chi', '吃'], ['you', '有']], 'he',
    l('Чай пьют: 喝茶. 吃 — есть твёрдую еду.', 'Шайды ішеді: 喝茶. 吃 — қатты тағамды жеу.', 'Tea is drunk: 喝茶. 吃 is for eating food.')),
  gap('xiang-gap', 'food', l('Вставьте «хотеть»: 我___吃米饭。', '«Қалау» сөзін қойыңыз: 我___吃米饭。', 'Insert “want”: 我___吃米饭。'), ['想'],
    l('想 + глагол = хотеть сделать: 我想吃米饭.', '想 + етістік = бір нәрсе істегісі келу: 我想吃米饭.', '想 + verb = want to do: 我想吃米饭.')),
  order('what-order', 'food', l('Соберите вопрос «Что ты хочешь выпить?»', '«Не ішкің келеді?» сұрағын құрастырыңыз.', 'Build the question “What do you want to drink?”'), ['你', '想', '喝', '什么'],
    l('什么 стоит на месте ответа, в конце: 你想喝什么？', '什么 жауаптың орнында, соңында тұрады: 你想喝什么？', '什么 takes the place of the answer, at the end: 你想喝什么？')),
  input('water-input', 'food', l('Напишите иероглиф «вода».', '«Су» иероглифін жазыңыз.', 'Write the character for “water”.'), ['水'],
    l('水 (shuǐ) — вода. 喝水 — пить воду.', '水 (shuǐ) — су. 喝水 — су ішу.', '水 (shuǐ) means water. 喝水 — drink water.')),
  choice('food-reading', 'food', 'reading', l('A: 你想吃什么？ B: 我想吃米饭。 Что хочет B?', 'A: 你想吃什么？ B: 我想吃米饭。 B не қалайды?', 'A: 你想吃什么？ B: 我想吃米饭。 What does B want?'),
    [['rice', l('Рис', 'Күріш', 'Rice')], ['tea', l('Чай', 'Шай', 'Tea')], ['water', l('Воду', 'Су', 'Water')]], 'rice',
    l('我想吃米饭 — я хочу поесть риса.', '我想吃米饭 — мен күріш жегім келеді.', '我想吃米饭 — I want to eat rice.')),
]) } });

// 11. Shopping.
lessons.push({ slug: 'hsk1-shopping', draft: { title: l('Сколько стоит?', 'Қанша тұрады?', 'How much is it?'), minutes: 15, blocks: [
  goal(l('Цель: спросить цену и купить несколько вещей. Нужны числа, 个 и 想.',
    'Мақсат: бағасын сұрау және бірнеше зат сатып алу. Сандар, 个 және 想 қажет.',
    'Goal: ask a price and buy a few things. You need numbers, 个 and 想.'),
    '这个多少钱？', 'Zhège duōshao qián?', l('Сколько это стоит?', 'Мынау қанша тұрады?', 'How much is this?')),
  vocabulary([
    word('买', 'mǎi', 'покупать', 'сатып алу', 'to buy'),
    word('这', 'zhè', 'это, этот', 'бұл, мынау', 'this'),
    word('那', 'nà', 'то, тот', 'ол, анау', 'that'),
    word('多少', 'duōshao', 'сколько', 'қанша', 'how many; how much'),
    word('钱', 'qián', 'деньги', 'ақша', 'money'),
    word('块', 'kuài', 'юань (в разговоре)', 'юань (ауызекі)', 'yuan (spoken)'),
    word('苹果', 'píngguǒ', 'яблоко', 'алма', 'apple'),
  ]),
  reading(l('多少钱 и 这个 / 那个', '多少钱 және 这个 / 那个', '多少钱 and 这个 / 那个'),
    l('Цену спрашивают 多少钱？ «Этот / тот» перед существительным: 这个苹果, 那个苹果. 多少 используют для любых количеств, 几 — для небольших. В разговоре юань называют 块: 五块 — пять юаней.',
      'Бағасын 多少钱？ деп сұрайды. Зат есімнің алдындағы «мына / ана»: 这个苹果, 那个苹果. 多少 кез келген мөлшерге, 几 — шағын мөлшерге қолданылады. Ауызекі тілде юань 块 деп аталады: 五块 — бес юань.',
      'Ask a price with 多少钱？ “This / that” before a noun: 这个苹果, 那个苹果. 多少 works for any quantity, 几 for small ones. In speech a yuan is 块: 五块 — five yuan.'),
    '这个苹果多少钱？　五块。', 'Zhège píngguǒ duōshao qián?　Wǔ kuài.', l('Сколько стоит это яблоко?　Пять юаней.', 'Мына алма қанша тұрады?　Бес юань.', 'How much is this apple?　Five yuan.')),
  reading(l('Диалог в магазине', 'Дүкендегі диалог', 'Dialogue in a shop'),
    l('Прочитайте по ролям: покупатель (A) и продавец (B).', 'Рөлге бөліп оқыңыз: сатып алушы (A) және сатушы (B).', 'Read in roles: customer (A) and seller (B).'),
    'A：这个苹果多少钱？\nB：五块。\nA：我买三个。\nB：十五块。\nA：谢谢！', 'A: Zhège píngguǒ duōshao qián?\nB: Wǔ kuài.\nA: Wǒ mǎi sān ge.\nB: Shíwǔ kuài.\nA: Xièxie!',
    l('A: Сколько стоит это яблоко?\nB: Пять юаней.\nA: Я куплю три.\nB: Пятнадцать юаней.\nA: Спасибо!', 'A: Мына алма қанша тұрады?\nB: Бес юань.\nA: Мен үшеуін аламын.\nB: Он бес юань.\nA: Рақмет!', 'A: How much is this apple?\nB: Five yuan.\nA: I will buy three.\nB: Fifteen yuan.\nA: Thank you!')),
], quiz: quiz([
  choice('price-choice', 'shopping', 'grammar', l('Как спросить «Сколько это стоит?»', '«Мынау қанша тұрады?» деп қалай сұрайды?', 'How do you ask “How much is this?”'), [['price', '这个多少钱？'], ['age', '你多大了？'], ['what', '这是什么？']], 'price',
    l('多少钱 — «сколько денег», то есть «сколько стоит».', '多少钱 — «қанша ақша», яғни «қанша тұрады».', '多少钱 means “how much money”, i.e. the price.')),
  match('shop-match', 'shopping', l('Сопоставьте слова и переводы.', 'Сөздер мен аудармаларды сәйкестендіріңіз.', 'Match the words and translations.'),
    [['买', l('покупать', 'сатып алу', 'buy')], ['钱', l('деньги', 'ақша', 'money')], ['苹果', l('яблоко', 'алма', 'apple')], ['那', l('тот', 'анау', 'that')]],
    l('买 — покупать, 钱 — деньги, 苹果 — яблоко, 那 — тот.', '买 — сатып алу, 钱 — ақша, 苹果 — алма, 那 — анау.', '买 is buy, 钱 is money, 苹果 is apple, 那 is that.')),
  gap('kuai-gap', 'shopping', l('Ответьте «пять юаней»: 五___。', '«Бес юань» деп жауап беріңіз: 五___。', 'Answer “five yuan”: 五___。'), ['块'],
    l('В разговоре юань называют 块: 五块.', 'Ауызекі тілде юань 块 деп аталады: 五块.', 'In speech a yuan is 块: 五块.')),
  order('buy-order', 'shopping', l('Соберите «Я куплю три яблока».', '«Мен үш алма аламын» сөйлемін құрастырыңыз.', 'Build “I will buy three apples”.'), ['我', '买', '三', '个', '苹果'],
    l('我 + 买 + число + 个 + 苹果.', '我 + 买 + сан + 个 + 苹果.', '我 + 买 + number + 个 + 苹果.')),
  input('buy-input', 'shopping', l('Напишите иероглиф «покупать».', '«Сатып алу» иероглифін жазыңыз.', 'Write the character for “buy”.'), ['买'],
    l('买 (mǎi) — покупать. Не путайте с 卖 (mài) — продавать.', '买 (mǎi) — сатып алу. 卖 (mài) — сатумен шатастырмаңыз.', '买 (mǎi) means buy. Do not confuse it with 卖 (mài), sell.')),
  choice('shop-reading', 'shopping', 'reading', l('Яблоко стоит 五块, A покупает 三个. Сколько платит A?', 'Алма 五块 тұрады, A 三个 алады. A қанша төлейді?', 'An apple costs 五块 and A buys 三个. How much does A pay?'),
    [['15', '十五块'], ['8', '八块'], ['50', '五十块']], '15',
    l('3 × 5 = 15, то есть 十五块.', '3 × 5 = 15, яғни 十五块.', '3 × 5 = 15, i.e. 十五块.')),
]) } });

// 12. Places.
lessons.push({ slug: 'hsk1-places', draft: { title: l('Куда ты идёшь?', 'Қайда барасың?', 'Where are you going?'), minutes: 15, blocks: [
  goal(l('Цель: сказать, где кто-то находится и куда вы идёте. Нужны слова о семье и 呢.',
    'Мақсат: біреудің қайда екенін және өзіңіздің қайда баратыныңызды айту. Отбасы туралы сөздер мен 呢 қажет.',
    'Goal: say where someone is and where you are going. You need family words and 呢.'),
    '我去学校。', 'Wǒ qù xuéxiào.', l('Я иду в школу.', 'Мен мектепке барамын.', 'I am going to school.')),
  vocabulary([
    word('在', 'zài', 'находиться (где-то)', 'бір жерде болу', 'to be at (a place)'),
    word('去', 'qù', 'идти, ехать (куда-то)', 'бару', 'to go'),
    word('哪儿', 'nǎr', 'где; куда', 'қайда', 'where'),
    word('这儿', 'zhèr', 'здесь', 'осында', 'here'),
    word('学校', 'xuéxiào', 'школа', 'мектеп', 'school'),
    word('医院', 'yīyuàn', 'больница', 'аурухана', 'hospital'),
    word('商店', 'shāngdiàn', 'магазин', 'дүкен', 'shop'),
  ]),
  reading(l('在 и 去', '在 және 去', '在 and 去'),
    l('在 + место — где кто-то находится: 妈妈在家. 去 + место — куда кто-то идёт: 我去学校. Вопрос с 哪儿 ставится на место ответа: 你去哪儿？ 爸爸在哪儿？',
      '在 + орын — біреудің қайда екені: 妈妈在家. 去 + орын — біреудің қайда баратыны: 我去学校. 哪儿 сұрағы жауаптың орнына қойылады: 你去哪儿？ 爸爸在哪儿？',
      '在 + place — where someone is: 妈妈在家. 去 + place — where someone goes: 我去学校. 哪儿 takes the place of the answer: 你去哪儿？ 爸爸在哪儿？'),
    '你去哪儿？　我去商店。', 'Nǐ qù nǎr?　Wǒ qù shāngdiàn.', l('Куда ты идёшь?　Я иду в магазин.', 'Қайда барасың?　Мен дүкенге барамын.', 'Where are you going?　I am going to the shop.')),
  reading(l('Диалог', 'Диалог', 'Dialogue'),
    l('Прочитайте по ролям и замените места своими.', 'Рөлге бөліп оқып, орындарды өзіңізше ауыстырыңыз.', 'Read in roles and swap in your own places.'),
    'A：你去哪儿？\nB：我去学校。你呢？\nA：我去医院。我妈妈在医院。', 'A: Nǐ qù nǎr?\nB: Wǒ qù xuéxiào. Nǐ ne?\nA: Wǒ qù yīyuàn. Wǒ māma zài yīyuàn.',
    l('A: Куда ты идёшь?\nB: Я иду в школу. А ты?\nA: Я иду в больницу. Моя мама в больнице.', 'A: Қайда барасың?\nB: Мен мектепке барамын. Ал сен ше?\nA: Мен ауруханаға барамын. Менің анам ауруханада.', 'A: Where are you going?\nB: I am going to school. And you?\nA: I am going to the hospital. My mom is in the hospital.')),
], quiz: quiz([
  match('places-match', 'places', l('Сопоставьте слова и переводы.', 'Сөздер мен аудармаларды сәйкестендіріңіз.', 'Match the words and translations.'),
    [['学校', l('школа', 'мектеп', 'school')], ['医院', l('больница', 'аурухана', 'hospital')], ['商店', l('магазин', 'дүкен', 'shop')]],
    l('学校 — школа, 医院 — больница, 商店 — магазин.', '学校 — мектеп, 医院 — аурухана, 商店 — дүкен.', '学校 is school, 医院 is hospital, 商店 is shop.')),
  choice('zai-qu-choice', 'places', 'grammar', l('Какое слово нужно в 妈妈___家? (мама дома)', '妈妈___家 ішіне қай сөз керек? (анам үйде)', 'Which word fits 妈妈___家? (mom is at home)'), [['zai', '在'], ['qu', '去'], ['you', '有']], 'zai',
    l('在 — «находиться где-то»: 妈妈在家. 去 — «идти куда-то».', '在 — «бір жерде болу»: 妈妈在家. 去 — «бір жерге бару».', '在 means to be at a place: 妈妈在家. 去 means to go somewhere.')),
  gap('nar-gap', 'places', l('Дополните вопрос «Куда ты идёшь?»: 你去___？', '«Қайда барасың?» сұрағын толықтырыңыз: 你去___？', 'Complete “Where are you going?”: 你去___？'), ['哪儿', '哪里'],
    l('哪儿 (nǎr) — где, куда; на юге Китая говорят 哪里. 你去哪儿？', '哪儿 (nǎr) — қайда; Қытайдың оңтүстігінде 哪里 дейді. 你去哪儿？', '哪儿 (nǎr) means where; in southern China people say 哪里. 你去哪儿？')),
  order('go-order', 'places', l('Соберите «Я иду в магазин».', '«Мен дүкенге барамын» сөйлемін құрастырыңыз.', 'Build “I am going to the shop”.'), ['我', '去', '商店'],
    l('我 + 去 + место. Предлог «в» не нужен.', '我 + 去 + орын. Қосымша септік керек емес.', '我 + 去 + place. No word for “to” is needed.')),
  input('go-input', 'places', l('Напишите иероглиф «идти, ехать (куда-то)».', '«Бару» иероглифін жазыңыз.', 'Write the character for “go”.'), ['去'],
    l('去 (qù) — идти, ехать: 我去学校.', '去 (qù) — бару: 我去学校.', '去 (qù) means go: 我去学校.')),
  choice('places-reading', 'places', 'reading', l('A: 我去医院。我妈妈在医院。 Где мама A?', 'A: 我去医院。我妈妈在医院。 A-ның анасы қайда?', 'A: 我去医院。我妈妈在医院。 Where is A’s mom?'),
    [['hospital', l('В больнице', 'Ауруханада', 'At the hospital')], ['school', l('В школе', 'Мектепте', 'At school')], ['home', l('Дома', 'Үйде', 'At home')]], 'hospital',
    l('我妈妈在医院 — моя мама в больнице.', '我妈妈在医院 — менің анам ауруханада.', '我妈妈在医院 — my mom is at the hospital.')),
]) } });

// Module 2 test: 10 questions over lessons 5–12.
const pick = (slug, id) => structuredClone(lessons.find(x => x.slug === slug).draft.quiz.questions.find(q => q.id === id));
lessons.push({ slug: 'hsk1-module2-test', draft: { title: l('Итоговый тест: модуль 2', 'Қорытынды тест: 2-модуль', 'Final quiz: module 2'), minutes: 15, blocks: [
  reading(l('Перед тестом', 'Тест алдында', 'Before the quiz'),
    l('В тесте 10 заданий по урокам 5–12: числа, страны, возраст, семья, даты, еда, покупки и места. Для зачёта нужно 8 верных ответов (80%). После отправки доступны объяснения и пересдача. Это тест учебного модуля, не экзамен HSK 1.',
      'Тестте 5–12 сабақтар бойынша 10 тапсырма бар: сандар, елдер, жас, отбасы, күндер, тамақ, сатып алу және орындар. Өту үшін 8 дұрыс жауап (80%) қажет. Жібергеннен кейін түсіндірмелер мен қайта тапсыру қолжетімді. Бұл HSK 1 емтиханы емес, оқу модулінің тесті.',
      'The quiz has 10 questions on lessons 5–12: numbers, countries, age, family, dates, food, shopping and places. You need 8 correct answers (80%) to pass. Explanations and retakes are available after submission. This is a module quiz, not an HSK 1 exam.'),
    '加油！', 'Jiāyóu!', l('Удачи!', 'Сәттілік!', 'Good luck!')),
], quiz: { kind: 'module', passPercent: 80, questions: [
  pick('hsk1-numbers', 'eighteen-choice'), pick('hsk1-countries', 'bushi-gap'), pick('hsk1-age', 'correct-sentence'),
  pick('hsk1-family', 'meiyou-gap'), pick('hsk1-family', 'measure-choice'), pick('hsk1-dates', 'date-order'),
  pick('hsk1-food', 'drink-choice'), pick('hsk1-shopping', 'shop-reading'), pick('hsk1-places', 'zai-qu-choice'), pick('hsk1-places', 'go-order'),
] } } });

const checked = lessons.map(({ slug, draft }) => ({ slug, draft: draftSchema.parse(draft) }));
await mkdir('docs/hsk1-content', { recursive: true });
await writeFile('docs/hsk1-content/module2.json', JSON.stringify({ status: 'DRAFT_REQUIRES_HUMAN_REVIEW', publish: false, lessons: checked }, null, 2) + '\n');
console.log(checked.map(x => `${x.slug}: ${x.draft.blocks.length} blocks, ${x.draft.quiz?.questions.length ?? 0} questions`).join('\n'));
