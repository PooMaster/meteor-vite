import Path from 'path';
import { describe, expect, it, test } from 'vitest';
import MeteorPackage from '../../src/meteor/package/components/MeteorPackage';
import { ModuleExportData, parseMeteorPackage } from '../../src/meteor/package/parser/Parser';
import { AllMockPackages } from '../__mocks';

describe('Validate known exports for mock packages', () => {
    AllMockPackages.forEach((mockPackage) => {
        describe(`meteor/${mockPackage.packageName}`, async () => {
            const { result: parsedPackage } = await parseMeteorPackage({
                filePath: mockPackage.filePath,
                fileContent: mockPackage.fileContent,
            });
            
            it('parsed the package name', () => {
                expect(parsedPackage.name).toEqual(mockPackage.packageName)
            });
            
            it('has a packageId', () => {
                expect(parsedPackage.packageId).toEqual(mockPackage.packageId);
            })
            
            it('detected the correct main module path', () => {
                expect(parsedPackage.mainModulePath).toEqual(mockPackage.mainModulePath);
            });
            
            it('has the correct mainModule exports', () => {
                const mainModule = new MeteorPackage(parsedPackage, { timeSpent: 'none' }).mainModule;
                const parsedPath = Path.parse(mockPackage.mainModulePath);
                const fileName = parsedPath.base as keyof typeof mockPackage['modules'];
                const mockModuleExports = mockPackage.modules[fileName];
                
                expect(mainModule?.exports).toEqual(mockModuleExports);
            })
            
            const exportedModules = Object.entries(mockPackage.modules);
            
            describe.runIf(exportedModules.length)('Files', () => {
                exportedModules.forEach(([filePath, mockExports]: [string, ModuleExportData[]]) => {
                    describe(filePath, () => {
                        const parsedExports =  parsedPackage.modules[filePath];
                        const namedMockExports = mockExports?.filter(({ type }) => type === 'export')
                        const mockReExports = mockExports?.filter(({ type }) => type === 're-export')
                        
                        
                        it('has an array of exports', () => {
                            expect(Object.keys(parsedPackage.modules)).toContain(filePath);
                            expect(parsedExports).toBeDefined();
                        });
                        
                        
                        describe.runIf(namedMockExports?.length)('Named exports', () => {
                            namedMockExports?.forEach((mockExport) => {
                                it(`export const ${mockExport.name}`, ({ expect }) => {
                                    expect(parsedExports).toEqual(
                                        expect.arrayContaining([mockExport])
                                    )
                                })
                            })
                        })
                        
                        describe.runIf(mockReExports?.length)('Re-exports', () => {
                            mockReExports?.forEach((mockExport) => {
                                test(`export ${mockExport.as || mockExport.name} from ${mockExport.from}`, ({ expect }) => {
                                    expect(parsedExports).toEqual(
                                        expect.arrayContaining([mockExport])
                                    )
                                })
                            })
                        })
                    })
                })
            })
        })
    })
});