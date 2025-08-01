const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const os = require('os');
const db = require(path.join(__dirname, '../database', 'index.js'));
const si = require('systeminformation');
const { exec, spawn, execFile } = require('child_process');
const fs = require('fs');

// Set USER_DATA_PATH for consistent file locations in production
process.env.USER_DATA_PATH = app.getPath('userData');

// Global variables
let dhcpProcess = null;
let orchestratorProcess = null;
let udsProcess = null;
let mainWindow = null;
let ecuIpAddress = null;
let udsData = null; // Variable to store UDS JSON output

function createWindow() {
  mainWindow = new BrowserWindow({
    frame: false,
    webPreferences: {
      backgroundThrottling: false,
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.webContents.openDevTools();
  mainWindow.setMenu(null);
  mainWindow.maximize();

  if (app.isPackaged) {
    const indexPath = path.join(process.resourcesPath, 'app.asar', 'dist', 'index.html');
    mainWindow.loadFile(indexPath);
  } else {
    mainWindow.loadURL('http://localhost:5173');
  }

  // Window controls IPC
  ipcMain.on('window-minimize', () => mainWindow.minimize());
  ipcMain.on('window-close', () => mainWindow.close());
}

// IPC handler for network interfaces
ipcMain.handle('get-network-interfaces', async () => {
  try {
    const allIfaces = os.networkInterfaces();
    const ethIfaces = {};
    for (const [name, addrs] of Object.entries(allIfaces)) {
      if (!/^(eth|en|Ethernet)/i.test(name)) continue;
      const usable = addrs.filter((a) => !a.internal);
      if (usable.length) {
        ethIfaces[name] = usable;
      }
    }
    return ethIfaces;
  } catch (err) {
    console.error('Error fetching network interfaces:', err.message);
    throw err;
  }
});

// IPC to check if any wired (Ethernet) NIC is up
ipcMain.handle('is-ethernet-connected', async () => {
  try {
    const ifaces = await si.networkInterfaces();
    const realEthernet = ifaces.filter(
      (iface) =>
        iface.type === 'wired' &&
        iface.operstate === 'up' &&
        iface.virtual === false &&
        iface.speed > 0 &&
        (iface.iface === 'enp0s31f6' || iface.iface === 'Ethernet') &&
        /^(eth|en|Ethernet)/i.test(iface.iface)
    );
    return realEthernet.length > 0;
  } catch (err) {
    console.error('Error in is-ethernet-connected:', err.message);
    return false;
  }
});

// IPC to save uds setup
ipcMain.handle('save-uds-setup', async (_, { logical_add }) => {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      // 1) Delete any existing row
      db.run(`DELETE FROM uds_setup`, err => {
        if (err) {
          console.error('Error clearing uds_setup table:', err.message);
          return reject(err);
        }
        // 2) Insert the new logical_add
        db.run(
          `INSERT INTO uds_setup (logical_add) VALUES (?)`,
          [logical_add],
          err2 => {
            if (err2) {
              console.error('Error inserting into uds_setup:', err2.message);
              return reject(err2);
            }
            console.log('uds_setup saved:', logical_add);
            resolve(true);
          }
        );
      });
    });
  });
});

// IPC to fetch saved uds setup
ipcMain.handle('fetch-uds-setup', () => {
  return new Promise((resolve, reject) => {
    db.all('SELECT * FROM uds_setup', (err, rows) => {
      if (err) {
        console.error('Error fetching uds_setup:', err.message);
        reject(err.message);
      } else {
        resolve(rows);
      }
    });
  });
});

// IPC to clear all rows from uds_setup
ipcMain.handle('clear-uds-setup', async () => {
  try {
    return new Promise((resolve, reject) => {
      db.run(`DELETE FROM uds_setup`, (err) => {
        if (err) {
          console.error('Error clearing uds setup:', err.message);
          reject(err.message);
        } else {
          console.log('uds setup cleared');
          resolve(true);
        }
      });
    });
  } catch (err) {
    console.error('Error in clear-uds-setup:', err.message);
    throw err;
  }
});

// IPC to save network mode (always keeps exactly 1 row)
ipcMain.handle('save-network-mode', async (_, { mode }) => {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      // 1) Delete any existing row
      db.run(`DELETE FROM network_mode`, err => {
        if (err) {
          console.error('Error clearing network_mode table:', err.message);
          return reject(err);
        }
        // 2) Insert the new mode
        db.run(
          `INSERT INTO network_mode (mode) VALUES (?)`,
          [mode],
          err2 => {
            if (err2) {
              console.error('Error inserting into network_mode:', err2.message);
              return reject(err2);
            }
            console.log('network_mode saved:', mode);
            resolve(true);
          }
        );
      });
    });
  });
});

// IPC to fetch the current network mode
ipcMain.handle('fetch-network-mode', async () => {
  return new Promise((resolve, reject) => {
    db.get(`SELECT mode FROM network_mode LIMIT 1`, (err, row) => {
      if (err) {
        console.error('Error fetching network_mode:', err.message);
        return reject(err);
      }
      // If no row, you might choose to default to 'dynamic'
      const mode = row ? row.mode : null;
      resolve(mode);
    });
  });
});

// IPC to save a network setup (with validation)
ipcMain.handle('save-network-setup', async (_, { interface, ip_host, subnet, pool_val1, pool_val2 }) => {
  try {
    // Validate IP addresses and subnet
    const re = /^(?:\d{1,3}\.){3}\d{1,3}$/;
    if (![ip_host, subnet, pool_val1, pool_val2].every((v) => re.test(v))) {
      throw new Error('Invalid IP or subnet format');
    }
    const toNum = (ip) => ip.split('.').reduce((acc, o) => (acc << 8) + parseInt(o, 10), 0);
    const ipNum = toNum(ip_host),
      subnetNum = toNum(subnet),
      r1Num = toNum(pool_val1),
      r2Num = toNum(pool_val2);
    if (r1Num > r2Num) {
      throw new Error('rangeStart must be less than or equal to rangeEnd');
    }
    if ((ipNum & subnetNum) !== (r1Num & subnetNum) || (ipNum & subnetNum) !== (r2Num & subnetNum)) {
      throw new Error('IP range must be in the same subnet as the server IP');
    }

    return new Promise((resolve, reject) => {
      db.serialize(() => {
        // Delete existing rows
        db.run(`DELETE FROM network_setup`, (err) => {
          if (err) return reject(err.message);
          // Insert new row
          db.run(
            `INSERT INTO network_setup (interface, ip_host, subnet, pool_val1, pool_val2)
             VALUES (?, ?, ?, ?, ?)`,
            [interface, ip_host, subnet, pool_val1, pool_val2],
            (err2) => {
              if (err2) {
                console.error('Error saving network setup:', err2.message);
                return reject(err2.message);
              }
              console.log('Network setup saved:', { interface, ip_host, subnet, pool_val1, pool_val2 });
              resolve(true);
            }
          );
        });
      });
    });
  } catch (err) {
    console.error('Error in save-network-setup:', err.message);
    throw err;
  }
});

// IPC to fetch saved network setups
ipcMain.handle('fetch-network-setup', () => {
  return new Promise((resolve, reject) => {
    db.all('SELECT * FROM network_setup', (err, rows) => {
      if (err) {
        console.error('Error fetching network setup:', err.message);
        reject(err.message);
      } else {
        resolve(rows);
      }
    });
  });
});

// IPC to clear all rows from network_setup
ipcMain.handle('clear-network-setup', async () => {
  try {
    return new Promise((resolve, reject) => {
      db.run(`DELETE FROM network_setup`, (err) => {
        if (err) {
          console.error('Error clearing network setup:', err.message);
          reject(err.message);
        } else {
          console.log('Network setup cleared');
          resolve(true);
        }
      });
    });
  } catch (err) {
    console.error('Error in clear-uds-setup:', err.message);
    throw err;
  }
});

// IPC to fetch UDS data
ipcMain.handle('fetch-uds-data', () => {
  return udsData; // Return the stored UDS data
});

// Function to run UDS script
async function runUdsScript(ip, logicalAddress) {
  try {
    const platform = process.platform;
    const udsDir = app.isPackaged
      ? path.join(process.resourcesPath, 'uds', 'dist')
      : path.join(__dirname, '../uds/dist');
    const udsExecutable = platform === 'win32'
      ? path.join(udsDir, 'uds.exe')
      : path.join(udsDir, 'uds');

    if (!fs.existsSync(udsExecutable)) {
      throw new Error(`UDS executable not found: ${udsExecutable}`);
    }

    if (platform !== 'win32') {
      try {
        fs.chmodSync(udsExecutable, '755');
      } catch (err) {
        throw new Error(`Failed to set UDS executable permissions: ${err.message}`);
      }
    }

    const args = ['-i', ip, '-l', logicalAddress];

    return new Promise((resolve, reject) => {
      udsProcess = spawn(
        platform === 'win32' ? udsExecutable : 'sudo',
        platform === 'win32' ? args : ['-E', udsExecutable, ...args],
        {
          stdio: ['ignore', 'pipe', 'pipe'],
          cwd: udsDir,
          env: { ...process.env }
        }
      );

      let output = '';
      udsProcess.stdout.on('data', (data) => {
        output += data.toString();
      });

      udsProcess.stderr.on('data', (data) => {
        console.error(`UDS stderr: ${data}`);
      });

      udsProcess.on('close', (code) => {
        udsProcess = null;
        if (code !== 0) {
          console.error(`UDS process exited with code ${code}`);
          reject(new Error(`UDS process failed with code ${code}`));
          return;
        }
        try {
          udsData = JSON.parse(output);
          console.log('UDS Data:', udsData);
          // Send UDS data to renderer process
          if (mainWindow) {
            mainWindow.webContents.send('uds-data-update', udsData);
          }
          resolve(udsData);
        } catch (err) {
          console.error('Error parsing UDS JSON output:', err.message);
          reject(err);
        }
      });

      udsProcess.on('error', (err) => {
        udsProcess = null;
        console.error(`UDS process error: ${err.message}`);
        reject(err);
      });
    });
  } catch (err) {
    console.error('Error running UDS script:', err.message);
    throw err;
  }
}

// IPC: Start DHCP (assign temporary IP to interface and start DHCP server)
ipcMain.handle('start-dhcp', async () => {
  try {
    const networkRows = await new Promise((resolve, reject) => {
      db.all('SELECT * FROM network_setup', (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });

    if (networkRows.length === 0) throw new Error('No network setup configured.');

    const { interface: iface, ip_host, subnet, pool_val1, pool_val2 } = networkRows[0];
    const netmask = subnet || '255.255.255.0';

    const platform = process.platform;
    let cmd = platform === 'win32'
      ? `netsh interface ip set address "${iface}" static ${ip_host} ${netmask}`
      : `sudo ip addr add ${ip_host}/${netmask} dev ${iface}`;

    await new Promise((resolve, reject) => {
      exec(cmd, (error, stdout, stderr) => {
        if (error) {
          console.error(`start-dhcp (set IP) error: ${stderr}`);
          return reject(new Error(`Failed to set IP: ${stderr}`));
        }
        console.log(`start-dhcp (set IP): ${stdout}`);
        resolve();
      });
    });

    const dhcpServerDir = app.isPackaged
      ? path.join(process.resourcesPath, 'dhcp_server', 'dist')
      : path.join(__dirname, '../dhcp_server/dist');

    const dhcpExecutable = platform === 'win32'
      ? path.join(dhcpServerDir, 'dhcp_server-win.exe')
      : path.join(dhcpServerDir, 'dhcp_server-linux');

    if (!fs.existsSync(dhcpExecutable)) {
      throw new Error(`DHCP server executable not found: ${dhcpExecutable}`);
    }

    const args = ['--interface', iface, '--ip', ip_host, '--subnet', netmask, '--rangeStart', pool_val1, '--rangeEnd', pool_val2];

    if (platform === 'win32') {
      dhcpProcess = spawn(dhcpExecutable, args, {
        stdio: ['ignore', 'pipe', 'pipe'],
        cwd: dhcpServerDir
      });
    } else {
      dhcpProcess = spawn('sudo', ['-E', dhcpExecutable, ...args], {
        stdio: ['ignore', 'pipe', 'pipe'],
        cwd: dhcpServerDir
      });
    }

    const userDataPath = app.getPath('userData');
    console.log('ECU_LOG path:', path.join(userDataPath, 'ecu_dhcp.log'));

    let stdoutBuffer = '';
    dhcpProcess.stdout.on('data', (data) => {
      const output = data.toString();
      stdoutBuffer += output;
      const lines = stdoutBuffer.split('\n');
      stdoutBuffer = lines.pop();
      lines.forEach(async (line) => {
        try {
          const message = JSON.parse(line);
          if (message.type === 'ecu-ip-assigned') {
            ecuIpAddress = message.ip;
            console.log(`ECU IP assigned: ${ecuIpAddress} for MAC ${message.mac}`);
            // Fetch logical address from uds_setup
            try {
              const udsRows = await new Promise((resolve, reject) => {
                db.all('SELECT logical_add FROM uds_setup', (err, rows) => {
                  if (err) reject(err);
                  else resolve(rows);
                });
              });
              if (udsRows.length === 0) {
                console.error('No UDS setup configured');
                return;
              }
              const logicalAddress = udsRows[0].logical_add;
              // Run UDS script after ECU IP is assigned
              await runUdsScript(ecuIpAddress, logicalAddress);
            } catch (err) {
              console.error('Error fetching UDS setup or running UDS script:', err.message);
            }
          }
        } catch (e) {
          console.log(`DHCP server stdout: ${line}`);
        }
      });
    });

    dhcpProcess.stderr.on('data', (data) => console.error(`DHCP server stderr: ${data}`));
    dhcpProcess.on('error', (err) => {
      console.error(`DHCP server error: ${err.message}`);
      dhcpProcess = null;
      throw err;
    });
    dhcpProcess.on('close', (code) => {
      console.log(`DHCP server exited with code ${code}`);
      dhcpProcess = null;
    });

    const orchDir = app.isPackaged
      ? path.join(process.resourcesPath, 'log_orchestrator', 'dist')
      : path.join(__dirname, '../log_orchestrator', 'dist');

    const orchExecutable = platform === 'win32'
      ? path.join(orchDir, 'log_orchestrator-win.exe')
      : path.join(orchDir, 'log_orchestrator-linux');

    if (!fs.existsSync(orchExecutable)) {
      throw new Error(`Log Orchestrator executable not found: ${orchExecutable}`);
    }
    if (platform !== 'win32') {
      try {
        fs.chmodSync(orchExecutable, '755');
      } catch (err) {
        throw new Error(`Failed to set executable permissions: ${err.message}`);
      }
    }

    fs.mkdirSync(userDataPath, { recursive: true });
    try {
      fs.accessSync(userDataPath, fs.constants.W_OK);
    } catch (err) {
      throw new Error(`Log directory not writable: ${err.message}`);
    }

    const logFilePath = path.join(userDataPath, 'ecu_dhcp.log');
    console.log('Starting orchestrator with log:', logFilePath);

    orchestratorProcess = spawn(
      platform === 'win32' ? orchExecutable : 'sudo',
      platform === 'win32' ? [logFilePath] : ['-E', orchExecutable, logFilePath],
      {
        stdio: ['ignore', 'pipe', 'pipe'],
        cwd: orchDir,
        env: { ...process.env }
      }
    );

    orchestratorProcess.stdout.on('data', (data) => {
      if (mainWindow) {
        const lines = data.toString().split('\n').filter((line) => line.trim());
        lines.forEach((line) => mainWindow.webContents.send('log-update', line));
      }
    });

    orchestratorProcess.stderr.on('data', (data) => console.error(`[orch] ${data}`));
    orchestratorProcess.on('error', (err) => {
      console.error(`Orchestrator error: ${err.message}`);
      if (mainWindow) {
        mainWindow.webContents.send('orchestrator-error', err.message);
      }
    });
    orchestratorProcess.on('close', (code) => console.log(`Orchestrator exited with code ${code}`));

    console.log(`Started DHCP server: ${dhcpExecutable} ${args.join(' ')}`);
    return true;
  } catch (err) {
    console.error('start-dhcp error:', err.message);
    throw err;
  }
});

// IPC: Stop DHCP (remove host IP from interface and stop DHCP server)
ipcMain.handle('stop-dhcp', async () => {
  try {
    const rows = await new Promise((resolve, reject) => {
      db.all('SELECT * FROM network_setup', (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });

    if (rows.length === 0) throw new Error('No network setup found');

    const { interface: iface, ip_host, subnet } = rows[0];
    const netmask = subnet || '255.255.255.0';

    // Step 1: Stop the UDS process if it exists
    if (udsProcess) {
      udsProcess.kill('SIGTERM');
      await new Promise((resolve) => udsProcess.on('close', resolve));
      console.log('UDS process terminated');
      udsProcess = null;
    }

    // Step 2: Stop the DHCP server process if it exists
    if (dhcpProcess) {
      dhcpProcess.kill('SIGTERM');
      await new Promise((resolve) => dhcpProcess.on('close', resolve));
      console.log('DHCP server process terminated');
      dhcpProcess = null;
    }

    if (orchestratorProcess) {
      orchestratorProcess.kill('SIGTERM');
      orchestratorProcess = null;
    }

    // Step 3: Remove static IP from the interface
    const platform = process.platform;
    let cmd = platform === 'win32'
      ? `netsh interface ip set address "${iface}" dhcp`
      : `sudo ip addr del ${ip_host}/${netmask} dev ${iface}`;

    return new Promise((resolve, reject) => {
      exec(cmd, (error, stdout, stderr) => {
        if (error) {
          console.error(`stop-dhcp (remove IP) error: ${stderr}`);
          return reject(new Error(`Failed to remove IP: ${stderr}`));
        }
        console.log(`stop-dhcp (remove IP): ${stdout}`);
        resolve(true);
      });
    });
  } catch (err) {
    console.error('stop-dhcp error:', err.message);
    throw err;
  }
});

// Disable Chromium’s timer throttling in background or occluded windows
app.commandLine.appendSwitch('disable-background-timer-throttling');
// Disable Chromium’s occlusion/backgrounding heuristics
app.commandLine.appendSwitch('disable-renderer-backgrounding');
app.commandLine.appendSwitch('disable-features', 'Translate,AutofillServerCommunication');
app.disableHardwareAcceleration(true);

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', async (event) => {
  console.log('App is quitting, attempting to stop DHCP...');
  try {
    // Stop the UDS process if it exists
    if (udsProcess) {
      udsProcess.kill('SIGTERM');
      await new Promise((resolve) => udsProcess.on('close', resolve));
      console.log('UDS process terminated on app quit');
      udsProcess = null;
    }

    // Stop the DHCP server process if it exists
    if (dhcpProcess) {
      dhcpProcess.kill('SIGTERM');
      await new Promise((resolve) => dhcpProcess.on('close', resolve));
      console.log('DHCP server process terminated on app quit');
      dhcpProcess = null;
    }

    if (orchestratorProcess) {
      orchestratorProcess.kill('SIGTERM');
      orchestratorProcess = null;
    }

    const rows = await new Promise((resolve, reject) => {
      db.all('SELECT * FROM network_setup', (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });

    if (rows.length === 0) return;

    const { interface: iface, ip_host, subnet } = rows[0];
    const netmask = subnet || '255.255.255.0';
    const platform = process.platform;

    let cmd = platform === 'win32'
      ? `netsh interface ip set address "${iface}" dhcp`
      : `sudo ip addr del ${ip_host}/${netmask} dev ${iface}`;

    await new Promise((resolve, reject) => {
      exec(cmd, (error, stdout, stderr) => {
        if (error) {
          console.error('Failed to stop DHCP on quit:', stderr);
          return reject(new Error(`Failed to stop DHCP: ${stderr}`));
        }
        console.log('DHCP stopped on app quit');
        resolve();
      });
    });
  } catch (err) {
    console.error('Error during DHCP cleanup on quit:', err.message);
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});