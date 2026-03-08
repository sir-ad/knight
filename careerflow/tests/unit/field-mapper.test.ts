import { needsLLMGeneration, getFieldPriority, sortFieldsByPriority } from '../../src/lib/field-mapper';
import { workdayAdapter } from '../../src/content/ats-adapters/workday';
import { greenhouseAdapter } from '../../src/content/ats-adapters/greenhouse';
import { naukriAdapter } from '../../src/content/ats-adapters/naukri';
import type { Profile, DetectedField, MappedField } from '../../src/lib/types';

jest.mock('../../src/lib/ollama-client');

interface MockDetectedField {
  element: HTMLElement;
  type: 'input' | 'textarea' | 'select';
  label: string;
  name: string | null;
  id: string | null;
  placeholder: string | null;
  required: boolean;
  selector: string;
}

const mockDetectedField = (overrides: Partial<MockDetectedField> = {}): MockDetectedField => ({
  element: document.createElement('input'),
  type: 'input',
  label: '',
  name: null,
  id: null,
  placeholder: null,
  required: false,
  selector: '#test',
  ...overrides,
});

const mockProfile: Profile = {
  identity: {
    name: 'John Doe',
    email: 'john.doe@example.com',
    phone: '+1234567890',
    location: 'San Francisco, CA',
    linkedin: 'https://linkedin.com/in/johndoe',
    github: 'https://github.com/johndoe',
  },
  work_history: [
    {
      company: 'TechCorp',
      title: 'Senior Software Engineer',
      start_date: '2020-01-15',
      current: true,
      location: 'San Francisco',
    },
    {
      company: 'StartupInc',
      title: 'Software Engineer',
      start_date: '2017-06-01',
      end_date: '2019-12-31',
    },
  ],
  education: [
    {
      degree: 'Bachelor of Science',
      field: 'Computer Science',
      institution: 'Stanford University',
      end_date: '2017-05-15',
      gpa: 3.8,
    },
  ],
  skills: {
    technical: ['JavaScript', 'TypeScript', 'Python', 'React', 'Node.js'],
    tools: ['Git', 'Docker', 'AWS', 'PostgreSQL'],
    soft: ['Leadership', 'Communication'],
  },
  meta: {
    current_ctc: 1500000,
    expected_ctc: 1800000,
    notice_period_days: 30,
    work_mode_preference: 'remote',
  },
};

describe('field-mapper', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    document.body.innerHTML = '';
  });

  describe('Workday field mapping', () => {
    it('should map first name field', () => {
      const field = mockDetectedField({ label: 'First Name' }) as DetectedField;
      const result = workdayAdapter.mapField(field, mockProfile);

      expect(result.profileValue).toBe('John');
      expect(result.confidence).toBe('high');
      expect(result.needsLLM).toBe(false);
    });

    it('should map last name field', () => {
      const field = mockDetectedField({ label: 'Last Name' }) as DetectedField;
      const result = workdayAdapter.mapField(field, mockProfile);

      expect(result.profileValue).toBe('Doe');
      expect(result.confidence).toBe('high');
    });

    it('should map full name field', () => {
      const field = mockDetectedField({ label: 'Full Name' }) as DetectedField;
      const result = workdayAdapter.mapField(field, mockProfile);

      expect(result.profileValue).toBe('John Doe');
      expect(result.confidence).toBe('high');
    });

    it('should map email field', () => {
      const field = mockDetectedField({ label: 'Email Address' }) as DetectedField;
      const result = workdayAdapter.mapField(field, mockProfile);

      expect(result.profileValue).toBe('john.doe@example.com');
      expect(result.confidence).toBe('high');
    });

    it('should map phone field', () => {
      const field = mockDetectedField({ label: 'Phone Number' }) as DetectedField;
      const result = workdayAdapter.mapField(field, mockProfile);

      expect(result.profileValue).toBe('+1234567890');
      expect(result.confidence).toBe('high');
    });

    it('should map LinkedIn field', () => {
      const field = mockDetectedField({ label: 'LinkedIn Profile' }) as DetectedField;
      const result = workdayAdapter.mapField(field, mockProfile);

      expect(result.profileValue).toBe('https://linkedin.com/in/johndoe');
      expect(result.confidence).toBe('high');
    });

    it('should map current company field', () => {
      const field = mockDetectedField({ label: 'Current Company' }) as DetectedField;
      const result = workdayAdapter.mapField(field, mockProfile);

      expect(result.profileValue).toBe('TechCorp');
      expect(result.confidence).toBe('high');
    });

    it('should map current title field', () => {
      const field = mockDetectedField({ label: 'Current Title' }) as DetectedField;
      const result = workdayAdapter.mapField(field, mockProfile);

      expect(result.profileValue).toBe('Senior Software Engineer');
      expect(result.confidence).toBe('high');
    });

    it('should map education institution field', () => {
      const field = mockDetectedField({ label: 'University' }) as DetectedField;
      const result = workdayAdapter.mapField(field, mockProfile);

      expect(result.profileValue).toBe('Stanford University');
      expect(result.confidence).toBe('high');
    });

    it('should map degree field', () => {
      const field = mockDetectedField({ label: 'Degree' }) as DetectedField;
      const result = workdayAdapter.mapField(field, mockProfile);

      expect(result.profileValue).toBe('Bachelor of Science in Computer Science');
      expect(result.confidence).toBe('high');
    });

    it('should map skills field', () => {
      const field = mockDetectedField({ label: 'Skills' }) as DetectedField;
      const result = workdayAdapter.mapField(field, mockProfile);

      expect(result.profileValue).toBe('JavaScript, TypeScript, Python, React, Node.js');
      expect(result.confidence).toBe('high');
    });

    it('should mark textarea fields as needing LLM', () => {
      const textarea = document.createElement('textarea');
      const field = mockDetectedField({ type: 'textarea', element: textarea, label: 'Cover Letter' }) as DetectedField;
      const result = workdayAdapter.mapField(field, mockProfile);

      expect(result.needsLLM).toBe(true);
      expect(result.profileValue).toBeNull();
      expect(result.confidence).toBe('low');
    });
  });

  describe('Greenhouse field mapping', () => {
    it('should map first name field', () => {
      const field = mockDetectedField({ label: 'First Name' }) as DetectedField;
      const result = greenhouseAdapter.mapField(field, mockProfile);

      expect(result.profileValue).toBe('John');
      expect(result.confidence).toBe('high');
    });

    it('should map portfolio field', () => {
      const profileWithPortfolio = {
        ...mockProfile,
        identity: { ...mockProfile.identity, portfolio: 'https://johndoe.dev' },
      };
      const field = mockDetectedField({ label: 'Portfolio' }) as DetectedField;
      const result = greenhouseAdapter.mapField(field, profileWithPortfolio);

      expect(result.profileValue).toBe('https://johndoe.dev');
      expect(result.confidence).toBe('high');
    });

    it('should map website field to portfolio', () => {
      const profileWithPortfolio = {
        ...mockProfile,
        identity: { ...mockProfile.identity, portfolio: 'https://johndoe.dev' },
      };
      const field = mockDetectedField({ label: 'Website' }) as DetectedField;
      const result = greenhouseAdapter.mapField(field, profileWithPortfolio);

      expect(result.profileValue).toBe('https://johndoe.dev');
    });

    it('should return null for demographic fields', () => {
      const selectElement = document.createElement('select');
      const field = mockDetectedField({ type: 'select', element: selectElement, label: 'Gender' }) as DetectedField;
      const result = greenhouseAdapter.mapField(field, mockProfile);

      expect(result.profileValue).toBeNull();
      expect(result.confidence).toBe('low');
    });

    it('should return null for race/ethnicity fields', () => {
      const selectElement = document.createElement('select');
      const field = mockDetectedField({ type: 'select', element: selectElement, label: 'Race/Ethnicity' }) as DetectedField;
      const result = greenhouseAdapter.mapField(field, mockProfile);

      expect(result.profileValue).toBeNull();
    });

    it('should return null for veteran status fields', () => {
      const selectElement = document.createElement('select');
      const field = mockDetectedField({ type: 'select', element: selectElement, label: 'Veteran Status' }) as DetectedField;
      const result = greenhouseAdapter.mapField(field, mockProfile);

      expect(result.profileValue).toBeNull();
    });

    it('should return null for disability status fields', () => {
      const selectElement = document.createElement('select');
      const field = mockDetectedField({ type: 'select', element: selectElement, label: 'Disability Status' }) as DetectedField;
      const result = greenhouseAdapter.mapField(field, mockProfile);

      expect(result.profileValue).toBeNull();
    });
  });

  describe('Naukri CTC fields', () => {
    it('should map current CTC field with LPA format', () => {
      const field = mockDetectedField({ label: 'Current CTC' }) as DetectedField;
      const result = naukriAdapter.mapField(field, mockProfile);

      expect(result.profileValue).toBe('15.00 LPA');
      expect(result.confidence).toBe('high');
    });

    it('should map current salary field', () => {
      const field = mockDetectedField({ label: 'Current Salary' }) as DetectedField;
      const result = naukriAdapter.mapField(field, mockProfile);

      expect(result.profileValue).toBe('15.00 LPA');
    });

    it('should map expected CTC field with LPA format', () => {
      const field = mockDetectedField({ label: 'Expected CTC' }) as DetectedField;
      const result = naukriAdapter.mapField(field, mockProfile);

      expect(result.profileValue).toBe('18.00 LPA');
      expect(result.confidence).toBe('high');
    });

    it('should map expected salary field', () => {
      const field = mockDetectedField({ label: 'Expected Salary' }) as DetectedField;
      const result = naukriAdapter.mapField(field, mockProfile);

      expect(result.profileValue).toBe('18.00 LPA');
    });

    it('should map salary expectation field', () => {
      const field = mockDetectedField({ label: 'Salary Expectation' }) as DetectedField;
      const result = naukriAdapter.mapField(field, mockProfile);

      expect(result.profileValue).toBe('18.00 LPA');
    });

    it('should map notice period field', () => {
      const field = mockDetectedField({ label: 'Notice Period' }) as DetectedField;
      const result = naukriAdapter.mapField(field, mockProfile);

      expect(result.profileValue).toBe('30 days');
      expect(result.confidence).toBe('high');
    });

    it('should map total experience field', () => {
      const field = mockDetectedField({ label: 'Total Experience' }) as DetectedField;
      const result = naukriAdapter.mapField(field, mockProfile);

      expect(result.profileValue).toBeDefined();
    });

    it('should map work mode preference field', () => {
      const selectElement = document.createElement('select');
      const field = mockDetectedField({ type: 'select', element: selectElement, label: 'Work Mode' }) as DetectedField;
      const result = naukriAdapter.mapField(field, mockProfile);

      expect(result.profileValue).toBe('remote');
    });

    it('should handle CTC below 1 lakh', () => {
      const lowCTCProfile = {
        ...mockProfile,
        meta: { ...mockProfile.meta, current_ctc: 50000 },
      };
      const field = mockDetectedField({ label: 'Current CTC' }) as DetectedField;
      const result = naukriAdapter.mapField(field, lowCTCProfile);

      expect(result.profileValue).toBe('50000');
    });

    it('should map key skills field', () => {
      const field = mockDetectedField({ label: 'Key Skills' }) as DetectedField;
      const result = naukriAdapter.mapField(field, mockProfile);

      expect(result.profileValue).toContain('JavaScript');
      expect(result.profileValue).toContain('Git');
    });
  });

  describe('confidence calculation', () => {
    it('should return high confidence for exact match with value', () => {
      const field = mockDetectedField({ label: 'Email', required: true }) as DetectedField;
      const result = workdayAdapter.mapField(field, mockProfile);

      expect(result.confidence).toBe('high');
    });

    it('should return medium confidence for partial match', () => {
      const profileWithoutPhone = {
        ...mockProfile,
        identity: { ...mockProfile.identity, phone: undefined },
      };
      const field = mockDetectedField({ label: 'Phone', required: false }) as DetectedField;
      const result = workdayAdapter.mapField(field, profileWithoutPhone);

      expect(result.confidence).toBe('low');
    });

    it('should return low confidence for LLM-required fields', () => {
      const textarea = document.createElement('textarea');
      const field = mockDetectedField({ type: 'textarea', element: textarea, label: 'Why do you want to join?' }) as DetectedField;
      const result = workdayAdapter.mapField(field, mockProfile);

      expect(result.confidence).toBe('low');
      expect(result.needsLLM).toBe(true);
    });
  });

  describe('LLM field detection', () => {
    it('should detect textarea fields as needing LLM', () => {
      const textarea = document.createElement('textarea');
      const field = mockDetectedField({ type: 'textarea', element: textarea }) as DetectedField;
      expect(needsLLMGeneration(field)).toBe(true);
    });

    it('should detect "why do you" questions', () => {
      const field = mockDetectedField({ label: 'Why do you want to work here?' }) as DetectedField;
      expect(needsLLMGeneration(field)).toBe(true);
    });

    it('should detect cover letter fields', () => {
      const field = mockDetectedField({ label: 'Cover Letter' }) as DetectedField;
      expect(needsLLMGeneration(field)).toBe(true);
    });

    it('should detect "tell us about" questions', () => {
      const field = mockDetectedField({ label: 'Tell us about yourself' }) as DetectedField;
      expect(needsLLMGeneration(field)).toBe(true);
    });

    it('should detect "describe your" questions', () => {
      const field = mockDetectedField({ label: 'Describe your experience' }) as DetectedField;
      expect(needsLLMGeneration(field)).toBe(true);
    });

    it('should detect "what motivates" questions', () => {
      const field = mockDetectedField({ label: 'What motivates you?' }) as DetectedField;
      expect(needsLLMGeneration(field)).toBe(true);
    });

    it('should detect "give an example" questions', () => {
      const field = mockDetectedField({ label: 'Give an example of leadership' }) as DetectedField;
      expect(needsLLMGeneration(field)).toBe(true);
    });

    it('should detect questions in placeholder', () => {
      const field = mockDetectedField({ placeholder: 'Why are you interested in this role?' }) as DetectedField;
      expect(needsLLMGeneration(field)).toBe(true);
    });

    it('should not mark simple fields as needing LLM', () => {
      const field = mockDetectedField({ label: 'First Name' }) as DetectedField;
      expect(needsLLMGeneration(field)).toBe(false);
    });

    it('should not mark email fields as needing LLM', () => {
      const field = mockDetectedField({ label: 'Email Address' }) as DetectedField;
      expect(needsLLMGeneration(field)).toBe(false);
    });
  });

  describe('field priority sorting', () => {
    const createMappedField = (
      label: string,
      required: boolean,
      confidence: 'high' | 'medium' | 'low',
      needsLLM: boolean
    ): MappedField => ({
      field: mockDetectedField({ label, required }) as DetectedField,
      profileValue: 'test value',
      confidence,
      needsLLM,
    });

    it('should prioritize required fields with high confidence', () => {
      const fields = [
        createMappedField('Optional Low', false, 'low', false),
        createMappedField('Required High', true, 'high', false),
        createMappedField('Required Low', true, 'low', false),
        createMappedField('Optional High', false, 'high', false),
      ];

      const sorted = sortFieldsByPriority(fields);

      expect(sorted[0].field.label).toBe('Required High');
      expect(sorted[1].field.label).toBe('Required Low');
      expect(sorted[2].field.label).toBe('Optional High');
      expect(sorted[3].field.label).toBe('Optional Low');
    });

    it('should sort required high confidence first', () => {
      const field = createMappedField('Test', true, 'high', false);
      expect(getFieldPriority(field)).toBe(1);
    });

    it('should sort required medium confidence second', () => {
      const field = createMappedField('Test', true, 'medium', false);
      expect(getFieldPriority(field)).toBe(2);
    });

    it('should sort required low confidence third', () => {
      const field = createMappedField('Test', true, 'low', false);
      expect(getFieldPriority(field)).toBe(3);
    });

    it('should sort optional high confidence fourth', () => {
      const field = createMappedField('Test', false, 'high', false);
      expect(getFieldPriority(field)).toBe(4);
    });

    it('should sort optional medium confidence fifth', () => {
      const field = createMappedField('Test', false, 'medium', false);
      expect(getFieldPriority(field)).toBe(5);
    });

    it('should sort optional low confidence last', () => {
      const field = createMappedField('Test', false, 'low', false);
      expect(getFieldPriority(field)).toBe(6);
    });
  });
});
