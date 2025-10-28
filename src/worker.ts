
'use server';
/**
 * @fileOverview Standalone worker process for running background tasks.
 * This script is intended to be executed by a scheduler (e.g., cron) or run as a long-running service.
 *
 * Usage:
 * To run a one-off task (like NPL check):
 * npm run run:worker -- npl
 *
 * To start the continuous repayment service:
 * npm run run:worker -- repayment-service
 */

import { processAutomatedRepayments } from './actions/repayment';
import { updateNplStatus } from './actions/npl';

const REPAYMENT_INTERVAL_MS = 60 * 60 * 1000; // 1 hour

async function runRepaymentServiceLoop() {
    console.log(`[${new Date().toISOString()}] Automated repayment service started. Will run every ${REPAYMENT_INTERVAL_MS / 1000 / 60} minutes.`);
    while (true) {
        try {
            console.log(`[${new Date().toISOString()}] Starting automated repayment cycle...`);
            await processAutomatedRepayments();
            console.log(`[${new Date().toISOString()}] Repayment cycle finished successfully.`);
        } catch (error) {
            console.error(`[${new Date().toISOString()}] An error occurred during the repayment cycle:`, error);
        }
        console.log(`[${new Date().toISOString()}] Waiting for next cycle...`);
        await new Promise(resolve => setTimeout(resolve, REPAYMENT_INTERVAL_MS));
    }
}


async function main() {
  const task = process.argv[2];

  if (!task) {
    console.error('Error: No task specified.');
    console.log('Usage: npm run run:worker -- <task-name>');
    console.log('Available tasks: repayment-service, npl');
    process.exit(1);
  }

  console.log(`[${new Date().toISOString()}] Starting worker for task: ${task}`);

  try {
    switch (task) {
      case 'repayment-service':
        // This is a long-running service, it will not exit on its own.
        await runRepaymentServiceLoop();
        break;
      case 'npl':
        // This is a one-off task.
        await updateNplStatus();
        console.log(`[${new Date().toISOString()}] Finished task: ${task} successfully.`);
        process.exit(0);
        break;
      default:
        console.error(`Error: Unknown task "${task}".`);
        process.exit(1);
    }
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Error executing task "${task}":`, error);
    process.exit(1);
  }
}

main();
