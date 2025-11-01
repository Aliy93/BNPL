
# LoanFlow - Buy Now, Pay Later (BNPL) Platform

This application is a multi-provider **Buy Now, Pay Later (BNPL)** platform built with Next.js, Prisma, and Tailwind CSS. It provides a comprehensive solution for managing the entire financing lifecycle, from merchant onboarding and customer checkout to installment repayments and merchant settlements.

## Key Features

*   **Merchant, Admin, & Customer Interfaces**: The app provides a secure admin dashboard for platform management, a portal for merchants to track sales and settlements, and a seamless checkout experience for customers.

*   **Multi-Financing Partner & Plan Management**: Administrators can configure multiple financing partners and define various payment plan products for each, setting rules for installments, fees, and interest.

*   **Dynamic Credit Scoring Engine**: Each financing partner can build their own credit scoring model using a powerful rules engine. This allows them to weigh different data points to automatically determine a customer's eligibility and spending limit at the point of sale.

*   **End-to-End BNPL Lifecycle**: Customers can select "Pay with LoanFlow" at a partner merchant's checkout, receive instant approval, and complete their purchase. The system tracks the entire lifecycle, including order creation, merchant settlement, installment billing, penalties, and repayments.

*   **Automated Backend Processes**: The application includes backend services for processing automated installment payments from customer accounts and for identifying and flagging Non-Performing accounts based on configurable rules.

*   **Comprehensive Reporting & Auditing**: Admins have access to a detailed reporting suite to monitor key metrics like sales volume, collections, income, and merchant performance. All critical actions are logged for compliance and security.

*   **Role-Based Access Control**: The platform features a robust access control system, allowing administrators to define granular roles and permissions for different user types.

## The BNPL Process

The purchase and repayment lifecycle follows a clear, structured path from checkout to final payment.

1.  **Checkout & Eligibility Check**: A customer's journey begins at a partner merchant's checkout. When they select "Pay with LoanFlow," the system automatically runs a real-time eligibility check for each available financing partner, calculating the customer's credit score and determining their available spending limit.

2.  **Plan Selection**: The customer is presented with available installment plans (e.g., "Pay in 4 interest-free installments").

3.  **Order Confirmation**: Upon accepting the terms, the order is confirmed. The platform creates an `Order` record and an associated `InstallmentPlan`.

4.  **Merchant Settlement**: The platform settles the transaction amount with the merchant according to the agreed-upon terms (e.g., instantly or batched daily). The system decrements the financing partner's available capital.

5.  **Installment Monitoring**: The system automatically tracks the `InstallmentPlan`. If a payment is missed, penalties are applied according to the configured penalty tiers.

6.  **Repayment**: The customer makes repayments on their scheduled due dates. The system prioritizes payments, settling any outstanding penalties and fees before applying the remainder to the principal.

7.  **Automated Services**:
    *   **Automated Repayment**: A background service runs periodically to attempt to deduct payments for due installments from the customer's account.
    *   **NPL Flagging**: Another service identifies customers with long-overdue installments (e.g., 60 days) and flags their account as Non-Performing, restricting them from making new purchases.
