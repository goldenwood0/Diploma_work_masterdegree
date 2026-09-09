-- AlterTable
ALTER TABLE "UserSettings" ADD COLUMN     "experience" TEXT NOT NULL DEFAULT 'beginner',
ADD COLUMN     "goal" TEXT NOT NULL DEFAULT 'communication',
ADD COLUMN     "onboardingCompletedAt" TIMESTAMP(3),
ADD COLUMN     "remindersEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "startLevel" INTEGER NOT NULL DEFAULT 1;
