-- AlterTable
ALTER TABLE [dbo].[LoanProduct] ADD [eligibilityUploadId] NVARCHAR(1000);

-- CreateIndex
CREATE UNIQUE INDEX [LoanProduct_eligibilityUploadId_key] ON [dbo].[LoanProduct]([eligibilityUploadId]);

-- AddForeignKey
ALTER TABLE [dbo].[LoanProduct] ADD CONSTRAINT [LoanProduct_eligibilityUploadId_fkey] FOREIGN KEY ([eligibilityUploadId]) REFERENCES [dbo].[DataProvisioningUpload]([id]) ON DELETE SET NULL ON UPDATE CASCADE;
