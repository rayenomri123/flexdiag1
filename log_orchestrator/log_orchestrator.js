const fs = require('fs');
const readline = require('readline');

const logFile = process.argv[2]; // Get log file path from command-line argument
let lastPosition = 0;

setInterval(() => {
  fs.stat(logFile, (err, stats) => {
    if (err) {
      console.error('Error accessing log file:', err.message);
      return;
    }

    const currentSize = stats.size;
    if (currentSize > lastPosition) {
      const stream = fs.createReadStream(logFile, {
        start: lastPosition,
        end: currentSize - 1,
      });

      const rl = readline.createInterface({ input: stream });

      rl.on('line', (line) => {
        console.log(line); // Output each new line to stdout
      });

      rl.on('close', () => {
        lastPosition = currentSize; // Update position after reading
      });

      rl.on('error', (err) => {
        console.error('Error reading log file:', err.message);
      });
    }
  });
}, 1000); // Poll every 1 second