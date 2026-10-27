import { createGameServer } from './server';
const app = createGameServer();
app.listen().catch(() => {
  console.error(
    JSON.stringify({
      event: 'startup_failed',
      message: 'Unable to start server. Check configuration and port availability.',
    }),
  );
  process.exitCode = 1;
});
for (const signal of ['SIGINT', 'SIGTERM'] as const)
  process.once(signal, () => {
    void app.close();
  });
