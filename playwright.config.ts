import { defineConfig } from "@playwright/test";
import { config } from "./src/shared/config.js";

export default defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",

  // Fluxo assincrono: o teste em si espera com timeout proprio, mas o
  // limite do Playwright precisa ser maior que o do waitForResult.
  timeout: 60_000,
  expect: { timeout: 10_000 },

  use: {
    baseURL: `http://localhost:${config.ports.publisher}`,
    trace: "retain-on-failure",
  },

  // Os dois servicos sobem junto com os testes. O emulador precisa estar de pe
  // antes (npm run lab:up) - ensureTopology espera por ele ate 30s.
  webServer: [
    {
      command: "npm run publisher",
      url: `http://localhost:${config.ports.publisher}/health`,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
      stdout: "pipe",
      stderr: "pipe",
    },
    {
      command: "npm run consumer",
      url: `http://localhost:${config.ports.consumer}/health`,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
      stdout: "pipe",
      stderr: "pipe",
    },
  ],
});
