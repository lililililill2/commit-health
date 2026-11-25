CREATE TABLE "SleepRecord" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "recordDate" DATE NOT NULL,
    "bedtime" TIMESTAMPTZ(3) NOT NULL,
    "wakeTime" TIMESTAMPTZ(3) NOT NULL,
    "durationMinutes" INTEGER NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SleepRecord_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SleepRecord_userId_recordDate_key" ON "SleepRecord"("userId", "recordDate");

ALTER TABLE "SleepRecord" ADD CONSTRAINT "SleepRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
