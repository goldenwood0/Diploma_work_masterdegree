"""Printable Word review sheet for the teacher, built from the same draft JSON as REVIEW_SHEET.md.

No third-party packages: a .docx is a ZIP of WordprocessingML files written here directly.
Usage: python scripts/hsk1-review-docx.py  ->  docs/hsk1-content/REVIEW_SHEET.docx
"""
import json
import zipfile
from xml.sax.saxutils import escape

FILES = [
    ('Модуль 1 (уроки 1–4 и тест): черновики поверх опубликованных уроков', 'docs/hsk1-audit/proposed-content.json'),
    ('Модуль 2 (уроки 5–12 и тест): новые неопубликованные уроки', 'docs/hsk1-content/module2.json'),
]
OUT = 'docs/hsk1-content/REVIEW_SHEET.docx'
KINDS = {'choice': 'выбор', 'match': 'сопоставление', 'order': 'порядок', 'gap': 'пропуск', 'input': 'ввод', 'dictation': 'диктант'}
PAGE_W, PAGE_H, MARGIN = 16838, 11906, 850  # A4 landscape, ~1.5 cm margins (twips)
TEXT_W = PAGE_W - 2 * MARGIN

body = []


def run(text, bold=False, size=None, color=None):
    props = ''.join([
        '<w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial" w:eastAsia="Microsoft YaHei"/>',
        '<w:b/>' if bold else '',
        f'<w:color w:val="{color}"/>' if color else '',
        f'<w:sz w:val="{size}"/><w:szCs w:val="{size}"/>' if size else '',
    ])
    parts = str(text).split('\n')
    xml = []
    for i, part in enumerate(parts):
        if i:
            xml.append('<w:br/>')
        xml.append(f'<w:t xml:space="preserve">{escape(part)}</w:t>')
    return f'<w:r><w:rPr>{props}</w:rPr>{"".join(xml)}</w:r>'


def para(runs, style=None, keep_next=False, after=80, before=0, page_break=False):
    ppr = ''.join([
        f'<w:pStyle w:val="{style}"/>' if style else '',
        '<w:keepNext/>' if keep_next else '',
        '<w:pageBreakBefore/>' if page_break else '',
        f'<w:spacing w:before="{before}" w:after="{after}"/>',
    ])
    return f'<w:p><w:pPr>{ppr}</w:pPr>{"".join(runs)}</w:p>'


def cell(content, width, shade=None, bold=False, size=18):
    lines = content if isinstance(content, list) else [content]
    shading = f'<w:shd w:val="clear" w:color="auto" w:fill="{shade}"/>' if shade else ''
    paras = ''.join(para([run(line, bold=bold, size=size)], after=0) for line in lines) or para([], after=0)
    return (f'<w:tc><w:tcPr><w:tcW w:w="{width}" w:type="dxa"/>{shading}'
            f'<w:tcMar><w:top w:w="40" w:type="dxa"/><w:bottom w:w="40" w:type="dxa"/></w:tcMar></w:tcPr>{paras}</w:tc>')


def table(header, rows, ratios):
    widths = [int(TEXT_W * r / sum(ratios)) for r in ratios]
    widths[-1] += TEXT_W - sum(widths)
    border = ''.join(f'<w:{side} w:val="single" w:sz="4" w:space="0" w:color="9AA79C"/>' for side in ('top', 'left', 'bottom', 'right', 'insideH', 'insideV'))
    grid = ''.join(f'<w:gridCol w:w="{w}"/>' for w in widths)
    head = '<w:tr><w:trPr><w:tblHeader/><w:cantSplit/></w:trPr>' + ''.join(cell(h, w, 'E7EEE3', True) for h, w in zip(header, widths)) + '</w:tr>'
    body_rows = ''.join('<w:tr><w:trPr><w:cantSplit/></w:trPr>' + ''.join(cell(c, w) for c, w in zip(row, widths)) + '</w:tr>' for row in rows)
    body.append(f'<w:tbl><w:tblPr><w:tblW w:w="{TEXT_W}" w:type="dxa"/><w:tblBorders>{border}</w:tblBorders>'
                f'<w:tblLayout w:type="fixed"/></w:tblPr><w:tblGrid>{grid}</w:tblGrid>{head}{body_rows}</w:tbl>')
    body.append(para([], after=120))


def tri(v):
    return [f'ru: {v["ru"]}', f'kk: {v["kk"]}', f'en: {v["en"]}']


def answer(q):
    if q['kind'] == 'choice':
        return tri(next(o['text'] for o in q['options'] if o['id'] == q['correct']))
    if q['kind'] == 'order':
        return [' '.join(next(o['text']['ru'] for o in q['options'] if o['id'] == i) for i in q['correct'])]
    if q['kind'] == 'match':
        right = {o['id']: o['text']['ru'] for o in q['right']}
        return [f'{left["text"]["ru"]} → {right[q["correct"][i]]}' for i, left in enumerate(q['left'])]
    return [' / '.join(q['accepted'])]


body.append(para([run('HSK 1: лист проверки уроков ZhPath', True, 40)], after=120))
body.append(para([run('Для преподавателя. Проверьте иероглифы, пиньинь и тоны, переводы ru/kk/en, правильность ответов и объяснений, '
                      'пригодность для начинающего. Отметки и исправления — в колонке ✓ или на полях.', size=21)], after=80))
for mark, note in [('kk', 'Казахские тексты писал не носитель языка — просьба проверить особенно внимательно.'),
                   ('HSK', '哈萨克斯坦 (Казахстан) добавлен как дополнительное слово; его нет в списке HSK 1.'),
                   ('Тоны', 'Изменение тонов: 不是 bú shì, 一个 yí ge, 你好 ní hǎo (в записи сохраняются исходные тоны).'),
                   ('哪儿', 'В ответах принимается и вариант 哪里.')]:
    body.append(para([run(f'{mark}: ', True, 20), run(note, size=20)], after=40))

for f_index, (heading, path) in enumerate(FILES):
    data = json.load(open(path, encoding='utf-8'))
    body.append(para([run(heading, True, 30, '226447')], before=240, after=120, keep_next=True, page_break=f_index > 0))
    for lesson in data['lessons']:
        d = lesson['draft']
        title = d['title']
        body.append(para([run(f'{title["ru"]} · {title["kk"]} · {title["en"]}', True, 26)], before=200, after=40, keep_next=True))
        body.append(para([run(f'{lesson["slug"]} · {d["minutes"]} мин', size=18, color='4F6858')], after=80, keep_next=True))
        for block in d['blocks']:
            c = block['content']
            if block['kind'] == 'vocabulary':
                body.append(para([run(c['title']['ru'], True, 21)], keep_next=True))
                table(['Иероглифы', 'Пиньинь', 'ru', 'kk', 'en', '✓'],
                      [[w['hanzi'], w['pinyin'], w['translation']['ru'], w['translation']['kk'], w['translation']['en'], ''] for w in c['words']],
                      [10, 12, 22, 22, 22, 12])
            else:
                label = c['title']['ru'] + (f' (аудио: {c["author"]}, {c["license"]})' if block['kind'] == 'audio' else '')
                body.append(para([run(label, True, 21)], keep_next=True))
                rows = []
                if 'text' in c:
                    rows.append(['Текст', [f'ru: {c["text"]["ru"]}', f'kk: {c["text"]["kk"]}', f'en: {c["text"]["en"]}'], ''])
                rows.append(['Пример', [c['hanzi'], c['pinyin'], *tri(c['translation'])], ''])
                table(['Часть', 'Содержание', '✓'], rows, [10, 78, 12])
        if d.get('quiz'):
            qz = d['quiz']
            body.append(para([run(f'Тест: {len(qz["questions"])} заданий, порог {qz["passPercent"]}%', True, 21)], keep_next=True))
            table(['№', 'Тип', 'Задание', 'Правильный ответ', 'Объяснение', '✓'],
                  [[str(i + 1), KINDS[q['kind']], tri(q['prompt']), answer(q), tri(q['explanation']), ''] for i, q in enumerate(qz['questions'])],
                  [4, 9, 27, 18, 30, 12])

body.append(para([run('Подпись преподавателя: ____________________    Дата: ____________', size=21)], before=400))

document = ('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>'
            + ''.join(body)
            + f'<w:sectPr><w:pgSz w:w="{PAGE_W}" w:h="{PAGE_H}" w:orient="landscape"/>'
            f'<w:pgMar w:top="{MARGIN}" w:right="{MARGIN}" w:bottom="{MARGIN}" w:left="{MARGIN}" w:header="400" w:footer="400" w:gutter="0"/></w:sectPr>'
            '</w:body></w:document>')
styles = ('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
          '<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr>'
          '<w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial" w:eastAsia="Microsoft YaHei"/><w:sz w:val="20"/><w:lang w:val="ru-RU" w:eastAsia="zh-CN"/>'
          '</w:rPr></w:rPrDefault></w:docDefaults></w:styles>')
content_types = ('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
                 '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
                 '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
                 '<Default Extension="xml" ContentType="application/xml"/>'
                 '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>'
                 '<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>'
                 '</Types>')
rels = ('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>'
        '</Relationships>')
doc_rels = ('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
            '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>'
            '</Relationships>')
with zipfile.ZipFile(OUT, 'w', zipfile.ZIP_DEFLATED) as z:
    z.writestr('[Content_Types].xml', content_types)
    z.writestr('_rels/.rels', rels)
    z.writestr('word/document.xml', document)
    z.writestr('word/_rels/document.xml.rels', doc_rels)
    z.writestr('word/styles.xml', styles)
print('Written', OUT)
