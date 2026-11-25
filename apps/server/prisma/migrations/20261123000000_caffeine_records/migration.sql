CREATE TABLE "CaffeineRecord" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "recordDate" DATE NOT NULL,
    "drinkName" VARCHAR(100) NOT NULL,
    "catalogId" VARCHAR(100),
    "servingLabel" VARCHAR(80),
    "caffeineMg" DECIMAL(6,2) NOT NULL,
    "consumedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "CaffeineRecord_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CaffeineRecord_userId_recordDate_consumedAt_idx" ON "CaffeineRecord"("userId", "recordDate", "consumedAt");

ALTER TABLE "CaffeineRecord" ADD CONSTRAINT "CaffeineRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
