#!/usr/bin/env node

import { CLIApplication } from './cli/CLIApplication';

// Export all modules
export * from './types';
export * from './interfaces';
export * from './utils';
export * from './connection';
export * from './handlers';
export * from './cli';

/**
 * Main entry point for Chrome DevTools CLI
 */
async function main(): Promise<void> {
  const app = new CLIApplication();
  
  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\nShutting down...');
    await app.shutdown();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    await app.shutdown();
    process.exit(0);
  });

  // Run the application
  const exitCode = await app.run(process.argv);
  process.exit(exitCode);
}

// Run main if executed directly
if (require.main === module) {
  main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}