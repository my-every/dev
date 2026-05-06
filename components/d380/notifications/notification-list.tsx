import type { NotificationCardViewModel } from '@/types/d380-notifications'

import { NotificationCard } from '@/components/d380/notifications/notification-card'

export function NotificationList({
  notifications,
  onToggleRead,
  onInspect,
}: {
  notifications: NotificationCardViewModel[]
  onToggleRead: (notificationId: string) => void
  onInspect: (notificationId: string) => void
}) {
  return (
    <div className="grid gap-4">
      {notifications.map(notification => (
        <NotificationCard key={notification.id} notification={notification} onToggleRead={onToggleRead} onInspect={onInspect} />
      ))}
    </div>
  )
}