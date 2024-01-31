import spawnAsync from '@expo/spawn-async';
import fs from 'fs-extra';
import path from 'path';

import { installDependencies } from './packageManager';
import { PackageManagerName } from './resolvePackageManager';
import { SubstitutionData } from './types';

// These dependencies will be removed from the example app (`expo init` adds them)
const DEPENDENCIES_TO_REMOVE = ['expo-status-bar', 'expo-splash-screen'];

/**
 * Initializes a new Expo project as an example app.
 */
export async function createExampleApp(
  data: SubstitutionData,
  targetDir: string,
  packageManager: PackageManagerName
): Promise<void> {
  console.log('🎭 Creating the example app...');

  const exampleProjectSlug = `${data.project.slug}-example`;

  await spawnAsync(
    'expo',
    ['init', exampleProjectSlug, '--template', 'expo-template-blank-typescript'],
    {
      cwd: targetDir,
      stdio: ['ignore', 'ignore', 'inherit'],
    }
  );

  // `expo init` creates a new folder with the same name as the project slug
  const appTmpPath = path.join(targetDir, exampleProjectSlug);

  // Path to the target example dir
  const appTargetPath = path.join(targetDir, 'example');

  console.log('🛠  Configuring the example app...');

  // "example" folder already exists and contains template files,
  // that should replace these created by `expo init`.
  await moveFiles(appTargetPath, appTmpPath);

  // Cleanup the "example" dir
  await fs.rmdir(appTargetPath);

  // Move the temporary example app to "example" dir
  await fs.rename(appTmpPath, appTargetPath);

  await addMissingAppConfigFields(appTargetPath, data);

  console.log('👷 Prebuilding the example app...');
  await prebuildExampleApp(appTargetPath);

  await modifyPackageJson(appTargetPath);

  console.log('📦 Installing dependencies in the example app...');
  await installDependencies(packageManager, appTargetPath);

  console.log('🥥 Installing iOS pods in the example app...');
  await podInstall(appTargetPath);
}

/**
 * Copies files from one directory to another.
 */
async function moveFiles(fromPath: string, toPath: string): Promise<void> {
  for (const file of await fs.readdir(fromPath)) {
    await fs.move(path.join(fromPath, file), path.join(toPath, file), {
      overwrite: true,
    });
  }
}

/**
 * Adds missing configuration that are required to run `expo prebuild`.
 */
async function addMissingAppConfigFields(appPath: string, data: SubstitutionData): Promise<void> {
  const appConfigPath = path.join(appPath, 'app.json');
  const appConfig = await fs.readJson(appConfigPath);
  const appId = `${data.project.package}.example`;

  // Android package name needs to be added to app.json
  if (!appConfig.expo.android) {
    appConfig.expo.android = {};
  }
  appConfig.expo.android.package = appId;

  // Specify iOS bundle identifier
  if (!appConfig.expo.ios) {
    appConfig.expo.ios = {};
  }
  appConfig.expo.ios.bundleIdentifier = appId;

  await fs.writeJson(appConfigPath, appConfig, {
    spaces: 2,
  });
}

/**
 * Applies necessary changes to **package.json** of the example app.
 * It means setting the autolinking config and removing unnecessary dependencies.
 */
async function modifyPackageJson(appPath: string): Promise<void> {
  const packageJsonPath = path.join(appPath, 'package.json');
  const packageJson = await fs.readJson(packageJsonPath);

  if (!packageJson.expo) {
    packageJson.expo = {};
  }

  // Set the native modules dir to the root folder,
  // so that the autolinking can detect and link the module.
  packageJson.expo.autolinking = {
    nativeModulesDir: '..',
  };

  // Remove unnecessary dependencies
  for (const dependencyToRemove of DEPENDENCIES_TO_REMOVE) {
    delete packageJson.dependencies[dependencyToRemove];
  }

  await fs.writeJson(packageJsonPath, packageJson, {
    spaces: 2,
  });
}

/**
 * Runs `expo prebuild` in the example app.
 */
async function prebuildExampleApp(exampleAppPath: string): Promise<void> {
  try {
    await spawnAsync('expo', ['prebuild', '--no-install'], {
      cwd: exampleAppPath,
      stdio: ['ignore', 'ignore', 'pipe'],
    });
  } catch (error: any) {
    console.error(error.stderr);
    process.exit(1);
  }
}

/**
 * Runs `pod install` in the iOS project at the given path.
 */
async function podInstall(appPath: string): Promise<void> {
  try {
    await spawnAsync('pod', ['install'], {
      cwd: path.join(appPath, 'ios'),
      stdio: ['ignore', 'ignore', 'pipe'],
    });
  } catch (error: any) {
    console.error(error.stderr);
    process.exit(1);
  }
}
