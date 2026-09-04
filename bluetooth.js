/*

    Bluetooth RFCOMM bridge (Linux / BlueZ)

    Replaces chrome.bluetooth / chrome.bluetoothSocket. Binds a paired
    device's Serial Port Profile channel to /dev/rfcommN via the `rfcomm`
    CLI (needs root - invoked through `sudo -n`, see README for the
    passwordless sudoers entry this requires), then reads/writes that
    device node directly with Node's fs/tty modules.

    Deliberately not using the `serialport` package here: it opens
    /dev/rfcommN fine but never delivers a 'data' event on it (tested and
    confirmed against this hardware) - some mismatch between how it
    configures the tty and how the kernel's virtual RFCOMM tty behaves.
    Node's own tty.ReadStream, opened non-blocking, works correctly.

*/

const { execFile } = require('child_process');
const { promisify } = require('util');
const fs = require('fs');
const tty = require('tty');

const execFileAsync = promisify(execFile);

const RFCOMM_ID = 0;
const RFCOMM_DEVICE = `/dev/rfcomm${RFCOMM_ID}`;
const RFCOMM_CHANNEL = 1;

let fd = null;
let readStream = null;
let bound = false;

async function listPairedDevices() {
  const { stdout } = await execFileAsync('bluetoothctl', ['devices', 'Paired']);

  return stdout
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const m = line.match(/^Device\s+([0-9A-Fa-f:]{17})\s+(.+)$/);
      return m ? { address: m[1], name: m[2] } : null;
    })
    .filter(Boolean);
}

async function releaseRfcomm() {
  if (!bound)
    return;

  bound = false;

  await execFileAsync('sudo', ['-n', 'rfcomm', 'release', String(RFCOMM_ID)]).catch(() => {});
}

async function bindRfcomm(address) {
  await releaseRfcomm();

  try {
    await execFileAsync('sudo', ['-n', 'rfcomm', 'bind', String(RFCOMM_ID), address, String(RFCOMM_CHANNEL)]);
  } catch (err) {
    throw new Error(
      `rfcomm bind failed (${err.message}). This app needs passwordless sudo for ` +
      `"rfcomm" - see the README setup section.`
    );
  }

  // rfcomm bind creates the device node as root:root mode 600, and relies
  // on udev to relabel it to root:dialout 660 a moment later - which in
  // turn only helps if this process's own session actually picked up
  // dialout group membership (easy to end up stale after adding the
  // group, e.g. a terminal that survived logout). Chmod it open directly
  // instead, so this doesn't depend on either of those.
  try {
    await execFileAsync('sudo', ['-n', 'chmod', '666', RFCOMM_DEVICE]);
  } catch (err) {
    throw new Error(
      `chmod on ${RFCOMM_DEVICE} failed (${err.message}). This app needs passwordless sudo for ` +
      `"chmod 666 ${RFCOMM_DEVICE}" - see the README setup section.`
    );
  }

  bound = true;
}

async function disconnect() {
  if (readStream) {
    readStream.destroy();
    readStream = null;
  }

  if (fd !== null) {
    try {
      fs.closeSync(fd);
    } catch {}

    fd = null;
  }

  await releaseRfcomm();
}

async function connect(deviceName, onData) {
  const devices = await listPairedDevices();
  const device = devices.find((d) => d.name === deviceName);

  if (!device)
    throw new Error(`Paired Bluetooth device "${deviceName}" not found. Pair it first with bluetoothctl.`);

  await disconnect();

  // Give the OS and the board's radio a moment to fully tear down the
  // previous link - rebinding immediately after a release can otherwise
  // race the old teardown, or hit the board before it's ready to accept
  // a fresh connection.
  await new Promise((resolve) => setTimeout(resolve, 1000));

  await bindRfcomm(device.address);

  // O_NONBLOCK matters here: a blocking open() on this tty can hang
  // waiting on carrier-detect, which a virtual Bluetooth link never
  // raises.
  fd = fs.openSync(RFCOMM_DEVICE, fs.constants.O_RDWR | fs.constants.O_NOCTTY | fs.constants.O_NONBLOCK);
  readStream = new tty.ReadStream(fd);

  readStream.on('data', (chunk) => onData(chunk.toString('latin1')));
  readStream.on('error', (err) => console.error('meCoffee serial error:', err.message));
  readStream.on('close', () => releaseRfcomm());
}

async function send(line) {
  if (fd === null)
    throw new Error('Not connected');

  await new Promise((resolve, reject) => {
    fs.write(fd, Buffer.from(line, 'latin1'), (err) => (err ? reject(err) : resolve()));
  });
}

module.exports = { listPairedDevices, connect, disconnect, send };
