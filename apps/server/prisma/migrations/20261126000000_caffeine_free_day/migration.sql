CREATE TABLE "CaffeineFreeDay" (
    "userId" UUID NOT NULL,
    "recordDate" DATE NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CaffeineFreeDay_pkey" PRIMARY KEY ("userId","recordDate")
);

ALTER TABLE "CaffeineFreeDay" ADD CONSTRAINT "CaffeineFreeDay_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
