#!/usr/bin/env ts-node

import { CDPClient } from './src/client/CDPClient';
import { EvaluateScriptHandler } from './src/handlers/EvaluateScriptHandler';

/**
 * Demo script to test JavaScript execution via Chrome DevTools Protocol
 */
async function demo() {
  const client = new CDPClient();
  const handler = new EvaluateScriptHandler();

  try {
    console.log('🚀 Chrome DevTools CLI Demo');
    console.log('============================');
    
    // Connect to Chrome (make sure Chrome is running with --remote-debugging-port=9222)
    console.log('📡 Connecting to Chrome...');
    await client.connect('localhost', 9222);
    console.log('✅ Connected successfully!');

    // Enable Runtime domain
    console.log('🔧 Enabling Runtime domain...');
    await client.send('Runtime.enable');
    console.log('✅ Runtime domain enabled!');

    // Test 1: Simple arithmetic
    console.log('\n📝 Test 1: Simple arithmetic');
    const result1 = await handler.execute(client, {
      expression: '2 + 2'
    });
    console.log('Result:', result1);

    // Test 2: String manipulation
    console.log('\n📝 Test 2: String manipulation');
    const result2 = await handler.execute(client, {
      expression: '"Hello, " + "Chrome DevTools CLI!"'
    });
    console.log('Result:', result2);

    // Test 3: Current page info
    console.log('\n📝 Test 3: Current page info');
    const result3 = await handler.execute(client, {
      expression: 'window.location.href'
    });
    console.log('Result:', result3);

    // Test 4: DOM manipulation
    console.log('\n📝 Test 4: DOM query');
    const result4 = await handler.execute(client, {
      expression: 'document.title'
    });
    console.log('Result:', result4);

    // Test 5: Async operation
    console.log('\n📝 Test 5: Async operation');
    const result5 = await handler.execute(client, {
      expression: 'Promise.resolve("Async result!")',
      awaitPromise: true
    });
    console.log('Result:', result5);

    // Test 6: Error handling
    console.log('\n📝 Test 6: Error handling');
    const result6 = await handler.execute(client, {
      expression: 'nonExistentVariable'
    });
    console.log('Result:', result6);

    console.log('\n🎉 Demo completed successfully!');

  } catch (error) {
    console.error('❌ Demo failed:', error);
    console.log('\n💡 Make sure Chrome is running with: chrome --remote-debugging-port=9222');
  } finally {
    await client.disconnect();
    console.log('👋 Disconnected from Chrome');
  }
}

// Run the demo
if (require.main === module) {
  demo().catch(console.error);
}

export { demo };