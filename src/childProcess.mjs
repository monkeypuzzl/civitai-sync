import { spawn } from 'child_process';

export async function spawnChild (command = '', args = [], options = {}, progressFn = () => {}) {
  const child = spawn(command, args, options);

  return new Promise((resolve, reject) => {
    let stdout = '';
    let stderr = '';

    child.stdout.on('data', data => {
      stdout += data;
      progressFn(data.toString());
    });

    child.stderr.on('data', data => {
      stderr += data;
      reject({ stdout, stderr });
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve({ code, stdout, stderr });
      }

      else {
        reject({ code, stdout, stderr });
      }
    });
  });
}
