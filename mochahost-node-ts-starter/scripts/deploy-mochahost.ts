import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import * as ftp from 'basic-ftp';
import dotenv from 'dotenv';

console.log('🚀 Starting Mochahost FTP deployment script...');

const envPath = path.resolve(process.cwd(), '.env.prod');
dotenv.config({ path: envPath });

const sourceDir = process.cwd();
const deploymentDir = path.join(sourceDir, 'deployment-ftp');

const ftpConfig = {
  host: process.env.FTP_HOST,
  user: process.env.FTP_USER,
  password: process.env.FTP_PASSWORD,
  port: Number.parseInt(process.env.FTP_PORT ?? '21', 10),
  secure: process.env.FTP_SECURE === 'true',
  remotePath: process.env.FTP_REMOTE_PATH ?? '/',
};

const filesToCopy = [
  'package.json',
  'package-lock.json',
  'web.config',
  'tsconfig.json',
  'README.md',
];

const foldersToCopy = [
  'src',
  'dist',
];

const excludeFromSrc = [
  'scripts/deploy.ts',
  'scripts/deploy-full.ts',
  'scripts/deploy-mochahost.ts'
];

console.log('📁 Source directory:', sourceDir);
console.log('📁 Deployment directory:', deploymentDir);

function validateFtpConfig(): void {
  console.log('🔧 Validating FTP configuration...');
  const required = ['FTP_HOST', 'FTP_USER', 'FTP_PASSWORD'] as const;
  const missing = required.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    console.error('❌ Missing required FTP environment variables:');
    missing.forEach(key => console.error(`   - ${key}`));
    console.error('\nAdd them to .env.prod. See .env.example and README.');
    process.exit(1);
  }
  console.log('✅ FTP configuration validated');
  console.log(`   Host: ${ftpConfig.host}`);
  console.log(`   User: ${ftpConfig.user}`);
  console.log(`   Port: ${ftpConfig.port}`);
  console.log(`   Secure: ${ftpConfig.secure}`);
  console.log(`   Remote Path: ${ftpConfig.remotePath}`);
}

function createDeploymentDir(): void {
  try {
    if (fs.existsSync(deploymentDir)) {
      console.log('🗑️  Removing existing deployment directory...');
      fs.rmSync(deploymentDir, { recursive: true, force: true });
    }
    console.log('📁 Creating deployment directory...');
    fs.mkdirSync(deploymentDir, { recursive: true });
    console.log('✅ Deployment directory created');
  } catch (error) {
    console.error('❌ Error creating deployment directory:', error);
    process.exit(1);
  }
}

function copyFile(sourcePath: string, destPath: string): void {
  try {
    const destDir = path.dirname(destPath);
    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    }
    fs.copyFileSync(sourcePath, destPath);
    console.log(`✅ Copied: ${path.relative(sourceDir, sourcePath)}`);
  } catch (error) {
    console.error(`❌ Error copying ${sourcePath}:`, error);
  }
}

function copyDirectory(sourcePath: string, destPath: string): void {
  try {
    if (!fs.existsSync(destPath)) {
      fs.mkdirSync(destPath, { recursive: true });
    }
    const items = fs.readdirSync(sourcePath);
    for (const item of items) {
      const sourceItemPath = path.join(sourcePath, item);
      const destItemPath = path.join(destPath, item);
      const relativePath = path.relative(sourceDir, sourceItemPath).replace(/\\/g, '/');
      if (excludeFromSrc.includes(relativePath)) {
        console.log(`⏭️  Skipped: ${relativePath}`);
        continue;
      }
      const stat = fs.statSync(sourceItemPath);
      if (stat.isDirectory()) {
        copyDirectory(sourceItemPath, destItemPath);
      } else {
        copyFile(sourceItemPath, destItemPath);
      }
    }
  } catch (error) {
    console.error(`❌ Error copying directory ${sourcePath}:`, error);
  }
}

function buildProject(): void {
  console.log('🔨 Building project locally (dist/ will be uploaded)...');
  execSync('npm run build', { stdio: 'inherit', cwd: sourceDir });
  console.log('✅ Build complete');
}

function createDeploymentPackage(): void {
  console.log('\n📦 Creating deployment package...');
  console.log('\n📄 Copying files...');
  for (const file of filesToCopy) {
    const sourcePath = path.join(sourceDir, file);
    const destPath = path.join(deploymentDir, file);
    if (fs.existsSync(sourcePath)) {
      copyFile(sourcePath, destPath);
    } else {
      console.log(`⚠️  File not found: ${file}`);
    }
  }

  console.log('\n🔧 Handling environment file...');
  const envProdPath = path.join(sourceDir, '.env.prod');
  const envDestPath = path.join(deploymentDir, '.env');
  if (fs.existsSync(envProdPath)) {
    copyFile(envProdPath, envDestPath);
    console.log('✅ Copied .env.prod as .env for production');
  } else {
    console.log('⚠️  .env.prod not found');
    const fallbackEnv = path.join(sourceDir, '.env');
    if (fs.existsSync(fallbackEnv)) {
      copyFile(fallbackEnv, envDestPath);
      console.log('✅ Copied .env as fallback');
    } else {
      console.log('❌ No .env.prod or .env found');
    }
  }

  console.log('\n🔧 Handling web.config...');
  const webConfigPath = path.join(sourceDir, 'web.config');
  if (fs.existsSync(webConfigPath)) {
    copyFile(webConfigPath, path.join(deploymentDir, 'web.config'));
    console.log('✅ Copied web.config');
  } else {
    console.log('⚠️  web.config not found');
  }

  console.log('\n📁 Copying folders...');
  for (const folder of foldersToCopy) {
    const sourcePath = path.join(sourceDir, folder);
    const destPath = path.join(deploymentDir, folder);
    if (fs.existsSync(sourcePath)) {
      console.log(`📁 Copying folder: ${folder}`);
      copyDirectory(sourcePath, destPath);
    } else {
      console.log(`⚠️  Folder not found: ${folder}`);
    }
  }
  console.log('📁 After upload, on server run: npm install --production (then restart IIS).');
}

async function uploadViaFtp(): Promise<void> {
  const client = new ftp.Client();
  client.ftp.verbose = false;
  try {
    console.log('\n📤 Connecting to FTP server...');
    await client.access({
      host: ftpConfig.host!,
      user: ftpConfig.user!,
      password: ftpConfig.password!,
      port: ftpConfig.port,
      secure: ftpConfig.secure
    });
    console.log('✅ Connected to FTP server');
    console.log(`📁 FTP Remote Path: ${ftpConfig.remotePath}`);
    if (ftpConfig.remotePath !== '/') {
      await client.ensureDir(ftpConfig.remotePath);
    }
    try {
      await client.removeDir(path.posix.join(ftpConfig.remotePath, 'src'));
      console.log('🗑️  Cleared remote src');
    } catch (err) {
      console.warn('⚠️  Could not clear remote src:', (err as Error).message);
    }
    try {
      await client.removeDir(path.posix.join(ftpConfig.remotePath, 'dist'));
      console.log('🗑️  Cleared remote dist');
    } catch (err) {
      console.warn('⚠️  Could not clear remote dist:', (err as Error).message);
    }
    const totalFiles = countFilesInDirectory(deploymentDir);
    console.log(`📊 Total files to upload: ${totalFiles}`);
    let uploadedFiles = 0;
    const uploadWithProgress = async (localPath: string, remotePath: string) => {
      try {
        await client.uploadFrom(localPath, remotePath);
        uploadedFiles++;
        const pct = Math.round((uploadedFiles / totalFiles) * 100);
        console.log(`📤 Uploaded: ${uploadedFiles}/${totalFiles} (${pct}%) - ${path.basename(localPath)}`);
      } catch (error) {
        console.error(`❌ Failed to upload ${localPath}:`, error);
      }
    };
    await uploadDirectoryWithProgress(client, deploymentDir, ftpConfig.remotePath, uploadWithProgress);
    console.log(`✅ All files uploaded (${uploadedFiles}/${totalFiles})`);
  } catch (error) {
    console.error('❌ FTP upload failed:', error);
    throw error;
  } finally {
    client.close();
  }
}

function countFilesInDirectory(dirPath: string): number {
  let count = 0;
  try {
    const items = fs.readdirSync(dirPath);
    for (const item of items) {
      const itemPath = path.join(dirPath, item);
      if (fs.statSync(itemPath).isDirectory()) {
        count += countFilesInDirectory(itemPath);
      } else {
        count++;
      }
    }
  } catch {
    // ignore
  }
  return count;
}

async function uploadDirectoryWithProgress(
  client: ftp.Client,
  localDir: string,
  remoteDir: string,
  uploadCallback: (localPath: string, remotePath: string) => Promise<void>
): Promise<void> {
  const items = fs.readdirSync(localDir);
  for (const item of items) {
    const localPath = path.join(localDir, item);
    const remotePath = path.join(remoteDir, item).replace(/\\/g, '/');
    if (fs.statSync(localPath).isDirectory()) {
      try {
        await client.ensureDir(remotePath);
      } catch {
        // ignore
      }
      await uploadDirectoryWithProgress(client, localPath, remotePath, uploadCallback);
    } else {
      await uploadCallback(localPath, remotePath);
    }
  }
}

function createDeploymentInfo(): void {
  const deploymentInfo = {
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version ?? '0.1.0',
    nodeVersion: process.version,
    type: 'mochahost-node-ts-starter-deployment',
    files: filesToCopy,
    folders: foldersToCopy,
    excluded: excludeFromSrc,
    ftp: {
      host: ftpConfig.host,
      user: ftpConfig.user,
      port: ftpConfig.port,
      secure: ftpConfig.secure,
      remotePath: ftpConfig.remotePath,
    },
    notes: [
      'App runs from project root; web.config routes to dist/server.js',
      '.env must be in project root (deployed from .env.prod).',
    ],
  };
  fs.writeFileSync(
    path.join(deploymentDir, 'deployment-info.json'),
    JSON.stringify(deploymentInfo, null, 2)
  );
  console.log('📋 Created deployment-info.json');
}

function createInstructions(): void {
  const instructions = `# Mochahost Deployment

Deployment uploaded via FTP. Includes: dist/, src/, package.json, web.config, .env (from .env.prod).

## On the server (Plesk / SSH)

1. \`npm install --production\`
2. Restart the IIS application in Plesk
3. Test: \`node dist/server.js\` and visit / and /health

## Environment

.env is in project root. Use dot notation (process.env.PORT) in code.
web.config routes all requests to dist/server.js.

## FTP used

- Host: ${ftpConfig.host}
- User: ${ftpConfig.user}
- Port: ${ftpConfig.port}
- Remote Path: ${ftpConfig.remotePath}
`;
  fs.writeFileSync(path.join(deploymentDir, 'DEPLOYMENT-INSTRUCTIONS.md'), instructions);
  console.log('📖 Created DEPLOYMENT-INSTRUCTIONS.md');
}

async function deploy(): Promise<void> {
  try {
    console.log('🚀 Starting Mochahost deployment...\n');
    validateFtpConfig();
    console.log('🔧 Env file:', envPath, 'exists:', fs.existsSync(envPath));
    console.log('🔧 FTP:', { ...ftpConfig, password: ftpConfig.password ? '***' : 'not set' });
    buildProject();
    createDeploymentDir();
    createDeploymentPackage();
    createDeploymentInfo();
    createInstructions();
    await uploadViaFtp();
    try {
      if (fs.existsSync(deploymentDir)) {
        fs.rmSync(deploymentDir, { recursive: true, force: true });
        console.log(`🗑️  Deleted local deployment dir`);
      }
    } catch (cleanupError) {
      console.error('⚠️  Cleanup failed:', cleanupError);
    }
    console.log('\n🎉 Mochahost deployment completed.');
    console.log(`🌐 Remote: ${ftpConfig.host}${ftpConfig.remotePath}`);
    console.log('\n📋 On server: npm install --production → Restart IIS → Test / and /health');
    console.log('🔗 Test: https://' + ftpConfig.host + '/ and /health');
  } catch (error) {
    console.error('❌ Deployment failed:', error);
    process.exit(1);
  }
}

deploy();
