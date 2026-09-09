export default function NotFound() {
  return (
    <section className="max-w-3xl mx-auto rounded-3xl bg-white border border-border p-8 space-y-4">
      <h1 className="text-3xl font-bold text-dark-green">Страница не найдена</h1>
      <p className="text-muted-foreground">Проверьте адрес или вернитесь на главную.</p>
      <a className="inline-block text-primary font-bold hover:underline" href="#/">На главную</a>
    </section>
  );
}
