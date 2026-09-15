import type { LearningStats } from "../api/stats"
import { topicLabels, skillLabels } from "../app/assessmentLabels"
import { useLanguage } from "../i18n/LanguageProvider"

export default function AccuracyStats({ data }: { data: LearningStats }) {
  const { t } = useLanguage()
  const tables = [
    { title: t("Точность по темам"), rows: data.topicAccuracy, labels: topicLabels as Record<string, string>, unclassified: data.unclassifiedTopics },
    { title: t("Точность по навыкам"), rows: data.skillAccuracy, labels: skillLabels as Record<string, string>, unclassified: data.unclassifiedSkills },
  ]
  return <section className="bg-card border border-border rounded-2xl p-6 space-y-6" aria-labelledby="accuracy-title">
    <h2 id="accuracy-title" className="text-xl font-semibold">{t("Точность по темам и навыкам")}</h2>
    <p className="text-sm text-foreground/65">{t("Последняя попытка каждого актуального опубликованного теста за 30 дней. Пересдача заменяет прежний результат.")}</p>
    {tables.map(table => <div key={table.title} className="space-y-3">
      <table className="w-full text-sm">
        <caption className="text-left text-lg font-semibold mb-3">{table.title}</caption>
        <thead><tr className="border-b border-border"><th scope="col" className="text-left py-2">{t("Область")}</th><th scope="col" className="text-right px-2">{t("Верно / всего")}</th><th scope="col" className="text-right">{t("Точность")}</th></tr></thead>
        <tbody>{table.rows.map(row => <tr key={row.key} className="border-b border-border">
          <th scope="row" className="text-left font-medium py-3">{t(table.labels[row.key] ?? row.key)}</th>
          <td className="text-right px-2 tabular-nums">{row.correct} / {row.total}</td>
          <td className="text-right tabular-nums">{row.total ? `${Math.round(row.correct / row.total * 100)}%` : t("Нет данных")}</td>
        </tr>)}</tbody>
      </table>
      {table.unclassified > 0 && <p className="text-sm">{t("Ответов без разметки")}: {table.unclassified}</p>}
    </div>)}
    <p className="text-sm text-foreground/65">{t("Один ответ — одно задание. Темы и навыки задаёт редактор; старые ответы без разметки не распределяются автоматически. Это ориентир по выполненным заданиям, а не оценка уровня HSK.")}</p>
    <p className="text-sm text-foreground/65">{t("Письменная речь не оценивает почерк. Голосовая самопроверка и SRS в эти проценты не входят.")}</p>
  </section>
}
