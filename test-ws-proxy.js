const WebSocket = require('ws');

async function testWebSocketProxy() {
  const connectionId = 'conn_1766409701317_folzge8ze';
  const wsUrl = `ws://localhost:9223/ws?connectionId=${connectionId}`;
  
  console.log('Connecting to WebSocket proxy:', wsUrl);
  
  const ws = new WebSocket(wsUrl);
  
  ws.on('open', () => {
    console.log('WebSocket connected');
    
    // Send a Runtime.evaluate command
    const command = {
      id: 1,
      method: 'Runtime.evaluate',
      params: {
        expression: 'console.log("Message from WebSocket proxy!"); console.warn("Warning from proxy!"); "WebSocket test complete"'
      }
    };
    
    console.log('Sending command:', command);
    ws.send(JSON.stringify(command));
  });
  
  ws.on('message', (data) => {
    console.log('Received:', data.toString());
  });
  
  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
  });
  
  ws.on('close', () => {
    console.log('WebSocket closed');
  });
  
  // Keep the connection open for a few seconds
  setTimeout(() => {
    ws.close();
  }, 5000);
}

testWebSocketProxy();