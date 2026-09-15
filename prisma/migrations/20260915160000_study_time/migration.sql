CREATE TABLE "StudyTimeEntry" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "requestId" TEXT NOT NULL,
  "startAt" TIMESTAMP(3) NOT NULL,
  "endAt" TIMESTAMP(3) NOT NULL,
  "source" TEXT NOT NULL,
  "lessonSlug" TEXT,
  "creditedMs" INTEGER NOT NULL,
  "segments" JSONB NOT NULL,
  CONSTRAINT "StudyTimeEntry_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "StudyTimeEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "StudyTimeEntry_userId_requestId_key" ON "StudyTimeEntry"("userId", "requestId");
CREATE INDEX "StudyTimeEntry_userId_endAt_idx" ON "StudyTimeEntry"("userId", "endAt");
