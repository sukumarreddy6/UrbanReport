const app = require('./app');
const { connectDatabase } = require('./config/db');

async function start() {
  const port = Number(process.env.PORT) || 3000;
  try {
    await connectDatabase();
    app.listen(port, () => console.log(`UrbanReport listening on port ${port}`));
  } catch (error) {
    console.error(`Startup failed: ${error.message}`);
    process.exitCode = 1;
  }
}

start();
