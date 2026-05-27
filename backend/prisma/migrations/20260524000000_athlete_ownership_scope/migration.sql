ALTER TABLE "Athlete" ADD COLUMN "createdByUserId" INTEGER;

WITH athlete_owner_counts AS (
  SELECT
    aa."athleteId" AS athlete_id,
    c."createdByUserId" AS owner_id,
    COUNT(*) AS cnt,
    MAX(aa."createdAt") AS last_app_at
  FROM "AthleteApplication" aa
  JOIN "Competition" c ON c.id = aa."competitionId"
  WHERE c."createdByUserId" IS NOT NULL
  GROUP BY aa."athleteId", c."createdByUserId"
),
ranked AS (
  SELECT
    athlete_id,
    owner_id,
    ROW_NUMBER() OVER (
      PARTITION BY athlete_id
      ORDER BY cnt DESC, last_app_at DESC, owner_id ASC
    ) AS rn
  FROM athlete_owner_counts
)
UPDATE "Athlete" a
SET "createdByUserId" = ranked.owner_id
FROM ranked
WHERE a.id = ranked.athlete_id
  AND ranked.rn = 1;

ALTER TABLE "Athlete"
  ADD CONSTRAINT "Athlete_createdByUserId_fkey"
  FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Athlete_createdByUserId_lastName_firstName_idx" ON "Athlete"("createdByUserId", "lastName", "firstName");
