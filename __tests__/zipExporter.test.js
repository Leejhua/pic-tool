/**
 * ZipExporter 属性测试
 * 
 * **Feature: image-batch-processor, Property 5: ZIP 打包正确性**
 * **验证: 需求 5.3, 6.2, 6.3**
 */

import fc from 'fast-check';
import { ZipExporter } from '../app.js';

// Track what files were added to the ZIP
let lastZipContent = null;

// Mock JSZip for testing
class MockJSZipFolder {
  constructor(name) {
    this.name = name;
    this.files = new Map();
  }

  file(name, content) {
    this.files.set(name, content);
    return this;
  }
}

class MockJSZip {
  constructor() {
    this.folders = new Map();
    this.rootFiles = new Map();
  }

  folder(name) {
    const folder = new MockJSZipFolder(name);
    this.folders.set(name, folder);
    return folder;
  }

  async generateAsync(options) {
    // Store the structure for verification
    const structure = {
      folders: {},
      options
    };
    
    for (const [folderName, folder] of this.folders) {
      structure.folders[folderName] = {
        files: Array.from(folder.files.keys())
      };
    }
    
    // Store for test verification
    lastZipContent = structure;
    
    return new Blob(['mock-zip-content'], { type: 'application/zip' });
  }
}

// Helper to get last ZIP content
const getLastZipContent = () => lastZipContent;

// Store original JSZip
const originalJSZip = global.JSZip;

beforeAll(() => {
  global.JSZip = MockJSZip;
});

afterAll(() => {
  global.JSZip = originalJSZip;
});

beforeEach(() => {
  lastZipContent = null;
});

// Helper to create mock processing result
const createMockResult = (filename, type, hasBlob = true) => ({
  originalFile: new File(['test'], filename, { type }),
  processedBlob: hasBlob ? new Blob(['processed'], { type }) : null,
  finalWidth: 750,
  finalHeight: 600,
  finalSize: 100 * 1024,
  wasProcessed: true
});

// Arbitraries for property testing
const filenameArb = fc.stringOf(
  fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789_-'.split('')),
  { minLength: 1, maxLength: 20 }
);

const extensionArb = fc.constantFrom('.jpg', '.jpeg', '.png');

const mimeTypeArb = fc.constantFrom('image/jpeg', 'image/png');

const folderNameArb = fc.stringOf(
  fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789_-'.split('')),
  { minLength: 1, maxLength: 30 }
);

describe('ZipExporter', () => {
  /**
   * 属性测试
   * **Feature: image-batch-processor, Property 5: ZIP 打包正确性**
   * **验证: 需求 5.3, 6.2, 6.3**
   * 
   * 对于任意处理结果集合和文件夹名称，生成的 ZIP 文件应包含所有处理后的图片，
   * 且每个文件保持原始文件名和格式
   */
  describe('Property Tests - ZIP Packaging Correctness', () => {
    
    test('属性5: ZIP 打包正确性 - ZIP 包含所有有效处理结果的文件', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.tuple(filenameArb, extensionArb, mimeTypeArb, fc.boolean()),
            { minLength: 1, maxLength: 10 }
          ),
          folderNameArb,
          async (fileSpecs, folderName) => {
            const results = fileSpecs.map(([name, ext, mime, hasBlob]) => 
              createMockResult(`${name}${ext}`, mime, hasBlob)
            );
            
            await ZipExporter.createZip(results, folderName);
            const zipContent = getLastZipContent();
            
            // Get files in the folder
            const folder = zipContent.folders[folderName];
            if (!folder) return false;
            
            const filesInZip = new Set(folder.files);
            
            // Count results with valid blobs
            const validResults = results.filter(r => r.processedBlob !== null);
            
            // ZIP should contain exactly the files with valid blobs
            return filesInZip.size === validResults.length;
          }
        ),
        { numRuns: 100 }
      );
    }, 30000);

    test('属性5: ZIP 打包正确性 - 保持原始文件名', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.tuple(filenameArb, extensionArb, mimeTypeArb),
            { minLength: 1, maxLength: 10 }
          ),
          folderNameArb,
          async (fileSpecs, folderName) => {
            // Ensure unique filenames
            const uniqueSpecs = [];
            const seenNames = new Set();
            for (const [name, ext, mime] of fileSpecs) {
              const fullName = `${name}${ext}`;
              if (!seenNames.has(fullName)) {
                seenNames.add(fullName);
                uniqueSpecs.push([name, ext, mime]);
              }
            }
            
            if (uniqueSpecs.length === 0) return true;
            
            const results = uniqueSpecs.map(([name, ext, mime]) => 
              createMockResult(`${name}${ext}`, mime, true)
            );
            
            await ZipExporter.createZip(results, folderName);
            const zipContent = getLastZipContent();
            
            const folder = zipContent.folders[folderName];
            if (!folder) return false;
            
            const filesInZip = new Set(folder.files);
            
            // Every original filename should be in the ZIP
            for (const result of results) {
              if (!filesInZip.has(result.originalFile.name)) {
                return false;
              }
            }
            
            return true;
          }
        ),
        { numRuns: 100 }
      );
    }, 30000);

    test('属性5: ZIP 打包正确性 - 使用用户指定的文件夹名称', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.tuple(filenameArb, extensionArb, mimeTypeArb),
            { minLength: 1, maxLength: 5 }
          ),
          folderNameArb,
          async (fileSpecs, folderName) => {
            const results = fileSpecs.map(([name, ext, mime]) => 
              createMockResult(`${name}${ext}`, mime, true)
            );
            
            await ZipExporter.createZip(results, folderName);
            const zipContent = getLastZipContent();
            
            // The folder with the specified name should exist
            return zipContent.folders.hasOwnProperty(folderName);
          }
        ),
        { numRuns: 100 }
      );
    }, 30000);

    test('属性5: ZIP 打包正确性 - 跳过无效的处理结果（processedBlob 为 null）', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.tuple(filenameArb, extensionArb, mimeTypeArb, fc.boolean()),
            { minLength: 1, maxLength: 10 }
          ),
          folderNameArb,
          async (fileSpecs, folderName) => {
            const results = fileSpecs.map(([name, ext, mime, hasBlob]) => 
              createMockResult(`${name}${ext}`, mime, hasBlob)
            );
            
            await ZipExporter.createZip(results, folderName);
            const zipContent = getLastZipContent();
            
            const folder = zipContent.folders[folderName];
            if (!folder) return false;
            
            const filesInZip = folder.files;
            
            // Files with null blobs should not be in the ZIP
            for (let i = 0; i < results.length; i++) {
              const result = results[i];
              const isInZip = filesInZip.includes(result.originalFile.name);
              
              if (result.processedBlob === null && isInZip) {
                return false; // Should not include null blob files
              }
            }
            
            return true;
          }
        ),
        { numRuns: 100 }
      );
    }, 30000);

    test('属性5: ZIP 打包正确性 - 保持原始文件格式（扩展名）', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.tuple(filenameArb, extensionArb, mimeTypeArb),
            { minLength: 1, maxLength: 10 }
          ),
          folderNameArb,
          async (fileSpecs, folderName) => {
            const results = fileSpecs.map(([name, ext, mime]) => 
              createMockResult(`${name}${ext}`, mime, true)
            );
            
            await ZipExporter.createZip(results, folderName);
            const zipContent = getLastZipContent();
            
            const folder = zipContent.folders[folderName];
            if (!folder) return false;
            
            // Every file in ZIP should have a valid image extension
            for (const filename of folder.files) {
              const hasValidExt = filename.endsWith('.jpg') || 
                                  filename.endsWith('.jpeg') || 
                                  filename.endsWith('.png');
              if (!hasValidExt) {
                return false;
              }
            }
            
            return true;
          }
        ),
        { numRuns: 100 }
      );
    }, 30000);
  });
});
