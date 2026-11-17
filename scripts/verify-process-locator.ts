import { ProcessLocator } from '../src/rpc/processLocator';

async function main() {
  console.log('=== ProcessLocator Windows Live Detection Test ===');
  const locator = new ProcessLocator((msg) => console.log('[ProcessLocator Log]', msg));
  
  console.log('Starting detectConnections()...');
  const connections = await locator.detectConnections();
  
  console.log('\n=== Detection Results ===');
  console.log(`Found ${connections.length} connection(s):`);
  for (const conn of connections) {
    console.log(`  - PID: ${conn.pid}`);
    console.log(`  - Port: ${conn.port}`);
    console.log(`  - CSRF Token: ${conn.csrfToken}`);
  }

  if (connections.length === 0) {
    console.error('FAILED: No connections found!');
    process.exit(1);
  }

  const primary = connections[0];
  if (!primary.pid || !primary.port || !primary.csrfToken) {
    console.error('FAILED: Connection info incomplete!');
    process.exit(1);
  }

  console.log('\nSUCCESS: Valid Antigravity language server connection verified.');
}

main().catch((err) => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
