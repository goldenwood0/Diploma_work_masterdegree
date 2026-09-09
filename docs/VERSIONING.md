# Git и GitHub

Репозиторий: https://github.com/goldenwood0/Diploma_work_masterdegree

Основная ветка — `main`. Каждый законченный этап сохраняется отдельным коммитом
и меткой `sprint-N`. `sprint-0` — исходный интерфейс и план; `sprint-1` — аккаунты
и сервер; `sprint-2` — профиль, онбординг и локализация. Перед следующим спринтом проверять `git status` и сохранять незавершённые
изменения осмысленным отдельным коммитом, если это необходимо.

Локально для этого проекта указан автор goldenwood0 с GitHub noreply-адресом
goldenwood0@users.noreply.github.com. Глобальные имя и email Git не изменялись.

Обычный цикл:

```sh
git status
git diff
pnpm typecheck
pnpm server:build
pnpm test:server
pnpm build
git add <изменённые-файлы>
git commit -m "feat: краткое описание завершённого изменения"
git push
```

Для отдельной работы использовать ветки `feature/<название>` и pull request.
Не использовать force push в main. Просмотр версий: `git log --oneline --decorate`.
Для отмены опубликованного изменения использовать `git revert <commit>`,
сохраняя историю. Метки этапов не перемещать после публикации.

`.env`, node_modules, dist, dist-server и локальный кеш исключены из Git.
Пример настроек `.env.example`, миграции, lockfile и исходный код сохраняются.
GitHub Actions выполняет проверки на push в main и на pull request.
Git сохраняет код; резервные копии PostgreSQL нужно организовать отдельно.
