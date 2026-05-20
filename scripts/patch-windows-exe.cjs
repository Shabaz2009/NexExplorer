const path = require('node:path');
const rcedit = require('rcedit');

module.exports = async function patchWindowsExe(context) {
  if (context.electronPlatformName !== 'win32') return;

  const exePath = path.join(context.appOutDir, 'NexExplorer.exe');
  const projectDir = context.packager.projectDir;
  const iconPath = path.join(projectDir, 'build', 'icon.ico');
  const manifestPath = path.join(projectDir, 'build', 'windows10-11.manifest');
  const version = context.packager.appInfo.version;

  await rcedit(exePath, {
    icon: iconPath,
    'application-manifest': manifestPath,
    'requested-execution-level': 'asInvoker',
    'file-version': version,
    'product-version': version,
    'version-string': {
      CompanyName: 'NexExplorer',
      FileDescription: 'NexExplorer for Windows 10 and 11',
      FileVersion: version,
      InternalName: 'NexExplorer',
      OriginalFilename: 'NexExplorer.exe',
      ProductName: 'NexExplorer',
      ProductVersion: version,
    },
  });
};
