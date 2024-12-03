const fs = require('fs');
const path = require('path');

// Check if credentials file is provided as argument
const credentialsFile = process.argv[2];
if (!credentialsFile) {
  console.error('Please provide the path to your Google Cloud credentials JSON file');
  console.error('Usage: node setup-google-cloud.js path/to/credentials.json');
  process.exit(1);
}

try {
  // Read and validate credentials file
  const credentials = JSON.parse(fs.readFileSync(credentialsFile, 'utf8'));
  
  if (!credentials.type || !credentials.project_id || !credentials.private_key) {
    throw new Error('Invalid Google Cloud credentials file');
  }

  // Create credentials directory if it doesn't exist
  const credentialsDir = path.join(process.cwd(), 'credentials');
  if (!fs.existsSync(credentialsDir)) {
    fs.mkdirSync(credentialsDir);
  }

  // Copy credentials file to project
  const targetPath = path.join(credentialsDir, 'google-cloud.json');
  fs.copyFileSync(credentialsFile, targetPath);
  console.log('✓ Credentials file copied to project');

  // Update .env file
  const envPath = path.join(process.cwd(), '.env');
  let envContent = '';
  
  if (fs.existsSync(envPath)) {
    envContent = fs.readFileSync(envPath, 'utf8');
  }

  // Remove any existing GOOGLE_APPLICATION_CREDENTIALS entries
  envContent = envContent
    .split('\n')
    .filter(line => !line.startsWith('GOOGLE_APPLICATION_CREDENTIALS='))
    .join('\n');

  // Add new credentials path
  const relativePath = path.relative(process.cwd(), targetPath).replace(/\\/g, '/');
  envContent += `\nGOOGLE_APPLICATION_CREDENTIALS=${relativePath}\n`;

  fs.writeFileSync(envPath, envContent.trim() + '\n');
  console.log('✓ Environment variables updated');

  // Update .gitignore to exclude credentials
  const gitignorePath = path.join(process.cwd(), '.gitignore');
  let gitignoreContent = '';
  
  if (fs.existsSync(gitignorePath)) {
    gitignoreContent = fs.readFileSync(gitignorePath, 'utf8');
  }

  if (!gitignoreContent.includes('credentials/')) {
    gitignoreContent += '\n# Google Cloud credentials\ncredentials/\n';
    fs.writeFileSync(gitignorePath, gitignoreContent.trim() + '\n');
    console.log('✓ .gitignore updated');
  }

  // Update package.json to add dev script with credentials
  const packagePath = path.join(process.cwd(), 'package.json');
  const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));

  // Update or add the dev script
  packageJson.scripts = packageJson.scripts || {};
  packageJson.scripts.dev = 'next dev';

  fs.writeFileSync(packagePath, JSON.stringify(packageJson, null, 2) + '\n');
  console.log('✓ package.json updated');

  console.log('\nSetup completed successfully!');
  console.log('\nYou can now start the application with:');
  console.log('npm run dev');

} catch (error) {
  console.error('Error during setup:', error.message);
  process.exit(1);
}
