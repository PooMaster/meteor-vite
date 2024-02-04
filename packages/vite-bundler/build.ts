import * as fs from 'fs';
import path from 'node:path';
import fs from 'fs-extra';
import { cwd } from './workers';
import Logger from './utility/Logger';
import Compiler, { BUNDLE_FILE_EXTENSION } from './plugin/Compiler';
import { Meteor } from 'meteor/meteor';
import { getBuildConfig, posixPath } from './utility/Helpers';
import { prepareViteBundle, ViteBundleOutput } from './plugin/IntermediaryMeteorProject';

const {
  meteorMainModule,
  isSimulatedProduction,
  entryModuleFilepath,
  viteOutSrcDir,
  pluginEnabled,
} = getBuildConfig();

// Empty stubs from any previous builds
if (pluginEnabled) {
  fs.ensureDirSync(path.dirname(entryModuleFilepath));
  fs.writeFileSync(entryModuleFilepath, `// Stub file for Meteor-Vite\n`, 'utf8');
  
  // Add .gitignore file to prevent the transpiled bundle from being committed accidentally.
  fs.writeFileSync(path.join(viteOutSrcDir, '.gitignore'), '/**');
}

if (!pluginEnabled) {
  Logger.info('Build plugin is disabled')
}

// In development, clients will connect to the Vite development server directly. So there is no need for Meteor
// to do any work.
else if (process.env.NODE_ENV === 'production') {
  Plugin.registerCompiler({
    extensions: [BUNDLE_FILE_EXTENSION],
    filenames: [],
  }, () => new Compiler());
  
  try {
    // Meteor v3 build process (Async-await)
    if (Meteor.isFibersDisabled) {
      await build();
    }
    
    // Meteor v2 build process (Fibers)
    else {
      Promise.await(build());
    }
    
  } catch (error) {
    Logger.error(' Failed to complete build process:\n', error);
    throw error;
  }
}

async function build() {
  const { payload, entryAsset } = await prepareViteBundle();
  
  // Transpile and push the Vite bundle into the Meteor project's source directory
  transpileViteBundle({ payload });
  
  const importPath = path.relative(path.resolve(viteOutSrcDir, '..'), entryModuleFilepath);
  const moduleImportPath = posixPath(`./${importPath}`);
  const meteorViteImport = `import ${JSON.stringify(moduleImportPath)};`
  const meteorViteImportTemplate = `
/**
 * This import is automatically generated by Meteor-Vite while building for production.
 * It should only point to your Vite production bundle, and is perfectly safe to remove or commit.
 *
 * If you're seeing this import including any other files like the Vite plugin itself,
 * Meteor might be trying to import ESM over CommonJS. Please open an issue if this happens.
 * Shouldn't be dangerous, but it might bloat your client bundle.
**/
${meteorViteImport}


`.trimLeft();
  
  // Patch project's meteor entry with import for meteor-vite's entry module.
  // in node_modules/meteor-vite/temp
  const meteorEntry = path.join(cwd, meteorMainModule)
  const originalEntryContent = fs.readFileSync(meteorEntry, 'utf8');
  const oldEntryImports = [
      'meteor-vite/.build/import-vite-bundle.js',
  ]
  
  // Patch import strings from older builds of the vite-bundler with an up-to-date import.
  for (const oldImport of oldEntryImports) {
    if (!originalEntryContent.includes(oldImport)) {
      continue;
    }
    const newContent = originalEntryContent.replace(oldImport, `${moduleImportPath}`);
    fs.writeFileSync(meteorEntry, newContent, 'utf8');
  }
  
  // Import the Vite client bundle in the source project's client main module if it isn't already included.
  if (!originalEntryContent.includes(moduleImportPath)) {
    fs.writeFileSync(meteorEntry, `${meteorViteImportTemplate}\n${originalEntryContent}`, 'utf8')
  }
  
  // Patch the meteor-vite entry module with an import for the project's Vite production bundle
  // in <project root>/client/_vite-bundle
  const bundleEntryPath = path.relative(path.dirname(entryModuleFilepath), path.join(viteOutSrcDir, entryAsset.fileName));
  const entryModuleContent = `import ${JSON.stringify(`./${posixPath(bundleEntryPath)}`)}`
  fs.writeFileSync(entryModuleFilepath, entryModuleContent, 'utf8')
  
  Compiler.addCleanupHandler(() => {
    if (isSimulatedProduction) return;
    fs.removeSync(viteOutSrcDir);
    fs.writeFileSync(meteorEntry, originalEntryContent, 'utf8');
  });
}

function transpileViteBundle({ payload }: Pick<ViteBundleOutput, 'payload'>) {
  const profile = Logger.startProfiler();
  Logger.info('Transpiling Vite bundle for Meteor...');
  
  fs.ensureDirSync(viteOutSrcDir)
  fs.emptyDirSync(viteOutSrcDir)
  for (const { fileName: file } of payload.output) {
    const from = path.join(payload.outDir, file)
    const to = path.join(viteOutSrcDir, `${file}.${BUNDLE_FILE_EXTENSION}`);
    fs.ensureDirSync(path.dirname(to))
    
    if (path.extname(from) === '.js') {
      // Transpile to Meteor target (Dynamic import support)
      // @TODO don't use Babel
      const source = fs.readFileSync(from, 'utf8')
      const babelOptions = Babel.getDefaultOptions()
      babelOptions.babelrc = true
      babelOptions.sourceMaps = true
      babelOptions.filename = babelOptions.sourceFileName = from
      const transpiled = Babel.compile(source, babelOptions, {
        cacheDirectory: path.join(cwd, 'node_modules', '.babel-cache'),
      })
      fs.writeFileSync(to, transpiled.code, 'utf8')
    } else {
      fs.copyFileSync(from, to)
    }
  }
  
  profile.complete('Transpile completed');
}
