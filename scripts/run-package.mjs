import { spawnSync } from "node:child_process";

const target = process.argv[2] ?? "All";
const allowedTargets = new Set(["All", "Chrome", "Firefox"]);

if (!allowedTargets.has(target)) {
  console.error(`PACKAGE FAILED: Unknown target "${target}".`);
  process.exit(1);
}

const npmEntryPoint = process.env.npm_execpath;
if (!npmEntryPoint) {
  console.error("PACKAGE FAILED: Run this script through an npm package command.");
  process.exit(1);
}

const stages = [
  {
    name: "chart build",
    command: process.execPath,
    args: [npmEntryPoint, "run", "build:charts"]
  },
  {
    name: "manifest validation",
    command: process.execPath,
    args: [npmEntryPoint, "run", "validate:manifests"]
  },
  {
    name: "archive creation",
    command: "powershell",
    args: ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", "scripts/package-extension.ps1", "-Target", target]
  },
  {
    name: "package validation",
    command: "powershell",
    args: ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", "scripts/validate-packages.ps1", "-Target", target]
  }
];

for (const stage of stages) {
  console.log(`\n== ${stage.name} ==`);
  const result = spawnSync(stage.command, stage.args, { stdio: "inherit" });

  if (result.error) {
    console.error(`\nPACKAGE FAILED during ${stage.name}: ${result.error.message}`);
    process.exit(1);
  }

  if (result.status !== 0) {
    const detail = result.signal ? `signal ${result.signal}` : `exit code ${result.status}`;
    console.error(`\nPACKAGE FAILED during ${stage.name} (${detail}).`);
    process.exit(result.status ?? 1);
  }
}

const targetLabel = target === "All" ? "Chrome and Firefox packages" : `${target} package`;
console.log(`\nPACKAGE SUCCEEDED: ${targetLabel} created and validated.`);
