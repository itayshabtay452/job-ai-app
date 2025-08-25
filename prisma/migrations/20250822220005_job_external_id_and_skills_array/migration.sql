/*
  Warnings:

  - The `skillsRequired` column on the `Job` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - A unique constraint covering the columns `[source,externalId]` on the table `Job` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `externalId` to the `Job` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "public"."Job" ADD COLUMN     "externalId" TEXT NOT NULL,
DROP COLUMN "skillsRequired",
ADD COLUMN     "skillsRequired" TEXT[];

-- CreateIndex
CREATE INDEX "Job_createdAt_idx" ON "public"."Job"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Job_source_externalId_key" ON "public"."Job"("source", "externalId");
