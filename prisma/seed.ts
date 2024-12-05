import { PrismaClient, Genre, RoleName, Permission } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('Starting seeding...')

  // Create roles with permissions
  const adminRole = await prisma.role.upsert({
    where: { name: RoleName.ADMIN },
    update: {},
    create: {
      name: RoleName.ADMIN,
      permissions: [
        Permission.CREATE_DIALOGUE,
        Permission.EDIT_DIALOGUE,
        Permission.DELETE_DIALOGUE,
        Permission.PUBLISH_DIALOGUE,
        Permission.MANAGE_USERS,
        Permission.MANAGE_ROLES
      ]
    }
  })

  const userRole = await prisma.role.upsert({
    where: { name: RoleName.USER },
    update: {},
    create: {
      name: RoleName.USER,
      permissions: [
        Permission.CREATE_DIALOGUE,
        Permission.EDIT_DIALOGUE,
        Permission.DELETE_DIALOGUE
      ]
    }
  })

  const moderatorRole = await prisma.role.upsert({
    where: { name: RoleName.MODERATOR },
    update: {},
    create: {
      name: RoleName.MODERATOR,
      permissions: [
        Permission.CREATE_DIALOGUE,
        Permission.EDIT_DIALOGUE,
        Permission.DELETE_DIALOGUE,
        Permission.PUBLISH_DIALOGUE,
        Permission.MANAGE_USERS
      ]
    }
  })

  console.log('Created roles:', {
    admin: adminRole.name,
    user: userRole.name,
    moderator: moderatorRole.name
  })

  // Create a test user role assignment
  const testUserRole = await prisma.userRole.upsert({
    where: {
      userId_roleId: {
        userId: 'test_user_123',
        roleId: userRole.id
      }
    },
    update: {},
    create: {
      userId: 'test_user_123',
      roleId: userRole.id,
      assignedBy: 'system_init'
    }
  })

  console.log('Created test user role:', {
    userId: testUserRole.userId,
    roleId: testUserRole.roleId
  })

  // Create a test dialogue
  const testDialogue = await prisma.dialogue.create({
    data: {
      userId: 'test_user_123',
      title: 'Test Dialogue',
      description: 'A test dialogue for development',
      genre: Genre.OTHER,
      hashtags: ['test', 'development'],
      plays: 5, 
      lastPlayedAt: new Date(), 
      characters: {
        create: [
          {
            customName: 'Character 1',
            voiceId: 'voice_1',
            voiceConfig: { pitch: 1.0, speed: 1.0 }
          },
          {
            customName: 'Character 2',
            voiceId: 'voice_2',
            voiceConfig: { pitch: 0.9, speed: 1.1 }
          }
        ]
      }
    },
    include: {
      characters: true
    }
  })

  // Create test dialogue turns
  await prisma.dialogueTurn.create({
    data: {
      dialogueId: testDialogue.id,
      characterId: testDialogue.characters[0].id,
      text: 'Hello, this is a test dialogue!',
      audioUrl: 'https://example.com/audio1.mp3',
      duration: 2.5,
      order: 1
    }
  })

  console.log('Created test dialogue:', {
    id: testDialogue.id,
    title: testDialogue.title,
    characterCount: testDialogue.characters.length,
    plays: testDialogue.plays
  })

  console.log('Seeding finished.')
}

main()
  .catch((e) => {
    console.error('Error during seeding:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
