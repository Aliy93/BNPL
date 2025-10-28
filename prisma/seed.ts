
import { PrismaClient, Prisma } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { addDays } from 'date-fns';

const prisma = new PrismaClient();

const permissions = {
  superAdmin: {
    dashboard: { create: true, read: true, update: true, delete: true },
    reports: { create: true, read: true, update: true, delete: true },
    'access-control': { create: true, read: true, update: true, delete: true },
    'scoring-engine': { create: true, read: true, update: true, delete: true },
    settings: { create: true, read: true, update: true, delete: true },
    products: { create: true, read: true, update: true, delete: true },
    tax: { create: true, read: true, update: true, delete: true },
  },
  loanProvider: {
    dashboard: { create: false, read: true, update: false, delete: false },
    reports: { create: true, read: true, update: false, delete: false },
    'access-control': { create: false, read: false, update: false, delete: false },
    'scoring-engine': { create: false, read: true, update: true, delete: false },
    settings: { create: false, read: true, update: true, delete: false },
    products: { create: true, read: true, update: true, delete: true },
    tax: { create: false, read: true, update: false, delete: false },
  },
   reconciliation: {
    dashboard: { create: false, read: true, update: false, delete: false },
    reports: { create: false, read: true, update: false, delete: false },
    'access-control': { create: false, read: false, update: false, delete: false },
    'scoring-engine': { create: false, read: false, update: false, delete: false },
    settings: { create: false, read: false, update: false, delete: false },
    products: { create: false, read: false, update: false, delete: false },
    tax: { create: false, read: true, update: false, delete: false },
  }
};

const defaultLedgerAccounts = [
    // Assets (Receivables)
    { name: 'Principal Receivable', type: 'Receivable', category: 'Principal' },
    { name: 'Interest Receivable', type: 'Receivable', category: 'Interest' },
    { name: 'Service Fee Receivable', type: 'Receivable', category: 'ServiceFee' },
    { name: 'Penalty Receivable', type: 'Receivable', category: 'Penalty' },
    { name: 'Tax Receivable', type: 'Receivable', category: 'Tax' },
    // Cash / Received
    { name: 'Principal Received', type: 'Received', category: 'Principal' },
    { name: 'Interest Received', type: 'Received', category: 'Interest' },
    { name: 'Service Fee Received', type: 'Received', category: 'ServiceFee' },
    { name: 'Penalty Received', type: 'Received', category: 'Penalty' },
    { name: 'Tax Received', type: 'Received', category: 'Tax' },
    // Income
    { name: 'Interest Income', type: 'Income', category: 'Interest' },
    { name: 'Service Fee Income', type: 'Income', category: 'ServiceFee' },
    { name: 'Penalty Income', type: 'Income', category: 'Penalty' },
];

async function main() {
  console.log('Start seeding...');

  // Seed Roles
  const superAdminRole = await prisma.role.upsert({
    where: { name: 'Super Admin' },
    update: {
      permissions: JSON.stringify(permissions.superAdmin),
    },
    create: {
      name: 'Super Admin',
      permissions: JSON.stringify(permissions.superAdmin),
    },
  });

  const loanProviderRole = await prisma.role.upsert({
    where: { name: 'Loan Provider' },
    update: {
       permissions: JSON.stringify(permissions.loanProvider),
    },
    create: {
      name: 'Loan Provider',
      permissions: JSON.stringify(permissions.loanProvider),
    },
  });

  const reconciliationRole = await prisma.role.upsert({
    where: { name: 'Reconciliation' },
    update: {
      permissions: JSON.stringify(permissions.reconciliation),
    },
    create: {
      name: 'Reconciliation',
      permissions: JSON.stringify(permissions.reconciliation),
    },
  });

  console.log('Roles seeded.');

  // Seed User
  const hashedPassword = await bcrypt.hash('password123', 10);
  await prisma.user.upsert({
    where: { email: 'admin@example.com' },
    update: {},
    create: {
      fullName: 'Super Admin',
      email: 'admin@example.com',
      phoneNumber: '0900000000',
      password: hashedPassword,
      status: 'Active',
      role: {
        connect: {
          id: superAdminRole.id,
        }
      }
    },
  });
  console.log('Admin user seeded.');

  // Seed Loan Provider and Products
  const nibBank = await prisma.loanProvider.upsert({
    where: { name: 'NIb Bank' },
    update: {},
    create: {
      name: 'NIb Bank',
      icon: 'Landmark',
      colorHex: '#fdb913',
      displayOrder: 1,
      accountNumber: '1000123456789',
      startingCapital: 1000000,
      initialBalance: 1000000,
      allowCrossProviderLoans: false,
      nplThresholdDays: 60,
    },
  });
  
  // Seed Ledger Accounts for NIb Bank
  const nibExistingAccounts = await prisma.ledgerAccount.count({ where: { providerId: nibBank.id } });
  if (nibExistingAccounts === 0) {
      await prisma.ledgerAccount.createMany({
          data: defaultLedgerAccounts.map(acc => ({
              ...acc,
              providerId: nibBank.id,
          }))
      });
      console.log('Ledger accounts for NIb Bank seeded.');
  }

  let personalLoan = await prisma.loanProduct.findFirst({
      where: { name: 'Personal Loan', providerId: nibBank.id }
  });

  if (!personalLoan) {
      personalLoan = await prisma.loanProduct.create({
          data: {
              providerId: nibBank.id,
              name: 'Personal Loan',
              description: 'A personal loan for your everyday needs.',
              icon: 'PersonStanding',
              minLoan: 500,
              maxLoan: 50000,
              duration: 30,
              status: 'Active',
              allowConcurrentLoans: false,
              serviceFeeEnabled: true,
              serviceFee: JSON.stringify({ type: 'percentage', value: 2 }), // 2% service fee
              dailyFeeEnabled: true,
              dailyFee: JSON.stringify({ type: 'percentage', value: 0.1, calculationBase: 'principal' }), // This enables daily fee
              penaltyRulesEnabled: true,
              penaltyRules: JSON.stringify([
                { id: 'p1', fromDay: 1, toDay: 15, type: 'fixed', value: 50, frequency: 'daily' },
                { id: 'p2', fromDay: 16, toDay: null, type: 'percentageOfPrincipal', value: 0.5, frequency: 'daily' },
              ]),
              dataProvisioningEnabled: false,
          }
      });
  }
  
  const nibLoanTiers = await prisma.loanAmountTier.count({ where: { productId: personalLoan.id } });
  if (nibLoanTiers === 0) {
    await prisma.loanAmountTier.createMany({
        data: [
            { productId: personalLoan.id, fromScore: 0, toScore: 300, loanAmount: 1000 },
            { productId: personalLoan.id, fromScore: 301, toScore: 500, loanAmount: 5000 },
            { productId: personalLoan.id, fromScore: 501, toScore: 700, loanAmount: 25000 },
            { productId: personalLoan.id, fromScore: 701, toScore: 1000, loanAmount: 50000 },
        ]
    });
  }

  // Seed Second Provider: Abyssinia Bank
  const abyssiniaBank = await prisma.loanProvider.upsert({
    where: { name: 'Abyssinia Bank' },
    update: {},
    create: {
      name: 'Abyssinia Bank',
      icon: 'Building2',
      colorHex: '#8a2be2',
      displayOrder: 2,
      accountNumber: '2000987654321',
      startingCapital: 500000,
      initialBalance: 500000,
      allowCrossProviderLoans: true,
      nplThresholdDays: 90,
    },
  });

  const abbyExistingAccounts = await prisma.ledgerAccount.count({ where: { providerId: abyssiniaBank.id } });
  if (abbyExistingAccounts === 0) {
      await prisma.ledgerAccount.createMany({
          data: defaultLedgerAccounts.map(acc => ({
              ...acc,
              providerId: abyssiniaBank.id,
          }))
      });
      console.log('Ledger accounts for Abyssinia Bank seeded.');
  }

  let mortgageLoan = await prisma.loanProduct.findFirst({
      where: { name: 'Mortgage Loan', providerId: abyssiniaBank.id }
  });

  if (!mortgageLoan) {
      mortgageLoan = await prisma.loanProduct.create({
          data: {
              providerId: abyssiniaBank.id,
              name: 'Mortgage Loan',
              description: 'Loan for purchasing property.',
              icon: 'Home',
              minLoan: 100000,
              maxLoan: 2000000,
              duration: 365,
              status: 'Active',
              allowConcurrentLoans: false,
              serviceFeeEnabled: true,
              serviceFee: JSON.stringify({ type: 'fixed', value: 5000 }),
              dailyFeeEnabled: true,
              dailyFee: JSON.stringify({ type: 'percentage', value: 0.05, calculationBase: 'principal' }),
              penaltyRulesEnabled: false,
              penaltyRules: JSON.stringify([]),
              dataProvisioningEnabled: false,
          }
      });
  }

  console.log('Loan Providers and Products seeded.');

  // Seed a test borrower
  const testBorrower = await prisma.borrower.upsert({
      where: { id: 'borrower-123' },
      update: {},
      create: { id: 'borrower-123' },
  });

  // Seed a Data Provisioning Config for NIb
  // First, try to find an existing config with the same name for this provider.
  let dataConfig = await prisma.dataProvisioningConfig.findFirst({
      where: { providerId: nibBank.id, name: 'Credit Score Data' },
  });

  if (!dataConfig) {
      dataConfig = await prisma.dataProvisioningConfig.create({
          data: {
              providerId: nibBank.id,
              name: 'Credit Score Data',
              columns: JSON.stringify([
                  { id: 'c1', name: 'id', type: 'string', isIdentifier: true },
                  { id: 'c2', name: 'Full Name', type: 'string', isIdentifier: false },
                  { id: 'c3', name: 'Monthly Income', type: 'number', isIdentifier: false },
                  { id: 'c4', name: 'Employment Status', type: 'string', isIdentifier: false },
              ])
          }
      });
  }


  // Seed provisioned data for the test borrower
  await prisma.provisionedData.upsert({
      where: { borrowerId_configId: { borrowerId: testBorrower.id, configId: dataConfig.id } },
      update: {
        data: JSON.stringify({
            id: 'borrower-123',
            'Full Name': 'Test Borrower',
            'Monthly Income': 15000,
            'Employment Status': 'Employed'
        })
      },
      create: {
          borrowerId: testBorrower.id,
          configId: dataConfig.id,
          data: JSON.stringify({
            id: 'borrower-123',
            'Full Name': 'Test Borrower',
            'Monthly Income': 15000,
            'Employment Status': 'Employed'
          })
      }
  });
  console.log('Test borrower and provisioned data seeded.');

  // Seed an existing loan for the test borrower to test repayment
  const existingLoan = await prisma.loan.findFirst({ where: { borrowerId: testBorrower.id, productId: personalLoan.id }});
  if (!existingLoan) {
    const loanAmount = 5000;
    const serviceFeePercent = 2;
    const serviceFeeAmount = loanAmount * (serviceFeePercent / 100);
    const disbursedDate = new Date();
    const dueDate = addDays(disbursedDate, 30);

    const testApplication = await prisma.loanApplication.create({
        data: {
            borrowerId: testBorrower.id,
            productId: personalLoan.id,
            loanAmount: loanAmount,
            status: 'DISBURSED'
        }
    });
    
    await prisma.loan.create({
        data: {
            borrowerId: testBorrower.id,
            productId: personalLoan.id,
            loanApplicationId: testApplication.id,
            loanAmount: loanAmount,
            serviceFee: serviceFeeAmount,
            penaltyAmount: 0,
            disbursedDate: disbursedDate,
            dueDate: dueDate,
            repaymentStatus: 'Unpaid',
            repaidAmount: 0,
        }
    });
    
    // Decrement the provider's balance
    await prisma.loanProvider.update({
      where: { id: nibBank.id },
      data: { initialBalance: { decrement: loanAmount } }
    });

    console.log(`Created test loan for ${testBorrower.id} with a service fee and daily fee.`);
  }


  console.log('Seeding finished.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
