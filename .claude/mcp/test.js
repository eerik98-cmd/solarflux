import { spawn } from 'child_process';

const server = spawn('node', ['src/index.js', '--stdio'], {
  stdio: ['pipe', 'pipe', 'pipe'],
});

server.stdout.on('data', (data) => {
  console.log('Szerver válasza:', data.toString());
});

server.stderr.on('data', (data) => {
  console.error('Szerver hiba:', data.toString());
});

server.on('spawn', () => {
  console.log('Szerver elindult!');
  // Küldj üzenetet, amikor a szerver elindult
  const message = JSON.stringify({
    jsonrpc: "2.0",
    method: "test",
    params: {}
  }) + '\n';
  server.stdin.write(message);
});