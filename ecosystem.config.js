module.exports = {
  apps: [
    {
      name: "refresh-subscriptions",
      script: "./app/scripts/refresh-tokens.ts",
      interpreter: "tsx",
      cron_restart: "0 3 * * *", // запуск щодня о 03:00
      autorestart: false,
      watch: false,
      max_restarts: 1,
    },
  ],
};