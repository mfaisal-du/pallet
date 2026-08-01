-- AlterTable
ALTER TABLE `users` ADD COLUMN `roles` JSON NOT NULL DEFAULT (JSON_ARRAY());

-- Phase 4 backfill: every existing user gets their primary role as their role set,
-- so authorization (which reads `roles`) matches the pre-Phase-4 behavior.
UPDATE `users` SET `roles` = JSON_ARRAY(`role`) WHERE JSON_LENGTH(`roles`) = 0;
