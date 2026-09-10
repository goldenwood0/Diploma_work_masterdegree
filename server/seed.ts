import { PrismaClient, type Prisma } from '@prisma/client';

const db = new PrismaClient();
const l = (ru: string, kk: string, en: string) => ({ ru, kk, en });
const word = (hanzi: string, pinyin: string, ru: string, kk: string, en: string) => ({ hanzi, pinyin, translation: l(ru, kk, en) });
const vocabulary = (words: ReturnType<typeof word>[]) => ({ kind: 'vocabulary', content: { title: l('Новые слова', 'Жаңа сөздер', 'New words'), words } });
const reading = (title: ReturnType<typeof l>, text: ReturnType<typeof l>, hanzi: string, pinyin: string, translation: ReturnType<typeof l>) => ({ kind: 'reading', content: { title, text, hanzi, pinyin, translation } });

const lessons = [
  { slug: 'hsk1-greetings', title: l('Приветствие', 'Сәлемдесу', 'Greetings'), blocks: [
    vocabulary([word('你', 'nǐ', 'ты', 'сен', 'you'), word('好', 'hǎo', 'хороший; хорошо', 'жақсы', 'good; well'), word('你好', 'nǐ hǎo', 'здравствуйте; привет', 'сәлеметсіз бе; сәлем', 'hello')]),
    reading(l('Тоны в приветствии', 'Сәлемдесудегі тондар', 'Tones in a greeting'),
      l('В китайском языке тон различает значения слов. В сочетании двух третьих тонов первый произносится как второй: nǐ hǎo звучит как ní hǎo. В учебной записи сохраняем исходные тоны.',
        'Қытай тілінде тон сөздердің мағынасын ажыратады. Екі үшінші тон қатар келсе, біріншісі екінші тон сияқты айтылады: nǐ hǎo — ní hǎo болып естіледі. Оқу жазбасында бастапқы тондар сақталады.',
        'Tone distinguishes word meanings in Chinese. When two third tones occur together, the first is pronounced like a second tone: nǐ hǎo sounds like ní hǎo. Learning materials retain the underlying tone marks.'), '你好！', 'Nǐ hǎo!', l('Здравствуйте!', 'Сәлеметсіз бе!', 'Hello!')),
    { kind: 'audio', content: { title: l('Послушайте приветствие', 'Сәлемдесуді тыңдаңыз', 'Listen to the greeting'), hanzi: '你好', pinyin: 'Nǐ hǎo', translation: l('Здравствуйте', 'Сәлеметсіз бе', 'Hello'),
      audioUrl: 'https://upload.wikimedia.org/wikipedia/commons/7/7d/Zh_n%C7%90_h%C7%8Eo.ogg',
      sourceUrl: 'https://commons.wikimedia.org/wiki/File:Zh_n%C7%90_h%C7%8Eo.ogg', author: 'Sjors Provoost', license: 'CC BY-SA 3.0', licenseUrl: 'https://creativecommons.org/licenses/by-sa/3.0/' } },
  ] },
  { slug: 'hsk1-my-name', title: l('Меня зовут…', 'Менің атым…', 'My name is…'), blocks: [
    vocabulary([word('我', 'wǒ', 'я', 'мен', 'I; me'), word('叫', 'jiào', 'зваться', 'аталу', 'to be called'), word('名字', 'míngzi', 'имя', 'есім', 'name')]),
    reading(l('Представьтесь', 'Өзіңізді таныстырыңыз', 'Introduce yourself'), l('Поставьте имя после 我叫. Для этого предложения не нужно добавлять 是.', 'Есімді 我叫 сөзінен кейін қойыңыз. Бұл сөйлемге 是 қосудың қажеті жоқ.', 'Put a name after 我叫. You do not need to add 是 in this sentence.'), '我叫安娜。', 'Wǒ jiào Ānnà.', l('Меня зовут Анна.', 'Менің атым Анна.', 'My name is Anna.')),
    reading(l('Мини-диалог', 'Қысқа диалог', 'Short dialogue'), l('Прочитайте реплики вслух и замените имя своим.', 'Сөйлемдерді дауыстап оқып, есімді өз есіміңізге ауыстырыңыз.', 'Read aloud and replace the name with your own.'), 'A：你好！\nB：你好！我叫安娜。', 'A: Nǐ hǎo!\nB: Nǐ hǎo! Wǒ jiào Ānnà.', l('А: Здравствуйте!\nБ: Здравствуйте! Меня зовут Анна.', 'А: Сәлеметсіз бе!\nБ: Сәлеметсіз бе! Менің атым Анна.', 'A: Hello!\nB: Hello! My name is Anna.')),
  ] },
  { slug: 'hsk1-your-name', title: l('Как вас зовут?', 'Атыңыз кім?', 'What is your name?'), blocks: [
    vocabulary([word('什么', 'shénme', 'что; какой', 'не; қандай', 'what'), word('名字', 'míngzi', 'имя', 'есім', 'name')]),
    reading(l('Вопрос с 什么', '什么 арқылы сұрақ', 'Questions with 什么'), l('什么 ставится на место неизвестной информации. В вопросе 你叫什么名字？частица 吗 не нужна.', '什么 белгісіз ақпараттың орнына қойылады. 你叫什么名字？сұрағында 吗 шылауы қажет емес.', '什么 takes the place of the unknown information. The question 你叫什么名字？does not need 吗.'), '你叫什么名字？', 'Nǐ jiào shénme míngzi?', l('Как вас зовут?', 'Атыңыз кім?', 'What is your name?')),
    reading(l('Знакомство', 'Танысу', 'Meeting someone'), l('Прочитайте вопрос и ответ. Затем ответьте своим именем.', 'Сұрақ пен жауапты оқыңыз. Содан кейін өз есіміңізбен жауап беріңіз.', 'Read the question and answer, then answer with your own name.'), 'A：你叫什么名字？\nB：我叫安娜。', 'A: Nǐ jiào shénme míngzi?\nB: Wǒ jiào Ānnà.', l('А: Как вас зовут?\nБ: Меня зовут Анна.', 'А: Атыңыз кім?\nБ: Менің атым Анна.', 'A: What is your name?\nB: My name is Anna.')),
  ] },
  { slug: 'hsk1-courtesy', title: l('Вежливые слова', 'Сыпайы сөздер', 'Polite expressions'), blocks: [
    vocabulary([word('谢谢', 'xièxie', 'спасибо', 'рақмет', 'thank you'), word('不客气', 'bú kèqi', 'пожалуйста (ответ на благодарность)', 'оқасы жоқ (алғысқа жауап)', 'you are welcome'), word('再见', 'zàijiàn', 'до свидания', 'сау болыңыз', 'goodbye')]),
    reading(l('Ответ на благодарность', 'Алғысқа жауап', 'Responding to thanks'), l('На 谢谢 можно ответить 不客气. Перед четвёртым тоном 不 произносится вторым тоном: bú.', '谢谢 дегенге 不客气 деп жауап беруге болады. Төртінші тонның алдында 不 екінші тонмен айтылады: bú.', 'You can respond to 谢谢 with 不客气. Before a fourth tone, 不 is pronounced with a second tone: bú.'), 'A：谢谢！\nB：不客气！', 'A: Xièxie!\nB: Bú kèqi!', l('А: Спасибо!\nБ: Пожалуйста!', 'А: Рақмет!\nБ: Оқасы жоқ!', 'A: Thank you!\nB: You are welcome!')),
    reading(l('Прощание', 'Қоштасу', 'Saying goodbye'), l('Завершите разговор словом 再见. Вспомните, как поздороваться и представиться.', 'Әңгімені 再见 сөзімен аяқтаңыз. Сәлемдесу мен өзіңізді таныстыруды еске түсіріңіз.', 'End the conversation with 再见. Recall how to greet someone and introduce yourself.'), '再见！', 'Zàijiàn!', l('До свидания!', 'Сау болыңыз!', 'Goodbye!')),
  ] },
];

try {
  // Additive seed: rerunning never overwrites edited lessons or learner progress.
  await db.$transaction(async tx => {
    await tx.curriculum.upsert({ where: { id: 'hsk-pilot' }, update: {}, create: { id: 'hsk-pilot', title: l('Китайский язык · HSK', 'Қытай тілі · HSK', 'Chinese · HSK') } });
    for (let number = 1; number <= 6; number++) await tx.courseLevel.upsert({ where: { id: `hsk-${number}` }, update: {}, create: { id: `hsk-${number}`, curriculumId: 'hsk-pilot', number } });
    await tx.courseUnit.upsert({ where: { id: 'hsk1-meeting' }, update: {}, create: { id: 'hsk1-meeting', levelId: 'hsk-1', position: 0, title: l('Первое знакомство', 'Алғашқы танысу', 'First introductions') } });
    let prerequisiteId: string | null = null;
    for (const [position, lesson] of lessons.entries()) {
      const stored: { id: string } = await tx.lesson.upsert({ where: { slug: lesson.slug }, update: {}, create: {
        slug: lesson.slug, title: lesson.title, unitId: 'hsk1-meeting', position, published: true, prerequisiteId,
        blocks: { create: lesson.blocks.map((block, index) => ({ position: index, kind: block.kind, content: block.content as Prisma.InputJsonValue })) },
      } });
      prerequisiteId = stored.id;
    }
  });
  console.log('Pilot curriculum ready: HSK 1–6, four HSK 1 lessons. Editorial review pending.');
} finally { await db.$disconnect(); }
