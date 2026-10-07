-- Additive prepaid-commerce tables. Apply only to a disposable staging database first.
CREATE TABLE `CommerceOrder` (
  `id` VARCHAR(191) NOT NULL,
  `userId` VARCHAR(191) NOT NULL,
  `customerEmail` VARCHAR(191) NOT NULL,
  `requestKey` VARCHAR(191) NOT NULL,
  `dealId` VARCHAR(191) NOT NULL,
  `catalogVersion` VARCHAR(191) NOT NULL,
  `amountCents` INTEGER NOT NULL,
  `currency` VARCHAR(191) NOT NULL DEFAULT 'usd',
  `status` ENUM('CREATED','PAID','PROVISIONING','PROVISIONED','ACTIVE','HELD','FAILED') NOT NULL DEFAULT 'CREATED',
  `stripeSessionId` VARCHAR(191) NULL,
  `stripePaymentId` VARCHAR(191) NULL,
  `holdReason` VARCHAR(191) NULL,
  `primaryDomain` VARCHAR(253) NULL,
  `cpanelUsername` VARCHAR(191) NULL,
  `brandIntakeEncrypted` MEDIUMBLOB NULL,
  `brandIntakeMime` VARCHAR(191) NULL,
  `paidAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `CommerceOrder_userId_requestKey_key` (`userId`, `requestKey`),
  UNIQUE INDEX `CommerceOrder_stripeSessionId_key` (`stripeSessionId`),
  UNIQUE INDEX `CommerceOrder_stripePaymentId_key` (`stripePaymentId`),
  INDEX `CommerceOrder_userId_createdAt_idx` (`userId`, `createdAt`),
  INDEX `CommerceOrder_status_idx` (`status`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE TABLE `CommerceJob` (
  `orderId` VARCHAR(191) NOT NULL,
  `state` VARCHAR(191) NOT NULL DEFAULT 'PENDING',
  `alertSentAt` DATETIME(3) NULL,
  `deliverySentAt` DATETIME(3) NULL,
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`orderId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE TABLE `CommerceStripeEvent` (
  `id` VARCHAR(191) NOT NULL,
  `type` VARCHAR(191) NOT NULL,
  `processedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
ALTER TABLE `CommerceJob` ADD CONSTRAINT `CommerceJob_orderId_fkey`
  FOREIGN KEY (`orderId`) REFERENCES `CommerceOrder`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
