-- CreateIndex
CREATE INDEX `trucks_assigned_driver_id_idx` ON `trucks`(`assigned_driver_id`);

-- AddForeignKey
ALTER TABLE `trucks` ADD CONSTRAINT `trucks_assigned_driver_id_fkey` FOREIGN KEY (`assigned_driver_id`) REFERENCES `drivers`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
