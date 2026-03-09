import {
  classifyEmail,
  extractApplicationData,
} from '../../src/lib/email-classifier';
import { generateProviderStructured } from '../../src/lib/llm/provider-service';
import { storageManager } from '../../src/lib/storage-manager';

jest.mock('../../src/lib/llm/provider-service', () => ({
  generateProviderStructured: jest.fn(),
  buildLLMConfig: jest.fn(() => ({
    provider: 'ollama',
    model: 'llama3.2:3b',
    endpoint: 'http://localhost:11434',
  })),
}));

jest.mock('../../src/lib/storage-manager', () => ({
  storageManager: {
    getSettings: jest.fn(),
    getProviderSecrets: jest.fn(),
  },
}));

describe('email-classifier', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (storageManager.getSettings as jest.Mock).mockResolvedValue({
      llmConfig: {
        provider: 'ollama',
        endpoint: 'http://localhost:11434',
        model: 'llama3.2:3b',
      },
    });
    (storageManager.getProviderSecrets as jest.Mock).mockResolvedValue({});
  });

  describe('confirmation email classification', () => {
    it('should classify application received email as confirmation', async () => {
      const emailContent = {
        subject: 'Application Received - Software Engineer at Google',
        from: 'recruitment@google.com',
        body: 'Thank you for applying for the Software Engineer position at Google. We have received your application and will review it shortly.',
      };

      (generateProviderStructured as jest.Mock).mockResolvedValue({
        classification: 'confirmation',
        confidence: 0.95,
        company: 'Google',
        role: 'Software Engineer',
        status: 'Application Received',
        next_action: null,
        interview_date: null,
      });

      const result = await classifyEmail(emailContent);

      expect(result.classification).toBe('confirmation');
      expect(result.confidence).toBeGreaterThan(0.5);
      expect(result.data.company).toBe('Google');
      expect(result.data.role).toBe('Software Engineer');
    });

    it('should detect confirmation by keywords when LLM fails', async () => {
      const emailContent = {
        subject: 'Application Confirmation',
        from: 'careers@company.com',
        body: 'Thank you for applying. Your application has been successfully submitted.',
      };

      (generateProviderStructured as jest.Mock).mockRejectedValue(new Error('LLM failed'));

      const result = await classifyEmail(emailContent);

      expect(result.classification).toBe('confirmation');
      expect(result.confidence).toBeGreaterThan(0);
    });

    it('should extract company from email sender', async () => {
      const emailContent = {
        subject: 'Application Received',
        from: 'Google Recruitment <recruitment@google.com>',
        body: 'Thank you for your application.',
      };

      (generateProviderStructured as jest.Mock).mockResolvedValue({
        classification: 'confirmation',
        confidence: 0.9,
        company: null,
        role: null,
        status: 'Received',
        next_action: null,
        interview_date: null,
      });

      const result = await classifyEmail(emailContent);

      expect(result.data.company).toBeDefined();
    });

    it('should detect "application received" keyword', async () => {
      const emailContent = {
        subject: 'Application Received',
        from: 'hr@company.com',
        body: 'We acknowledge application received for your submission.',
      };

      (generateProviderStructured as jest.Mock).mockRejectedValue(new Error('LLM failed'));

      const result = await classifyEmail(emailContent);

      expect(result.classification).toBe('confirmation');
    });

    it('should detect "successfully submitted" keyword', async () => {
      const emailContent = {
        subject: 'Application Status',
        from: 'no-reply@ats.com',
        body: 'Your application was successfully submitted.',
      };

      (generateProviderStructured as jest.Mock).mockRejectedValue(new Error('LLM failed'));

      const result = await classifyEmail(emailContent);

      expect(result.classification).toBe('confirmation');
    });
  });

  describe('interview invite detection', () => {
    it('should classify interview invitation correctly', async () => {
      const emailContent = {
        subject: 'Interview Invitation - Software Engineer at Meta',
        from: 'recruiting@meta.com',
        body: 'We would like to invite you for a technical interview for the Software Engineer position. Please select a time slot for your phone screen.',
      };

      (generateProviderStructured as jest.Mock).mockResolvedValue({
        classification: 'interview_invite',
        confidence: 0.92,
        company: 'Meta',
        role: 'Software Engineer',
        status: 'Interview Scheduled',
        next_action: 'Schedule interview',
        interview_date: '2024-02-15',
      });

      const result = await classifyEmail(emailContent);

      expect(result.classification).toBe('interview_invite');
      expect(result.data.next_action).toBe('Schedule interview');
    });

    it('should detect interview by keywords', async () => {
      const emailContent = {
        subject: 'Interview Request',
        from: 'hr@company.com',
        body: 'We would like to schedule an interview with you next week.',
      };

      (generateProviderStructured as jest.Mock).mockRejectedValue(new Error('LLM failed'));

      const result = await classifyEmail(emailContent);

      expect(result.classification).toBe('interview_invite');
    });

    it('should detect phone screen keyword', async () => {
      const emailContent = {
        subject: 'Phone Screen Invitation',
        from: 'recruiter@company.com',
        body: 'We would like to conduct a phone screen with you.',
      };

      (generateProviderStructured as jest.Mock).mockRejectedValue(new Error('LLM failed'));

      const result = await classifyEmail(emailContent);

      expect(result.classification).toBe('interview_invite');
    });

    it('should detect technical interview keyword', async () => {
      const emailContent = {
        subject: 'Technical Interview',
        from: 'engineering@company.com',
        body: 'Your technical interview is scheduled for next Monday.',
      };

      (generateProviderStructured as jest.Mock).mockRejectedValue(new Error('LLM failed'));

      const result = await classifyEmail(emailContent);

      expect(result.classification).toBe('interview_invite');
    });

    it('should detect onsite interview keyword', async () => {
      const emailContent = {
        subject: 'Onsite Interview',
        from: 'recruiting@company.com',
        body: 'Welcome to your onsite interview at our office.',
      };

      (generateProviderStructured as jest.Mock).mockRejectedValue(new Error('LLM failed'));

      const result = await classifyEmail(emailContent);

      expect(result.classification).toBe('interview_invite');
    });

    it('should detect video interview keyword', async () => {
      const emailContent = {
        subject: 'Video Interview Link',
        from: 'noreply@hire.com',
        body: 'Please complete the video interview at your convenience.',
      };

      (generateProviderStructured as jest.Mock).mockRejectedValue(new Error('LLM failed'));

      const result = await classifyEmail(emailContent);

      expect(result.classification).toBe('interview_invite');
    });

    it('should extract interview date from email', async () => {
      const emailContent = {
        subject: 'Interview Confirmation',
        from: 'hr@company.com',
        body: 'Your interview is scheduled for 2024-03-15 at 10:00 AM.',
      };

      (generateProviderStructured as jest.Mock).mockResolvedValue({
        classification: 'interview_invite',
        confidence: 0.9,
        company: 'Company',
        role: 'Engineer',
        status: 'Interview',
        next_action: 'Prepare for interview',
        interview_date: '2024-03-15',
      });

      const result = await classifyEmail(emailContent);

      expect(result.data.interview_date).toBe('2024-03-15');
    });
  });

  describe('rejection email parsing', () => {
    it('should classify rejection email correctly', async () => {
      const emailContent = {
        subject: 'Application Update - Software Engineer Position',
        from: 'noreply@amazon.com',
        body: 'Unfortunately, we regret to inform you that we will not be proceeding with your application for the Software Engineer position at Amazon.',
      };

      (generateProviderStructured as jest.Mock).mockResolvedValue({
        classification: 'rejection',
        confidence: 0.88,
        company: 'Amazon',
        role: 'Software Engineer',
        status: 'Rejected',
        next_action: null,
        interview_date: null,
      });

      const result = await classifyEmail(emailContent);

      expect(result.classification).toBe('rejection');
      expect(result.data.company).toBe('Amazon');
      expect(result.data.status).toBe('Rejected');
    });

    it('should detect rejection by "unfortunately" keyword', async () => {
      const emailContent = {
        subject: 'Application Status',
        from: 'hr@company.com',
        body: 'Unfortunately, we have decided to move forward with other candidates.',
      };

      (generateProviderStructured as jest.Mock).mockRejectedValue(new Error('LLM failed'));

      const result = await classifyEmail(emailContent);

      expect(result.classification).toBe('rejection');
    });

    it('should detect rejection by "not moving forward" keyword', async () => {
      const emailContent = {
        subject: 'Update on your application',
        from: 'recruiting@company.com',
        body: 'We are not moving forward with your application at this time.',
      };

      (generateProviderStructured as jest.Mock).mockRejectedValue(new Error('LLM failed'));

      const result = await classifyEmail(emailContent);

      expect(result.classification).toBe('rejection');
    });

    it('should detect rejection by "regret to inform" keyword', async () => {
      const emailContent = {
        subject: 'Application Decision',
        from: 'careers@company.com',
        body: 'We regret to inform you that the position has been filled.',
      };

      (generateProviderStructured as jest.Mock).mockRejectedValue(new Error('LLM failed'));

      const result = await classifyEmail(emailContent);

      expect(result.classification).toBe('rejection');
    });

    it('should detect rejection by "position has been filled" keyword', async () => {
      const emailContent = {
        subject: 'Position Update',
        from: 'hr@company.com',
        body: 'The position has been filled. Thank you for your interest.',
      };

      (generateProviderStructured as jest.Mock).mockRejectedValue(new Error('LLM failed'));

      const result = await classifyEmail(emailContent);

      expect(result.classification).toBe('rejection');
    });

    it('should detect rejection by "other candidates" keyword', async () => {
      const emailContent = {
        subject: 'Application Status',
        from: 'recruiting@company.com',
        body: 'We have selected other candidates for the next round.',
      };

      (generateProviderStructured as jest.Mock).mockRejectedValue(new Error('LLM failed'));

      const result = await classifyEmail(emailContent);

      expect(result.classification).toBe('rejection');
    });

    it('should detect rejection by "rejected" keyword', async () => {
      const emailContent = {
        subject: 'Application Rejected',
        from: 'auto@ats.com',
        body: 'We regret to inform you that your application was rejected for the position.',
      };

      (generateProviderStructured as jest.Mock).mockRejectedValue(new Error('LLM failed'));

      const result = await classifyEmail(emailContent);

      expect(result.classification).toBe('rejection');
    });
  });

  describe('offer extraction', () => {
    it('should classify job offer correctly', async () => {
      const emailContent = {
        subject: 'Job Offer - Software Engineer at Netflix',
        from: 'offers@netflix.com',
        body: 'We are pleased to offer you the position of Software Engineer at Netflix. Please find attached the formal offer letter with details of your employment offer.',
      };

      (generateProviderStructured as jest.Mock).mockResolvedValue({
        classification: 'offer',
        confidence: 0.95,
        company: 'Netflix',
        role: 'Software Engineer',
        status: 'Offer Received',
        next_action: 'Review and accept offer',
        interview_date: null,
      });

      const result = await classifyEmail(emailContent);

      expect(result.classification).toBe('offer');
      expect(result.data.company).toBe('Netflix');
      expect(result.data.next_action).toBe('Review and accept offer');
    });

    it('should detect offer by "pleased to offer" keyword', async () => {
      const emailContent = {
        subject: 'Congratulations!',
        from: 'hr@company.com',
        body: 'We are pleased to offer you the position.',
      };

      (generateProviderStructured as jest.Mock).mockRejectedValue(new Error('LLM failed'));

      const result = await classifyEmail(emailContent);

      expect(result.classification).toBe('offer');
    });

    it('should detect offer by "congratulations" keyword', async () => {
      const emailContent = {
        subject: 'Congratulations from TechCorp',
        from: 'careers@techcorp.com',
        body: 'Congratulations! We would like to welcome you to our team.',
      };

      (generateProviderStructured as jest.Mock).mockRejectedValue(new Error('LLM failed'));

      const result = await classifyEmail(emailContent);

      expect(result.classification).toBe('offer');
    });

    it('should detect offer by "job offer" keyword', async () => {
      const emailContent = {
        subject: 'Job Offer Details',
        from: 'recruiting@company.com',
        body: 'Please review the job offer details attached.',
      };

      (generateProviderStructured as jest.Mock).mockRejectedValue(new Error('LLM failed'));

      const result = await classifyEmail(emailContent);

      expect(result.classification).toBe('offer');
    });

    it('should detect offer by "formal offer" keyword', async () => {
      const emailContent = {
        subject: 'Formal Offer Letter',
        from: 'hr@company.com',
        body: 'Attached is your formal offer letter.',
      };

      (generateProviderStructured as jest.Mock).mockRejectedValue(new Error('LLM failed'));

      const result = await classifyEmail(emailContent);

      expect(result.classification).toBe('offer');
    });

    it('should detect offer by "employment offer" keyword', async () => {
      const emailContent = {
        subject: 'Employment Offer',
        from: 'legal@company.com',
        body: 'This employment offer is contingent upon background check.',
      };

      (generateProviderStructured as jest.Mock).mockRejectedValue(new Error('LLM failed'));

      const result = await classifyEmail(emailContent);

      expect(result.classification).toBe('offer');
    });

    it('should detect offer by "excited to offer" keyword', async () => {
      const emailContent = {
        subject: 'Welcome to the Team',
        from: 'recruiting@company.com',
        body: 'We are excited to offer you this opportunity to join us.',
      };

      (generateProviderStructured as jest.Mock).mockRejectedValue(new Error('LLM failed'));

      const result = await classifyEmail(emailContent);

      expect(result.classification).toBe('offer');
    });
  });

  describe('company extraction', () => {
    it('should extract company from sender name', async () => {
      const emailContent = {
        subject: 'Application Update',
        from: 'Google Recruitment <recruitment@google.com>',
        body: 'Thank you for applying.',
      };

      (generateProviderStructured as jest.Mock).mockRejectedValue(new Error('LLM failed'));

      const result = await classifyEmail(emailContent);

      expect(result.data.company).toBe('Google Recruitment');
    });

    it('should extract company from email domain', async () => {
      const emailContent = {
        subject: 'Application Update',
        from: 'recruitment@amazon.com',
        body: 'Thank you for applying.',
      };

      (generateProviderStructured as jest.Mock).mockRejectedValue(new Error('LLM failed'));

      const result = await classifyEmail(emailContent);

      expect(result.data.company).toBe('Amazon');
    });

    it('should extract company from body "at Company" pattern', async () => {
      const emailContent = {
        subject: 'Application Update',
        from: 'sender',
        body: 'Thank you for applying at Microsoft for the Engineer role.',
      };

      (generateProviderStructured as jest.Mock).mockRejectedValue(new Error('LLM failed'));

      const result = await classifyEmail(emailContent);

      expect(result.data.company).toBe('Microsoft');
    });
  });

  describe('role extraction', () => {
    it('should extract role from subject line', async () => {
      const emailContent = {
        subject: 'Application for Software Engineer at Google',
        from: 'recruitment@google.com',
        body: 'Thank you for applying.',
      };

      (generateProviderStructured as jest.Mock).mockRejectedValue(new Error('LLM failed'));

      const result = await classifyEmail(emailContent);

      expect(result.data.role).toContain('Software Engineer');
    });

    it('should extract role from "position:" pattern', async () => {
      const emailContent = {
        subject: 'Your Application',
        from: 'hr@company.com',
        body: 'Position: Senior Software Engineer at our company.',
      };

      (generateProviderStructured as jest.Mock).mockRejectedValue(new Error('LLM failed'));

      const result = await classifyEmail(emailContent);

      expect(result.data.role).toContain('Senior Software Engineer');
    });

    it('should extract role from "role:" pattern', async () => {
      const emailContent = {
        subject: 'Interview Invitation',
        from: 'recruiting@company.com',
        body: 'Role: Product Manager for the mobile team.',
      };

      (generateProviderStructured as jest.Mock).mockRejectedValue(new Error('LLM failed'));

      const result = await classifyEmail(emailContent);

      expect(result.data.role).toContain('Product Manager');
    });

    it('should extract role from "application for:" pattern', async () => {
      const emailContent = {
        subject: 'Confirmation',
        from: 'auto@ats.com',
        body: 'Application for: Data Scientist position.',
      };

      (generateProviderStructured as jest.Mock).mockRejectedValue(new Error('LLM failed'));

      const result = await classifyEmail(emailContent);

      expect(result.data.role).toContain('Data Scientist');
    });
  });

  describe('other email classification', () => {
    it('should classify unrelated emails as other', async () => {
      const emailContent = {
        subject: 'Newsletter: Tech News Weekly',
        from: 'newsletter@technews.com',
        body: 'Here are the latest technology news updates.',
      };

      (generateProviderStructured as jest.Mock).mockResolvedValue({
        classification: 'other',
        confidence: 0.8,
        company: null,
        role: null,
        status: null,
        next_action: null,
        interview_date: null,
      });

      const result = await classifyEmail(emailContent);

      expect(result.classification).toBe('other');
    });
  });

  describe('extractApplicationData', () => {
    it('should return extracted data', async () => {
      const emailContent = {
        subject: 'Interview Invitation',
        from: 'recruiter@company.com',
        body: 'We invite you for an interview.',
      };

      (generateProviderStructured as jest.Mock).mockResolvedValue({
        classification: 'interview_invite',
        confidence: 0.9,
        company: 'Company',
        role: 'Engineer',
        status: 'Interview',
        next_action: 'Confirm attendance',
        interview_date: '2024-03-20',
      });

      const data = await extractApplicationData(emailContent);

      expect(data.company).toBe('Company');
      expect(data.role).toBe('Engineer');
      expect(data.status).toBe('Interview');
      expect(data.next_action).toBe('Confirm attendance');
      expect(data.interview_date).toBe('2024-03-20');
    });
  });
});
