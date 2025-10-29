
# LoanFlow - Buy Now, Pay Later (BNPL) Platform

This application is a multi-provider Buy Now, Pay Later (BNPL) platform built with Next.js, Prisma, and Tailwind CSS. It provides a comprehensive solution for managing the entire financing lifecycle, from merchant onboarding and provider configuration to customer checkout and installment repayments.

## Key Features

*   **Merchant, Admin, & Customer Interfaces**: The app has a secure admin dashboard for management, a portal for merchants to track sales and settlements, and a seamless checkout flow for customers.

*   **Multi-Provider & Plan Management**: Administrators can configure multiple financing providers (e.g., different banks) and define various payment plans for each, such as "Pay in 4" or "Pay in 30 days," with unique rules and fees.

*   **Dynamic Credit Scoring Engine**: Each provider can build their own credit scoring model using a powerful rules engine. This allows them to weigh different data points (like income or purchase history) to automatically determine a customer's eligibility and spending limit at the point of sale.

*   **End-to-End Purchase Lifecycle**: Customers can select the BNPL option at a partner merchant's checkout, receive instant approval, and complete their purchase. The system tracks the entire lifecycle, including order creation, merchant settlement, daily fee accrual (if any), repayments, and overdue statuses.

*   **Automated Backend Processes**: The application includes backend services for processing automated installment repayments from customer accounts and for identifying and flagging accounts in default (Non-Performing Loans).

*   **Comprehensive Reporting & Auditing**: Admins have access to a detailed reporting suite to monitor key metrics like sales volume, portfolio health, collections, and income. All critical actions are logged for compliance and security.

*   **Role-Based Access Control**: The platform features a robust access control system, allowing administrators to define granular roles and permissions for different user types, including merchant-specific roles.

## The BNPL Process

The financing lifecycle follows a clear path from a customer's checkout to their final repayment.

1.  **Checkout & Eligibility Check**: A customer's journey begins at a partner merchant's checkout. When they select "Pay with LoanFlow," the system automatically runs an eligibility check for each available financing provider, calculating the customer's credit score and determining their available spending limit for that transaction.

2.  **Plan Selection**: The customer is presented with available installment plans (e.g., "4 interest-free payments of $25"). They choose the plan that best suits their needs.

3.  **Order Confirmation**: Upon selecting a plan, the customer confirms the purchase. In the background, the system creates an `Order` record and an `InstallmentPlan` (which replaces the old `Loan` model).

4.  **Merchant Settlement**: The platform settles the transaction with the merchant, transferring the full purchase amount minus any agreed-upon merchant fees. This happens independently of the customer's repayment schedule.

5.  **Installment Monitoring**: The system automatically tracks the customer's repayment schedule. If an installment becomes overdue, penalties are applied according to the configured penalty tiers for the chosen plan.

6.  **Repayment**: The customer makes repayments according to their installment schedule. The system prioritizes payments, settling any outstanding penalties and fees before applying the remainder to the principal.

7.  **Automated Services**:
    *   **Automated Repayment**: A background service runs periodically to attempt to deduct payments for due installments from the customer's account.
    *   **NPL Flagging**: Another service identifies customers who have been overdue for a configurable period (e.g., 60 days) and flags their account as a Non-Performing Loan (NPL), restricting them from making new purchases.

## The `OrderId`

The `OrderId` is the key that connects the entire BNPL lifecycle. It serves as a container for the purchase, linking the merchant, the items bought, the customer, the approval status, and the final `InstallmentPlan` record. This ensures a complete and auditable trail for every financed purchase in the system.
