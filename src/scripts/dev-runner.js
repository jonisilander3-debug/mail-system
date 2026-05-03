const { spawn } = require("child_process");
const path = require("path");

const rootDir = path.join(__dirname, "..", "..");
const npmCommand = process.platform === "win32" ? "C:\\Program Files\\nodejs\\npm.cmd" : "npm";
const nodeCommand = process.execPath;

function run(name, command, args, cwd) {
  const commandString = process.platform === "win32"
    ? `"${command}" ${args.join(" ")}`
    : `${command} ${args.join(" ")}`;

  const child = spawn(commandString, {
    cwd,
    shell: true,
    stdio: "inherit",
    windowsHide: false,
  });

  child.on("exit", (code) => {
    if (code && code !== 0) {
      console.error(`${name} exited with code ${code}`);
      process.exitCode = code;
    }
  });

  return child;
}

run("api", nodeCommand, ["src/server.js"], rootDir);
run("web", npmCommand, ["run", "dev", "--prefix", "frontend"], rootDir);
