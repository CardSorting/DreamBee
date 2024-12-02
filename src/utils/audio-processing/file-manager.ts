import fs from 'fs/promises'
import path from 'path'
import os from 'os'
import { randomBytes } from 'crypto'

export class FileManager {
  constructor(private readonly baseDir: string = path.join(os.tmpdir(), 'audio-processing')) {}

  async createTempDir(): Promise<string> {
    const uniqueId = randomBytes(16).toString('hex')
    const tempDir = path.join(this.baseDir, uniqueId)
    await fs.mkdir(tempDir, { recursive: true })
    return tempDir
  }

  async cleanup(dir: string): Promise<void> {
    try {
      const files = await fs.readdir(dir)
      await Promise.all(
        files.map(file => fs.unlink(path.join(dir, file)))
      )
      await fs.rmdir(dir)
    } catch (error) {
      console.warn('Warning: Failed to clean up temp directory:', error)
    }
  }

  async writeFile(dir: string, filename: string, content: Buffer): Promise<string> {
    const filePath = path.join(dir, filename)
    await fs.writeFile(filePath, content)
    return filePath
  }

  async readFile(filePath: string): Promise<Buffer> {
    return await fs.readFile(filePath)
  }

  async exists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath)
      return true
    } catch {
      return false
    }
  }
}
