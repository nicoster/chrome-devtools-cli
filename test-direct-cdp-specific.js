const WebSocket = require('ws');

async function testDirectCDPSpecific() {
  const wsUrl = 'ws://localhost:9222/devtools/page/3CA8214855BF261C8D7A130C9F8D4DD9';
  console.log('Connecting to:', wsUrl);
  
  const ws = new WebSocket(wsUrl);
  
  ws.on('open', () => {
    console.log('WebSocket connected');
    
    // Send Runtime.enable command first
    const enableCommand = {
      id: 1,
      method: 'Runtime.enable',
      params: {}
    };
    
    console.log('Sending Runtime.enable...');
    ws.send(JSON.stringify(enableCommand));
    
    // Send Runtime.evaluate command after a delay
    setTimeout(() => {
      const evalCommand = {
        id: 2,
        method: 'Runtime.evaluate',
        params: {
          expression: 'console.log("Direct CDP test"); "direct-test-result"'
        }
      };
      
      console.log('Sending Runtime.evaluate...');
      ws.send(JSON.stringify(evalCommand));
    }, 1000);
    
    // Set timeout
    setTimeout(() => {
      console.log('Timeout - closing connection');
      ws.close();
    }, 10000);
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
}

testDirectCDPSpecific();