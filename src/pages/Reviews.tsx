export default function Reviews() {
  return (
    <section className="max-w-3xl mx-auto rounded-3xl bg-white border border-border p-8 space-y-4">
      <h1 className="text-3xl font-bold text-dark-green">Повторение</h1>
      <p className="text-muted-foreground">Здесь будут слова из пройденных уроков и ваши карточки для ежедневной практики. Повторение пока недоступно.</p>
      <a className="inline-block text-primary font-bold hover:underline" href="#/courses">Перейти к курсам</a>
    </section>
  );
}
