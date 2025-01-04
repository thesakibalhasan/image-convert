import * as vscode from 'vscode';
import { spawn } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';

export function convertToCustomFormat(fileUri: vscode.Uri) {
  if (!fileUri) {
    vscode.window.showErrorMessage('No file selected.');
    return;
  }

  vscode.window
    .showInputBox({
      placeHolder: 'Enter the custom format (e.g., abc)',
      prompt: 'Type the custom format you want to convert to.',
      validateInput: (value) => {
        if (!value || !/^[a-zA-Z0-9]+$/.test(value)) {
          return 'Invalid format. Please use alphanumeric characters only.';
        }
        return null;
      },
    })
    .then((customFormat) => {
      if (!customFormat) {
        vscode.window.showWarningMessage('Conversion cancelled. No custom format provided.');
        return;
      }

      const inputPath = fileUri.fsPath.replace(/\\/g, '/'); // Sanitize file path
      const outputDir = path.join(path.dirname(inputPath), 'Converted');
      const tempSvgPath = path.join(outputDir, 'temp03489534-0853409853049852345324sdasdfasd.svg');
      const tempPngPath = path.join(outputDir, 'temp03489534-0853409853049852345324sdasdfasd.png');
      const outputPath = path.join(outputDir, `${path.basename(inputPath, path.extname(inputPath))}.${customFormat}`);

      // Ensure the "Converted" directory exists
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir);
      }

      vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: `Converting ${inputPath} to .${customFormat}...`,
          cancellable: true,
        },
        async (progress, token) => {
          return new Promise((resolve, reject) => {
            // Step 1: Convert to temp.svg
            const tempSvgCommand = ['convert', inputPath, tempSvgPath];
            const tempSvgProcess = spawn('magick', tempSvgCommand);

            tempSvgProcess.on('close', (svgCode) => {
              if (svgCode === 0) {
                // Step 2: Convert temp.svg to temp.png
                const tempPngCommand = ['convert', tempSvgPath, tempPngPath];
                const tempPngProcess = spawn('magick', tempPngCommand);

                tempPngProcess.on('close', (pngCode) => {
                  if (pngCode === 0) {
                    // Delete temp.svg after successful conversion to temp.png
                    if (fs.existsSync(tempSvgPath)) {
                      fs.unlinkSync(tempSvgPath);
                    }

                    // Step 3: Convert temp.png to final format
                    const finalCommand = ['convert', tempPngPath, outputPath];
                    const finalProcess = spawn('magick', finalCommand);

                    let progressPercent = 0;
                    const interval = setInterval(() => {
                      progressPercent += 10;
                      if (progressPercent > 100) {
                        progressPercent = 100;
                      }
                      progress.report({ increment: 10, message: `${progressPercent}% completed...` });
                    }, 500);

                    finalProcess.on('close', (finalCode) => {
                      clearInterval(interval);
                      if (finalCode === 0) {
                        // Delete temp.png after successful final conversion
                        if (fs.existsSync(tempPngPath)) {
                          fs.unlinkSync(tempPngPath);
                        }
                        vscode.window.showInformationMessage(
                          `Successfully converted to .${customFormat}: ${outputPath}`
                        );
                        resolve(undefined);
                      } else {
                        vscode.window.showErrorMessage(
                          `Error converting to .${customFormat}. Process exited with code ${finalCode}.`
                        );
                        reject(new Error(`Process exited with code ${finalCode}`));
                      }
                    });

                    finalProcess.on('error', (err) => {
                      clearInterval(interval);
                      reject(new Error(`Error during final conversion: ${err.message}`));
                    });
                  } else {
                    vscode.window.showErrorMessage(
                      `Error during conversion from temp.svg to temp.png. Process exited with code ${pngCode}.`
                    );
                    reject(new Error(`temp.svg to temp.png conversion process exited with code ${pngCode}`));
                  }
                });

                tempPngProcess.on('error', (err) => {
                  reject(new Error(`Error during temp.svg to temp.png conversion: ${err.message}`));
                });
              } else {
                vscode.window.showErrorMessage(
                  `Error during temp conversion to SVG. Process exited with code ${svgCode}.`
                );
                reject(new Error(`Temp conversion process exited with code ${svgCode}`));
              }
            });

            tempSvgProcess.on('error', (err) => {
              reject(new Error(`Error during temp conversion to SVG: ${err.message}`));
            });

            // Handle cancellation
            token.onCancellationRequested(() => {
              tempSvgProcess.kill();
              vscode.window.showWarningMessage(`Conversion to .${customFormat} cancelled.`);
              reject(new Error('Cancelled by user.'));
            });
          });
        }
      );
    });
}
