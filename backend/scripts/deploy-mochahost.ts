import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import * as ftp from 'basic-ftp';
import dotenv from 'dotenv';

console.log('🚀 Starting Radio Station Mochahost FTP deployment script...');

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
  'channels',  // HLS files already uploaded; uncomment to re-upload
  'public',
];

// Only exclude the deployment scripts themselves
const excludeFromSrc = [
  'scripts/deploy.ts',
  'scripts/deploy-full.ts',
  'scripts/deploy-mochahost.ts'
];

console.log('📁 Source directory:', sourceDir);
console.log('📁 Deployment directory:', deploymentDir);

// Validate FTP configuration
function validateFtpConfig() {
  console.log('🔧 Validating FTP configuration...');
  
  const required = ['FTP_HOST', 'FTP_USER', 'FTP_PASSWORD'] as const;
  const missing = required.filter((key) => !process.env[key]);
  
  if (missing.length > 0) {
    console.error('❌ Missing required FTP environment variables:');
    missing.forEach(key => console.error(`   - ${key}`));
    console.error('\nPlease add these to your .env.prod file:');
    console.error('FTP_HOST=your-ftp-server.com');
    console.error('FTP_USER=your-username');
    console.error('FTP_PASSWORD=your-password');
    console.error('FTP_PORT=21 (optional, default: 21)');
    console.error('FTP_SECURE=false (optional, default: false)');
    console.error('FTP_REMOTE_PATH=/ (optional, default: /)');
    process.exit(1);
  }
  
  console.log('✅ FTP configuration validated');
  console.log(`   Host: ${ftpConfig.host}`);
  console.log(`   User: ${ftpConfig.user}`);
  console.log(`   Port: ${ftpConfig.port}`);
  console.log(`   Secure: ${ftpConfig.secure}`);
  console.log(`   Remote Path: ${ftpConfig.remotePath}`);
}

// Create deployment directory
function createDeploymentDir() {
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

// Copy a file
function copyFile(sourcePath: string, destPath: string) {
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

// Copy a directory recursively
function copyDirectory(sourcePath: string, destPath: string) {
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

// Create deployment package
function createDeploymentPackage() {
  console.log('\n📦 Creating deployment package...');
  
  // Copy individual files
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
  
  // Handle environment file - copy .env.prod and rename to .env
  console.log('\n🔧 Handling environment file...');
  const envProdPath = path.join(sourceDir, '.env.prod');
  const envDestPath = path.join(deploymentDir, '.env');
  
  if (fs.existsSync(envProdPath)) {
    copyFile(envProdPath, envDestPath);
    console.log('✅ Copied .env.prod as .env for production');
  } else {
    console.log('⚠️  .env.prod file not found - you may need to create it');
    console.log('   Expected location: .env.prod');
    console.log('   Fallback: checking for .env...');
    
    // Fallback to .env if .env.prod doesn't exist
    const envPath = path.join(sourceDir, '.env');
    if (fs.existsSync(envPath)) {
      copyFile(envPath, envDestPath);
      console.log('✅ Copied .env as fallback');
    } else {
      console.log('❌ No environment file found (.env.prod or .env)');
    }
  }
  
  // Handle web.config - copy web.config to deployment directory
  console.log('\n🔧 Handling web.config...');
  const webConfigPath = path.join(sourceDir, 'web.config');
  const webConfigDestPath = path.join(deploymentDir, 'web.config');
  
  if (fs.existsSync(webConfigPath)) {
    copyFile(webConfigPath, webConfigDestPath);
    console.log('✅ Copied web.config for deployment');
  } else {
    console.log('⚠️  web.config not found');
  }
  
  // Copy folders
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

// Upload files via FTP
async function uploadViaFtp() {
  const client = new ftp.Client();
  client.ftp.verbose = false; // Disable verbose logging for cleaner output
  
  try {
    console.log('\n📤 Connecting to FTP server...');
    
    // Create a properly typed config object
    const config = {
      host: ftpConfig.host!,
      user: ftpConfig.user!,
      password: ftpConfig.password!,
      port: ftpConfig.port,
      secure: ftpConfig.secure
    };
    
    await client.access(config);
    console.log('✅ Connected to FTP server');
    
    // Navigate to remote directory
    console.log(`📁 FTP Remote Path: ${ftpConfig.remotePath}`);
    if (ftpConfig.remotePath !== '/') {
      console.log(`📁 Navigating to remote path: ${ftpConfig.remotePath}`);
      await client.ensureDir(ftpConfig.remotePath);
    }
    
    // Optional: clear remote src/dist so upload is clean (skip if first deploy)
    try {
      const remoteSrc = path.posix.join(ftpConfig.remotePath, 'src');
      await client.removeDir(remoteSrc);
      console.log('🗑️  Cleared remote src directory');
    } catch (err) {
      console.warn('⚠️  Could not clear remote src (may not exist):', (err as Error).message);
    }
    try {
      const remoteDist = path.posix.join(ftpConfig.remotePath, 'dist');
      await client.removeDir(remoteDist);
      console.log('🗑️  Cleared remote dist directory');
    } catch (err) {
      console.warn('⚠️  Could not clear remote dist (may not exist):', (err as Error).message);
    }
    // Channels HLS already on server; skip clear so we don't remove them
    // try {
    //   const remoteChannels = path.posix.join(ftpConfig.remotePath, 'channels');
    //   await client.removeDir(remoteChannels);
    //   console.log('🗑️  Cleared remote channels directory');
    // } catch (err) {
    //   console.warn('⚠️  Could not clear remote channels (may not exist):', (err as Error).message);
    // }

    console.log('📤 Starting file upload...');
    
    // Count total files to upload
    const totalFiles = countFilesInDirectory(deploymentDir);
    console.log(`📊 Total files to upload: ${totalFiles}`);
    
    let uploadedFiles = 0;
    
    // Custom upload function with progress tracking
    const uploadWithProgress = async (localPath: string, remotePath: string) => {
      try {
        await client.uploadFrom(localPath, remotePath);
        uploadedFiles++;
        const percentage = Math.round((uploadedFiles / totalFiles) * 100);
        console.log(`📤 Uploaded: ${uploadedFiles}/${totalFiles} files (${percentage}%) - ${path.basename(localPath)}`);
      } catch (error) {
        console.error(`❌ Failed to upload ${localPath}:`, error);
      }
    };
    
    // Upload all files from deployment directory with progress
    await uploadDirectoryWithProgress(client, deploymentDir, ftpConfig.remotePath, uploadWithProgress);
    
    console.log(`✅ All files uploaded successfully! (${uploadedFiles}/${totalFiles} files)`);
    
  } catch (error) {
    console.error('❌ FTP upload failed:', error);
    throw error;
  } finally {
    client.close();
  }
}

// Count files in directory recursively
function countFilesInDirectory(dirPath: string): number {
  let count = 0;
  
  try {
    const items = fs.readdirSync(dirPath);
    
    for (const item of items) {
      const itemPath = path.join(dirPath, item);
      const stat = fs.statSync(itemPath);
      
      if (stat.isDirectory()) {
        count += countFilesInDirectory(itemPath);
      } else {
        count++;
      }
    }
  } catch (error) {
    console.warn(`⚠️  Could not count files in ${dirPath}:`, error);
  }
  
  return count;
}

// Upload directory with progress tracking
async function uploadDirectoryWithProgress(
  client: ftp.Client, 
  localDir: string, 
  remoteDir: string, 
  uploadCallback: (localPath: string, remotePath: string) => Promise<void>
) {
  try {
    const items = fs.readdirSync(localDir);
    
    for (const item of items) {
      const localPath = path.join(localDir, item);
      const remotePath = path.join(remoteDir, item).replace(/\\/g, '/');
      const stat = fs.statSync(localPath);
      
      if (stat.isDirectory()) {
        // Create remote directory
        try {
          await client.ensureDir(remotePath);
        } catch (error) {
          console.warn(`⚠️  Could not create remote directory ${remotePath}:`, error);
        }
        
        // Recursively upload directory contents
        await uploadDirectoryWithProgress(client, localPath, remotePath, uploadCallback);
      } else {
        // Upload file with progress
        await uploadCallback(localPath, remotePath);
      }
    }
  } catch (error) {
    console.error(`❌ Error uploading directory ${localDir}:`, error);
  }
}

function createDeploymentInfo(): void {
  const deploymentInfo = {
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version ?? '0.1.0',
    nodeVersion: process.version,
    type: 'radio-station-mochahost-deployment',
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

  const infoPath = path.join(deploymentDir, 'deployment-info.json');
  fs.writeFileSync(infoPath, JSON.stringify(deploymentInfo, null, 2));
  console.log('📋 Created deployment-info.json');
}

function createInstructions(): void {
  const instructions = `# Radio Station Mochahost Deployment

Deployment was uploaded via FTP. This package includes:
- dist/ (built app), src/, package.json, web.config, tsconfig.json, .env (from .env.prod)

## On the server (Plesk / SSH)

1. \`npm install --production\`
2. Restart the IIS application in Plesk
3. Test: \`node dist/server.js\` and visit / and /health

## Environment

.env is copied from .env.prod. Keep in project root. Use dot notation (process.env.PORT) in code.
web.config routes all requests to dist/server.js.

## FTP used

- Host: ${ftpConfig.host}
- User: ${ftpConfig.user}
- Port: ${ftpConfig.port}
- Remote Path: ${ftpConfig.remotePath}
`;

  const instructionsPath = path.join(deploymentDir, 'DEPLOYMENT-INSTRUCTIONS.md');
  fs.writeFileSync(instructionsPath, instructions);
  console.log('📖 Created DEPLOYMENT-INSTRUCTIONS.md');
}

async function deploy(): Promise<void> {
  try {
    console.log('🚀 Starting Radio Station Mochahost deployment...\n');

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
        console.log(`🗑️  Deleted local deployment dir: ${deploymentDir}`);
      }
    } catch (cleanupError) {
      console.error('⚠️  Cleanup failed:', cleanupError);
    }

    console.log('\n🎉 Radio Station Mochahost deployment completed.');
    console.log(`🌐 Remote: ${ftpConfig.host}${ftpConfig.remotePath}`);
    console.log('\n📋 On server: npm install --production → Restart IIS → Test / and /health');
    console.log('🔗 Test: https://' + ftpConfig.host + '/ and /health');
  } catch (error) {
    console.error('❌ Deployment failed:', error);
    process.exit(1);
  }
}

// Run deployment
deploy(); 