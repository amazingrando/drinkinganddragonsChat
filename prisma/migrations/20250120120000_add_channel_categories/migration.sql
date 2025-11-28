-- CreateTable
CREATE TABLE "ChannelCategory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "serverID" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChannelCategory_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "Channel" ADD COLUMN     "categoryId" TEXT,
ADD COLUMN     "order" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "ChannelCategory_serverID_idx" ON "ChannelCategory"("serverID");

-- CreateIndex
CREATE INDEX "Channel_categoryId_idx" ON "Channel"("categoryId");

-- AddForeignKey
ALTER TABLE "ChannelCategory" ADD CONSTRAINT "ChannelCategory_serverID_fkey" FOREIGN KEY ("serverID") REFERENCES "Server"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Channel" ADD CONSTRAINT "Channel_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ChannelCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

