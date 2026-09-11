-- AlterTable
ALTER TABLE "User" ADD COLUMN     "roleVersion" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "RoleChange" (
    "id" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "before" "Role" NOT NULL,
    "after" "Role" NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RoleChange_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RoleChange_userId_createdAt_idx" ON "RoleChange"("userId", "createdAt");
