import Babel from '@babel/core';
import FS from 'fs';
import Path from 'path';
import type { Plugin } from 'vite';

const cwd = process.cwd();
const defaultOptions: Options = {
    publicationDirectories: [
        './imports/publications',
    ],
    methodDirectories: [
        './imports/methods',
    ],
}

export default async function zodernRelay({
    publicationDirectories = [...defaultOptions.publicationDirectories],
    methodDirectories = [...defaultOptions.methodDirectories],
}: Options = defaultOptions): Promise<Plugin> {
    const directories = {
        methods: methodDirectories.map((path) => Path.relative(cwd, path)),
        publications: publicationDirectories.map((path) => Path.relative(cwd, path)),
    }
    type RelayInfo = {
        type: 'methods' | 'publications';
        id: string;
        relativePath: string;
    };
    
    function resolveRelay(id: string): RelayInfo | undefined {
        const relativePath = Path.relative(cwd, id);
        for (const dir of directories.methods) {
            if (!relativePath.startsWith(dir)) {
                continue;
            }
            return {
                id,
                type: 'methods',
                relativePath,
            }
        }
        for (const dir of directories.publications) {
            if (!relativePath.startsWith(dir)) {
                continue;
            }
            return {
                id,
                type: 'publications',
                relativePath,
            }
        }
    }
    
    
    return {
        name: 'zodern-relay',
        async load(filename) {
            const relay = resolveRelay(filename || '');
            if (!relay) {
                return;
            }
            const code = FS.readFileSync(filename, 'utf-8');
            const transform = await Babel.transformAsync(code, {
                configFile: false,
                babelrc: false,
                filename,
                plugins: ['@zodern/babel-plugin-meteor-relay']
            });
            
            if (!transform) {
                return;
            }
            
            return {
                code: transform.code ?? '',
            }
        }
    }
}

export interface Options {
    /**
     * Path to directories where your zodern:relay methods live
     * @default
     * publicationDirectories: ['./imports/methods']
     */
    methodDirectories: string[];
    
    /**
     * Path to the directories where your zodern:relay publications live.
     * @default
     * publicationDirectories: ['./imports/publications']
     */
    publicationDirectories: string[];
}