import { cwd, getProjectPackageJson } from '../workers';
import Path from 'node:path';
import OS from 'node:os';
import FS from 'node:fs';

export function msToHumanTime(milliseconds: number) {
    const duration = {
        count: milliseconds,
        type: 'ms',
    }
    
    if (milliseconds > 1000) {
        duration.count = milliseconds / 1000;
        duration.type = 's';
    }
    
    if (duration.type === 's' && duration.count > 60) {
        duration.type = 'min'
        duration.count = duration.count / 60;
    }
    
    return `${Math.round(duration.count * 100) / 100}${duration.type}`;
}

export function posixPath(filePath: string) {
    return filePath.split(Path.sep).join('/')
}

export function getTempDir() {
    const packageJson = getProjectPackageJson();
    try {
        const tempDir = Path.resolve(packageJson?.meteorVite?.tempDir || OS.tmpdir(), 'meteor-vite', packageJson.name);
        FS.mkdirSync(tempDir, { recursive: true });
        return tempDir;
    } catch (error) {
        console.warn(new Error(`⚡  Unable to set up temp directory for meteor-vite bundles. Will use node_modules instead`, { cause: error }));
        return Path.resolve(cwd, 'node_modules', '.vite-meteor-temp');
    }
}
