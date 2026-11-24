CREATE TYPE "MealKind" AS ENUM ('BREAKFAST', 'LUNCH', 'DINNER', 'SNACK');

CREATE TABLE "MealRecord" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "recordDate" DATE NOT NULL,
    "kind" "MealKind" NOT NULL,
    "items" JSONB NOT NULL,
    "note" VARCHAR(500) NOT NULL DEFAULT '',
    "revision" INTEGER NOT NULL DEFAULT 1,
    "requestId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "MealRecord_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "UserSchool" (
    "userId" UUID NOT NULL,
    "officeCode" VARCHAR(3) NOT NULL,
    "schoolCode" VARCHAR(7) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "region" VARCHAR(200) NOT NULL,
    CONSTRAINT "UserSchool_pkey" PRIMARY KEY ("userId")
);

CREATE UNIQUE INDEX "MealRecord_userId_recordDate_kind_key"
    ON "MealRecord"("userId", "recordDate", "kind");

ALTER TABLE "MealRecord" ADD CONSTRAINT "MealRecord_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "UserSchool" ADD CONSTRAINT "UserSchool_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
