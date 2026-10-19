import { defineConfig } from "@neon/config/v1";

export default defineConfig({
  functions: {
    escrowcron: {
      name: "Escrow auto-release schedule",
      source: "./neon-functions/escrow-cron.ts",
      env: {
        ESCROW_CRON_URL: "https://studentxchange.vercel.app/api/cron/escrow-auto-release",
        NEON_TRIGGER_SECRET: process.env.NEON_TRIGGER_SECRET!,
      },
    },
  },
  triggers: {
    escrowhourly: {
      type: "schedule",
      function: "escrowcron",
      cron: "0 * * * *",
    },
  },
});
