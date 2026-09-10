import "reflect-metadata"
import { beforeEach, afterEach, test } from "node:test"
import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import supertest from "supertest"
import type { INestApplication } from "@nestjs/common"
import { createApp } from "./app.js"
import { Database } from "./database.js"
import { digest, newToken } from "./passwords.js"

let app: INestApplication
let db: Database
let api: ReturnType<typeof supertest>
let fixture: string
let first: string
let second: string
let blocks: string[]
let users: string[]
let session: string
let other: string
const title = { ru: "Тест", kk: "Сынақ", en: "Test" }
const get = (path: string, cookie = session) =>
  api.get(`/api/learning/${path}`).set("Cookie", cookie)
const put = (slug: string, body: object, cookie = session) =>
  api
    .put(`/api/learning/lessons/${slug}/progress`)
    .set("Cookie", cookie)
    .set("Origin", process.env.APP_ORIGIN!)
    .set("X-ZhPath-Request", "1")
    .send(body)
async function device(userId: string) {
  const token = newToken()
  await db.session.create({
    data: {
      userId,
      tokenHash: digest(token),
      expiresAt: new Date(Date.now() + 60000),
    },
  })
  return `zhpath_session=${token}`
}
beforeEach(async () => {
  if (process.env.NODE_ENV === "production")
    throw new Error("Tests must not run in production")
  app = await createApp()
  db = app.get(Database)
  api = supertest(app.getHttpServer())
  fixture = `learning-test-${randomUUID()}`
  first = `${fixture}-first`
  second = `${fixture}-second`
  users = []
  for (let i = 0; i < 2; i++) {
    const user = await db.user.create({
      data: {
        email: `${fixture}-${i}@example.test`,
        name: "Test",
        passwordHash: "unused",
        emailVerifiedAt: new Date(),
      },
    })
    users.push(user.id)
  }
  session = await device(users[0])
  other = await device(users[1])
  await db.curriculum.create({
    data: {
      id: fixture,
      title,
      levels: {
        create: {
          id: fixture,
          number: 1,
          units: { create: { id: fixture, title, position: 0 } },
        },
      },
    },
  })
  const lesson = await db.lesson.create({
    data: {
      slug: first,
      unitId: fixture,
      position: 0,
      title,
      published: true,
      blocks: {
        create: [0, 1, 2].map((position) => ({
          position,
          kind: "reading",
          content: {
            title,
            text: title,
            hanzi: "你好",
            pinyin: "nǐ hǎo",
            translation: title,
          },
        })),
      },
    },
    include: { blocks: { orderBy: { position: "asc" } } },
  })
  blocks = lesson.blocks.map((b) => b.id)
  await db.lesson.create({
    data: {
      slug: second,
      unitId: fixture,
      position: 1,
      title,
      published: true,
      prerequisiteId: lesson.id,
      blocks: { create: { position: 0, kind: "reading", content: { title } } },
    },
  })
  await db.lesson.create({
    data: {
      slug: `${fixture}-draft`,
      unitId: fixture,
      position: 2,
      title,
      published: false,
    },
  })
})
afterEach(async () => {
  if (db) {
    await db.user.deleteMany({ where: { id: { in: users ?? [] } } })
    await db.lesson.updateMany({
      where: { unitId: fixture },
      data: { prerequisiteId: null },
    })
    await db.curriculum.deleteMany({ where: { id: fixture } })
  }
  if (app) await app.close()
})

test("catalog and lesson enforce sessions, publication and prerequisite access", async () => {
  await api.get("/api/learning/catalog").expect(401)
  const result = await get("catalog").expect(200)
  const lessons = result.body.curricula.find(
    (c: { id: string }) => c.id === fixture,
  ).levels[0].units[0].lessons
  assert.equal(lessons.length, 2)
  assert.equal(lessons[0].locked, false)
  assert.equal(lessons[1].locked, true)
  await get(`lessons/${second}`).expect(403)
  await put(second, { blockId: blocks[0], revision: 1 }).expect(403)
  await get(`lessons/${fixture}-draft`).expect(404)
  await get("lessons/nonexistent").expect(404)
})

test("checkpoint resumes in a second session and isolates another learner", async () => {
  await put(first, { blockId: blocks[0], revision: 1 }).expect(200)
  const secondDevice = await device(users[0])
  assert.equal(
    (await get(`lessons/${first}`, secondDevice).expect(200)).body.progress
      .nextBlock,
    1,
  )
  assert.equal(
    (await get(`lessons/${first}`, other).expect(200)).body.progress.nextBlock,
    0,
  )
  await put(first, {
    blockId: blocks[1],
    revision: 1,
    userId: users[1],
  }).expect(400)
  await api
    .put(`/api/learning/lessons/${first}/progress`)
    .set("Cookie", session)
    .send({ blockId: blocks[1], revision: 1 })
    .expect(403)
})

test("ordered completion is idempotent and unlocks the next lesson only for its owner", async () => {
  await put(first, { blockId: blocks[2], revision: 1 }).expect(409)
  await put(first, { blockId: "foreign-block", revision: 1 }).expect(409)
  for (const blockId of blocks)
    await put(first, { blockId, revision: 1 }).expect(200)
  const completed = (await get(`lessons/${first}`).expect(200)).body.progress
  assert.equal(completed.nextBlock, 3)
  assert.ok(completed.completedAt)
  const replay = (
    await put(first, { blockId: blocks[0], revision: 1 }).expect(200)
  ).body
  assert.equal(replay.nextBlock, 3)
  assert.equal(replay.completedAt, completed.completedAt)
  await get(`lessons/${second}`).expect(200)
  await get(`lessons/${second}`, other).expect(403)
})

test("concurrent requests cannot double advance or regress progress", async () => {
  const responses = await Promise.all([
    put(first, { blockId: blocks[0], revision: 1 }),
    put(first, { blockId: blocks[0], revision: 1 }),
  ])
  assert.ok(responses.some((r) => r.status === 200))
  assert.ok(responses.every((r) => [200, 409].includes(r.status)))
  await put(first, { blockId: blocks[0], revision: 1 }).expect(200)
  assert.equal(
    (await get(`lessons/${first}`).expect(200)).body.progress.nextBlock,
    1,
  )
})

test("content revision rejects stale writes and restarts the new block sequence", async () => {
  for (const blockId of blocks)
    await put(first, { blockId, revision: 1 }).expect(200)
  await get(`lessons/${second}`).expect(200)
  await db.lesson.update({ where: { slug: first }, data: { revision: 2 } })
  await get(`lessons/${second}`).expect(403)
  const catalog = (await get("catalog").expect(200)).body
  const catalogLessons = catalog.curricula.find(
    (c: { id: string }) => c.id === fixture,
  ).levels[0].units[0].lessons
  assert.equal(catalogLessons[0].progress.nextBlock, 0)
  assert.equal(catalogLessons[1].locked, true)
  await put(first, { blockId: blocks[1], revision: 1 }).expect(409)
  const revised = (await get(`lessons/${first}`).expect(200)).body
  assert.equal(revised.progress.nextBlock, 0)
  assert.equal(revised.progress.revision, 2)
  await put(first, { blockId: blocks[1], revision: 2 }).expect(409)
  await put(first, { blockId: blocks[0], revision: 2 }).expect(200)
  assert.equal(
    (await get(`lessons/${first}`).expect(200)).body.progress.nextBlock,
    1,
  )
})
