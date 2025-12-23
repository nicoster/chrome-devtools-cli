const WebSocket = require('ws');

async function testProxyHealth() {
  // First, let's check if the proxy server is running
  try {
    const response = await fetch('http://localhost:9223/api/connections');
    const data = await response.json();
    console.log('Proxy server status:', data);
    
    if (data.data.connections && data.data.connections.length > 0) {
      const connection = data.data.connections[0];
      console.log('Found connection:', connection.id);
      
      // Test WebSocket connection to this connection
      const wsUrl = `ws://localhost:9223/ws?connectionId=${connection.id}`;
      console.log('Connecting to:', wsUrl);
      
      const ws = new WebSocket(wsUrl);
      
      ws.on('open', () => {
        console.log('WebSocket connected to proxy');
        
        // Send a simple Runtime.evaluate command
        const command = {
          id: 1,
          method: 'Runtime.evaluate',
          params: {
            expression: 'console.log("Test from proxy health check"); "proxy-test-result"'
          }
        };
        
        console.log('Sending command:', command);
        ws.send(JSON.stringify(command));
      });
      
      ws.on('message', (data) => {
        console.log('Received from proxy:', data.toString());
      });
      
      ws.on('error', (error) => {
        console.error('WebSocket error:', error);
      });
      
      ws.on('close', () => {
        console.log('WebSocket closed');
      });
      
      // Keep connection open for a few seconds
      setTimeout(() => {
        ws.close();
      }, 10000);
    } else {
      console.log('No connections found in proxy');
    }
  } catch (error) {
    console.error('Error testing proxy:', error);
  }
}

testProxyHealth();