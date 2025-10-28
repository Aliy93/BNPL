BEGIN TRY

BEGIN TRAN;

-- CreateTable
CREATE TABLE [dbo].[User] (
    [id] NVARCHAR(1000) NOT NULL,
    [fullName] NVARCHAR(1000) NOT NULL,
    [email] NVARCHAR(1000) NOT NULL,
    [phoneNumber] NVARCHAR(1000) NOT NULL,
    [password] NVARCHAR(1000) NOT NULL,
    [status] NVARCHAR(1000) NOT NULL,
    [roleId] NVARCHAR(1000) NOT NULL,
    [loanProviderId] NVARCHAR(1000),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [User_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [User_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [User_email_key] UNIQUE NONCLUSTERED ([email]),
    CONSTRAINT [User_phoneNumber_key] UNIQUE NONCLUSTERED ([phoneNumber])
);

-- CreateTable
CREATE TABLE [dbo].[Role] (
    [id] NVARCHAR(1000) NOT NULL,
    [name] NVARCHAR(1000) NOT NULL,
    [permissions] NVARCHAR(1000) NOT NULL,
    CONSTRAINT [Role_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [Role_name_key] UNIQUE NONCLUSTERED ([name])
);

-- CreateTable
CREATE TABLE [dbo].[LoanProvider] (
    [id] NVARCHAR(1000) NOT NULL,
    [name] NVARCHAR(1000) NOT NULL,
    [icon] TEXT NOT NULL,
    [colorHex] NVARCHAR(1000) NOT NULL,
    [displayOrder] INT NOT NULL,
    [accountNumber] NVARCHAR(1000),
    [startingCapital] FLOAT(53) NOT NULL,
    [initialBalance] FLOAT(53) NOT NULL,
    [allowCrossProviderLoans] BIT NOT NULL CONSTRAINT [LoanProvider_allowCrossProviderLoans_df] DEFAULT 0,
    [nplThresholdDays] INT NOT NULL CONSTRAINT [LoanProvider_nplThresholdDays_df] DEFAULT 60,
    CONSTRAINT [LoanProvider_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [LoanProvider_name_key] UNIQUE NONCLUSTERED ([name])
);

-- CreateTable
CREATE TABLE [dbo].[LoanProduct] (
    [id] NVARCHAR(1000) NOT NULL,
    [providerId] NVARCHAR(1000) NOT NULL,
    [name] NVARCHAR(1000) NOT NULL,
    [description] NVARCHAR(1000) NOT NULL,
    [icon] TEXT NOT NULL,
    [minLoan] FLOAT(53) NOT NULL,
    [maxLoan] FLOAT(53) NOT NULL,
    [duration] INT NOT NULL,
    [status] NVARCHAR(1000) NOT NULL,
    [allowConcurrentLoans] BIT NOT NULL CONSTRAINT [LoanProduct_allowConcurrentLoans_df] DEFAULT 0,
    [serviceFee] NVARCHAR(1000) NOT NULL,
    [serviceFeeEnabled] BIT,
    [dailyFee] NVARCHAR(1000) NOT NULL,
    [dailyFeeEnabled] BIT,
    [penaltyRules] NVARCHAR(1000) NOT NULL,
    [penaltyRulesEnabled] BIT,
    [dataProvisioningEnabled] BIT,
    [dataProvisioningConfigId] NVARCHAR(1000),
    CONSTRAINT [LoanProduct_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [LoanProduct_name_providerId_key] UNIQUE NONCLUSTERED ([name],[providerId])
);

-- CreateTable
CREATE TABLE [dbo].[Loan] (
    [id] NVARCHAR(1000) NOT NULL,
    [borrowerId] NVARCHAR(1000) NOT NULL,
    [productId] NVARCHAR(1000) NOT NULL,
    [loanApplicationId] NVARCHAR(1000) NOT NULL,
    [loanAmount] FLOAT(53) NOT NULL,
    [serviceFee] FLOAT(53) NOT NULL,
    [penaltyAmount] FLOAT(53) NOT NULL,
    [disbursedDate] DATETIME2 NOT NULL,
    [dueDate] DATETIME2 NOT NULL,
    [repaymentStatus] NVARCHAR(1000) NOT NULL,
    [repaymentBehavior] NVARCHAR(1000),
    [repaidAmount] FLOAT(53),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [Loan_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [Loan_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [Loan_loanApplicationId_key] UNIQUE NONCLUSTERED ([loanApplicationId])
);

-- CreateTable
CREATE TABLE [dbo].[Payment] (
    [id] NVARCHAR(1000) NOT NULL,
    [loanId] NVARCHAR(1000) NOT NULL,
    [amount] FLOAT(53) NOT NULL,
    [date] DATETIME2 NOT NULL,
    [outstandingBalanceBeforePayment] FLOAT(53),
    [journalEntryId] NVARCHAR(1000),
    CONSTRAINT [Payment_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [Payment_journalEntryId_key] UNIQUE NONCLUSTERED ([journalEntryId])
);

-- CreateTable
CREATE TABLE [dbo].[Borrower] (
    [id] NVARCHAR(1000) NOT NULL,
    [status] NVARCHAR(1000) NOT NULL CONSTRAINT [Borrower_status_df] DEFAULT 'Active',
    CONSTRAINT [Borrower_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[LoanApplication] (
    [id] NVARCHAR(1000) NOT NULL,
    [borrowerId] NVARCHAR(1000) NOT NULL,
    [productId] NVARCHAR(1000) NOT NULL,
    [loanAmount] FLOAT(53),
    [status] NVARCHAR(1000) NOT NULL CONSTRAINT [LoanApplication_status_df] DEFAULT 'PENDING_DOCUMENTS',
    [rejectionReason] TEXT,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [LoanApplication_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [LoanApplication_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[RequiredDocument] (
    [id] NVARCHAR(1000) NOT NULL,
    [productId] NVARCHAR(1000) NOT NULL,
    [name] NVARCHAR(1000) NOT NULL,
    [description] NVARCHAR(1000),
    CONSTRAINT [RequiredDocument_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[UploadedDocument] (
    [id] NVARCHAR(1000) NOT NULL,
    [loanApplicationId] NVARCHAR(1000) NOT NULL,
    [requiredDocumentId] NVARCHAR(1000) NOT NULL,
    [fileName] NVARCHAR(1000) NOT NULL,
    [fileType] NVARCHAR(1000) NOT NULL,
    [fileContent] TEXT NOT NULL,
    [status] NVARCHAR(1000) NOT NULL CONSTRAINT [UploadedDocument_status_df] DEFAULT 'PENDING',
    [reviewedBy] NVARCHAR(1000),
    [reviewedAt] DATETIME2,
    CONSTRAINT [UploadedDocument_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [UploadedDocument_loanApplicationId_requiredDocumentId_key] UNIQUE NONCLUSTERED ([loanApplicationId],[requiredDocumentId])
);

-- CreateTable
CREATE TABLE [dbo].[DataProvisioningConfig] (
    [id] NVARCHAR(1000) NOT NULL,
    [providerId] NVARCHAR(1000) NOT NULL,
    [name] NVARCHAR(1000) NOT NULL,
    [columns] NVARCHAR(1000) NOT NULL,
    CONSTRAINT [DataProvisioningConfig_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[DataProvisioningUpload] (
    [id] NVARCHAR(1000) NOT NULL,
    [configId] NVARCHAR(1000) NOT NULL,
    [fileName] NVARCHAR(1000) NOT NULL,
    [rowCount] INT NOT NULL,
    [uploadedBy] NVARCHAR(1000) NOT NULL,
    [uploadedAt] DATETIME2 NOT NULL CONSTRAINT [DataProvisioningUpload_uploadedAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [DataProvisioningUpload_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[ProvisionedData] (
    [id] NVARCHAR(1000) NOT NULL,
    [borrowerId] NVARCHAR(1000) NOT NULL,
    [configId] NVARCHAR(1000) NOT NULL,
    [uploadId] NVARCHAR(1000),
    [data] NVARCHAR(1000) NOT NULL,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [ProvisionedData_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [ProvisionedData_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [ProvisionedData_borrowerId_configId_key] UNIQUE NONCLUSTERED ([borrowerId],[configId])
);

-- CreateTable
CREATE TABLE [dbo].[ScoringParameter] (
    [id] NVARCHAR(1000) NOT NULL,
    [providerId] NVARCHAR(1000) NOT NULL,
    [name] NVARCHAR(1000) NOT NULL,
    [weight] INT NOT NULL,
    CONSTRAINT [ScoringParameter_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[Rule] (
    [id] NVARCHAR(1000) NOT NULL,
    [parameterId] NVARCHAR(1000) NOT NULL,
    [field] NVARCHAR(1000) NOT NULL,
    [condition] NVARCHAR(1000) NOT NULL,
    [value] NVARCHAR(1000) NOT NULL,
    [score] INT NOT NULL,
    CONSTRAINT [Rule_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[LoanAmountTier] (
    [id] NVARCHAR(1000) NOT NULL,
    [productId] NVARCHAR(1000) NOT NULL,
    [fromScore] INT NOT NULL,
    [toScore] INT NOT NULL,
    [loanAmount] FLOAT(53) NOT NULL,
    CONSTRAINT [LoanAmountTier_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[ScoringConfigurationHistory] (
    [id] NVARCHAR(1000) NOT NULL,
    [providerId] NVARCHAR(1000) NOT NULL,
    [parameters] NVARCHAR(1000) NOT NULL,
    [savedAt] DATETIME2 NOT NULL CONSTRAINT [ScoringConfigurationHistory_savedAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [ScoringConfigurationHistory_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[ScoringConfigurationProduct] (
    [id] NVARCHAR(1000) NOT NULL,
    [configId] NVARCHAR(1000) NOT NULL,
    [productId] NVARCHAR(1000) NOT NULL,
    [assignedAt] DATETIME2 NOT NULL CONSTRAINT [ScoringConfigurationProduct_assignedAt_df] DEFAULT CURRENT_TIMESTAMP,
    [assignedBy] NVARCHAR(1000) NOT NULL,
    CONSTRAINT [ScoringConfigurationProduct_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [ScoringConfigurationProduct_configId_productId_key] UNIQUE NONCLUSTERED ([configId],[productId])
);

-- CreateTable
CREATE TABLE [dbo].[LedgerAccount] (
    [id] NVARCHAR(1000) NOT NULL,
    [providerId] NVARCHAR(1000) NOT NULL,
    [name] NVARCHAR(1000) NOT NULL,
    [type] NVARCHAR(1000) NOT NULL,
    [category] NVARCHAR(1000) NOT NULL,
    [balance] FLOAT(53) NOT NULL CONSTRAINT [LedgerAccount_balance_df] DEFAULT 0,
    CONSTRAINT [LedgerAccount_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [LedgerAccount_providerId_name_key] UNIQUE NONCLUSTERED ([providerId],[name])
);

-- CreateTable
CREATE TABLE [dbo].[JournalEntry] (
    [id] NVARCHAR(1000) NOT NULL,
    [providerId] NVARCHAR(1000) NOT NULL,
    [loanId] NVARCHAR(1000),
    [date] DATETIME2 NOT NULL,
    [description] NVARCHAR(1000) NOT NULL,
    CONSTRAINT [JournalEntry_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[LedgerEntry] (
    [id] NVARCHAR(1000) NOT NULL,
    [journalEntryId] NVARCHAR(1000) NOT NULL,
    [ledgerAccountId] NVARCHAR(1000) NOT NULL,
    [type] NVARCHAR(1000) NOT NULL,
    [amount] FLOAT(53) NOT NULL,
    CONSTRAINT [LedgerEntry_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[TermsAndConditions] (
    [id] NVARCHAR(1000) NOT NULL,
    [providerId] NVARCHAR(1000) NOT NULL,
    [content] TEXT NOT NULL,
    [version] INT NOT NULL,
    [isActive] BIT NOT NULL CONSTRAINT [TermsAndConditions_isActive_df] DEFAULT 0,
    [publishedAt] DATETIME2 NOT NULL,
    CONSTRAINT [TermsAndConditions_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [TermsAndConditions_providerId_version_key] UNIQUE NONCLUSTERED ([providerId],[version])
);

-- CreateTable
CREATE TABLE [dbo].[BorrowerAgreement] (
    [id] NVARCHAR(1000) NOT NULL,
    [borrowerId] NVARCHAR(1000) NOT NULL,
    [termsId] NVARCHAR(1000) NOT NULL,
    [acceptedAt] DATETIME2 NOT NULL CONSTRAINT [BorrowerAgreement_acceptedAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [BorrowerAgreement_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [BorrowerAgreement_borrowerId_termsId_key] UNIQUE NONCLUSTERED ([borrowerId],[termsId])
);

-- CreateTable
CREATE TABLE [dbo].[Tax] (
    [id] NVARCHAR(1000) NOT NULL,
    [name] NVARCHAR(1000),
    [rate] FLOAT(53) NOT NULL CONSTRAINT [Tax_rate_df] DEFAULT 0,
    [appliedTo] NVARCHAR(1000) NOT NULL,
    CONSTRAINT [Tax_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[AuditLog] (
    [id] NVARCHAR(1000) NOT NULL,
    [actorId] NVARCHAR(1000) NOT NULL,
    [action] NVARCHAR(1000) NOT NULL,
    [entity] NVARCHAR(1000),
    [entityId] NVARCHAR(1000),
    [details] TEXT,
    [ipAddress] NVARCHAR(1000),
    [userAgent] TEXT,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [AuditLog_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [AuditLog_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateIndex
CREATE NONCLUSTERED INDEX [AuditLog_actorId_idx] ON [dbo].[AuditLog]([actorId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [AuditLog_action_idx] ON [dbo].[AuditLog]([action]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [AuditLog_entity_entityId_idx] ON [dbo].[AuditLog]([entity], [entityId]);

-- AddForeignKey
ALTER TABLE [dbo].[User] ADD CONSTRAINT [User_roleId_fkey] FOREIGN KEY ([roleId]) REFERENCES [dbo].[Role]([id]) ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[User] ADD CONSTRAINT [User_loanProviderId_fkey] FOREIGN KEY ([loanProviderId]) REFERENCES [dbo].[LoanProvider]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[LoanProduct] ADD CONSTRAINT [LoanProduct_providerId_fkey] FOREIGN KEY ([providerId]) REFERENCES [dbo].[LoanProvider]([id]) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[LoanProduct] ADD CONSTRAINT [LoanProduct_dataProvisioningConfigId_fkey] FOREIGN KEY ([dataProvisioningConfigId]) REFERENCES [dbo].[DataProvisioningConfig]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Loan] ADD CONSTRAINT [Loan_borrowerId_fkey] FOREIGN KEY ([borrowerId]) REFERENCES [dbo].[Borrower]([id]) ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[Loan] ADD CONSTRAINT [Loan_productId_fkey] FOREIGN KEY ([productId]) REFERENCES [dbo].[LoanProduct]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Loan] ADD CONSTRAINT [Loan_loanApplicationId_fkey] FOREIGN KEY ([loanApplicationId]) REFERENCES [dbo].[LoanApplication]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Payment] ADD CONSTRAINT [Payment_loanId_fkey] FOREIGN KEY ([loanId]) REFERENCES [dbo].[Loan]([id]) ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[Payment] ADD CONSTRAINT [Payment_journalEntryId_fkey] FOREIGN KEY ([journalEntryId]) REFERENCES [dbo].[JournalEntry]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[LoanApplication] ADD CONSTRAINT [LoanApplication_borrowerId_fkey] FOREIGN KEY ([borrowerId]) REFERENCES [dbo].[Borrower]([id]) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[LoanApplication] ADD CONSTRAINT [LoanApplication_productId_fkey] FOREIGN KEY ([productId]) REFERENCES [dbo].[LoanProduct]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[RequiredDocument] ADD CONSTRAINT [RequiredDocument_productId_fkey] FOREIGN KEY ([productId]) REFERENCES [dbo].[LoanProduct]([id]) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[UploadedDocument] ADD CONSTRAINT [UploadedDocument_loanApplicationId_fkey] FOREIGN KEY ([loanApplicationId]) REFERENCES [dbo].[LoanApplication]([id]) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[UploadedDocument] ADD CONSTRAINT [UploadedDocument_requiredDocumentId_fkey] FOREIGN KEY ([requiredDocumentId]) REFERENCES [dbo].[RequiredDocument]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[DataProvisioningConfig] ADD CONSTRAINT [DataProvisioningConfig_providerId_fkey] FOREIGN KEY ([providerId]) REFERENCES [dbo].[LoanProvider]([id]) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[DataProvisioningUpload] ADD CONSTRAINT [DataProvisioningUpload_configId_fkey] FOREIGN KEY ([configId]) REFERENCES [dbo].[DataProvisioningConfig]([id]) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[ProvisionedData] ADD CONSTRAINT [ProvisionedData_borrowerId_fkey] FOREIGN KEY ([borrowerId]) REFERENCES [dbo].[Borrower]([id]) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[ProvisionedData] ADD CONSTRAINT [ProvisionedData_configId_fkey] FOREIGN KEY ([configId]) REFERENCES [dbo].[DataProvisioningConfig]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[ProvisionedData] ADD CONSTRAINT [ProvisionedData_uploadId_fkey] FOREIGN KEY ([uploadId]) REFERENCES [dbo].[DataProvisioningUpload]([id]) ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[ScoringParameter] ADD CONSTRAINT [ScoringParameter_providerId_fkey] FOREIGN KEY ([providerId]) REFERENCES [dbo].[LoanProvider]([id]) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[Rule] ADD CONSTRAINT [Rule_parameterId_fkey] FOREIGN KEY ([parameterId]) REFERENCES [dbo].[ScoringParameter]([id]) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[LoanAmountTier] ADD CONSTRAINT [LoanAmountTier_productId_fkey] FOREIGN KEY ([productId]) REFERENCES [dbo].[LoanProduct]([id]) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[ScoringConfigurationHistory] ADD CONSTRAINT [ScoringConfigurationHistory_providerId_fkey] FOREIGN KEY ([providerId]) REFERENCES [dbo].[LoanProvider]([id]) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[ScoringConfigurationProduct] ADD CONSTRAINT [ScoringConfigurationProduct_configId_fkey] FOREIGN KEY ([configId]) REFERENCES [dbo].[ScoringConfigurationHistory]([id]) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[ScoringConfigurationProduct] ADD CONSTRAINT [ScoringConfigurationProduct_productId_fkey] FOREIGN KEY ([productId]) REFERENCES [dbo].[LoanProduct]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[LedgerAccount] ADD CONSTRAINT [LedgerAccount_providerId_fkey] FOREIGN KEY ([providerId]) REFERENCES [dbo].[LoanProvider]([id]) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[JournalEntry] ADD CONSTRAINT [JournalEntry_providerId_fkey] FOREIGN KEY ([providerId]) REFERENCES [dbo].[LoanProvider]([id]) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[JournalEntry] ADD CONSTRAINT [JournalEntry_loanId_fkey] FOREIGN KEY ([loanId]) REFERENCES [dbo].[Loan]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[LedgerEntry] ADD CONSTRAINT [LedgerEntry_journalEntryId_fkey] FOREIGN KEY ([journalEntryId]) REFERENCES [dbo].[JournalEntry]([id]) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[LedgerEntry] ADD CONSTRAINT [LedgerEntry_ledgerAccountId_fkey] FOREIGN KEY ([ledgerAccountId]) REFERENCES [dbo].[LedgerAccount]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[TermsAndConditions] ADD CONSTRAINT [TermsAndConditions_providerId_fkey] FOREIGN KEY ([providerId]) REFERENCES [dbo].[LoanProvider]([id]) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[BorrowerAgreement] ADD CONSTRAINT [BorrowerAgreement_borrowerId_fkey] FOREIGN KEY ([borrowerId]) REFERENCES [dbo].[Borrower]([id]) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[BorrowerAgreement] ADD CONSTRAINT [BorrowerAgreement_termsId_fkey] FOREIGN KEY ([termsId]) REFERENCES [dbo].[TermsAndConditions]([id]) ON DELETE CASCADE ON UPDATE CASCADE;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
