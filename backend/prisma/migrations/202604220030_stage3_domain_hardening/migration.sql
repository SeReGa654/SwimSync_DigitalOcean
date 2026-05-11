DO $$ BEGIN
  CREATE TYPE "UserRole" AS ENUM ('admin', 'secretary', 'operator');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "CompetitionStatus" AS ENUM ('draft', 'active', 'completed');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "AthleteGender" AS ENUM ('M', 'F', 'MIXED', 'X');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "SwimStyle" AS ENUM (
    'FREE', 'BREAST', 'BACK', 'FLY', 'MEDLEY',
    'Freestyle', 'Breaststroke', 'Backstroke', 'Butterfly', 'Medley'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "EntryStatus" AS ENUM ('IN', 'PK', 'DQ', 'DNS', 'DNF');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "ResultStatus" AS ENUM ('OK', 'DQ', 'DNS', 'DNF', 'PK');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "Competition"
  ALTER COLUMN "status" DROP DEFAULT,
  ALTER COLUMN "dateFrom" TYPE TIMESTAMP(3) USING (
    CASE
      WHEN "dateFrom" IS NULL OR trim("dateFrom") = '' THEN NULL
      ELSE "dateFrom"::timestamp
    END
  ),
  ALTER COLUMN "dateTo" TYPE TIMESTAMP(3) USING (
    CASE
      WHEN "dateTo" IS NULL OR trim("dateTo") = '' THEN NULL
      ELSE "dateTo"::timestamp
    END
  ),
  ALTER COLUMN "status" TYPE "CompetitionStatus" USING (
    CASE
      WHEN "status" IN ('draft', 'active', 'completed') THEN "status"::"CompetitionStatus"
      ELSE 'draft'::"CompetitionStatus"
    END
  ),
  ALTER COLUMN "status" SET DEFAULT 'draft';

ALTER TABLE "Athlete"
  ALTER COLUMN "gender" DROP DEFAULT,
  ALTER COLUMN "gender" TYPE "AthleteGender" USING (
    CASE
      WHEN upper("gender") = 'F' THEN 'F'::"AthleteGender"
      WHEN upper("gender") = 'MIXED' THEN 'MIXED'::"AthleteGender"
      WHEN upper("gender") = 'X' THEN 'X'::"AthleteGender"
      ELSE 'M'::"AthleteGender"
    END
  ),
  ALTER COLUMN "gender" SET DEFAULT 'M';

ALTER TABLE "Event"
  ALTER COLUMN "style" TYPE "SwimStyle" USING (
    CASE
      WHEN "style" IN ('FREE', 'BREAST', 'BACK', 'FLY', 'MEDLEY', 'Freestyle', 'Breaststroke', 'Backstroke', 'Butterfly', 'Medley')
        THEN "style"::"SwimStyle"
      ELSE 'Freestyle'::"SwimStyle"
    END
  ),
  ALTER COLUMN "gender" TYPE "AthleteGender" USING (
    CASE
      WHEN upper("gender") = 'F' THEN 'F'::"AthleteGender"
      WHEN upper("gender") = 'MIXED' THEN 'MIXED'::"AthleteGender"
      WHEN upper("gender") = 'X' THEN 'X'::"AthleteGender"
      ELSE 'M'::"AthleteGender"
    END
  );

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'AthleteApplicationItem'
  ) THEN
    ALTER TABLE "AthleteApplicationItem"
      ALTER COLUMN "style" TYPE "SwimStyle" USING (
        CASE
          WHEN "style" IN ('FREE', 'BREAST', 'BACK', 'FLY', 'MEDLEY', 'Freestyle', 'Breaststroke', 'Backstroke', 'Butterfly', 'Medley')
            THEN "style"::"SwimStyle"
          ELSE 'Freestyle'::"SwimStyle"
        END
      ),
      ALTER COLUMN "gender" TYPE "AthleteGender" USING (
        CASE
          WHEN upper("gender") = 'F' THEN 'F'::"AthleteGender"
          WHEN upper("gender") = 'MIXED' THEN 'MIXED'::"AthleteGender"
          WHEN upper("gender") = 'X' THEN 'X'::"AthleteGender"
          ELSE 'M'::"AthleteGender"
        END
      );
  END IF;
END $$;

ALTER TABLE "Entry"
  ALTER COLUMN "status" DROP DEFAULT,
  ALTER COLUMN "status" TYPE "EntryStatus" USING (
    CASE
      WHEN "status" IN ('IN', 'PK', 'DQ', 'DNS', 'DNF') THEN "status"::"EntryStatus"
      ELSE 'IN'::"EntryStatus"
    END
  ),
  ALTER COLUMN "status" SET DEFAULT 'IN';

ALTER TABLE "Result"
  ALTER COLUMN "status" DROP DEFAULT,
  ALTER COLUMN "status" TYPE "ResultStatus" USING (
    CASE
      WHEN "status" IN ('OK', 'DQ', 'DNS', 'DNF', 'PK') THEN "status"::"ResultStatus"
      ELSE 'OK'::"ResultStatus"
    END
  ),
  ALTER COLUMN "status" SET DEFAULT 'OK';

ALTER TABLE "User"
  ALTER COLUMN "role" TYPE "UserRole" USING (
    CASE
      WHEN "role" IN ('admin', 'secretary', 'operator') THEN "role"::"UserRole"
      ELSE 'secretary'::"UserRole"
    END
  );

CREATE INDEX IF NOT EXISTS "Competition_dateFrom_dateTo_idx" ON "Competition"("dateFrom", "dateTo");
CREATE INDEX IF NOT EXISTS "Athlete_region_idx" ON "Athlete"("region");
CREATE INDEX IF NOT EXISTS "Athlete_club_lastName_firstName_idx" ON "Athlete"("club", "lastName", "firstName");
