CREATE TYPE "GoogleOAuthIntent" AS ENUM ('SIGN_IN', 'SIGN_UP');

CREATE TABLE "GoogleAccount" (
    "id" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "GoogleAccount_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "GoogleOAuthAttempt" (
    "stateHash" TEXT NOT NULL,
    "codeVerifier" TEXT NOT NULL,
    "intent" "GoogleOAuthIntent" NOT NULL,
    "dateOfBirth" DATE,
    "guardianName" TEXT,
    "guardianEmail" TEXT,
    "termsAcceptedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GoogleOAuthAttempt_pkey" PRIMARY KEY ("stateHash")
);

CREATE UNIQUE INDEX "GoogleAccount_subject_key" ON "GoogleAccount"("subject");
CREATE UNIQUE INDEX "GoogleAccount_userId_key" ON "GoogleAccount"("userId");
CREATE INDEX "GoogleOAuthAttempt_expiresAt_idx" ON "GoogleOAuthAttempt"("expiresAt");

ALTER TABLE "GoogleAccount"
ADD CONSTRAINT "GoogleAccount_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
