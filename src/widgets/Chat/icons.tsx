// Shared icon re-exports for the chat widget and its entry points (ticket 07,
// D02). `ChatShell`, `ConversationList`, `ConversationView`, `MessageBubble`,
// `ChatHeaderIcon`, `DashboardCenter` and `StudentDetailModal` all used to
// hand-draw the same handful of inline SVGs (back arrow, paperclip, chat
// bubble, mic/stop, close, download, search) — `lucide-react` is already a
// project dependency (see `InfoFileListEditor`), so this file just points
// contextual names at its icons instead of redrawing them.
//
// Pass size/color the same way you would to any `lucide-react` icon
// (`size`, `color`, `className`, `strokeWidth`) — these are plain re-exports,
// no wrapping, no defaults baked in.
export {
  ChevronLeft as ChatBackIcon,
  Paperclip as ChatAttachIcon,
  MessageCircle as ChatBubbleIcon,
  MessageSquare as ChatSquareBubbleIcon,
  Mic as ChatMicIcon,
  Square as ChatStopIcon,
  X as ChatCloseIcon,
  Download as ChatDownloadIcon,
  Search as ChatSearchIcon,
  Send as ChatSendIcon,
  Calendar as ChatEventIcon,
  BookOpen as ChatHomeworkIcon,
  Gift as ChatServiceIcon,
  Wallet as ChatPaymentIcon,
} from 'lucide-react'
