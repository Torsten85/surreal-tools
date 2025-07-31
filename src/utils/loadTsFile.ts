import path from "node:path";

export default async function loadTsFile(...filePathSegments: Array<string>) {
  const originalWarningListeners = process.listeners("warning");
  process.removeAllListeners("warning");
  process.on("warning", (warning) => {
    if (
      warning.name === "ExperimentalWarning" &&
      warning.message.includes("Type Stripping")
    ) {
      return;
    }
    for (const listener of originalWarningListeners) {
      listener(warning);
    }
  });

  try {
    return await import(path.join(process.cwd(), ...filePathSegments));
  } finally {
    process.removeAllListeners("warning");
    for (const listener of originalWarningListeners) {
      process.on("warning", listener);
    }
  }
}
