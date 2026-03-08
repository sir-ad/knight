global.chrome = {
  runtime: {
    sendMessage: jest.fn(),
    onMessage: {
      addListener: jest.fn(),
      removeListener: jest.fn(),
    },
  },
};

class MockFileReader {
  result: ArrayBuffer | string | null = null;
  error: Error | null = null;
  onload: ((ev: ProgressEvent<FileReader>) => void) | null = null;
  onerror: ((ev: ProgressEvent<FileReader>) => void) | null = null;

  readAsArrayBuffer(_blob: Blob) {
    setTimeout(() => {
      this.result = new ArrayBuffer(0);
      if (this.onload) {
        this.onload({ target: this } as ProgressEvent<FileReader>);
      }
    }, 0);
  }

  readAsText(_blob: Blob) {
    setTimeout(() => {
      this.result = '';
      if (this.onload) {
        this.onload({ target: this } as ProgressEvent<FileReader>);
      }
    }, 0);
  }
}

(global as any).FileReader = MockFileReader;

(global as any).TextDecoder = class TextDecoder {
  decode(_input?: BufferSource): string {
    return '';
  }
};

(global as any).TextEncoder = class TextEncoder {
  encode(input: string): Uint8Array {
    return new Uint8Array(input.split('').map((c) => c.charCodeAt(0)));
  }
};

(global as any).fetch = jest.fn();

jest.mock('../src/lib/ollama-client', () => ({
  ollamaClient: {
    testConnection: jest.fn(),
    generate: jest.fn(),
    generateStructured: jest.fn(),
    extractProfile: jest.fn(),
  },
}));
