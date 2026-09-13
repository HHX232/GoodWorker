import { closeRoomIfEmpty } from '@/shared/lib/videoRoom/closeRoomIfEmpty'
import { prisma } from '@/shared/prisma/prisma'

const mockListParticipants = jest.fn()

jest.mock('@/shared/prisma/prisma', () => ({
  prisma: {
    videoCallRoom: {
      findUnique: jest.fn(),
      updateMany: jest.fn(),
    },
  },
}))

jest.mock('livekit-server-sdk', () => ({
  RoomServiceClient: jest.fn().mockImplementation(() => ({
    listParticipants: mockListParticipants,
  })),
}))

const mockedPrisma = prisma as unknown as {
  videoCallRoom: {
    findUnique: jest.Mock
    updateMany: jest.Mock
  }
}

describe('closeRoomIfEmpty', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    process.env.LIVEKIT_API_KEY = 'test-key'
    process.env.LIVEKIT_API_SECRET = 'test-secret'
    process.env.LIVEKIT_URL = 'wss://example.livekit.cloud'
  })

  it('closes the room when LiveKit reports zero participants', async () => {
    mockedPrisma.videoCallRoom.findUnique.mockResolvedValue({
      createdAt: new Date(),
      endedAt: null,
    })
    mockListParticipants.mockResolvedValue([])

    const result = await closeRoomIfEmpty('room-1')

    expect(result).toEqual({ closed: true, reason: 'empty' })
    expect(mockedPrisma.videoCallRoom.updateMany).toHaveBeenCalledWith({
      where: { name: 'room-1', endedAt: null },
      data: { endedAt: expect.any(Date) },
    })
  })

  it('does not close the room when other participants remain', async () => {
    mockedPrisma.videoCallRoom.findUnique.mockResolvedValue({
      createdAt: new Date(),
      endedAt: null,
    })
    mockListParticipants.mockResolvedValue([{ identity: 'student-1' }, { identity: 'teacher-1' }])

    const result = await closeRoomIfEmpty('room-1')

    expect(result).toEqual({ closed: false, reason: 'not_empty' })
    expect(mockedPrisma.videoCallRoom.updateMany).not.toHaveBeenCalled()
  })

  it('does not close a young room when LiveKit is unreachable', async () => {
    mockedPrisma.videoCallRoom.findUnique.mockResolvedValue({
      createdAt: new Date(Date.now() - 60_000),
      endedAt: null,
    })
    mockListParticipants.mockRejectedValue(new Error('network error'))

    const result = await closeRoomIfEmpty('room-1')

    expect(result).toEqual({ closed: false, reason: 'age_fallback_young' })
    expect(mockedPrisma.videoCallRoom.updateMany).not.toHaveBeenCalled()
  })

  it('closes an old room when LiveKit is unreachable', async () => {
    mockedPrisma.videoCallRoom.findUnique.mockResolvedValue({
      createdAt: new Date(Date.now() - 9 * 60 * 60 * 1000),
      endedAt: null,
    })
    mockListParticipants.mockRejectedValue(new Error('network error'))

    const result = await closeRoomIfEmpty('room-1')

    expect(result).toEqual({ closed: true, reason: 'age_fallback' })
    expect(mockedPrisma.videoCallRoom.updateMany).toHaveBeenCalled()
  })

  it('is idempotent for an already-ended room and never calls LiveKit', async () => {
    mockedPrisma.videoCallRoom.findUnique.mockResolvedValue({
      createdAt: new Date(Date.now() - 60_000),
      endedAt: new Date(),
    })

    const result = await closeRoomIfEmpty('room-1')

    expect(result).toEqual({ closed: false, reason: 'already_closed' })
    expect(mockListParticipants).not.toHaveBeenCalled()
    expect(mockedPrisma.videoCallRoom.updateMany).not.toHaveBeenCalled()
  })

  it('no-ops when the room cannot be found', async () => {
    mockedPrisma.videoCallRoom.findUnique.mockResolvedValue(null)

    const result = await closeRoomIfEmpty('missing-room')

    expect(result).toEqual({ closed: false, reason: 'room_not_found' })
    expect(mockListParticipants).not.toHaveBeenCalled()
  })

  it('no-ops when the database lookup itself fails', async () => {
    mockedPrisma.videoCallRoom.findUnique.mockRejectedValue(new Error('db down'))

    const result = await closeRoomIfEmpty('room-1')

    expect(result).toEqual({ closed: false, reason: 'room_not_found' })
    expect(mockListParticipants).not.toHaveBeenCalled()
  })
})
