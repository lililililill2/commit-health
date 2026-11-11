CREATE TYPE "ActivityKind" AS ENUM ('FOCUS', 'MEDITATION');
CREATE TYPE "ActivityStatus" AS ENUM ('RUNNING', 'COMPLETED', 'FAILED');

CREATE TABLE "ConditionRecord" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "recordDate" DATE NOT NULL,
    "score" INTEGER NOT NULL,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "ConditionRecord_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ActivitySession" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "recordDate" DATE NOT NULL,
    "kind" "ActivityKind" NOT NULL,
    "status" "ActivityStatus" NOT NULL DEFAULT 'RUNNING',
    "startedAt" TIMESTAMPTZ(3) NOT NULL,
    "lastSeenAt" TIMESTAMPTZ(3) NOT NULL,
    "endedAt" TIMESTAMPTZ(3),
    "durationSeconds" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "ActivitySession_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ConditionRecord_userId_recordDate_key" ON "ConditionRecord"("userId", "recordDate");
CREATE INDEX "ActivitySession_userId_recordDate_status_idx" ON "ActivitySession"("userId", "recordDate", "status");
ALTER TABLE "ConditionRecord" ADD CONSTRAINT "ConditionRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ActivitySession" ADD CONSTRAINT "ActivitySession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
