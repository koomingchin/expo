import spawnAsync from '@expo/spawn-async';
import chalk from 'chalk';
import { Command } from 'commander';
import downloadTarball from 'download-tarball';
import ejs from 'ejs';
import fs from 'fs-extra';
import path from 'path';
import prompts from 'prompts';
import validateNpmPackage from 'validate-npm-package-name';

import { createExampleApp } from './createExampleApp';
import { installDependencies } from './packageManager';
import { PackageManagerName, resolvePackageManager } from './resolvePackageManager';
import { CommandOptions, CustomPromptObject, SubstitutionData } from './types';

const packageJson = require('../package.json');

// `yarn run` may change the current working dir, then we should use `INIT_CWD` env.
const CWD = process.env.INIT_CWD || process.cwd();

// Ignore some paths. Especially `package.json` as it is rendered
// from `$package.json` file instead of the original one.
const IGNORES_PATHS = ['.DS_Store', 'build', 'node_modules', 'package.json'];

/**
 * The main function of the command.
 *
 * @param target Path to the directory where to create the module. Defaults to current working dir.
 * @param command An object from `commander`.
 */
async function main(target: string | undefined, options: CommandOptions) {
  const targetDir = target ? path.join(CWD, target) : CWD;

  await fs.ensureDir(targetDir);
  await confirmTargetDirAsync(targetDir);

  options.target = targetDir;

  const data = await askForSubstitutionDataAsync(targetDir, options);
  const packageManager = await resolvePackageManager();
  const packagePath = options.source
    ? path.join(CWD, options.source)
    : await downloadPackageAsync(targetDir);
  const files = await getFilesAsync(packagePath);

  console.log('🎨 Creating Expo module from the template files...');

  // Iterate through all template files.
  for (const file of files) {
    const renderedRelativePath = ejs.render(file.replace(/^\$/, ''), data, {
      openDelimiter: '{',
      closeDelimiter: '}',
      escape: (value: string) => value.replace('.', path.sep),
    });
    const fromPath = path.join(packagePath, file);
    const toPath = path.join(targetDir, renderedRelativePath);
    const template = await fs.readFile(fromPath, { encoding: 'utf8' });
    const renderedContent = ejs.render(template, data);

    await fs.outputFile(toPath, renderedContent, { encoding: 'utf8' });
  }

  // Install dependencies and build
  await postActionsAsync(packageManager, targetDir);

  if (!options.source) {
    // Files in the downloaded tarball are wrapped in `package` dir.
    // We should remove it after all.
    await fs.remove(packagePath);
  }
  if (!options.withReadme) {
    await fs.remove(path.join(targetDir, 'README.md'));
  }
  if (!options.withChangelog) {
    await fs.remove(path.join(targetDir, 'CHANGELOG.md'));
  }
  if (options.example) {
    // Create "example" folder
    await createExampleApp(data, targetDir, packageManager);
  }

  console.log('✅ Successfully created Expo module');
}

/**
 * Recursively scans for the files within the directory. Returned paths are relative to the `root` path.
 */
async function getFilesAsync(root: string, dir: string | null = null): Promise<string[]> {
  const files: string[] = [];
  const baseDir = dir ? path.join(root, dir) : root;

  for (const file of await fs.readdir(baseDir)) {
    const relativePath = dir ? path.join(dir, file) : file;

    if (IGNORES_PATHS.includes(relativePath) || IGNORES_PATHS.includes(file)) {
      continue;
    }

    const fullPath = path.join(baseDir, file);
    const stat = await fs.lstat(fullPath);

    if (stat.isDirectory()) {
      files.push(...(await getFilesAsync(root, relativePath)));
    } else {
      files.push(relativePath);
    }
  }
  return files;
}

/**
 * Asks NPM registry for the url to the tarball.
 */
async function getNpmTarballUrl(packageName: string, version: string = 'latest'): Promise<string> {
  const { stdout } = await spawnAsync('npm', ['view', `${packageName}@${version}`, 'dist.tarball']);
  return stdout.trim();
}

/**
 * Gets the username of currently logged in user. Used as a default in the prompt asking for the module author.
 */
async function npmWhoamiAsync(targetDir: string): Promise<string | null> {
  try {
    const { stdout } = await spawnAsync('npm', ['whoami'], { cwd: targetDir });
    return stdout.trim();
  } catch {
    return null;
  }
}

/**
 * Downloads the template from NPM registry.
 */
async function downloadPackageAsync(targetDir: string): Promise<string> {
  const tarballUrl = await getNpmTarballUrl('expo-module-template');

  console.log('⬇️  Downloading module template from npm...');

  await downloadTarball({
    url: tarballUrl,
    dir: targetDir,
  });
  return path.join(targetDir, 'package');
}

/**
 * Installs dependencies and builds TypeScript files.
 */
async function postActionsAsync(packageManager: PackageManagerName, targetDir: string) {
  console.log('📦 Installing module dependencies...');
  await installDependencies(packageManager, targetDir);

  console.log('🛠  Compiling TypeScript files...');
  await spawnAsync(packageManager, ['run', 'build'], {
    cwd: targetDir,
    stdio: 'ignore',
  });
}

/**
 * Asks the user for some data necessary to render the template.
 * Some values may already be provided by command options, the prompt is skipped in that case.
 */
async function askForSubstitutionDataAsync(
  targetDir: string,
  options: CommandOptions
): Promise<SubstitutionData> {
  const defaultPackageSlug = path.basename(targetDir);
  const useDefaultSlug = options.target && validateNpmPackage(defaultPackageSlug);
  const defaultProjectName = defaultPackageSlug
    .replace(/^./, (match) => match.toUpperCase())
    .replace(/\W+(\w)/g, (_, p1) => p1.toUpperCase());

  const promptQueries: CustomPromptObject[] = [
    {
      type: 'text',
      name: 'slug',
      message: 'What is the package slug?',
      initial: defaultPackageSlug,
      resolvedValue: useDefaultSlug ? defaultPackageSlug : null,
      validate: (input) =>
        validateNpmPackage(input).validForNewPackages || 'Must be a valid npm package name',
    },
    {
      type: 'text',
      name: 'name',
      message: 'What is the project name?',
      initial: defaultProjectName,
    },
    {
      type: 'text',
      name: 'description',
      message: 'How would you describe the module?',
      validate: (input) => !!input || 'Cannot be empty',
    },
    {
      type: 'text',
      name: 'package',
      message: 'What is the Android package name?',
      initial: `expo.modules.${defaultPackageSlug.replace(/\W/g, '').toLowerCase()}`,
    },
    {
      type: 'text',
      name: 'author',
      message: 'Who is the author?',
      initial: (await npmWhoamiAsync(targetDir)) ?? '',
    },
    {
      type: 'text',
      name: 'license',
      message: 'What is the license?',
      initial: 'MIT',
    },
    {
      type: 'text',
      name: 'repo',
      message: 'What is the repository URL?',
      validate: (input) => /^https?:\/\//.test(input) || 'Must be a valid URL',
    },
  ];

  // Stop the process when the user cancels/exits the prompt.
  const onCancel = () => {
    process.exit(0);
  };

  const answers: Record<string, string> = {};
  for (const query of promptQueries) {
    const { name, resolvedValue } = query;
    answers[name] = resolvedValue ?? options[name] ?? (await prompts(query, { onCancel }))[name];
  }

  const { slug, name, description, package: projectPackage, author, license, repo } = answers;

  return {
    project: {
      slug,
      name,
      version: '0.1.0',
      description,
      package: projectPackage,
    },
    author,
    license,
    repo,
  };
}

/**
 * Checks whether the target directory is empty and if not, asks the user to confirm if he wants to continue.
 */
async function confirmTargetDirAsync(targetDir: string): Promise<void> {
  const files = await fs.readdir(targetDir);

  if (files.length === 0) {
    return;
  }
  const { shouldContinue } = await prompts(
    {
      type: 'confirm',
      name: 'shouldContinue',
      message: `The target directory ${chalk.magenta(
        targetDir
      )} is not empty.\nDo you want to continue anyway?`,
      initial: true,
    },
    {
      onCancel: () => false,
    }
  );
  if (!shouldContinue) {
    process.exit(0);
  }
}

const program = new Command();

program
  .name(packageJson.name)
  .version(packageJson.version)
  .description(packageJson.description)
  .arguments('[target_dir]')
  .option(
    '-s, --source <source_dir>',
    'Local path to the template. By default it downloads `expo-module-template` from NPM.'
  )
  .option('-n, --name <module_name>', 'Name of the native module.')
  .option('-d, --description <description>', 'Description of the module.')
  .option('-p, --package <package>', 'The Android package name.')
  .option('-a, --author <author>', 'The author name.')
  .option('-l, --license <license>', 'The license that the module is distributed with.')
  .option('-r, --repo <repo_url>', 'The URL to the repository.')
  .option('--with-readme', 'Whether to include README.md file.', false)
  .option('--with-changelog', 'Whether to include CHANGELOG.md file.', false)
  .option('--no-example', 'Whether to skip creating the example app.', false)
  .action(main);

program.parse(process.argv);
