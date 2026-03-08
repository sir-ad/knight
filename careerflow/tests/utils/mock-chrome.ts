interface MockStorageData {
  [key: string]: unknown;
}

interface MockAlarm {
  name: string;
  scheduledTime: number;
  periodInMinutes?: number;
}

type StorageChangeListener = (changes: { [key: string]: { oldValue?: unknown; newValue?: unknown } }, areaName: string) => void;
type AlarmListener = (alarm: MockAlarm) => void;
type MessageListener = (message: unknown, sender: chrome.runtime.MessageSender, sendResponse: (response?: unknown) => void) => void;

let mockStorageData: MockStorageData = {};
let mockStorageListeners: StorageChangeListener[] = [];
let mockAlarms: Map<string, MockAlarm> = new Map();
let mockAlarmListeners: AlarmListener[] = [];
let mockMessageListeners: MessageListener[] = [];
let mockRuntimePort: MockPort | null = null;

class MockPort {
  name: string;
  onMessage: { addListener: (callback: (msg: unknown) => void) => void };
  onDisconnect: { addListener: (callback: () => void) => void };
  postMessage: (msg: unknown) => void;
  disconnect: () => void;
  
  private _messageListeners: ((msg: unknown) => void)[] = [];
  private _disconnectListeners: (() => void)[] = [];

  constructor(name: string) {
    this.name = name;
    this.onMessage = {
      addListener: (callback) => this._messageListeners.push(callback)
    };
    this.onDisconnect = {
      addListener: (callback) => this._disconnectListeners.push(callback)
    };
    this.postMessage = (msg) => {
      if (mockRuntimePort === this) {
        this._messageListeners.forEach(cb => cb(msg));
      }
    };
    this.disconnect = () => {
      mockRuntimePort = null;
      this._disconnectListeners.forEach(cb => cb());
    };
  }
}

export const mockChrome = {
  storage: {
    local: {
      get: jest.fn((keys?: string | string[] | null): Promise<MockStorageData> => {
        if (keys === null || keys === undefined) {
          return Promise.resolve({ ...mockStorageData });
        }
        if (typeof keys === 'string') {
          return Promise.resolve({ [keys]: mockStorageData[keys] });
        }
        if (Array.isArray(keys)) {
          const result: MockStorageData = {};
          keys.forEach(key => {
            if (mockStorageData.hasOwnProperty(key)) {
              result[key] = mockStorageData[key];
            }
          });
          return Promise.resolve(result);
        }
        return Promise.resolve({});
      }),

      set: jest.fn((data: MockStorageData): Promise<void> => {
        const changes: { [key: string]: { oldValue?: unknown; newValue?: unknown } } = {};
        Object.keys(data).forEach(key => {
          changes[key] = {
            oldValue: mockStorageData[key],
            newValue: data[key]
          };
          mockStorageData[key] = data[key];
        });
        mockStorageListeners.forEach(listener => listener(changes, 'local'));
        return Promise.resolve();
      }),

      remove: jest.fn((keys: string | string[]): Promise<void> => {
        const keysArray = Array.isArray(keys) ? keys : [keys];
        const changes: { [key: string]: { oldValue?: unknown; newValue?: unknown } } = {};
        keysArray.forEach(key => {
          changes[key] = {
            oldValue: mockStorageData[key],
            newValue: undefined
          };
          delete mockStorageData[key];
        });
        mockStorageListeners.forEach(listener => listener(changes, 'local'));
        return Promise.resolve();
      }),

      clear: jest.fn((): Promise<void> => {
        const changes: { [key: string]: { oldValue?: unknown; newValue?: unknown } } = {};
        Object.keys(mockStorageData).forEach(key => {
          changes[key] = {
            oldValue: mockStorageData[key],
            newValue: undefined
          };
        });
        mockStorageData = {};
        mockStorageListeners.forEach(listener => listener(changes, 'local'));
        return Promise.resolve();
      }),

      getBytesInUse: jest.fn((keys?: string | string[] | null): Promise<number> => {
        const data = keys === null || keys === undefined 
          ? mockStorageData 
          : typeof keys === 'string' 
            ? { [keys]: mockStorageData[keys] }
            : Object.fromEntries(
                keys.map(k => [k, mockStorageData[k]]).filter(([, v]) => v !== undefined)
              );
        return Promise.resolve(JSON.stringify(data).length);
      })
    },

    onChanged: {
      addListener: jest.fn((callback: StorageChangeListener) => {
        mockStorageListeners.push(callback);
      }),
      removeListener: jest.fn((callback: StorageChangeListener) => {
        mockStorageListeners = mockStorageListeners.filter(l => l !== callback);
      }),
      hasListener: jest.fn((callback: StorageChangeListener) => {
        return mockStorageListeners.includes(callback);
      })
    }
  },

  runtime: {
    onMessage: {
      addListener: jest.fn((callback: MessageListener) => {
        mockMessageListeners.push(callback);
      }),
      removeListener: jest.fn((callback: MessageListener) => {
        mockMessageListeners = mockMessageListeners.filter(l => l !== callback);
      }),
      hasListener: jest.fn((callback: MessageListener) => {
        return mockMessageListeners.includes(callback);
      })
    },

    sendMessage: jest.fn((message: unknown, responseCallback?: (response: unknown) => void): void => {
      setTimeout(() => {
        if (responseCallback) {
          responseCallback({ success: true });
        }
      }, 0);
    }),

    onConnect: {
      addListener: jest.fn((callback: (port: MockPort) => void) => {}),
      removeListener: jest.fn(),
      hasListener: jest.fn(() => false)
    },

    connect: jest.fn((connectInfo?: { name?: string }): MockPort => {
      mockRuntimePort = new MockPort(connectInfo?.name || '');
      return mockRuntimePort;
    }),

    getURL: jest.fn((path: string): string => {
      return `chrome-extension://mock-extension-id/${path}`;
    }),

    getManifest: jest.fn(() => ({
      name: 'CareerFlow',
      version: '1.0.0',
      manifest_version: 3,
      permissions: ['storage', 'alarms', 'tabs'],
      background: { service_worker: 'background.js' }
    })),

    lastError: undefined as chrome.runtime.LastError | undefined,

    reload: jest.fn(),

    getPlatformInfo: jest.fn((): Promise<chrome.runtime.PlatformInfo> => {
      return Promise.resolve({
        os: 'mac',
        arch: 'arm',
        nacl_arch: 'arm'
      });
    })
  },

  alarms: {
    create: jest.fn((name: string, alarmInfo: chrome.alarms.AlarmCreateInfo): void => {
      const alarm: MockAlarm = {
        name,
        scheduledTime: Date.now() + (alarmInfo.delayInMinutes || alarmInfo.periodInMinutes || 1) * 60000,
        periodInMinutes: alarmInfo.periodInMinutes
      };
      mockAlarms.set(name, alarm);
    }),

    get: jest.fn((name: string): Promise<MockAlarm | undefined> => {
      return Promise.resolve(mockAlarms.get(name));
    }),

    getAll: jest.fn((): Promise<MockAlarm[]> => {
      return Promise.resolve(Array.from(mockAlarms.values()));
    }),

    clear: jest.fn((name: string): Promise<boolean> => {
      const existed = mockAlarms.has(name);
      mockAlarms.delete(name);
      return Promise.resolve(existed);
    }),

    clearAll: jest.fn((): Promise<boolean> => {
      const hadAlarms = mockAlarms.size > 0;
      mockAlarms.clear();
      return Promise.resolve(hadAlarms);
    }),

    onAlarm: {
      addListener: jest.fn((callback: AlarmListener) => {
        mockAlarmListeners.push(callback);
      }),
      removeListener: jest.fn((callback: AlarmListener) => {
        mockAlarmListeners = mockAlarmListeners.filter(l => l !== callback);
      }),
      hasListener: jest.fn((callback: AlarmListener) => {
        return mockAlarmListeners.includes(callback);
      })
    }
  },

  tabs: {
    create: jest.fn((createProperties: chrome.tabs.CreateProperties): Promise<chrome.tabs.Tab> => {
      return Promise.resolve({
        id: 123,
        index: 0,
        windowId: 1,
        url: createProperties.url || 'about:blank',
        active: createProperties.active ?? true,
        pinned: false,
        highlighted: false,
        incognito: false,
        status: 'complete'
      } as chrome.tabs.Tab);
    }),

    query: jest.fn((queryInfo: chrome.tabs.QueryInfo): Promise<chrome.tabs.Tab[]> => {
      return Promise.resolve([]);
    }),

    sendMessage: jest.fn((tabId: number, message: unknown): Promise<unknown> => {
      return Promise.resolve({ success: true });
    }),

    update: jest.fn((tabId: number, updateProperties: chrome.tabs.UpdateProperties): Promise<chrome.tabs.Tab> => {
      return Promise.resolve({
        id: tabId,
        url: updateProperties.url || 'about:blank',
        active: true,
        status: 'complete'
      } as chrome.tabs.Tab);
    })
  }
};

export function resetMockChrome(): void {
  mockStorageData = {};
  mockStorageListeners = [];
  mockAlarms.clear();
  mockAlarmListeners = [];
  mockMessageListeners = [];
  mockRuntimePort = null;
  
  Object.values(mockChrome.storage.local).forEach(fn => {
    if (jest.isMockFunction(fn)) fn.mockClear();
  });
  Object.values(mockChrome.runtime).forEach(fn => {
    if (jest.isMockFunction(fn)) fn.mockClear();
  });
  Object.values(mockChrome.alarms).forEach(fn => {
    if (jest.isMockFunction(fn)) fn.mockClear();
  });
  Object.values(mockChrome.tabs).forEach(fn => {
    if (jest.isMockFunction(fn)) fn.mockClear();
  });
}

export function setMockStorageData(data: MockStorageData): void {
  mockStorageData = { ...data };
}

export function getMockStorageData(): MockStorageData {
  return { ...mockStorageData };
}

export function setMockAlarm(alarm: MockAlarm): void {
  mockAlarms.set(alarm.name, alarm);
}

export function getMockAlarms(): Map<string, MockAlarm> {
  return new Map(mockAlarms);
}

export function triggerAlarm(alarmName: string): void {
  const alarm = mockAlarms.get(alarmName);
  if (alarm) {
    mockAlarmListeners.forEach(listener => listener(alarm));
  }
}

export function triggerStorageChange(changes: { [key: string]: { oldValue?: unknown; newValue?: unknown } }): void {
  mockStorageListeners.forEach(listener => listener(changes, 'local'));
}

export function triggerMessage(message: unknown, sender?: chrome.runtime.MessageSender): Promise<unknown> {
  const mockSender: chrome.runtime.MessageSender = sender || {
    id: 'mock-sender-id',
    tab: { id: 123 } as chrome.tabs.Tab,
    url: 'https://example.com'
  };
  
  return new Promise((resolve) => {
    const sendResponse = (response?: unknown) => resolve(response);
    mockMessageListeners.forEach(listener => listener(message, mockSender, sendResponse));
  });
}

export function createMockTab(overrides?: Partial<chrome.tabs.Tab>): chrome.tabs.Tab {
  return {
    id: 123,
    index: 0,
    windowId: 1,
    url: 'https://example.com',
    active: true,
    pinned: false,
    highlighted: false,
    incognito: false,
    status: 'complete',
    ...overrides
  } as chrome.tabs.Tab;
}

export function createMockPort(name: string): MockPort {
  return new MockPort(name);
}

export { MockPort };

declare global {
  namespace NodeJS {
    interface Global {
      chrome: typeof mockChrome;
    }
  }
}

export function setupChromeMock(): void {
  (global as NodeJS.Global & { chrome: typeof mockChrome }).chrome = mockChrome;
}

export function teardownChromeMock(): void {
  delete (global as NodeJS.Global & { chrome?: typeof mockChrome }).chrome;
}
