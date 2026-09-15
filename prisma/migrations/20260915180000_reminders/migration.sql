ALTER TABLE "UserSettings" ADD COLUMN "reminderTime" TEXT NOT NULL DEFAULT '19:00';
CREATE TABLE "ReminderDelivery" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "localDate" TEXT NOT NULL,
  "timezone" TEXT NOT NULL,
  "scheduledTime" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "attemptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ReminderDelivery_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ReminderDelivery_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "ReminderDelivery_userId_localDate_key" ON "ReminderDelivery"("userId", "localDate");
CREATE INDEX "ReminderDelivery_userId_attemptedAt_idx" ON "ReminderDelivery"("userId", "attemptedAt");
