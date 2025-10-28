
# LoanFlow - Micro-Credit Platform

This application is a multi-provider micro-credit platform built with Next.js, Prisma, and Tailwind CSS. It provides a comprehensive solution for managing the entire loan lifecycle, from provider configuration to borrower application and repayment.

## Key Features

*   **Admin & Borrower Interfaces**: The app has a secure admin dashboard for management and a separate, simplified flow for borrowers to apply for loans.

*   **Multi-Provider & Product Management**: Administrators can create and configure multiple loan providers (e.g., different banks) and define various loan products for each, such as personal loans with unique rules, fees, and interest rates.

*   **Dynamic Credit Scoring Engine**: Each provider can build their own credit scoring model using a powerful rules engine. This allows them to weigh different data points (like income or employment status from uploaded data) to automatically determine a borrower's eligibility and maximum loan amount.

*   **End-to-End Loan Lifecycle**: Borrowers can check their eligibility, apply for a loan, and receive funds. The system tracks the entire lifecycle, including disbursement, daily fee accrual, penalties, repayments, and overdue statuses.

*   **Automated Backend Processes**: The application includes backend services for processing automated loan repayments from borrower accounts and for identifying and flagging Non-Performing Loans (NPLs) based on configurable rules.

*   **Comprehensive Reporting & Auditing**: Admins have access to a detailed reporting suite to monitor key metrics like portfolio health, collections, income, and fund utilization. All critical actions are logged for compliance and security.

*   **Role-Based Access Control**: The platform features a robust access control system, allowing administrators to define granular roles and permissions for different user types.

## The Loan Process

The loan lifecycle follows a clear, structured path from initial eligibility check to final repayment.

1.  **Eligibility Check**: A borrower's journey begins by selecting their profile from a list of provisioned customer data. The system then automatically runs an eligibility check for each available loan provider, calculating the borrower's credit score based on the provider's unique rules and determining their maximum loan limit.

2.  **Product Selection**: The borrower is presented with a dashboard showing available loan products from different providers. They can see their specific credit limit for each product and choose the one that best suits their needs.

3.  **Application & Calculation**:
    *   **Personal Loans**: After selecting a product, the borrower is taken to a calculator where they can enter their desired loan amount. The system instantly calculates the total repayable amount, including any service fees.
    *   **SME Loans**: For SME products, the borrower is directed to a document upload portal. They must submit all required documents (defined by the admin) before the application can proceed.

4.  **Approval Workflow (SME Loans)**: Once all documents are submitted, the application enters a "Pending Approval" state. An admin or loan officer reviews the application and the uploaded documents. They can then approve or reject the application.

5.  **Disbursement**:
    *   **Personal Loans**: Upon accepting the terms in the calculator, the loan is disbursed immediately.
    *   **SME Loans**: After an application is approved, the loan becomes "Ready for Disbursement" and can be triggered by an admin.
    
    Upon disbursement, the backend records the transaction, creates the necessary ledger entries for accounting, and decrements the provider's available capital. The disbursed `Loan` is linked to its originating `LoanApplication` via the `loanApplicationId`.

6.  **Loan Monitoring**: The system automatically tracks the loan's status. Daily fees are accrued based on the product's rules. If the loan becomes overdue, penalties are applied according to the configured penalty tiers.

7.  **Repayment**: The borrower can make repayments at any time. The system prioritizes payments, settling any outstanding penalties and fees before applying the remainder to the principal.

8.  **Automated Services**:
    *   **Automated Repayment**: A background service runs periodically to attempt to deduct payments for overdue loans from the borrower's account (simulated via provisioned data).
    *   **NPL Flagging**: Another service identifies loans that have been overdue for a configurable period (e.g., 60 days) and flags the borrower's account as a Non-Performing Loan (NPL), restricting them from taking new loans.

## The `loanApplicationId`

The `loanApplicationId` is the key that connects the entire loan lifecycle. It serves as a container for the application process, linking the initial request, all uploaded documents (for SME loans), the approval status, and the final disbursed `Loan` record. This ensures a complete and auditable trail for every loan in the system from start to finish.
