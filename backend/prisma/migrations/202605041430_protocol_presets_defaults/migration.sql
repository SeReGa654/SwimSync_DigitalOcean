ALTER TABLE "Competition"
  ADD COLUMN IF NOT EXISTS "resultProtocolConfigJson" JSONB;

CREATE TABLE IF NOT EXISTS "ResultProtocolPreset" (
  "id" SERIAL NOT NULL,
  "competitionId" INTEGER NOT NULL,
  "ownerUserId" INTEGER NOT NULL,
  "name" TEXT NOT NULL,
  "isShared" BOOLEAN NOT NULL DEFAULT false,
  "configJson" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ResultProtocolPreset_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "UserResultProtocolPreference" (
  "id" SERIAL NOT NULL,
  "userId" INTEGER NOT NULL,
  "configJson" JSONB NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "UserResultProtocolPreference_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ResultProtocolPreset_competitionId_fkey'
  ) THEN
    ALTER TABLE "ResultProtocolPreset"
      ADD CONSTRAINT "ResultProtocolPreset_competitionId_fkey"
      FOREIGN KEY ("competitionId") REFERENCES "Competition"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ResultProtocolPreset_ownerUserId_fkey'
  ) THEN
    ALTER TABLE "ResultProtocolPreset"
      ADD CONSTRAINT "ResultProtocolPreset_ownerUserId_fkey"
      FOREIGN KEY ("ownerUserId") REFERENCES "User"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'UserResultProtocolPreference_userId_fkey'
  ) THEN
    ALTER TABLE "UserResultProtocolPreference"
      ADD CONSTRAINT "UserResultProtocolPreference_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "ResultProtocolPreset_competitionId_isShared_idx"
  ON "ResultProtocolPreset"("competitionId", "isShared");
CREATE INDEX IF NOT EXISTS "ResultProtocolPreset_ownerUserId_competitionId_idx"
  ON "ResultProtocolPreset"("ownerUserId", "competitionId");
CREATE UNIQUE INDEX IF NOT EXISTS "ResultProtocolPreset_competitionId_ownerUserId_name_key"
  ON "ResultProtocolPreset"("competitionId", "ownerUserId", "name");
CREATE UNIQUE INDEX IF NOT EXISTS "UserResultProtocolPreference_userId_key"
  ON "UserResultProtocolPreference"("userId");
