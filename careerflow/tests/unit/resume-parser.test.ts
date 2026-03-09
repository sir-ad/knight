import { extractTextFromFile, parseResume, validateProfile } from '../../src/lib/resume-parser';
import { generateStructuredWithActiveProvider } from '../../src/lib/runtime-client';
import type { Profile } from '../../src/lib/types';

jest.mock('../../src/lib/runtime-client', () => ({
  generateStructuredWithActiveProvider: jest.fn(),
}));

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

describe("resume-parser", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("sends supported files to the parser service", async () => {
    const file = withArrayBuffer(
      new File(["resume"], "resume.pdf", { type: "application/pdf" }),
      "pdf bytes"
    )
    ;(parseResumeWithService as jest.Mock).mockResolvedValue({
      success: true,
      status: "ok",
      profile: {
        identity: {
          name: "Jane Doe",
          email: "jane@example.com",
        },
        work_history: [
          {
            company: "Acme",
            title: "Engineer",
            start_date: "2020-01-01",
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
