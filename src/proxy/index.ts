/**
 * Persistent Connection Proxy Server Entry Point
 * 
 * This is the main entry point for the proxy server that maintains
 * persistent CDP connections and accumulates console messages/network requests.
 */

import { CDPProxyServer } from './server/CDPProxyServer';
import { ProxyServerConfig } from './types/ProxyTypes';
import { Logger } from '../utils/logger';

const logger = new Logger();

/**
 * Start the proxy server with optional configuration
 */
async function startProxyServer(config?: Partial<ProxyServerConfig>): Promise<CDPProxyServer> {
  const server = new CDPProxyServer();
  
  try {
    await server.start(config);
    logger.info('Proxy server started successfully');
    return server;
  } catch (error) {
    logger.error('Failed to start proxy server:', error);
    throw error;
  }
}

/**
 * Main function for standalone proxy server execution
 */
async function main(): Promise<void> {
  // Check if running as standalone process
  if (require.main === module) {
    try {
      const server = await startProxyServer();
      
      // Handle graceful shutdown
      process.on('SIGINT', async () => {
        logger.info('Received SIGINT, shutting down gracefully...');
        await server.stop();
        process.exit(0);
      });
      
      process.on('SIGTERM', async () => {
        logger.info('Received SIGTERM, shutting down gracefully...');
        await server.stop();
        process.exit(0);
      });
      
    } catch (error) {
      logger.error('Proxy server failed to start:', error);
      process.exit(1);
    }
  }
}

// Export for programmatic usage
export { CDPProxyServer, startProxyServer };
export * from './types/ProxyTypes';

// Run main if executed directly
main().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
});