-- AlterTable
ALTER TABLE `movements` ADD COLUMN `trip_id` VARCHAR(191) NULL;

-- CreateTable
CREATE TABLE `trips` (
    `id` VARCHAR(191) NOT NULL,
    `type` ENUM('dispatch', 'return_collection', 'factory_receive') NOT NULL,
    `status` ENUM('open', 'closed', 'cancelled') NOT NULL DEFAULT 'open',
    `truck_id` VARCHAR(191) NULL,
    `truck_number` VARCHAR(30) NULL,
    `driver_id` VARCHAR(191) NULL,
    `driver_name` VARCHAR(100) NULL,
    `destination` VARCHAR(120) NULL,
    `expected_delivery` DATE NULL,
    `notes` VARCHAR(500) NULL,
    `collector` VARCHAR(100) NULL,
    `inspector` VARCHAR(100) NULL,
    `scanned_count` INTEGER NOT NULL DEFAULT 0,
    `failed_count` INTEGER NOT NULL DEFAULT 0,
    `created_by_id` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `closed_at` DATETIME(3) NULL,
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `trips_type_status_idx`(`type`, `status`),
    INDEX `trips_created_by_id_idx`(`created_by_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `movements_trip_id_idx` ON `movements`(`trip_id`);

-- AddForeignKey
ALTER TABLE `movements` ADD CONSTRAINT `movements_trip_id_fkey` FOREIGN KEY (`trip_id`) REFERENCES `trips`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `trips` ADD CONSTRAINT `trips_created_by_id_fkey` FOREIGN KEY (`created_by_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
