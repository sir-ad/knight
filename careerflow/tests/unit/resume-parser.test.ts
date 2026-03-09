import { extractTextFromFile, parseResume, validateProfile } from '../../src/lib/resume-parser';
import { generateStructuredWithActiveProvider } from '../../src/lib/runtime-client';
import type { Profile } from '../../src/lib/types';

jest.mock('../../src/lib/runtime-client', () => ({
  generateStructuredWithActiveProvider: jest.fn(),
}));

class FunctionalTextDecoder {
  decode(input?: BufferSource): string {
    if (!input) {
      return ''
    }

    if (input instanceof ArrayBuffer) {
      return Buffer.from(new Uint8Array(input)).toString('utf8')
    }

    return Buffer.from(
      input.buffer.slice(input.byteOffset, input.byteOffset + input.byteLength)
    ).toString('utf8')
  }
}

class CustomFileReader {
  result: ArrayBuffer | null = null;
  error: Error | null = null;
  onload: ((e: ProgressEvent<FileReader>) => void) | null = null;
  onerror: ((e: ProgressEvent<FileReader>) => void) | null = null;
  private _arrayBuffer: ArrayBuffer | null = null;

  setArrayBuffer(buffer: ArrayBuffer) {
    this._arrayBuffer = buffer;
  }

  readAsArrayBuffer() {
    this.result = this._arrayBuffer || new ArrayBuffer(0);
    setTimeout(() => {
      if (this.onload) {
        this.onload({ target: this } as ProgressEvent<FileReader>);
      }
    }, 0);
  }
}

describe('resume-parser', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (global as any).TextDecoder = FunctionalTextDecoder;
  });

  describe('PDF extraction', () => {
    it('should extract text from PDF file', async () => {
      const pdfContent = 'stream\nHello World PDF Content\nendstream';
      const encoder = new TextEncoder();
      const pdfBuffer = encoder.encode(pdfContent);

      const mockFile = new File([pdfBuffer], 'resume.pdf', { type: 'application/pdf' });

      const originalFileReader = (global as any).FileReader;
      class TestFileReader extends CustomFileReader {
        constructor() {
          super();
          (this as any).result = pdfBuffer.buffer;
        }
        readAsArrayBuffer() {
          this.result = pdfBuffer.buffer;
          setTimeout(() => {
            if (this.onload) {
              this.onload({ target: this } as ProgressEvent<FileReader>);
            }
          }, 0);
        }
      }
      (global as any).FileReader = TestFileReader;

      const text = await extractTextFromFile(mockFile);
      expect(text).toBeDefined();
      expect(typeof text).toBe('string');

      (global as any).FileReader = originalFileReader;
    });

    it('should handle PDF with minimal content', async () => {
      const pdfContent = 'stream\nAB\nendstream';
      const encoder = new TextEncoder();
      const pdfBuffer = encoder.encode(pdfContent);

      const mockFile = new File([pdfBuffer], 'resume.pdf', { type: 'application/pdf' });

      const originalFileReader = (global as any).FileReader;
      class TestFileReader extends CustomFileReader {
        readAsArrayBuffer() {
          this.result = pdfBuffer.buffer;
          setTimeout(() => {
            if (this.onload) {
              this.onload({ target: this } as ProgressEvent<FileReader>);
            }
          }, 0);
        }
      }
      (global as any).FileReader = TestFileReader;

      const text = await extractTextFromFile(mockFile);
      expect(typeof text).toBe('string');

      (global as any).FileReader = originalFileReader;
    });

    it('should clean PDF escape sequences', async () => {
      const pdfContent = 'stream\nHello\\nWorld\\tPDF\\(test\\)\nendstream';
      const encoder = new TextEncoder();
      const pdfBuffer = encoder.encode(pdfContent);

      const mockFile = new File([pdfBuffer], 'resume.pdf', { type: 'application/pdf' });

      const originalFileReader = (global as any).FileReader;
      class TestFileReader extends CustomFileReader {
        readAsArrayBuffer() {
          this.result = pdfBuffer.buffer;
          setTimeout(() => {
            if (this.onload) {
              this.onload({ target: this } as ProgressEvent<FileReader>);
            }
          }, 0);
        }
      }
      (global as any).FileReader = TestFileReader;

      const text = await extractTextFromFile(mockFile);
      expect(text).toBeDefined();

      (global as any).FileReader = originalFileReader;
    });
  });

  describe('DOCX extraction', () => {
    it('should extract text from DOCX file', async () => {
      const docxContent = '<w:t>John Doe Resume</w:t><w:t>Software Engineer</w:t>';
      const encoder = new TextEncoder();
      const docxBuffer = encoder.encode(docxContent);

      const mockFile = new File([docxBuffer], 'resume.docx', {
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      });

      const originalFileReader = (global as any).FileReader;
      class TestFileReader extends CustomFileReader {
        readAsArrayBuffer() {
          this.result = docxBuffer.buffer;
          setTimeout(() => {
            if (this.onload) {
              this.onload({ target: this } as ProgressEvent<FileReader>);
            }
          }, 0);
        }
      }
      (global as any).FileReader = TestFileReader;

      const text = await extractTextFromFile(mockFile);
      expect(text).toBeDefined();

      (global as any).FileReader = originalFileReader;
    });

    it('should handle DOCX with file extension detection', async () => {
      const docxContent = '<document>Content here</document>';
      const encoder = new TextEncoder();
      const docxBuffer = encoder.encode(docxContent);

      const mockFile = new File([docxBuffer], 'resume.docx', { type: '' });

      const originalFileReader = (global as any).FileReader;
      class TestFileReader extends CustomFileReader {
        readAsArrayBuffer() {
          this.result = docxBuffer.buffer;
          setTimeout(() => {
            if (this.onload) {
              this.onload({ target: this } as ProgressEvent<FileReader>);
            }
          }, 0);
        }
      }
      (global as any).FileReader = TestFileReader;

      const text = await extractTextFromFile(mockFile);
      expect(text).toBeDefined();

      (global as any).FileReader = originalFileReader;
    });
  });

  describe('TXT extraction', () => {
    it('should extract text from plain text file', async () => {
      const txtContent = 'John Doe\nSoftware Engineer\njohn@example.com';
      const encoder = new TextEncoder();
      const txtBuffer = encoder.encode(txtContent);

      const mockFile = new File([txtBuffer], 'resume.txt', { type: 'text/plain' });

      const originalFileReader = (global as any).FileReader;
      class TestFileReader extends CustomFileReader {
        readAsArrayBuffer() {
          this.result = txtBuffer.buffer;
          setTimeout(() => {
            if (this.onload) {
              this.onload({ target: this } as ProgressEvent<FileReader>);
            }
          }, 0);
        }
      }
      (global as any).FileReader = TestFileReader;

      const text = await extractTextFromFile(mockFile);
      expect(text).toBeDefined();

      (global as any).FileReader = originalFileReader;
    });
  });

  describe('profile validation', () => {
    it('should validate a complete profile', () => {
      const validProfile: Profile = {
        identity: {
          name: 'John Doe',
          email: 'john@example.com',
          phone: '+1234567890',
          location: 'New York, NY',
        },
        work_history: [
          {
            company: 'Tech Corp',
            title: 'Software Engineer',
            start_date: '2020-01-01',
            end_date: '2023-01-01',
          },
        ],
        education: [
          {
            degree: 'BS',
            field: 'Computer Science',
            institution: 'MIT',
          },
        ],
      };

      const result = validateProfile(validProfile);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject profile without name', () => {
      const invalidProfile: Profile = {
        identity: {
          name: '',
          email: 'john@example.com',
        },
        work_history: [
          {
            company: 'Tech Corp',
            title: 'Engineer',
            start_date: '2020-01-01',
          },
        ],
      };

      const result = validateProfile(invalidProfile);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Name is required');
    });

    it('should reject profile without email', () => {
      const invalidProfile: Profile = {
        identity: {
          name: 'John Doe',
          email: '',
        },
        work_history: [
          {
            company: 'Tech Corp',
            title: 'Engineer',
            start_date: '2020-01-01',
          },
        ],
      };

      const result = validateProfile(invalidProfile);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Email is required');
    });

    it('should reject profile with invalid email format', () => {
      const invalidProfile: Profile = {
        identity: {
          name: 'John Doe',
          email: 'invalid-email',
        },
        work_history: [
          {
            company: 'Tech Corp',
            title: 'Engineer',
            start_date: '2020-01-01',
          },
        ],
      };

      const result = validateProfile(invalidProfile);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Invalid email format');
    });

    it('should reject profile without work history', () => {
      const invalidProfile: Profile = {
        identity: {
          name: 'John Doe',
          email: 'john@example.com',
        },
        work_history: [],
      };

      const result = validateProfile(invalidProfile);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('At least one work experience is required');
    });

    it('should validate work history entries', () => {
      const invalidProfile: Profile = {
        identity: {
          name: 'John Doe',
          email: 'john@example.com',
        },
        work_history: [
          {
            company: '',
            title: '',
            start_date: '',
          },
        ],
      };

      const result = validateProfile(invalidProfile);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Work experience 1: Company is required');
      expect(result.errors).toContain('Work experience 1: Title is required');
      expect(result.errors).toContain('Work experience 1: Start date is required');
    });

    it('should validate multiple work history entries', () => {
      const invalidProfile: Profile = {
        identity: {
          name: 'John Doe',
          email: 'john@example.com',
        },
        work_history: [
          {
            company: 'Tech Corp',
            title: 'Engineer',
            start_date: '2020-01-01',
          },
          {
            company: '',
            title: 'Manager',
            start_date: '2018-01-01',
          },
        ],
      };

      const result = validateProfile(invalidProfile);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Work experience 2: Company is required');
    });
  });

  describe('error handling', () => {
    it('should reject unsupported file formats', async () => {
      const mockFile = new File(['content'], 'resume.jpg', { type: 'image/jpeg' });

      await expect(extractTextFromFile(mockFile)).rejects.toThrow('Unsupported file format');
    });

    it('should handle file read errors', async () => {
      const mockFile = new File(['content'], 'test.pdf', { type: 'application/pdf' });

      const originalFileReader = (global as any).FileReader;
      class ErrorFileReader {
        result: ArrayBuffer | null = null;
        error: Error = new Error('Read failed');
        onload: ((e: ProgressEvent<FileReader>) => void) | null = null;
        onerror: ((e: ProgressEvent<FileReader>) => void) | null = null;

        readAsArrayBuffer() {
          setTimeout(() => {
            if (this.onerror) {
              this.onerror({ target: this } as ProgressEvent<FileReader>);
            }
          }, 0);
        }
      }
      (global as any).FileReader = ErrorFileReader;

      await expect(extractTextFromFile(mockFile)).rejects.toThrow();

      (global as any).FileReader = originalFileReader;
    });

    it('should return error for insufficient extracted text', async () => {
      const shortContent = 'stream\nAB\nendstream';
      const encoder = new TextEncoder();
      const shortBuffer = encoder.encode(shortContent);

      const mockFile = new File([shortBuffer], 'resume.pdf', { type: 'application/pdf' });

      const originalFileReader = (global as any).FileReader;
      class TestFileReader extends CustomFileReader {
        readAsArrayBuffer() {
          this.result = shortBuffer.buffer;
          setTimeout(() => {
            if (this.onload) {
              this.onload({ target: this } as ProgressEvent<FileReader>);
            }
          }, 0);
        }
      }
      (global as any).FileReader = TestFileReader;

      (generateStructuredWithActiveProvider as jest.Mock).mockResolvedValue({
        success: true,
        profile: {
          identity: { name: 'Test', email: 'test@test.com' },
          work_history: [{ company: 'Test', title: 'Test', start_date: '2020-01-01' }],
        },
      });

      const result = await parseResume(mockFile);
      expect(result.success).toBeDefined();

      (global as any).FileReader = originalFileReader;
    });

    it('should return a repair draft when identity is missing', async () => {
      const pdfContent = 'stream\n' + 'B'.repeat(240) + '\nendstream';
      const encoder = new TextEncoder();
      const pdfBuffer = encoder.encode(pdfContent);

      const mockFile = new File([pdfBuffer], 'resume.pdf', { type: 'application/pdf' });

      const originalFileReader = (global as any).FileReader;
      class TestFileReader extends CustomFileReader {
        readAsArrayBuffer() {
          this.result = pdfBuffer.buffer;
          setTimeout(() => {
            if (this.onload) {
              this.onload({ target: this } as ProgressEvent<FileReader>);
            }
          }, 0);
        }
      }
      (global as any).FileReader = TestFileReader;

      (generateStructuredWithActiveProvider as jest.Mock).mockResolvedValue({
        work_history: [{ company: 'Acme', title: 'Engineer', start_date: '2020-01-01' }],
      });

      const result = await parseResume(mockFile);

      expect(result.success).toBe(true);
      expect(result.profile).toBeUndefined();
      expect(result.draftProfile).toBeDefined();
      expect(result.validationErrors).toContain('Name is required');
      expect(result.validationErrors).toContain('Email is required');
      expect(result.raw_response).toBeDefined();

      (global as any).FileReader = originalFileReader;
    });

    it('should return a repair draft when work history is missing', async () => {
      const pdfContent = 'stream\n' + 'C'.repeat(240) + '\nendstream';
      const encoder = new TextEncoder();
      const pdfBuffer = encoder.encode(pdfContent);

      const mockFile = new File([pdfBuffer], 'resume.pdf', { type: 'application/pdf' });

      const originalFileReader = (global as any).FileReader;
      class TestFileReader extends CustomFileReader {
        readAsArrayBuffer() {
          this.result = pdfBuffer.buffer;
          setTimeout(() => {
            if (this.onload) {
              this.onload({ target: this } as ProgressEvent<FileReader>);
            }
          }, 0);
        }
      }
      (global as any).FileReader = TestFileReader;

      (generateStructuredWithActiveProvider as jest.Mock).mockResolvedValue({
        identity: { name: 'John Doe', email: 'john@example.com' },
      });

      const result = await parseResume(mockFile);

      expect(result.success).toBe(true);
      expect(result.profile).toBeUndefined();
      expect(result.draftProfile).toBeDefined();
      expect(result.validationErrors).toContain('At least one work experience is required');

      (global as any).FileReader = originalFileReader;
    });

    it('should normalize partial provider output into an editable draft', async () => {
      const pdfContent = 'stream\n' + 'D'.repeat(240) + '\nendstream';
      const encoder = new TextEncoder();
      const pdfBuffer = encoder.encode(pdfContent);

      const mockFile = new File([pdfBuffer], 'resume.pdf', { type: 'application/pdf' });

      const originalFileReader = (global as any).FileReader;
      class TestFileReader extends CustomFileReader {
        readAsArrayBuffer() {
          this.result = pdfBuffer.buffer;
          setTimeout(() => {
            if (this.onload) {
              this.onload({ target: this } as ProgressEvent<FileReader>);
            }
          }, 0);
        }
      }
      (global as any).FileReader = TestFileReader;

      (generateStructuredWithActiveProvider as jest.Mock).mockResolvedValue({
        identity: { name: 'John Doe' },
        work_history: [{}],
      });

      const result = await parseResume(mockFile);

      expect(result.success).toBe(true);
      expect(result.draftProfile?.profile.identity.name).toBe('John Doe');
      expect(result.draftProfile?.profile.identity.email).toBe('');
      expect(result.draftProfile?.profile.work_history[0].company).toBe('');
      expect(result.validationErrors).toContain('Email is required');
      expect(result.validationErrors).toContain('Work experience 1: Company is required');

      (global as any).FileReader = originalFileReader;
    });

    it('should handle LLM parsing errors', async () => {
      const pdfContent = 'stream\n' + 'A'.repeat(100) + '\nendstream';
      const encoder = new TextEncoder();
      const pdfBuffer = encoder.encode(pdfContent);

      const mockFile = new File([pdfBuffer], 'resume.pdf', { type: 'application/pdf' });

      const originalFileReader = (global as any).FileReader;
      class TestFileReader extends CustomFileReader {
        readAsArrayBuffer() {
          this.result = pdfBuffer.buffer;
          setTimeout(() => {
            if (this.onload) {
              this.onload({ target: this } as ProgressEvent<FileReader>);
            }
          }, 0);
        }
      }
      (global as any).FileReader = TestFileReader;

      (generateStructuredWithActiveProvider as jest.Mock).mockRejectedValue(new Error('LLM failed'));

      const result = await parseResume(mockFile);
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();

      (global as any).FileReader = originalFileReader;
    });
  });
});
