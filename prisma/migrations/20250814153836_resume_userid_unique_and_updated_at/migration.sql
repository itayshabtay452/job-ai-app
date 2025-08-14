/*
  Warnings:

  - A unique constraint covering the columns `[userId]` on the table `Resume` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `updatedAt` to the `Resume` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "public"."Resume" ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Resume_userId_key" ON "public"."Resume"("userId");
