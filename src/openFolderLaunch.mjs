import path from 'node:path';
import { pathToFileURL } from 'node:url';

// Pure spawn spec for Open folder. Reveal (select the file in the native
// file manager) only when one filePath exists on disk: macOS `open -R`,
// Windows `explorer /select,`, Linux FileManager1.ShowItems with
// xdg-open-on-folder fallback. Folder-only callers (CLI Open folder,
// Explorer Settings roots, Export dest) and a missing file open the folder.
// Additional `filePaths` (callers pass only paths that exist, in request
// order): length 0 → folder open; length 1 → same as single reveal; length
// > 1 in one directory on macOS → `open -R` every file (one Finder window).
// Linux ShowItems opens one window per URI, and Windows `/select` cannot
// highlight more than one file, so those reveal the first path. A list that
// spans directories opens `folderPath` with nothing selected. Tests lock
// this argv; the OS opener is never invoked from tests.
export function buildOpenFolderLaunch ({ platform, folderPath, filePath, fileExists, filePaths }) {
  const multi = Array.isArray(filePaths) ? filePaths.filter(Boolean) : null;
  if (multi) {
    if (multi.length === 0) {
      return buildOpenFolderLaunch({ platform, folderPath, fileExists: false });
    }
    if (multi.length === 1) {
      return buildOpenFolderLaunch({
        platform,
        folderPath,
        filePath: multi[0],
        fileExists: true
      });
    }
    const dir = path.dirname(multi[0]);
    const sameDir = multi.every(p => path.dirname(p) === dir);
    if (platform === 'darwin' && sameDir) {
      return { cmd: 'open', args: ['-R', ...multi] };
    }
    if (sameDir) {
      return buildOpenFolderLaunch({
        platform,
        folderPath,
        filePath: multi[0],
        fileExists: true
      });
    }
    return buildOpenFolderLaunch({ platform, folderPath, fileExists: false });
  }

  const reveal = Boolean(filePath && fileExists);
  if (platform === 'win32') {
    return reveal
      ? { cmd: 'explorer', args: [`/select,${filePath}`] }
      : { cmd: 'explorer', args: [folderPath] };
  }
  if (platform === 'darwin') {
    return reveal
      ? { cmd: 'open', args: ['-R', filePath] }
      : { cmd: 'open', args: [folderPath] };
  }
  if (reveal) {
    const uri = pathToFileURL(filePath).href;
    return {
      cmd: 'dbus-send',
      args: [
        '--session',
        '--print-reply',
        '--dest=org.freedesktop.FileManager1',
        '--type=method_call',
        '/org/freedesktop/FileManager1',
        'org.freedesktop.FileManager1.ShowItems',
        `array:string:${uri}`,
        'string:'
      ],
      fallback: { cmd: 'xdg-open', args: [folderPath] }
    };
  }
  return { cmd: 'xdg-open', args: [folderPath] };
}
