import { storageManager, STORAGE_KEYS } from '../../src/lib/storage-manager'
import { mockChrome, resetMockChrome, setMockStorageData, getMockStorageData } from '../utils/mock-chrome'

describe('storage-manager profile safety', () => {
  beforeEach(() => {
    resetMockChrome()
    ;(global as any).chrome = mockChrome
  })

  it('should quarantine an invalid saved profile into a repair draft', async () => {
    setMockStorageData({
      [STORAGE_KEYS.PROFILE]: {
        identity: {
          name: '',
          email: '',
        },
        work_history: [],
      },
    })

    const profile = await storageManager.getProfile()
    const draft = await storageManager.getProfileDraft()

    expect(profile).toBeNull()
    expect(draft).not.toBeNull()
    expect(draft?.validationErrors).toContain('Name is required')
    expect(draft?.validationErrors).toContain('Email is required')
    expect(getMockStorageData()[STORAGE_KEYS.PROFILE]).toBeUndefined()
  })

  it('should keep a valid saved profile and clear the draft when saving', async () => {
    setMockStorageData({
      [STORAGE_KEYS.PROFILE_DRAFT]: {
        profile: {
          identity: {
            name: '',
            email: '',
          },
          work_history: [],
        },
        validationErrors: ['Name is required'],
        extractedText: 'draft text',
        updatedAt: new Date().toISOString(),
        source: 'parse',
      },
    })

    await storageManager.saveProfile({
      identity: {
        name: 'Jane Doe',
        email: 'jane@example.com',
      },
      work_history: [
        {
          company: 'Acme',
          title: 'Engineer',
          start_date: '2020-01-01',
        },
      ],
    })

    const storedProfile = await storageManager.getProfile()
    const storedDraft = await storageManager.getProfileDraft()

    expect(storedProfile?.identity.name).toBe('Jane Doe')
    expect(storedDraft).toBeNull()
  })

  it('should clear both valid profiles and repair drafts', async () => {
    setMockStorageData({
      [STORAGE_KEYS.PROFILE]: {
        identity: {
          name: 'Jane Doe',
          email: 'jane@example.com',
        },
        work_history: [
          {
            company: 'Acme',
            title: 'Engineer',
            start_date: '2020-01-01',
          },
        ],
      },
      [STORAGE_KEYS.PROFILE_DRAFT]: {
        profile: {
          identity: {
            name: '',
            email: '',
          },
          work_history: [],
        },
        validationErrors: ['Name is required'],
        extractedText: 'draft text',
        updatedAt: new Date().toISOString(),
        source: 'parse',
      },
    })

    await storageManager.clearProfileData()

    expect(await storageManager.getProfile()).toBeNull()
    expect(await storageManager.getProfileDraft()).toBeNull()
  })
})
