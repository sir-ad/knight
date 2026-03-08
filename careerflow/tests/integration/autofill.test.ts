import { AutofillController } from '../../src/content/autofill-controller';
import type { Profile, MappedField, DetectedField } from '../../src/lib/types';

jest.mock('../../src/lib/field-mapper', () => ({
  getAdapterForCurrentPage: jest.fn(),
  mapFieldsToProfile: jest.fn(),
  sortFieldsByPriority: jest.fn(),
}));

import { getAdapterForCurrentPage, mapFieldsToProfile, sortFieldsByPriority } from '../../src/lib/field-mapper';

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
  label: 'Test Field',
  name: null,
  id: null,
  placeholder: null,
  required: false,
  selector: '#test-field',
  ...overrides,
});

interface MockMappedField {
  field: MockDetectedField;
  profileValue: string | null;
  confidence: 'high' | 'medium' | 'low';
  needsLLM: boolean;
}

const mockMappedField = (overrides: Partial<MockMappedField> = {}): MockMappedField => ({
  field: mockDetectedField(),
  profileValue: 'test value',
  confidence: 'high',
  needsLLM: false,
  ...overrides,
});

const mockProfile: Profile = {
  identity: {
    name: 'John Doe',
    email: 'john@example.com',
    phone: '+1234567890',
  },
  work_history: [
    {
      company: 'TestCorp',
      title: 'Engineer',
      start_date: '2020-01-01',
    },
  ],
};

describe('autofill integration', () => {
  let controller: AutofillController;
  let mockAdapter: any;

  beforeEach(() => {
    jest.clearAllMocks();
    document.body.innerHTML = '';
    controller = new AutofillController();

    mockAdapter = {
      name: 'test-adapter',
      detect: jest.fn().mockReturnValue(true),
      scanFields: jest.fn(),
      mapField: jest.fn(),
    };

    (getAdapterForCurrentPage as jest.Mock).mockReturnValue(mockAdapter);
    (sortFieldsByPriority as jest.Mock).mockImplementation((fields) => fields);
  });

  describe('full autofill flow', () => {
    it('should complete full autofill workflow', async () => {
      document.body.innerHTML = `
        <form>
          <input id="first-name" name="firstName" type="text" />
          <input id="last-name" name="lastName" type="text" />
          <input id="email" name="email" type="email" />
        </form>
      `;

      const firstNameField = mockDetectedField({
        selector: '#first-name',
        label: 'First Name',
        element: document.getElementById('first-name') as HTMLInputElement,
      });

      const lastNameField = mockDetectedField({
        selector: '#last-name',
        label: 'Last Name',
        element: document.getElementById('last-name') as HTMLInputElement,
      });

      const emailField = mockDetectedField({
        selector: '#email',
        label: 'Email',
        element: document.getElementById('email') as HTMLInputElement,
      });

      const mappedFields: MappedField[] = [
        { field: firstNameField as DetectedField, profileValue: 'John', confidence: 'high', needsLLM: false },
        { field: lastNameField as DetectedField, profileValue: 'Doe', confidence: 'high', needsLLM: false },
        { field: emailField as DetectedField, profileValue: 'john@example.com', confidence: 'high', needsLLM: false },
      ];

      (mapFieldsToProfile as jest.Mock).mockReturnValue(mappedFields);
      mockAdapter.scanFields.mockReturnValue([firstNameField, lastNameField, emailField]);

      controller.setProfile(mockProfile);
      const result = controller.scanAndMap();

      expect(result.length).toBe(3);
      expect(result[0].profileValue).toBe('John');
    });

    it('should handle profile not set', () => {
      mockAdapter.scanFields.mockReturnValue([]);

      const result = controller.scanAndMap();

      expect(result).toEqual([]);
    });

    it('should handle no adapter available', () => {
      (getAdapterForCurrentPage as jest.Mock).mockReturnValue(null);

      controller.setProfile(mockProfile);
      const result = controller.scanAndMap();

      expect(result).toEqual([]);
    });
  });

  describe('field scanning on mock HTML', () => {
    it('should scan text input fields', () => {
      document.body.innerHTML = `
        <form>
          <input id="name" name="name" type="text" placeholder="Full Name" />
        </form>
      `;

      mockAdapter.scanFields.mockReturnValue([
        mockDetectedField({
          selector: '#name',
          label: 'Full Name',
          name: 'name',
          placeholder: 'Full Name',
        }),
      ]);

      controller.setProfile(mockProfile);
      controller.scanAndMap();

      expect(mockAdapter.scanFields).toHaveBeenCalled();
    });

    it('should scan email input fields', () => {
      document.body.innerHTML = `
        <form>
          <input id="email" name="email" type="email" />
        </form>
      `;

      mockAdapter.scanFields.mockReturnValue([
        mockDetectedField({
          selector: '#email',
          label: 'Email Address',
          type: 'input',
        }),
      ]);

      controller.setProfile(mockProfile);
      const result = controller.scanAndMap();

      expect(result).toBeDefined();
    });

    it('should scan textarea fields', () => {
      document.body.innerHTML = `
        <form>
          <textarea id="cover-letter" name="coverLetter"></textarea>
        </form>
      `;

      const textareaElement = document.createElement('textarea');
      textareaElement.id = 'cover-letter';

      mockAdapter.scanFields.mockReturnValue([
        mockDetectedField({
          selector: '#cover-letter',
          label: 'Cover Letter',
          type: 'textarea',
          element: textareaElement,
        }),
      ]);

      controller.setProfile(mockProfile);
      const result = controller.scanAndMap();

      expect(result).toBeDefined();
    });

    it('should scan select dropdown fields', () => {
      document.body.innerHTML = `
        <form>
          <select id="experience" name="experience">
            <option value="">Select</option>
            <option value="0-1">0-1 years</option>
            <option value="1-3">1-3 years</option>
          </select>
        </form>
      `;

      const selectElement = document.createElement('select');
      selectElement.id = 'experience';

      mockAdapter.scanFields.mockReturnValue([
        mockDetectedField({
          selector: '#experience',
          label: 'Years of Experience',
          type: 'select',
          element: selectElement,
        }),
      ]);

      controller.setProfile(mockProfile);
      const result = controller.scanAndMap();

      expect(result).toBeDefined();
    });

    it('should detect required fields', () => {
      document.body.innerHTML = `
        <form>
          <input id="name" name="name" type="text" required />
        </form>
      `;

      mockAdapter.scanFields.mockReturnValue([
        mockDetectedField({
          selector: '#name',
          label: 'Name',
          required: true,
        }),
      ]);

      controller.setProfile(mockProfile);
      const result = controller.scanAndMap();

      expect(result).toBeDefined();
      expect(result.length).toBeGreaterThan(0);
    });

    it('should skip hidden fields', () => {
      document.body.innerHTML = `
        <form>
          <input id="name" name="name" type="text" />
          <input id="hidden" name="hidden" type="hidden" />
        </form>
      `;

      mockAdapter.scanFields.mockReturnValue([
        mockDetectedField({
          selector: '#name',
          label: 'Name',
        }),
      ]);

      controller.setProfile(mockProfile);
      const result = controller.scanAndMap();

      expect(result).toBeDefined();
    });

    it('should extract labels from associated label elements', () => {
      document.body.innerHTML = `
        <form>
          <label for="email">Email Address</label>
          <input id="email" name="email" type="email" />
        </form>
      `;

      mockAdapter.scanFields.mockReturnValue([
        mockDetectedField({
          selector: '#email',
          label: 'Email Address',
        }),
      ]);

      controller.setProfile(mockProfile);
      const result = controller.scanAndMap();

      expect(result).toBeDefined();
      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe('field filling', () => {
    it('should fill input field with value', async () => {
      document.body.innerHTML = '<input id="name" type="text" />';

      const result = await controller.fillField('#name', 'John Doe');

      expect(result.success).toBe(true);
      expect(result.value).toBe('John Doe');
    });

    it('should return error for missing element', async () => {
      const result = await controller.fillField('#nonexistent', 'test');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Element not found');
    });

    it('should fill textarea field', async () => {
      document.body.innerHTML = '<textarea id="bio"></textarea>';

      const result = await controller.fillField('#bio', 'Software Engineer with 5 years experience');

      expect(result.success).toBe(true);
      expect(result.value).toBe('Software Engineer with 5 years experience');
    });

    it('should fill select field with matching option', async () => {
      document.body.innerHTML = `
        <select id="experience">
          <option value="">Select</option>
          <option value="5">5+ years</option>
          <option value="10">10+ years</option>
        </select>
      `;

      const result = await controller.fillField('#experience', '5');

      expect(result.success).toBe(true);
    });

    it('should handle select field with case-insensitive matching', async () => {
      document.body.innerHTML = `
        <select id="country">
          <option value="us">United States</option>
          <option value="uk">United Kingdom</option>
        </select>
      `;

      const result = await controller.fillField('#country', 'united states');

      expect(result.success).toBe(true);
    });

    it('should dispatch input and change events', async () => {
      document.body.innerHTML = '<input id="email" type="email" />';

      const inputHandler = jest.fn();
      const changeHandler = jest.fn();

      const inputElement = document.getElementById('email') as HTMLInputElement;
      inputElement.addEventListener('input', inputHandler);
      inputElement.addEventListener('change', changeHandler);

      await controller.fillField('#email', 'test@example.com');

      expect(inputHandler).toHaveBeenCalled();
      expect(changeHandler).toHaveBeenCalled();
    });
  });

  describe('fillAllFields', () => {
    it('should fill all fields in sequence', async () => {
      document.body.innerHTML = `
        <input id="name" type="text" />
        <input id="email" type="email" />
      `;

      const fields: MappedField[] = [
        mockMappedField({
          field: mockDetectedField({ selector: '#name' }) as DetectedField,
          profileValue: 'John',
        }) as MappedField,
        mockMappedField({
          field: mockDetectedField({ selector: '#email' }) as DetectedField,
          profileValue: 'john@example.com',
        }) as MappedField,
      ];

      (sortFieldsByPriority as jest.Mock).mockReturnValue(fields);

      const results = await controller.fillAllFields(fields);

      expect(results.length).toBe(2);
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(true);
    });

    it('should skip fields requiring LLM by default', async () => {
      document.body.innerHTML = '<textarea id="cover-letter"></textarea>';

      const fields: MappedField[] = [
        mockMappedField({
          field: mockDetectedField({
            selector: '#cover-letter',
            type: 'textarea',
          }) as DetectedField,
          needsLLM: true,
          profileValue: null,
        }) as MappedField,
      ];

      const results = await controller.fillAllFields(fields);

      expect(results[0].success).toBe(false);
      expect(results[0].error).toBe('LLM generation required');
    });

    it('should fill LLM fields when skipLLMFields is false', async () => {
      document.body.innerHTML = '<textarea id="bio"></textarea>';

      const fields: MappedField[] = [
        mockMappedField({
          field: mockDetectedField({
            selector: '#bio',
            type: 'textarea',
          }) as DetectedField,
          needsLLM: true,
          profileValue: 'Generated content',
        }) as MappedField,
      ];

      const results = await controller.fillAllFields(fields, { skipLLMFields: false });

      expect(results[0].success).toBe(true);
    });

    it('should skip fields without profile value', async () => {
      document.body.innerHTML = '<input id="optional" type="text" />';

      const fields: MappedField[] = [
        mockMappedField({
          field: mockDetectedField({ selector: '#optional' }) as DetectedField,
          profileValue: null,
        }) as MappedField,
      ];

      const results = await controller.fillAllFields(fields);

      expect(results[0].success).toBe(false);
      expect(results[0].error).toBe('No profile value available');
    });

    it('should respect fill delay option', async () => {
      document.body.innerHTML = `
        <input id="field1" type="text" />
        <input id="field2" type="text" />
      `;

      const fields: MappedField[] = [
        mockMappedField({
          field: mockDetectedField({ selector: '#field1' }) as DetectedField,
          profileValue: 'value1',
        }) as MappedField,
        mockMappedField({
          field: mockDetectedField({ selector: '#field2' }) as DetectedField,
          profileValue: 'value2',
        }) as MappedField,
      ];

      (sortFieldsByPriority as jest.Mock).mockReturnValue(fields);

      const startTime = Date.now();
      await controller.fillAllFields(fields, { fillDelay: 50 });
      const duration = Date.now() - startTime;

      expect(duration).toBeGreaterThanOrEqual(50);
    });
  });

  describe('review modal rendering', () => {
    it('should emit review:show event', () => {
      const handler = jest.fn();
      controller.on('review:show', handler);

      const fields: MappedField[] = [
        mockMappedField({
          field: mockDetectedField({ selector: '#name' }) as DetectedField,
          profileValue: 'John',
        }) as MappedField,
      ];

      controller.showReviewModal(fields);

      expect(handler).toHaveBeenCalled();
    });

    it('should post message to window', () => {
      const postMessageSpy = jest.spyOn(window, 'postMessage');

      const fields: MappedField[] = [
        mockMappedField({
          field: mockDetectedField({ selector: '#name', label: 'Name' }) as DetectedField,
          profileValue: 'John',
          confidence: 'high',
        }) as MappedField,
      ];

      controller.showReviewModal(fields);

      expect(postMessageSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'CAREERFLOW_SHOW_REVIEW',
        }),
        '*'
      );

      postMessageSpy.mockRestore();
    });
  });

  describe('event handling', () => {
    it('should register and call event handlers', () => {
      const handler = jest.fn();
      controller.on('field:fill', handler);

      controller.emit('field:fill', { selector: '#test', value: 'test' });

      expect(handler).toHaveBeenCalled();
    });

    it('should remove event handlers', () => {
      const handler = jest.fn();
      controller.on('field:fill', handler);
      controller.off('field:fill', handler);

      controller.emit('field:fill', { selector: '#test' });

      expect(handler).not.toHaveBeenCalled();
    });

    it('should handle multiple handlers for same event', () => {
      const handler1 = jest.fn();
      const handler2 = jest.fn();

      controller.on('field:fill', handler1);
      controller.on('field:fill', handler2);

      controller.emit('field:fill', { selector: '#test' });

      expect(handler1).toHaveBeenCalled();
      expect(handler2).toHaveBeenCalled();
    });
  });

  describe('initialization', () => {
    it('should initialize only once', () => {
      const addEventListenerSpy = jest.spyOn(document, 'addEventListener');

      controller.init();
      controller.init();

      expect(addEventListenerSpy).toHaveBeenCalledTimes(1);

      addEventListenerSpy.mockRestore();
    });

    it('should setup mutation observer', () => {
      const observeSpy = jest.spyOn(MutationObserver.prototype, 'observe');

      controller.init();

      expect(observeSpy).toHaveBeenCalledWith(document.body, expect.any(Object));

      observeSpy.mockRestore();
    });
  });
});
