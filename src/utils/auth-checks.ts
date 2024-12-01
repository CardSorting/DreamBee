import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { RBACService } from './dynamodb/rbac'

export async function requireAdmin() {
  const session = await auth()
  if (!session.userId) {
    redirect('/sign-in')
  }

  const isAdmin = await RBACService.isAdmin(session.userId)
  if (!isAdmin) {
    redirect('/')
  }

  return session.userId
}

export async function requireModerator() {
  const session = await auth()
  if (!session.userId) {
    redirect('/sign-in')
  }

  const isModerator = await RBACService.isModerator(session.userId)
  if (!isModerator) {
    redirect('/')
  }

  return session.userId
}

export async function checkIsAdmin() {
  const session = await auth()
  if (!session.userId) {
    return false
  }

  return RBACService.isAdmin(session.userId)
}

export async function checkIsModerator() {
  const session = await auth()
  if (!session.userId) {
    return false
  }

  return RBACService.isModerator(session.userId)
}
