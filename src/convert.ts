import * as vscode from 'vscode';
import { spawn } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';



function checkImageMagick(): Promise<boolean> {
  return new Promise((resolve) => {
    const process = spawn('magick', ['-version']);

    process.on('close', (code) => {
      resolve(code === 0); // If the process exits with code 0, ImageMagick is installed.
    });

    process.on('error', () => {
      resolve(false); // If there's an error starting the process, ImageMagick is not installed.
    });
  });
}

function promptImageMagickDownload() {
  vscode.window
    .showErrorMessage(
      'ImageMagick is not installed or not accessible.',
      'Download ImageMagick'
    )
    .then((selection) => {
      if (selection === 'Download ImageMagick') {
        vscode.window
          .showQuickPick(['Windows', 'Mac', 'Linux'], {
            placeHolder: 'Select your operating system',
          })
          .then((os) => {
            if (os === 'Windows') {
              vscode.env.openExternal(
                vscode.Uri.parse('https://imagemagick.org/script/download.php#windows')
              );
            } else if (os === 'Mac') {
              vscode.env.openExternal(
                vscode.Uri.parse('https://imagemagick.org/script/download.php#macosx')
              );
            } else if (os === 'Linux') {
              vscode.env.openExternal(
                vscode.Uri.parse('https://imagemagick.org/script/download.php#linux')
              );
            }
          });
      }
    });
}


export function convert(fileUri: vscode.Uri, format: string, quality: string) {
  if (!fileUri) {
    vscode.window.showInformationMessage('Image Convert Extention Activated');
    return;
  }

  const inputPath = fileUri.fsPath.replace(/\\/g, '/'); // Sanitize file path
  const outputDir = path.join(path.dirname(inputPath), 'Converted');
  const tempSvgPath = path.join(outputDir, 'temp034895340853409853049852345324sdasdfasd.svg');
  const tempPngPath = path.join(outputDir, 'temp2temp03489534-0853409853049852345324sdasdfasd.png');
  const finalOutputPath = path.join(outputDir, `${path.basename(inputPath, path.extname(inputPath))}.${format}`);

  // Ensure the "Converted" directory exists
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir);
  }

  vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: `Converting ${inputPath} to ${format.toUpperCase()} with quality ${quality}...`,
      cancellable: true,
    },
    async (progress, token) => {
      return new Promise((resolve, reject) => {
        let tempFilesToRemove: string[] = [];
        let activeProcess: any = null;

        // Step 1: Convert to temp.svg
        const tempCommandSvg = ['convert', inputPath, tempSvgPath];
        activeProcess = spawn('magick', tempCommandSvg);

        activeProcess.on('close', (code: number) => {
          if (code === 0) {
            tempFilesToRemove.push(tempSvgPath);

            // Step 2: Convert temp.svg to temp.png
            const tempCommandPng = ['convert', tempSvgPath, tempPngPath];
            activeProcess = spawn('magick', tempCommandPng);

            activeProcess.on('close', (pngCode: number) => {
              if (pngCode === 0) {
                tempFilesToRemove.push(tempPngPath);

                // Step 3: Convert temp.png to final format with quality
                const finalCommand = ['convert', tempPngPath, '-quality', quality, finalOutputPath];
                activeProcess = spawn('magick', finalCommand);

                let progressPercent = 0;
                const interval = setInterval(() => {
                  progressPercent += 10;
                  if (progressPercent > 100) {
                    progressPercent = 100;
                  }
                  progress.report({ increment: 10, message: `${progressPercent}% completed...` });
                }, 500);

                activeProcess.on('close', (finalCode: number) => {
                  clearInterval(interval);
                  if (finalCode === 0) {
                    cleanupTemporaryFiles(tempFilesToRemove);
                    vscode.window.showInformationMessage(
                      `Successfully converted to ${format.toUpperCase()} with quality ${quality}: ${finalOutputPath}`
                    );
                    resolve(undefined);
                  } else {
                    vscode.window.showErrorMessage(
                      `Error converting to ${format.toUpperCase()}. Process exited with code ${finalCode}.`
                    );
                    cleanupTemporaryFiles(tempFilesToRemove);
                    reject(new Error(`Process exited with code ${finalCode}`));
                  }
                });

                activeProcess.on('error', (err: Error) => {
                  clearInterval(interval);
                  cleanupTemporaryFiles(tempFilesToRemove);
                  reject(new Error(`Error during final conversion: ${err.message}`));
                });
              } else {
                vscode.window.showErrorMessage(
                  `Error during temp conversion to PNG. Process exited with code ${pngCode || 'unknown'}.`
                );
                cleanupTemporaryFiles(tempFilesToRemove);
                reject(new Error(`Temp conversion to PNG process exited with code ${pngCode || 'unknown'}`));
              }
            });

            activeProcess.on('error', (err: Error) => {
              cleanupTemporaryFiles(tempFilesToRemove);
              reject(new Error(`Error during temp conversion to PNG: ${err.message}`));
            });

            token.onCancellationRequested(() => {
              activeProcess.kill();
              cleanupTemporaryFiles(tempFilesToRemove);
              vscode.window.showWarningMessage(`Conversion to ${format.toUpperCase()} cancelled.`);
              reject(new Error('Cancelled by user.'));
            });
          } else {
            vscode.window.showErrorMessage(
              `Error during temp conversion to SVG. Process exited with code ${code}.`
            );
            cleanupTemporaryFiles(tempFilesToRemove);
            reject(new Error(`Temp conversion to SVG process exited with code ${code}`));
          }
        });

        activeProcess.on('error', (err: Error) => {
          cleanupTemporaryFiles(tempFilesToRemove);
          reject(new Error(`Error during temp conversion to SVG: ${err.message}`));
        });

        token.onCancellationRequested(() => {
          activeProcess.kill();
          cleanupTemporaryFiles(tempFilesToRemove);
          vscode.window.showWarningMessage(`Conversion to ${format.toUpperCase()} cancelled.`);
          reject(new Error('Cancelled by user.'));
        });
      });
    }
  );
}

// Utility function to clean up temporary files
function cleanupTemporaryFiles(files: string[]) {
  files.forEach((file) => {
    try {
      if (fs.existsSync(file)) {
        fs.unlinkSync(file);
      }
    } catch (err) {
      console.error(`Failed to delete file: ${file}`, err);
    }
  });
}



function handleProcessError(err: unknown, reject: (reason?: any) => void) {
  vscode.window.showErrorMessage(`Error: ${(err as Error).message}`, 'Install ImageMagick').then((selection) => {
    if (selection === 'Install ImageMagick') {
      vscode.window.showQuickPick(['Windows', 'Mac', 'Linux'], {
        placeHolder: 'Select your operating system',
      }).then((os) => {
        if (os === 'Windows') {
          vscode.env.openExternal(vscode.Uri.parse('https://imagemagick.org/script/download.php#windows'));
        } else if (os === 'Mac') {
          vscode.env.openExternal(vscode.Uri.parse('https://imagemagick.org/script/download.php#macosx'));
        } else if (os === 'Linux') {
          vscode.env.openExternal(vscode.Uri.parse('https://imagemagick.org/script/download.php#linux'));
        }
      });
    }
  });
  reject(err);
}


function registerCommand(context: vscode.ExtensionContext, command: string, format: string, quality: string) {
  const disposable = vscode.commands.registerCommand(command, (fileUri: vscode.Uri) => {
    convert(fileUri, format, quality);

  });
  context.subscriptions.push(disposable);
}

import { convertToCustomFormat } from './custom';

export function activateDynamicCommands(context: vscode.ExtensionContext) {
  const formats = [
    
      { command: 'image-convert.convertToPDF', format: 'pdf' , quality: '100'  },
      { command: 'image-convert.convertToARW', format: 'arw' , quality: '100'   },
      { command: 'image-convert.convertToAVIF', format: 'avif' , quality: '100'   },
      { command: 'image-convert.convertToGIF', format: 'gif' , quality: '100'   },
      { command: 'image-convert.convertToJPG', format: 'jpg' , quality: '100'   },
      { command: 'image-convert.convertToWEBP', format: 'webp' , quality: '100'   },
      { command: 'image-convert.convertToBMP', format: 'bmp' , quality: '100'   },
      { command: 'image-convert.convertToODD', format: 'odd' , quality: '100'   },
      { command: 'image-convert.convertToPSD', format: 'psd' , quality: '100'   },
      { command: 'image-convert.convertToEPS', format: 'eps' , quality: '100'   },
      { command: 'image-convert.convertToJPEG', format: 'jpeg' , quality: '100'   },
      { command: 'image-convert.convertToTIFF', format: 'tiff' , quality: '100'   },
      { command: 'image-convert.convertToSVG', format: 'svg' , quality: '100'   },
      { command: 'image-convert.convertToCR2', format: 'cr2' , quality: '100'   },
      { command: 'image-convert.convertToCR3', format: 'cr3' , quality: '100'   },
      { command: 'image-convert.convertToCRW', format: 'crw' , quality: '100'   },
      { command: 'image-convert.convertToDCR', format: 'dcr' , quality: '100'   },
      { command: 'image-convert.convertToDNG', format: 'dng' , quality: '100'   },
      { command: 'image-convert.convertToERF', format: 'erf' , quality: '100'   },
      { command: 'image-convert.convertToHEIC', format: 'heic' , quality: '100'   },
      { command: 'image-convert.convertToHEIF', format: 'heif' , quality: '100'   },
      { command: 'image-convert.convertToICNS', format: 'icns' , quality: '100'   },
      { command: 'image-convert.convertToJFIF', format: 'jfif' , quality: '100'   },
      { command: 'image-convert.convertToMOS', format: 'mos' , quality: '100'   },
      { command: 'image-convert.convertToMRW', format: 'mrw' , quality: '100'   },
      { command: 'image-convert.convertToNEF', format: 'nef' , quality: '100'   },
      { command: 'image-convert.convertToODG', format: 'odg' , quality: '100'   },
      { command: 'image-convert.convertToORF', format: 'orf' , quality: '100'   },
      { command: 'image-convert.convertToPEF', format: 'pef' , quality: '100'   },
      { command: 'image-convert.convertToPPM', format: 'ppm' , quality: '100'   },
      { command: 'image-convert.convertToRAW', format: 'raw' , quality: '100'   },
      { command: 'image-convert.convertToTIF', format: 'tif' , quality: '100'   },
      { command: 'image-convert.convertToPS', format: 'ps' , quality: '100'   },
      { command: 'image-convert.convertToRAF', format: 'raf' , quality: '100'   },
      { command: 'image-convert.convertToRW2', format: 'rw2' , quality: '100'   },
      { command: 'image-convert.convertToXCF', format: 'xcf' , quality: '100'   },
      { command: 'image-convert.convertToX3F', format: 'x3f' , quality: '100'   },
      { command: 'image-convert.convertToXPS', format: 'xps' , quality: '100'   },
      { command: 'image-convert.convertToPNG', format: 'png' , quality: '100'   },
      { command: 'image-convert.convertToHDR', format: 'hdr' , quality: '100'   },
      { command: 'image-convert.convertToAI', format: 'ai' , quality: '100'   },
      { command: 'image-convert.convertToJPGquality10', format: 'jpg', quality: '10'  },
      { command: 'image-convert.convertToJPGquality20', format: 'jpg', quality: '20'  },
      { command: 'image-convert.convertToJPGquality30', format: 'jpg', quality: '30'  },
      { command: 'image-convert.convertToJPGquality40', format: 'jpg', quality: '40'  },
      { command: 'image-convert.convertToJPGquality50', format: 'jpg', quality: '50'  },
      { command: 'image-convert.convertToJPGquality60', format: 'jpg', quality: '60'  },
      { command: 'image-convert.convertToJPGquality70', format: 'jpg', quality: '70'  },
      { command: 'image-convert.convertToJPGquality80', format: 'jpg', quality: '80'  },
      { command: 'image-convert.convertToJPGquality90', format: 'jpg', quality: '90'  },
      { command: 'image-convert.convertToJPGquality100', format: 'jpg', quality: '100'  },
      { command: 'image-convert.convertToJPGqualitycustom', format: 'jpg', quality: 'custom'  },

      { command: 'image-convert.convertToICO', format: 'ico', quality: '100'}
      








    
    
    // Add other formats as needed
  ];

  formats.forEach(({ command, format, quality }) => {
    const disposable = vscode.commands.registerCommand(command, (fileUri: vscode.Uri) => {
      convert(fileUri, format, quality);
    });
    context.subscriptions.push(disposable);
  });

  // Register Custom Format Command
  const customCommand = vscode.commands.registerCommand('image-convert.customFormats', (fileUri: vscode.Uri) => {
    convertToCustomFormat(fileUri);
  });
  context.subscriptions.push(customCommand);
}
