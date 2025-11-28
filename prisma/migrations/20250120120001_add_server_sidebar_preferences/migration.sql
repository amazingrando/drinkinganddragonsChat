-- CreateTable
CREATE TABLE "ServerSidebarPreferences" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "serverId" TEXT NOT NULL,
    "collapsedCategories" JSONB NOT NULL,
    "collapsedMembers" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServerSidebarPreferences_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ServerSidebarPreferences_memberId_serverId_key" ON "ServerSidebarPreferences"("memberId", "serverId");

-- CreateIndex
CREATE INDEX "ServerSidebarPreferences_memberId_idx" ON "ServerSidebarPreferences"("memberId");

-- CreateIndex
CREATE INDEX "ServerSidebarPreferences_serverId_idx" ON "ServerSidebarPreferences"("serverId");

-- AddForeignKey
ALTER TABLE "ServerSidebarPreferences" ADD CONSTRAINT "ServerSidebarPreferences_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServerSidebarPreferences" ADD CONSTRAINT "ServerSidebarPreferences_serverId_fkey" FOREIGN KEY ("serverId") REFERENCES "Server"("id") ON DELETE CASCADE ON UPDATE CASCADE;

