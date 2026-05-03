CREATE TABLE "AdminUserSenderProfileAccess" (
    "id" SERIAL NOT NULL,
    "adminUserId" INTEGER NOT NULL,
    "senderProfileId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminUserSenderProfileAccess_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AdminUserSenderProfileAccess_adminUserId_senderProfileId_key"
ON "AdminUserSenderProfileAccess"("adminUserId", "senderProfileId");

CREATE INDEX "AdminUserSenderProfileAccess_senderProfileId_idx"
ON "AdminUserSenderProfileAccess"("senderProfileId");

ALTER TABLE "AdminUserSenderProfileAccess"
ADD CONSTRAINT "AdminUserSenderProfileAccess_adminUserId_fkey"
FOREIGN KEY ("adminUserId") REFERENCES "AdminUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AdminUserSenderProfileAccess"
ADD CONSTRAINT "AdminUserSenderProfileAccess_senderProfileId_fkey"
FOREIGN KEY ("senderProfileId") REFERENCES "SenderProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
