-- Two-phase add of a required unique column so existing rows survive:
-- add nullable, seed from the primary key (already unique), then tighten.
ALTER TABLE `Org` ADD COLUMN `slug` VARCHAR(191) NULL;

UPDATE `Org` SET `slug` = `id` WHERE `slug` IS NULL;

ALTER TABLE `Org` MODIFY `slug` VARCHAR(191) NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX `Org_slug_key` ON `Org`(`slug`);
