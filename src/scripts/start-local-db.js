const fs = require("fs");
const net = require("net");
const path = require("path");
const { spawn } = require("child_process");

const dataDir = path.join(process.cwd(), ".postgres-data");
const postgresBin = "C:\\Program Files\\PostgreSQL\\16\\bin\\postgres.exe";
const host = "127.0.0.1";
const port = 5433;

function isPortOpen(targetHost, targetPort) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(1000);
    socket.once("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.once("timeout", () => {
      socket.destroy();
      resolve(false);
    });
    socket.once("error", () => {
      resolve(false);
    });
    socket.connect(targetPort, targetHost);
  });
}

async function waitForPort(targetHost, targetPort, attempts = 20) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    if (await isPortOpen(targetHost, targetPort)) {
      return true;
    }

    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  return false;
}

async function main() {
  if (!fs.existsSync(dataDir)) {
    console.log("Local PostgreSQL data directory not found. Skipping project-local DB startup.");
    return;
  }

  if (await isPortOpen(host, port)) {
    console.log(`Local PostgreSQL is already accepting connections on ${host}:${port}.`);
    return;
  }

  const stdout = fs.openSync(path.join(dataDir, "postgres.stdout.log"), "a");
  const stderr = fs.openSync(path.join(dataDir, "postgres.stderr.log"), "a");

  const child = spawn(postgresBin, ["-D", dataDir], {
    detached: true,
    stdio: ["ignore", stdout, stderr],
    windowsHide: true,
  });

  child.unref();

  const ready = await waitForPort(host, port);
  if (!ready) {
    throw new Error("Project-local PostgreSQL did not start on port 5433.");
  }

  console.log("Project-local PostgreSQL started on port 5433.");
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
