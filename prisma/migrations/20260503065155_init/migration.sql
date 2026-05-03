-- CreateEnum
CREATE TYPE "CampaignStatus" AS ENUM ('draft', 'ready', 'sending', 'paused', 'completed', 'failed', 'stopped');

-- CreateEnum
CREATE TYPE "RecipientStatus" AS ENUM ('pending', 'sent', 'failed', 'skipped');

-- CreateTable
CREATE TABLE "AdminUser" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdminUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppSetting" (
    "id" SERIAL NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppSetting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SenderProfile" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "fromName" TEXT NOT NULL,
    "fromEmail" TEXT NOT NULL,
    "serverToken" TEXT NOT NULL,
    "messageStream" TEXT NOT NULL DEFAULT 'broadcast',
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SenderProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Campaign" (
    "id" SERIAL NOT NULL,
    "senderProfileId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "fromName" TEXT NOT NULL,
    "fromEmail" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "htmlBody" TEXT NOT NULL,
    "textBody" TEXT NOT NULL,
    "includeUnsubscribe" BOOLEAN NOT NULL DEFAULT false,
    "status" "CampaignStatus" NOT NULL DEFAULT 'draft',
    "totalRecipients" INTEGER NOT NULL DEFAULT 0,
    "validRecipients" INTEGER NOT NULL DEFAULT 0,
    "invalidRecipients" INTEGER NOT NULL DEFAULT 0,
    "sentCount" INTEGER NOT NULL DEFAULT 0,
    "failedCount" INTEGER NOT NULL DEFAULT 0,
    "duplicateCount" INTEGER NOT NULL DEFAULT 0,
    "unsubscribedCount" INTEGER NOT NULL DEFAULT 0,
    "testSentAt" TIMESTAMP(3),
    "lastTestEmail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "Campaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Recipient" (
    "id" SERIAL NOT NULL,
    "campaignId" INTEGER NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "status" "RecipientStatus" NOT NULL DEFAULT 'pending',
    "postmarkMessageId" TEXT,
    "errorMessage" TEXT,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Recipient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Unsubscribe" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "unsubscribedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Unsubscribe_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SendAttempt" (
    "id" SERIAL NOT NULL,
    "campaignId" INTEGER NOT NULL,
    "recipientId" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "requestPayload" JSONB,
    "responsePayload" JSONB,
    "errorMessage" TEXT,
    "attemptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SendAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AdminUser_email_key" ON "AdminUser"("email");

-- CreateIndex
CREATE UNIQUE INDEX "AppSetting_key_key" ON "AppSetting"("key");

-- CreateIndex
CREATE UNIQUE INDEX "SenderProfile_fromEmail_messageStream_key" ON "SenderProfile"("fromEmail", "messageStream");

-- CreateIndex
CREATE INDEX "Recipient_campaignId_status_idx" ON "Recipient"("campaignId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Recipient_campaignId_email_key" ON "Recipient"("campaignId", "email");

-- CreateIndex
CREATE UNIQUE INDEX "Unsubscribe_email_key" ON "Unsubscribe"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Unsubscribe_token_key" ON "Unsubscribe"("token");

-- CreateIndex
CREATE INDEX "SendAttempt_campaignId_attemptedAt_idx" ON "SendAttempt"("campaignId", "attemptedAt");

-- CreateIndex
CREATE INDEX "SendAttempt_recipientId_attemptedAt_idx" ON "SendAttempt"("recipientId", "attemptedAt");

-- AddForeignKey
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_senderProfileId_fkey" FOREIGN KEY ("senderProfileId") REFERENCES "SenderProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recipient" ADD CONSTRAINT "Recipient_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SendAttempt" ADD CONSTRAINT "SendAttempt_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SendAttempt" ADD CONSTRAINT "SendAttempt_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "Recipient"("id") ON DELETE CASCADE ON UPDATE CASCADE;
