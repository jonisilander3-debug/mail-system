ALTER TABLE "SenderProfile"
ADD COLUMN "domain" TEXT NOT NULL DEFAULT '';

ALTER TABLE "SenderProfile"
ADD COLUMN "status" TEXT NOT NULL DEFAULT 'active';

UPDATE "SenderProfile"
SET "domain" = LOWER(SPLIT_PART("fromEmail", '@', 2))
WHERE "domain" = '';

ALTER TABLE "SenderProfile"
DROP CONSTRAINT IF EXISTS "SenderProfile_fromEmail_messageStream_key";

ALTER TABLE "SenderProfile"
ADD CONSTRAINT "SenderProfile_domain_fromEmail_messageStream_key"
UNIQUE ("domain", "fromEmail", "messageStream");
