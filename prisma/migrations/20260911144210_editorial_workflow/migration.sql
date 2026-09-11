-- AlterTable
ALTER TABLE "Lesson" ADD COLUMN     "editVersion" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "editorialState" TEXT NOT NULL DEFAULT 'DRAFT';

-- CreateTable
CREATE TABLE "LessonChange" (
    "id" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "snapshot" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LessonChange_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LessonChange_lessonId_createdAt_idx" ON "LessonChange"("lessonId", "createdAt");

-- AddForeignKey
ALTER TABLE "LessonChange" ADD CONSTRAINT "LessonChange_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;
