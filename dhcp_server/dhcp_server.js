#!/usr/bin/env node
// ───────────────────────────────────────────────────────────
// Imports
// ───────────────────────────────────────────────────────────
const fs = require('fs');
const path = require('path');
const dhcp = require('dhcp');
const yargs = require('yargs');
const { hideBin } = require('yargs/helpers');
const { createLogger, format, transports } = require('winston');

// ───────────────────────────────────────────────────────────
// Constants
// ───────────────────────────────────────────────────────────
const userDataPath = process.env.USER_DATA_PATH || path.resolve(process.cwd(), 'data');
fs.mkdirSync(userDataPath, { recursive: true });
const MASTER_LOG = path.join(userDataPath, 'dhcp_server.log');
const ECU_LOG = path.join(userDataPath, 'ecu_dhcp.log');
const LEASE_FILE = path.join(userDataPath, 'leases.json');
const ECU_MAC = 'AA-BB-CC-DD-30-60';
// const ECU_MAC = '08-00-27-3a-59-38'; // for testing
const LEASE_TIME = 7200;            // seconds
const LEASE_GRACE = 10 * 60 * 1000; // ms
const TIME_OFFSET = 3600 * 1000;    // ms

// ───────────────────────────────────────────────────────────
console.log(MASTER_LOG);
console.log(`<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<>><<<<<<<<<<< ${ECU_LOG} >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>><`);
// ───────────────────────────────────────────────────────────

// ───────────────────────────────────────────────────────────
// Logger setup
// ───────────────────────────────────────────────────────────
const { combine, timestamp, printf, colorize } = format;
const ts = timestamp({ format: () => new Date(Date.now() + TIME_OFFSET).toISOString() });

// File logger (debug+ for verbosity)
const fileLogger = createLogger({
  level: 'debug',
  format: combine(ts, printf(({ timestamp, level, message }) => `${timestamp} [${level.toUpperCase()}] ${message}`)),
  transports: [new transports.File({ filename: MASTER_LOG, options: { flags: 'a' } })]
});

// Console logger (warn+)
const consoleLogger = createLogger({
  level: 'warn',
  format: combine(colorize(), printf(({ level, message }) => `[${level}] ${message}`)),
  transports: [new transports.Console()]
});

// ECU logger (info+)
const ecuLogger = createLogger({
  level: 'info',
  format: combine(ts, printf(({ timestamp, level, message }) => `${timestamp} [${level.toUpperCase()}] ${message}`)),
  transports: [new transports.File({ filename: ECU_LOG, options: { flags: 'a' } })]
});

// ───────────────────────────────────────────────────────────
// State
// ───────────────────────────────────────────────────────────
let activeLeases = {};
let availableIps = [];
let initialEcuLease = null;

// ───────────────────────────────────────────────────────────
// Helpers
// ───────────────────────────────────────────────────────────
function normalizeMac(m) {
  return (m || '').toLowerCase().replace(/[:-]/g, '-');
}

const ECU_KEY = normalizeMac(ECU_MAC);

// ───────────────────────────────────────────────────────────
// Clear old ECU log
// ───────────────────────────────────────────────────────────
if (fs.existsSync(ECU_LOG)) {
  try { fs.unlinkSync(ECU_LOG); } catch (err) {
    console.error('Failed to clear ECU log:', err.message);
    fileLogger.error(`Failed to clear ECU log: ${err.message}`);
    ecuLogger.error(`Failed to clear ECU log: ${err.message}`);
  }
}

// ───────────────────────────────────────────────────────────
// Load persisted leases
// ───────────────────────────────────────────────────────────
if (fs.existsSync(LEASE_FILE)) {
  try {
    const data = fs.readFileSync(LEASE_FILE, 'utf8');
    const parsed = JSON.parse(data);
    const now = Date.now();

    Object.entries(parsed).forEach(([mac, lease]) => {
      const key = normalizeMac(mac);
      if (lease.expiresAt > now - LEASE_GRACE) {
        activeLeases[key] = lease;
        fileLogger.debug(`Loaded valid lease for MAC ${key}`);
        // if (key === ECU_KEY) {
        //   ecuLogger.info(`Loaded valid ECU lease:\n${JSON.stringify(lease, null, 2)}`);
        // }
      } else {
        fileLogger.debug(`Skipped expired lease for MAC ${key}`);
      }
    });

    if (activeLeases[ECU_KEY]) initialEcuLease = activeLeases[ECU_KEY].address;
    fileLogger.debug(`Active leases after loading:\n${JSON.stringify(activeLeases, null, 2)}`);
    // ecuLogger.info(`Active leases after loading for ECU:\n${JSON.stringify(activeLeases, null, 2)}`);
  } catch (err) {
    console.error('Failed to load leases:', err.message);
    fileLogger.error(`Failed to load leases: ${err.message}`);
    ecuLogger.error(`Failed to load leases: ${err.message}`);
  }
}

// ───────────────────────────────────────────────────────────
// CLI args
// ───────────────────────────────────────────────────────────
const argv = yargs(hideBin(process.argv))
  .option('i', { alias: 'interface', demandOption: true })
  .option('a', { alias: 'ip', demandOption: true })
  .option('s', { alias: 'subnet', demandOption: true })
  .option('r1', { alias: 'rangeStart', demandOption: true })
  .option('r2', { alias: 'rangeEnd', demandOption: true })
  .help().argv;

function validateIPs({ a, s, r1, r2 }) {
  const re = /^(?:\d{1,3}\.){3}\d{1,3}$/;
  [a, s, r1, r2].forEach(v => {
    if (!re.test(v)) {
      consoleLogger.error(`Invalid IP: ${v}`);
      fileLogger.error(`Invalid IP: ${v}`);
      ecuLogger.error(`Invalid IP: ${v}`);
      process.exit(1);
    }
  });
}
validateIPs(argv);

function expandRange(start, end) {
  const toNum = ip => ip.split('.')
    .reduce((acc, o) => (acc << 8) + parseInt(o, 10), 0);
  const toIp = num => [24,16,8,0]
    .map(shift => (num >> shift) & 0xFF)
    .join('.');
  const startNum = toNum(start);
  const endNum = toNum(end);
  const ips = [];
  for (let n = startNum; n <= endNum; n++) ips.push(toIp(n));
  return ips;
}

function persist() {
  try {
    fs.writeFileSync(LEASE_FILE, JSON.stringify(activeLeases, null, 2));
    fileLogger.info('Leases persisted');
    ecuLogger.info('Leases persisted for ECU check');
  } catch (err) {
    fileLogger.error(`Failed to persist leases: ${err.message}`);
    ecuLogger.error(`Failed to persist leases: ${err.message}`);
  }
}

function cleanup() {
  const now = Date.now(); let changed = false;
  Object.entries(activeLeases).forEach(([mac, lease]) => {
    if (lease.expiresAt <= now) {
      availableIps.push(lease.address);
      delete activeLeases[mac];
      changed = true;
      fileLogger.info(`Expired lease for MAC ${mac}, IP ${lease.address} returned to pool`);
      if (mac === ECU_KEY) ecuLogger.info(`Expired lease for ECU MAC ${mac}, IP returned`);
    }
  });
  if (changed) persist();
}

// ───────────────────────────────────────────────────────────
// Prepare IP pool & DHCP server init
// ───────────────────────────────────────────────────────────
availableIps = expandRange(argv.rangeStart, argv.rangeEnd);
Object.values(activeLeases).forEach(lease => {
  const idx = availableIps.indexOf(lease.address);
  if (idx !== -1) availableIps.splice(idx, 1);
});

const server = dhcp.createServer({
  range: availableIps,
  netmask: argv.subnet,
  router: [argv.ip],
  server: argv.ip,
  broadcast: argv.subnet.split('.')
    .map((b,i) => (parseInt(argv.ip.split('.')[i]) | ~parseInt(b) & 0xFF))
    .join('.'),
  dns: ['8.8.8.8','8.8.4.4'],
  leaseTime: LEASE_TIME,
  interface: argv.interface
});
setInterval(cleanup, 60*1000);

// ───────────────────────────────────────────────────────────
// DHCP handlers
// ───────────────────────────────────────────────────────────
server.on('discover', req => {
  const mac = normalizeMac(req.chaddr);
  fileLogger.debug(`DISCOVER from ${mac}`);
  const lease = activeLeases[mac];
  if (lease && lease.expiresAt > Date.now() - LEASE_GRACE) {
    fileLogger.info(`Offering existing lease ${lease.address} for MAC ${mac}`);
    if (mac === ECU_KEY) ecuLogger.info(`🔍 [ECU] DISCOVER, forcing valid lease`);
    return server.offer(req, lease.address);
  }
  if (mac === ECU_KEY && initialEcuLease && !activeLeases[mac]) {
    fileLogger.info(`Offering initial ECU lease ${initialEcuLease}`);
    ecuLogger.info(`🔍 [ECU] DISCOVER, using initial lease`);
    return server.offer(req, initialEcuLease);
  }
  fileLogger.info(`No valid lease for MAC ${mac}, assigning new IP`);
  if (mac === ECU_KEY) ecuLogger.info(`🔍 [ECU] DISCOVER, assigning new IP`);
  server.offer(req);
});

server.on('request', req => {
  const mac = normalizeMac(req.chaddr);
  const requestedIp = req.options.requestedIp || 'none';
  fileLogger.debug(`REQUEST from ${mac}, requested IP: ${requestedIp}`);
  const lease = activeLeases[mac];
  if (lease && lease.expiresAt > Date.now() - LEASE_GRACE) {
    if (requestedIp !== 'none' && requestedIp !== lease.address) {
      fileLogger.warn(`Rejecting REQUEST from ${mac} for IP ${requestedIp}`);
      if (mac === ECU_KEY) ecuLogger.warn(`🔑 [ECU] REQUEST, rejecting IP`);
      return server.nak(req, `Requested IP conflict`);
    }
    fileLogger.info(`Acknowledging existing lease ${lease.address} for MAC ${mac}`);
    if (mac === ECU_KEY) ecuLogger.info(`🔑 [ECU] REQUEST, forcing valid lease`);
    return server.ack(req, lease.address);
  }
  if (mac === ECU_KEY && initialEcuLease && !activeLeases[mac]) {
    fileLogger.info(`Acknowledging initial ECU lease ${initialEcuLease}`);
    ecuLogger.info(`🔑 [ECU] REQUEST, using initial lease`);
    return server.ack(req, initialEcuLease);
  }
  fileLogger.info(`No valid lease for MAC ${mac}, assigning new IP`);
  if (mac === ECU_KEY) ecuLogger.info(`🔑 [ECU] REQUEST, assigning new IP`);
  server.ack(req);
});

server.on('bound', state => {
  // Pretty-print and normalize state
const normState = Object.fromEntries(
    Object.entries(state).map(([mac, info]) => [normalizeMac(mac), info])
  );
  fileLogger.info(`BOUND state:
${JSON.stringify(normState, null, 2)}`);
  if (ECU_KEY in normState) {
    ecuLogger.info(`🔐 [ECU] BOUND:
${JSON.stringify(normState[ECU_KEY], null, 2)}`);
    // Send ECU IP address to stdout for main.js to pick up
    const ecuIpMessage = {
      type: 'ecu-ip-assigned',
      mac: ECU_KEY,
      ip: normState[ECU_KEY].address,
    };
    console.log(JSON.stringify(ecuIpMessage)); // Structured output to stdout
  }
  // Update leases
  Object.entries(normState).forEach(([mac, info]) => {
    activeLeases[mac] = {
      address: info.address,
      expiresAt: Date.now() + LEASE_TIME*1000,
      bindTime: info.bindTime,
      leasePeriod: LEASE_TIME,
      server: argv.ip,
      state: 'BOUND'
    };
    const idx = availableIps.indexOf(info.address);
    if (idx !== -1) availableIps.splice(idx, 1);
  });
  persist();
});

// ───────────────────────────────────────────────────────────
// Raw packet handler for logging only
// ───────────────────────────────────────────────────────────
server.on('message', data => {
  const mac = normalizeMac(data.chaddr);
  const messageType = data.options['53'] || 0;
  fileLogger.debug(`RAW MESSAGE from ${mac}, type: ${messageType}`);
//   if (mac === ECU_KEY) {                     !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
//     ecuLogger.info(`🔍 [ECU] RAW MESSAGE:
// ${JSON.stringify(data, null, 2)}`);
//   }
});

// ───────────────────────────────────────────────────────────
// Startup & shutdown
// ───────────────────────────────────────────────────────────
try {
  server.listen();
  const msg = `🚀 DHCP server running on ${argv.ip} (iface ${argv.interface})`;
  consoleLogger.warn(msg);
  fileLogger.info(msg);
  ecuLogger.info(msg);
} catch (err) {
  fileLogger.error(err.stack || err);
  ecuLogger.error(`Failed to start server: ${err.message}`);
  console.error(err.message);
  process.exit(1);
}

process.on('SIGINT', () => {
  consoleLogger.warn('🛑 SIGINT');
  fileLogger.info('🛑 SIGINT');
  ecuLogger.info('🛑 SIGINT');
  persist();
  process.exit(0);
});

process.on('SIGTERM', () => {
  consoleLogger.warn('🛑 SIGTERM');
  fileLogger.info('🛑 SIGTERM');
  ecuLogger.info('🛑 SIGTERM');
  persist();
  process.exit(0);
});