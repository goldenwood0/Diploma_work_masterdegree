CREATE TABLE "StudyActivity" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StudyActivity_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "StudyActivity_userId_createdAt_idx" ON "StudyActivity"("userId", "createdAt");
ALTER TABLE "StudyActivity" ADD CONSTRAINT "StudyActivity_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Only the last saved progress timestamp is recoverable for pre-migration lessons.
INSERT INTO "StudyActivity" ("id", "userId", "createdAt")
SELECT 'legacy:' || "userId" || ':' || "lessonId", "userId", "updatedAt"
FROM "LessonProgress" WHERE "nextBlock" > 0;
