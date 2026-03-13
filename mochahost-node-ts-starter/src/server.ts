import './loadEnv';
import { app } from './app';

// Mochahost: always use process.env.PORT || 3000 (dot notation). Never assign undefined.
const port = process.env.PORT || 3000;

app.listen(port, () => {
  const url = `http://localhost:${port}`;
  console.log(`Server running on port ${port}`);
  console.log(`Local: ${url}`);
  console.log(`Environment: ${process.env.NODE_ENV ?? 'development'}`);
});
