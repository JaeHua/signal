-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "githubId" INTEGER NOT NULL,
    "githubLogin" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT,
    "avatarUrl" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Repo" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "owner" TEXT NOT NULL,
    "repo" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "description" TEXT,
    "language" TEXT,
    "stars" INTEGER,
    "forks" INTEGER,
    "trendingDate" DATETIME,
    "trendingRank" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "RepoSummary" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "repoId" TEXT NOT NULL,
    "summaryDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "aiSummary" TEXT NOT NULL,
    "techTags" TEXT NOT NULL,
    "whyMatters" TEXT NOT NULL,
    "worthDeepDive" BOOLEAN NOT NULL,
    "deepDiveReason" TEXT,
    "provider" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RepoSummary_repoId_fkey" FOREIGN KEY ("repoId") REFERENCES "Repo" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SavedRepo" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "repoId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SavedRepo_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "SavedRepo_repoId_fkey" FOREIGN KEY ("repoId") REFERENCES "Repo" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_githubId_key" ON "User"("githubId");

-- CreateIndex
CREATE UNIQUE INDEX "Repo_name_key" ON "Repo"("name");

-- CreateIndex
CREATE INDEX "RepoSummary_repoId_summaryDate_idx" ON "RepoSummary"("repoId", "summaryDate");

-- CreateIndex
CREATE UNIQUE INDEX "SavedRepo_userId_repoId_key" ON "SavedRepo"("userId", "repoId");
