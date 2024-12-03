import fs from 'fs/promises'
import path from 'path'
import os from 'os'

export class FileManager {
  async createTempDir(): Promise<string> {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'audio-'))
    return tempDir
  }

  async cleanup(tempDir: string): Promise<void> {
    try {
      await fs.rm(tempDir, { recursive: true, force: true })
    } catch (error) {
      console.error('Error cleaning up temp directory:', error)
    }
  }

  async writeFile(filePath: string, content: Buffer | string): Promise<void> {
    await fs.writeFile(filePath, content)
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

  async ensureDir(dirPath: string): Promise<void> {
    await fs.mkdir(dirPath, { recursive: true })
  }
}
