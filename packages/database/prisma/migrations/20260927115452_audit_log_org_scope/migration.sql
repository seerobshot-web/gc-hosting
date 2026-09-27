-- AlterTable
ALTER TABLE `AuditLog` ADD COLUMN `orgId` VARCHAR(191) NULL;

-- CreateIndex
CREATE INDEX `AuditLog_orgId_createdAt_id_idx` ON `AuditLog`(`orgId`, `createdAt`, `id`);

-- AddForeignKey
ALTER TABLE `AuditLog` ADD CONSTRAINT `AuditLog_orgId_fkey` FOREIGN KEY (`orgId`) REFERENCES `Org`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
