
import { ImageProcessor, CONFIG } from '../app.js';

// Mock canvas for testing resize logic
const createMockImage = (width, height) => ({
  naturalWidth: width,
  naturalHeight: height
});

// Helper to create a canvas that produces blobs of specific size
// This overrides the global mock for specific tests if needed, 
// but for now we rely on the global mock in setup.js which uses quality to determine size.
// The global mock: size = quality ? 500000 * quality : 300000

describe('New Formats Support', () => {
  const mockImageInfo = {
    file: new File(['test'], 'test.png', { type: 'image/png' }),
    width: 1000,
    height: 1000,
    size: 500 * 1024,
    previewUrl: 'blob:test',
    needsProcessing: true
  };

  test('Should convert PNG to WebP', async () => {
    const userConfig = {
      format: 'image/webp',
      maxSizeKB: 800,
      extension: '.webp'
    };

    const result = await ImageProcessor.process(mockImageInfo, userConfig);
    
    expect(result.processedBlob.type).toBe('image/webp');
    expect(result.outputFileName).toBe('test.webp');
  });

  test('Should convert PNG to AVIF', async () => {
    const userConfig = {
      format: 'image/avif',
      maxSizeKB: 800,
      extension: '.avif'
    };

    const result = await ImageProcessor.process(mockImageInfo, userConfig);
    
    expect(result.processedBlob.type).toBe('image/avif');
    expect(result.outputFileName).toBe('test.avif');
  });

  test('Should not convert if format matches and no processing needed', async () => {
    const info = {
        ...mockImageInfo,
        file: new File(['test'], 'test.webp', { type: 'image/webp' }),
        width: 750,
        height: 750,
        size: 100 * 1024, // Small enough
        needsProcessing: false
    };

    const userConfig = {
      format: 'image/webp',
      maxSizeKB: 800,
      extension: '.webp'
    };

    const result = await ImageProcessor.process(info, userConfig);
    
    // Should return original
    expect(result.wasProcessed).toBe(false);
    expect(result.processedBlob).toBe(info.file);
  });

  test('Should compress WebP if size is too large', async () => {
    const info = {
        ...mockImageInfo,
        file: new File(['test'], 'large.webp', { type: 'image/webp' }),
        width: 750,
        height: 750,
        size: 2000 * 1024, // 2MB, needs compression
        needsProcessing: true // ImageAnalyzer would set this true due to size
    };

    const userConfig = {
      format: 'image/webp',
      maxSizeKB: 800,
      extension: '.webp'
    };

    const result = await ImageProcessor.process(info, userConfig);
    
    expect(result.wasProcessed).toBe(true);
    expect(result.processedBlob.type).toBe('image/webp');
    // The mock toBlob produces size based on quality.
    // Max quality 1.0 -> 500KB.
    // So it should be within 800KB.
    expect(result.finalSize).toBeLessThanOrEqual(800 * 1024);
  });
});
