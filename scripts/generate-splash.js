// Simple script to copy icon as splash screen
// For a professional splash with glow effect, you can use online tools like:
// https://www.appicon.co/ or https://romannurik.github.io/AndroidAssetStudio/

const fs = require('fs');
const path = require('path');

const iconPath = path.join(__dirname, '../assets/icon.png');
const splashPath = path.join(__dirname, '../assets/splash.png');

// For now, we'll copy the icon as splash
// You can later replace this with a professional splash screen with glow effects
fs.copyFileSync(iconPath, splashPath);

console.log('✅ Splash screen created! To add glow effect, consider using:');
console.log('   - https://www.appicon.co/ (automatic splash generation)');
console.log('   - https://makeappicon.com/ (includes glow effects)');
console.log('   - Or use Figma/Photoshop to add glow manually');
