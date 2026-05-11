-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('admin', 'secretary', 'operator');

-- CreateEnum
CREATE TYPE "CompetitionStatus" AS ENUM ('draft', 'active', 'completed');

-- CreateEnum
CREATE TYPE "AthleteGender" AS ENUM ('M', 'F', 'MIXED', 'X');

-- CreateEnum
CREATE TYPE "SwimStyle" AS ENUM ('FREE', 'BREAST', 'BACK', 'FLY', 'MEDLEY', 'Freestyle', 'Breaststroke', 'Backstroke', 'Butterfly', 'Medley');

-- CreateEnum
CREATE TYPE "EntryStatus" AS ENUM ('IN', 'PK', 'DQ', 'DNS', 'DNF');

-- CreateEnum
CREATE TYPE "ResultStatus" AS ENUM ('OK', 'DQ', 'DNS', 'DNF', 'PK');

-- CreateEnum
CREATE TYPE "ResultProtocolFormat" AS ENUM ('SEPARATE', 'COMBINED', 'MIXED');

-- CreateTable
CREATE TABLE "Competition" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "categoriesStr" TEXT NOT NULL DEFAULT '',
    "location" TEXT NOT NULL,
    "venue" TEXT NOT NULL DEFAULT '',
    "poolLength" INTEGER NOT NULL,
    "lanes" INTEGER NOT NULL DEFAULT 8,
    "dateFrom" TIMESTAMP(3),
    "dateTo" TIMESTAMP(3),
    "status" "CompetitionStatus" NOT NULL DEFAULT 'draft',
    "circularSeeding" BOOLEAN NOT NULL DEFAULT false,
    "resultProtocolFormat" "ResultProtocolFormat" NOT NULL DEFAULT 'SEPARATE',
    "mixedFormatPrimaryAgeGroupId" INTEGER,
    "mixedFormatSecondaryAgeGroupIds" TEXT,
    "resultProtocolConfigJson" JSONB,
    "createdByUserId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Competition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompetitionAgeGroup" (
    "id" SERIAL NOT NULL,
    "competitionId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "birthYearFrom" INTEGER NOT NULL,
    "birthYearTo" INTEGER NOT NULL,

    CONSTRAINT "CompetitionAgeGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Athlete" (
    "id" SERIAL NOT NULL,
    "lastName" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "birthYear" INTEGER NOT NULL,
    "gender" "AthleteGender" NOT NULL DEFAULT 'M',
    "currentRank" TEXT NOT NULL DEFAULT 'NONE',
    "coach" TEXT,
    "club" TEXT NOT NULL,
    "region" TEXT,

    CONSTRAINT "Athlete_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AthleteApplication" (
    "id" SERIAL NOT NULL,
    "athleteId" INTEGER NOT NULL,
    "competitionId" INTEGER,
    "currentRank" TEXT NOT NULL DEFAULT 'NONE',
    "coach" TEXT,
    "club" TEXT NOT NULL,
    "region" TEXT,
    "doctorApproved" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AthleteApplication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AthleteApplicationItem" (
    "id" SERIAL NOT NULL,
    "applicationId" INTEGER NOT NULL,
    "distanceM" INTEGER NOT NULL,
    "style" "SwimStyle" NOT NULL,
    "gender" "AthleteGender" NOT NULL,
    "entryTimeMs" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AthleteApplicationItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Event" (
    "id" SERIAL NOT NULL,
    "competitionId" INTEGER NOT NULL,
    "distance" INTEGER NOT NULL,
    "style" "SwimStyle" NOT NULL,
    "gender" "AthleteGender" NOT NULL,
    "name" TEXT NOT NULL,
    "isRelay" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Entry" (
    "id" SERIAL NOT NULL,
    "athleteId" INTEGER,
    "teamName" TEXT,
    "eventId" INTEGER NOT NULL,
    "entryTimeMs" INTEGER,
    "heatNumber" INTEGER,
    "laneNumber" INTEGER,
    "ageGroupId" INTEGER,
    "doctorApproved" BOOLEAN NOT NULL DEFAULT false,
    "status" "EntryStatus" NOT NULL DEFAULT 'IN',

    CONSTRAINT "Entry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Result" (
    "id" SERIAL NOT NULL,
    "entryId" INTEGER NOT NULL,
    "finishTimeMs" INTEGER,
    "pointsWa" INTEGER,
    "achievedRank" TEXT,
    "place" INTEGER,
    "placeDisplay" TEXT,
    "status" "ResultStatus" NOT NULL DEFAULT 'OK',
    "dqReason" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "Result_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WaBaseTime" (
    "id" SERIAL NOT NULL,
    "year" INTEGER NOT NULL,
    "gender" TEXT NOT NULL,
    "distance" INTEGER NOT NULL,
    "style" TEXT NOT NULL,
    "poolLength" INTEGER NOT NULL,
    "baseTimeMs" INTEGER NOT NULL,

    CONSTRAINT "WaBaseTime_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UaSportRank" (
    "id" SERIAL NOT NULL,
    "poolLength" INTEGER NOT NULL,
    "gender" TEXT NOT NULL,
    "distance" INTEGER NOT NULL,
    "style" TEXT NOT NULL,
    "rank" TEXT NOT NULL,
    "normTimeMs" INTEGER NOT NULL,

    CONSTRAINT "UaSportRank_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" SERIAL NOT NULL,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" INTEGER,
    "requestId" TEXT,
    "details" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" SERIAL NOT NULL,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isApproved" BOOLEAN NOT NULL DEFAULT false,
    "approvedAt" TIMESTAMP(3),
    "approvedBy" TEXT,
    "twoFactorEnabled" BOOLEAN NOT NULL DEFAULT false,
    "twoFactorSecret" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastLoginAt" TIMESTAMP(3),

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResultProtocolPreset" (
    "id" SERIAL NOT NULL,
    "competitionId" INTEGER NOT NULL,
    "ownerUserId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "isShared" BOOLEAN NOT NULL DEFAULT false,
    "configJson" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ResultProtocolPreset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserResultProtocolPreference" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "configJson" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserResultProtocolPreference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "ip" TEXT,
    "userAgent" TEXT,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeatureFlag" (
    "id" SERIAL NOT NULL,
    "key" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FeatureFlag_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Competition_status_createdAt_idx" ON "Competition"("status", "createdAt");

-- CreateIndex
CREATE INDEX "Competition_createdByUserId_createdAt_idx" ON "Competition"("createdByUserId", "createdAt");

-- CreateIndex
CREATE INDEX "Competition_dateFrom_dateTo_idx" ON "Competition"("dateFrom", "dateTo");

-- CreateIndex
CREATE INDEX "CompetitionAgeGroup_competitionId_idx" ON "CompetitionAgeGroup"("competitionId");

-- CreateIndex
CREATE INDEX "Athlete_lastName_firstName_idx" ON "Athlete"("lastName", "firstName");

-- CreateIndex
CREATE INDEX "Athlete_club_idx" ON "Athlete"("club");

-- CreateIndex
CREATE INDEX "Athlete_region_idx" ON "Athlete"("region");

-- CreateIndex
CREATE INDEX "Athlete_club_lastName_firstName_idx" ON "Athlete"("club", "lastName", "firstName");

-- CreateIndex
CREATE INDEX "AthleteApplication_athleteId_createdAt_idx" ON "AthleteApplication"("athleteId", "createdAt");

-- CreateIndex
CREATE INDEX "AthleteApplication_competitionId_createdAt_idx" ON "AthleteApplication"("competitionId", "createdAt");

-- CreateIndex
CREATE INDEX "AthleteApplication_region_club_idx" ON "AthleteApplication"("region", "club");

-- CreateIndex
CREATE INDEX "AthleteApplicationItem_applicationId_idx" ON "AthleteApplicationItem"("applicationId");

-- CreateIndex
CREATE INDEX "AthleteApplicationItem_distanceM_style_gender_idx" ON "AthleteApplicationItem"("distanceM", "style", "gender");

-- CreateIndex
CREATE INDEX "Event_competitionId_sortOrder_idx" ON "Event"("competitionId", "sortOrder");

-- CreateIndex
CREATE INDEX "Event_competitionId_gender_style_distance_idx" ON "Event"("competitionId", "gender", "style", "distance");

-- CreateIndex
CREATE INDEX "Entry_eventId_heatNumber_idx" ON "Entry"("eventId", "heatNumber");

-- CreateIndex
CREATE INDEX "Entry_eventId_laneNumber_idx" ON "Entry"("eventId", "laneNumber");

-- CreateIndex
CREATE INDEX "Entry_athleteId_idx" ON "Entry"("athleteId");

-- CreateIndex
CREATE UNIQUE INDEX "Entry_athleteId_eventId_key" ON "Entry"("athleteId", "eventId");

-- CreateIndex
CREATE UNIQUE INDEX "Result_entryId_key" ON "Result"("entryId");

-- CreateIndex
CREATE INDEX "Result_status_place_idx" ON "Result"("status", "place");

-- CreateIndex
CREATE UNIQUE INDEX "WaBaseTime_year_gender_distance_style_poolLength_key" ON "WaBaseTime"("year", "gender", "distance", "style", "poolLength");

-- CreateIndex
CREATE INDEX "UaSportRank_distance_style_gender_poolLength_idx" ON "UaSportRank"("distance", "style", "gender", "poolLength");

-- CreateIndex
CREATE UNIQUE INDEX "UaSportRank_rank_poolLength_gender_distance_style_key" ON "UaSportRank"("rank", "poolLength", "gender", "distance", "style");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_entity_entityId_createdAt_idx" ON "AuditLog"("entity", "entityId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_requestId_createdAt_idx" ON "AuditLog"("requestId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE INDEX "User_role_isActive_idx" ON "User"("role", "isActive");

-- CreateIndex
CREATE INDEX "User_isApproved_isActive_idx" ON "User"("isApproved", "isActive");

-- CreateIndex
CREATE INDEX "ResultProtocolPreset_competitionId_isShared_idx" ON "ResultProtocolPreset"("competitionId", "isShared");

-- CreateIndex
CREATE INDEX "ResultProtocolPreset_ownerUserId_competitionId_idx" ON "ResultProtocolPreset"("ownerUserId", "competitionId");

-- CreateIndex
CREATE UNIQUE INDEX "ResultProtocolPreset_competitionId_ownerUserId_name_key" ON "ResultProtocolPreset"("competitionId", "ownerUserId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "UserResultProtocolPreference_userId_key" ON "UserResultProtocolPreference"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_tokenHash_key" ON "Session"("tokenHash");

-- CreateIndex
CREATE INDEX "Session_userId_expiresAt_idx" ON "Session"("userId", "expiresAt");

-- CreateIndex
CREATE INDEX "Session_expiresAt_revokedAt_idx" ON "Session"("expiresAt", "revokedAt");

-- CreateIndex
CREATE UNIQUE INDEX "FeatureFlag_key_key" ON "FeatureFlag"("key");

-- AddForeignKey
ALTER TABLE "Competition" ADD CONSTRAINT "Competition_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompetitionAgeGroup" ADD CONSTRAINT "CompetitionAgeGroup_competitionId_fkey" FOREIGN KEY ("competitionId") REFERENCES "Competition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AthleteApplication" ADD CONSTRAINT "AthleteApplication_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "Athlete"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AthleteApplication" ADD CONSTRAINT "AthleteApplication_competitionId_fkey" FOREIGN KEY ("competitionId") REFERENCES "Competition"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AthleteApplicationItem" ADD CONSTRAINT "AthleteApplicationItem_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "AthleteApplication"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_competitionId_fkey" FOREIGN KEY ("competitionId") REFERENCES "Competition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Entry" ADD CONSTRAINT "Entry_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "Athlete"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Entry" ADD CONSTRAINT "Entry_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Entry" ADD CONSTRAINT "Entry_ageGroupId_fkey" FOREIGN KEY ("ageGroupId") REFERENCES "CompetitionAgeGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Result" ADD CONSTRAINT "Result_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "Entry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResultProtocolPreset" ADD CONSTRAINT "ResultProtocolPreset_competitionId_fkey" FOREIGN KEY ("competitionId") REFERENCES "Competition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResultProtocolPreset" ADD CONSTRAINT "ResultProtocolPreset_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserResultProtocolPreference" ADD CONSTRAINT "UserResultProtocolPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
