-- CreateTable
CREATE TABLE `Order` (
    `id` VARCHAR(191) NOT NULL,
    `orgId` VARCHAR(191) NOT NULL,
    `stripePaymentId` VARCHAR(191) NULL,
    `status` ENUM('PENDING', 'PAID', 'PROVISIONING', 'ACTIVE', 'CANCELLED', 'FAILED') NOT NULL DEFAULT 'PENDING',
    `planId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Order_stripePaymentId_key`(`stripePaymentId`),
    INDEX `Order_orgId_idx`(`orgId`),
    INDEX `Order_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ProviderService` (
    `id` VARCHAR(191) NOT NULL,
    `orderId` VARCHAR(191) NOT NULL,
    `resellPortalId` VARCHAR(191) NOT NULL,
    `status` ENUM('PROVISIONING', 'ACTIVE', 'SUSPENDED', 'TERMINATED') NOT NULL DEFAULT 'PROVISIONING',
    `provisionedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `ProviderService_orderId_key`(`orderId`),
    UNIQUE INDEX `ProviderService_resellPortalId_key`(`resellPortalId`),
    INDEX `ProviderService_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `IdempotencyRecord` (
    `key` VARCHAR(191) NOT NULL,
    `result` JSON NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `expiresAt` DATETIME(3) NOT NULL,

    INDEX `IdempotencyRecord_expiresAt_idx`(`expiresAt`),
    PRIMARY KEY (`key`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `AuditLog_actor_idx` ON `AuditLog`(`actor`);

-- AddForeignKey
ALTER TABLE `Order` ADD CONSTRAINT `Order_orgId_fkey` FOREIGN KEY (`orgId`) REFERENCES `Org`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Order` ADD CONSTRAINT `Order_planId_fkey` FOREIGN KEY (`planId`) REFERENCES `Plan`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProviderService` ADD CONSTRAINT `ProviderService_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `Order`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
