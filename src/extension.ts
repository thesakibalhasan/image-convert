import * as vscode from 'vscode';
// import { activate as activatePNG } from './png';
import { activateDynamicCommands } from './convert';

import { exec } from 'child_process';

// Check if ImageMagick is installed
function checkImageMagickInstalled(): Promise<boolean> {
  return new Promise((resolve) => {
    exec('magick --version', (error) => {
      if (error) {
        resolve(false); // Not installed
      } else {
        resolve(true); // Installed
      }
    });
  });
}

// Prompt user to install ImageMagick
async function promptImageMagickInstallation() {
  const isInstalled = await checkImageMagickInstalled();

  if (!isInstalled) {
    vscode.window.showErrorMessage(
      'ImageMagick is not installed. This extension requires ImageMagick to work properly.',
      'Download ImageMagick'
    ).then((selection) => {
      if (selection === 'Download ImageMagick') {
        const platform = process.platform;
        let downloadUrl = 'https://imagemagick.org/script/download.php';
        if (platform === 'win32') {
          downloadUrl = 'https://imagemagick.org/script/download.php#windows';
        } else if (platform === 'darwin') {
          downloadUrl = 'https://imagemagick.org/script/download.php#macosx';
        } else if (platform === 'linux') {
          downloadUrl = 'https://imagemagick.org/script/download.php#linux';
        }
        vscode.env.openExternal(vscode.Uri.parse(downloadUrl));
      }
    });
  }
}

// Activate the extension
export function activate(context: vscode.ExtensionContext) {
  // Check ImageMagick installation
  promptImageMagickInstallation();

  // Activate PNG-specific commands
  // activatePNG(context);


  // Activate GIF-specific commands


  activateDynamicCommands(context);

}

// Deactivate the extension
export function deactivate() {}
