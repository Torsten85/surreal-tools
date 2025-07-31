import chalk from "chalk";

function withLevel(
  level: "success" | "warn" | "error" | "log",
  segments: string[]
) {
  const message = segments
    .map((segment) => String(segment))
    .join(" ")
    .replace(/\|(.*?)\|/g, (_, str) => chalk.bold(str));

  switch (level) {
    case "success": {
      return `${chalk.bgGreen.black.bold(" INFO ")} ${chalk.green(message)}`;
    }
    case "warn": {
      return `${chalk.bgYellow.black.bold(" INFO ")} ${chalk.yellow(message)}`;
    }
    case "error": {
      return `${chalk.bgRed.black.bold(" INFO ")} ${chalk.red(message)}`;
    }
    case "log": {
      return `${chalk.bgMagenta.black.bold(" INFO ")} ${chalk.magenta(message)}`;
    }
  }
}

export default {
  log(...segments: any[]) {
    console.log("\n", withLevel("log", segments));
  },
  success(...segments: any[]) {
    console.log("\n", withLevel("success", segments));
  },
  warn(...segments: any[]) {
    console.log("\n", withLevel("warn", segments));
  },
  error(...segments: any[]) {
    console.log("\n", withLevel("error", segments));
  },
};
