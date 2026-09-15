import type { Prisma } from '@prisma/client';
import { questionsSchema, type Question } from './quiz.js';
const l = (ru: string, kk: string, en: string) => ({ ru, kk, en });
const option = (id: string, ru: string, kk = ru, en = ru) => ({ id, text: l(ru, kk, en) });
const choice: Question = { id: 'greeting-choice', topic: 'greetings', skill: 'vocabulary', kind: 'choice', prompt: l('Как поздороваться по-китайски?', 'Қытайша қалай сәлемдеседі?', 'How do you say hello in Chinese?'), options: [option('bye', '再见'), option('hello', '你好'), option('thanks', '谢谢')], correct: 'hello', explanation: l('你好 — приветствие. 再见 — до свидания; 谢谢 — спасибо.', '你好 — сәлемдесу. 再见 — сау болыңыз; 谢谢 — рақмет.', '你好 means hello; 再见 means goodbye; 谢谢 means thank you.') };
const dictation: Question = { id: 'greeting-dictation', topic: 'greetings', skill: 'listening', kind: 'dictation', prompt: l('Послушайте и запишите иероглифами услышанное приветствие.', 'Тыңдап, естіген сәлемдесуді иероглифтермен жазыңыз.', 'Listen and write the greeting in Chinese characters.'), accepted: ['你好'], explanation: l('В записи звучит 你好 — «здравствуйте».', 'Жазбада 你好 — «сәлеметсіз бе» айтылады.', 'The recording says 你好, meaning hello.'), audioUrl: 'https://upload.wikimedia.org/wikipedia/commons/7/7d/Zh_n%C7%90_h%C7%8Eo.ogg', sourceUrl: 'https://commons.wikimedia.org/wiki/File:Zh_n%C7%90_h%C7%8Eo.ogg', author: 'Sjors Provoost', license: 'CC BY-SA 3.0', licenseUrl: 'https://creativecommons.org/licenses/by-sa/3.0/' };
const match: Question = { id: 'name-match', topic: 'introductions', skill: 'vocabulary', kind: 'match', prompt: l('Сопоставьте слова и перевод.', 'Сөздер мен аудармаларын сәйкестендіріңіз.', 'Match the words to their meanings.'), left: [option('wo', '我'), option('jiao', '叫'), option('mingzi', '名字')], right: [option('name', 'имя', 'есім', 'name'), option('me', 'я', 'мен', 'I'), option('called', 'зваться', 'аталу', 'to be called')], correct: ['me', 'called', 'name'], explanation: l('我 — я; 叫 — зваться; 名字 — имя.', '我 — мен; 叫 — аталу; 名字 — есім.', '我 means I; 叫 means to be called; 名字 means name.') };
const gap: Question = { id: 'name-gap', topic: 'introductions', skill: 'grammar', kind: 'gap', prompt: l('Заполните пропуск одним иероглифом: 我 ___ 安娜。', 'Бос орынды бір иероглифпен толтырыңыз: 我 ___ 安娜。', 'Fill the gap with one character: 我 ___ 安娜。'), accepted: ['叫'], explanation: l('我叫安娜 означает «Меня зовут Анна».', '我叫安娜 — «Менің атым Анна».', '我叫安娜 means My name is Anna.') };
const order: Question = { id: 'name-order', topic: 'introductions', skill: 'grammar', kind: 'order', prompt: l('Соберите вопрос «Как вас зовут?»', '«Атыңыз кім?» сұрағын құрастырыңыз.', 'Build the question What is your name?'), options: [option('name', '名字'), option('you', '你'), option('what', '什么'), option('called', '叫')], correct: ['you', 'called', 'what', 'name'], explanation: l('Правильный порядок: 你叫什么名字？', 'Дұрыс реті: 你叫什么名字？', 'The correct order is 你叫什么名字？') };
const nameInput: Question = { id: 'name-input', topic: 'introductions', skill: 'vocabulary', kind: 'input', prompt: l('Напишите «имя» иероглифами.', '«Есім» сөзін иероглифтермен жазыңыз.', 'Write name in Chinese characters.'), accepted: ['名字'], explanation: l('名字 (míngzi) — имя.', '名字 (míngzi) — есім.', '名字 (míngzi) means name.') };
const thanks: Question = { id: 'thanks-choice', topic: 'courtesy', skill: 'vocabulary', kind: 'choice', prompt: l('Что ответить на 谢谢?', '谢谢 сөзіне қалай жауап береді?', 'How do you respond to 谢谢?'), options: [option('hello', '你好'), option('welcome', '不客气'), option('name', '名字')], correct: 'welcome', explanation: l('不客气 — вежливый ответ на благодарность.', '不客气 — алғысқа сыпайы жауап.', '不客气 is a polite response to thanks.') };
const goodbye: Question = { id: 'goodbye-input', topic: 'courtesy', skill: 'vocabulary', kind: 'input', prompt: l('Напишите «до свидания» иероглифами.', '«Сау болыңыз» сөзін иероглифтермен жазыңыз.', 'Write goodbye in Chinese characters.'), accepted: ['再见'], explanation: l('再见 (zàijiàn) — до свидания.', '再见 (zàijiàn) — сау болыңыз.', '再见 (zàijiàn) means goodbye.') };

export async function seedQuizzes(tx: Prisma.TransactionClient) {
  const prior = await tx.lesson.findUniqueOrThrow({ where: { slug: 'hsk1-courtesy' } });
  await tx.lesson.upsert({ where: { slug: 'hsk1-module-test' }, update: {}, create: {
    slug: 'hsk1-module-test', unitId: prior.unitId, position: 4, prerequisiteId: prior.id, published: true, minutes: 10,
    title: l('Тест модуля: Первое знакомство', 'Модуль тесті: Алғашқы танысу', 'Module test: First introductions'),
    blocks: { create: { position: 0, kind: 'reading', content: {
      title: l('Проверьте себя', 'Өзіңізді тексеріңіз', 'Check your knowledge'),
      text: l('В тесте шесть заданий. Для зачёта нужно правильно выполнить не менее пяти. После отправки появятся объяснения; тест можно пройти повторно.', 'Тестте алты тапсырма бар. Өту үшін кемінде бесеуін дұрыс орындаңыз. Жібергеннен кейін түсіндірмелер көрсетіледі; тестті қайта өтуге болады.', 'There are six questions. Answer at least five correctly to pass. Explanations appear after submission; you can retake the test.'),
      hanzi: '你好！', pinyin: 'Nǐ hǎo!', translation: l('Здравствуйте!', 'Сәлеметсіз бе!', 'Hello!'),
    } } },
  } });
  const content: Array<[string, Question[]]> = [
    ['hsk1-greetings', [choice, dictation]], ['hsk1-my-name', [match, gap]],
    ['hsk1-your-name', [order, nameInput]], ['hsk1-courtesy', [thanks, goodbye]],
    ['hsk1-module-test', [choice, match, order, gap, goodbye, dictation]],
  ];
  for (const [slug, questions] of content) {
    const lesson = await tx.lesson.findUniqueOrThrow({ where: { slug }, include: { quiz: true } });
    if (lesson.quiz) continue;
    await tx.quiz.create({ data: { lessonId: lesson.id, questions: questionsSchema.parse(questions), kind: slug === 'hsk1-module-test' ? 'module' : 'lesson', passPercent: 80 } });
    // Introduce assessment once; preserve reading checkpoints, require the test.
    await tx.lesson.update({ where: { id: lesson.id }, data: { revision: { increment: 1 } } });
    await tx.lessonProgress.updateMany({ where: { lessonId: lesson.id, revision: lesson.revision }, data: { revision: lesson.revision + 1, completedAt: null } });
  }
}
