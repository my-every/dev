import {
  SECURE_ACTION_LABELS,
  USER_ROLE_LABELS,
  type SecureActionType,
  type SessionErrorCode,
  type SessionFeedback,
  type UserRole,
} from '@/types/d380-user-session'

function formatRoleList(roles: UserRole[]): string {
  const labels = Array.from(new Set(roles)).map(role => USER_ROLE_LABELS[role])

  if (labels.length === 0) {
    return 'authorized'
  }

  if (labels.length === 1) {
    return labels[0]
  }

  if (labels.length === 2) {
    return `${labels[0]} or ${labels[1]}`
  }

  return `${labels.slice(0, -1).join(', ')}, or ${labels[labels.length - 1]}`
}

export function createSessionFeedback(
  code: SessionErrorCode,
  options?: {
    action?: SecureActionType
    requiredRoles?: UserRole[]
  },
): SessionFeedback {
  switch (code) {
    case 'INVALID_BADGE':
      return {
        code,
        title: 'Badge Not Found',
        message: 'Sorry, that badge number was not found in the current user roster. Check the badge and try again.',
      }
    case 'INVALID_PIN':
      return {
        code,
        title: 'Incorrect PIN',
        message: 'Sorry, that PIN does not match this badge. Re-enter your PIN or ask a team lead for help.',
      }
    case 'ACCOUNT_INACTIVE':
      return {
        code,
        title: 'Inactive User',
        message: 'Sorry, this badge is marked inactive in users.csv. Request a team lead to restore access before continuing.',
      }
    case 'PIN_CHANGE_REQUIRED':
      return {
        code,
        title: 'PIN Change Required',
        message: 'Your account still uses the default PIN. Enter a new 4-digit PIN before continuing.',
      }
    case 'PIN_CHANGE_FAILED':
      return {
        code,
        title: 'PIN Update Failed',
        message: 'The PIN could not be updated. Confirm the current PIN and try again.',
      }
    case 'PERMISSION_DENIED': {
      const actionLabel = options?.action ? SECURE_ACTION_LABELS[options.action] : 'this feature'
      const requiredRoles = options?.requiredRoles ?? []
      const roleLabel = formatRoleList(requiredRoles)

      return {
        code,
        title: 'Permission Required',
        message: `Sorry, ${actionLabel.toLowerCase()} requires ${roleLabel} access. Request a team lead to grant permission access.`,
      }
    }
    case 'SESSION_EXPIRED':
      return {
        code,
        title: 'Session Expired',
        message: 'Your session expired. Sign in again to continue.',
      }
    case 'SIGN_IN_FAILED':
      return {
        code,
        title: 'Sign-In Failed',
        message: 'Sign-in could not be completed. Try again or ask a team lead to verify your badge and PIN.',
      }
    case 'VERIFICATION_FAILED':
      return {
        code,
        title: 'Verification Failed',
        message: 'Credential verification failed. Try again.',
      }
    case 'ACTION_FAILED':
    default:
      return {
        code,
        title: 'Action Failed',
        message: 'The action could not be completed. Try again.',
      }
  }
}

export function getPermissionDeniedMessage(requiredRoles: UserRole[], action?: SecureActionType): string {
  return createSessionFeedback('PERMISSION_DENIED', { action, requiredRoles }).message
}