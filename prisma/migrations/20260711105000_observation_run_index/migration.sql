-- Support repeated samples for the same prompt and platform.
DROP INDEX "Observation_scanId_promptVersionId_platformId_modelId_key";

ALTER TABLE "Observation"
ADD COLUMN "runIndex" INTEGER NOT NULL DEFAULT 1;

CREATE UNIQUE INDEX "Observation_scanId_promptVersionId_platformId_modelId_runIn_key"
ON "Observation"("scanId", "promptVersionId", "platformId", "modelId", "runIndex");
