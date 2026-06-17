import { spawn } from "child_process";

const commands = [
  ["api", "node", ["server/index.js"]],
  ["web", "npx", ["vite", "--host", "127.0.0.1"]]
];

const children = commands.map(([label, command, args]) => {
  const child = spawn(command, args, {
    stdio: ["ignore", "pipe", "pipe"],
    shell: process.platform === "win32"
  });

  child.stdout.on("data", (chunk) => write(label, chunk));
  child.stderr.on("data", (chunk) => write(label, chunk));
  child.on("exit", (code) => {
    if (code) {
      console.error(`[${label}] exited with code ${code}`);
      stopAll();
    }
  });

  return child;
});

function write(label, chunk) {
  for (const line of chunk.toString().split(/\r?\n/).filter(Boolean)) {
    console.log(`[${label}] ${line}`);
  }
}

function stopAll() {
  for (const child of children) {
    if (!child.killed) child.kill();
  }
}

process.on("SIGINT", () => {
  stopAll();
  process.exit(0);
});
