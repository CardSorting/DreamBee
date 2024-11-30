import { baseStyles } from './base'
import { sidebarStyles } from './sidebar'
import { messageStyles } from './message'
import { typingStyles } from './typing'
import { inputStyles } from './input'
import { errorStyles } from './error'
import { mainStyles } from './main'
import { readReceiptStyles } from './readReceipt'

export const chatStyles = {
  ...baseStyles,
  sidebar: sidebarStyles,
  message: messageStyles,
  typing: typingStyles,
  input: inputStyles,
  error: errorStyles,
  main: mainStyles,
  readReceipt: readReceiptStyles
}

export type ChatStyles = typeof chatStyles
