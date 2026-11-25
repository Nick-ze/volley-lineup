/** v10: account, sign-in with an email code, cloud teams (upload / download), delete account. */
import type { SyncErrorCode } from '@/domain/types';

const changes = (n: number) => (n === 1 ? '1 change' : `${n} changes`);
const teams = (n: number) => (n === 1 ? '1 team' : `${n} teams`);

/** Said when an action signs the account out of this device (Delete all data, delete profile). */
const signOutNote = 'You’ll be signed out; shared teams stay in the cloud.';

export const account = {
  title: 'Account',
  signIn: {
    title: 'Sign in',
    email: 'Email',
    sendCode: 'Send code',
    code: '6-digit code',
    verify: 'Sign in',
    intro:
      'Sign in to sync your teams between your devices and share them. We email you a 6-digit code; no password needed.',
    emailInvalid: 'Enter a valid email address.',
    codeSent: (email: string) => `We sent a code to ${email}. It can take a minute to arrive.`,
    resend: 'Send a new code',
    resendIn: (seconds: number) => `New code in ${seconds} s`,
    changeEmail: 'Change email',
    noProfile: 'Open a profile first: shared teams are kept in a profile.',
    openProfiles: 'Open profiles',
    switchConfirm: (email: string, pending: number) =>
      `Teams of ${email} stay on this device as local copies.` +
      (pending > 0 ? ` ${changes(pending)} not synced yet won’t reach the cloud.` : '') +
      ' Continue?',
    switchContinue: 'Continue',
  },
  /** Every error a sync command can return, as a short message. */
  errors: {
    offline: 'No connection. Check your internet and try again.',
    forbidden: 'You’re not allowed to do this.',
    lastManager: 'Make someone else manager first.',
    lastMember: 'You’re the last member of this team.',
    inviteInvalid: 'This invite code is wrong or has expired.',
    notSignedIn: 'Sign in first.',
    signedOut: 'You were signed out. Sign in again.',
    invalidCode: 'Wrong or expired code. Check the email or send a new code.',
    rateLimited: 'Too many tries. Wait a moment and try again.',
    tooMany: 'Too many at once. Try again with fewer.',
    unknown: 'Something went wrong. Try again.',
  } satisfies Record<SyncErrorCode, string>,
  /** The section on the Profile tab. */
  profileSection: {
    title: 'Cloud sync',
    signedOut: 'Sign in to sync your teams between your devices and share them with your team.',
    signIn: 'Sign in',
    signInLabel: 'Sign in to sync your teams',
    signedIn: (email: string) => `Signed in as ${email}`,
    open: 'Account',
    openLabel: 'Account: sync status and shared teams',
    otherProfile: (email: string, profile: string) =>
      `${email} is signed in with the profile “${profile}” on this device. Open that profile to use the account.`,
  },
  screen: {
    lastSynced: (when: string) => `Last synced ${when}`,
    notSynced: 'Not synced yet',
    sharedTeams: 'Shared teams',
    noSharedTeams: 'No shared teams on this device yet.',
    roles: { manager: 'Manager', player: 'Player · view only' },
    openTeamLabel: (name: string, role: string) => `${name}: ${role}`,
    cloudTeams: 'Cloud teams',
    cloudTeamsHint: 'Upload teams from this device or download your teams from the cloud.',
    join: 'Join a team',
    signOut: 'Sign out',
    signOutHint: 'Your data stays on this device. Shared teams sync again when you sign in.',
    signOutConfirm: (pending: number) =>
      `${changes(pending)} will sync next time you sign in. Sign out now?`,
    signedOut: 'You’re not signed in.',
  },
  deleteAccount: {
    title: 'Delete account',
    hint: 'Deletes your account and your data in the cloud. Your data on this device stays.',
    button: 'Delete account',
    confirm: (soleTeams: string[]) =>
      'Your account and your memberships are deleted from the cloud.' +
      (soleTeams.length > 0
        ? ` Teams where you’re the only member are deleted for good: ${soleTeams.join(', ')}.`
        : '') +
      ' Your data on this device stays.',
    blocked:
      'You’re the last manager of these teams. Make someone else manager or delete the team first:',
    members: 'Members',
    membersLabel: (team: string) => `Members: ${team}`,
    notOnDevice: 'A team that isn’t on this device',
    done: 'Account deleted. Your data stays on this device.',
  },
  cloudTeams: {
    title: 'Cloud teams',
    intro: 'Choose what to share. Nothing is uploaded unless you tick it.',
    loading: 'Loading cloud teams…',
    retry: 'Try again',
    done: 'Done',
    checkMark: '✓',
    upload: {
      title: 'Upload from this device',
      hint: 'These teams aren’t shared yet. Uploaded teams sync between your devices.',
      empty: 'All teams of this profile are shared.',
      button: 'Upload selected',
      results: {
        created: 'uploaded',
        rekeyed: 'uploaded',
        linked: 'linked with the cloud copy',
        failed: 'couldn’t upload',
      },
      result: (team: string, result: string) => `${team}: ${result}`,
    },
    download: {
      title: 'Download from the cloud',
      hint: 'Your teams in the cloud that aren’t on this device yet.',
      empty: 'No other teams in the cloud.',
      button: 'Download',
      done: (n: number) => `${teams(n)} downloaded.`,
    },
  },
  /** Delete all data / delete profile while signed in. */
  signOutNote,
};
