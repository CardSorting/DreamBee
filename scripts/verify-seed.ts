import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('Verifying seeded data...')

  const dialogues = await prisma.dialogue.findMany({
    include: {
      characters: true,
      turns: true
    }
  })

  console.log('Found dialogues:', dialogues.length)
  dialogues.forEach(dialogue => {
    console.log('\nDialogue:', {
      id: dialogue.id,
      title: dialogue.title,
      characters: dialogue.characters.map(c => ({
        id: c.id,
        name: c.customName
      })),
      turns: dialogue.turns.map(t => ({
        id: t.id,
        text: t.text,
        characterId: t.characterId
      }))
    })
  })
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
