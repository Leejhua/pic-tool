/**
 * Jest 测试环境设置
 */

// Mock URL.createObjectURL and URL.revokeObjectURL
if (typeof global.URL.createObjectURL !== 'function') {
  global.URL.createObjectURL = () => 'blob:mock-url';
}
if (typeof global.URL.revokeObjectURL !== 'function') {
  global.URL.revokeObjectURL = () => {};
}

// Mock Image
class MockImage {
  constructor() {
    this.onload = null;
    this.onerror = null;
    this._src = '';
    this.naturalWidth = 1000;
    this.naturalHeight = 800;
  }

  get src() {
    return this._src;
  }

  set src(value) {
    this._src = value;
    // Simulate async image loading
    setTimeout(() => {
      if (this.onload) {
        this.onload();
      }
    }, 0);
  }
}

global.Image = MockImage;

// Mock canvas context
const mockContext = {
  drawImage: () => {},
  imageSmoothingEnabled: true,
  imageSmoothingQuality: 'high'
};

// Mock canvas methods
if (typeof HTMLCanvasElement !== 'undefined') {
  HTMLCanvasElement.prototype.getContext = function() {
    return mockContext;
  };
  
  HTMLCanvasElement.prototype.toBlob = function(callback, format, quality) {
    // Simulate blob creation with size based on quality
    const size = quality ? Math.floor(500000 * quality) : 300000;
    const blob = new Blob(['x'.repeat(size)], { type: format || 'image/jpeg' });
    callback(blob);
  };
}
