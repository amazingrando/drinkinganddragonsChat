-- CreateTable
CREATE TABLE "ChannelReadState" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "lastMessageId" TEXT,
    "lastReadAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ChannelReadState_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ChannelReadState_memberId_channelId_key" ON "ChannelReadState"("memberId", "channelId");

-- CreateIndex
CREATE INDEX "ChannelReadState_channelId_idx" ON "ChannelReadState"("channelId");

-- CreateIndex
CREATE INDEX "ChannelReadState_memberId_idx" ON "ChannelReadState"("memberId");

-- AddForeignKey
ALTER TABLE "ChannelReadState"
  ADD CONSTRAINT "ChannelReadState_memberId_fkey"
  FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChannelReadState"
  ADD CONSTRAINT "ChannelReadState_channelId_fkey"
  FOREIGN KEY ("channelId") REFERENCES "Channel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

