// The email for people who made an account and confirmed their email but never claimed a player. It lists what a claimed
// profile gives them and points at the dashboard, where the three claim steps are. Pure (no database, no sending): it only
// builds the message, so it is easy to preview and test.
import { renderEmail } from './emailTemplate.js'

const SITE = () => process.env.SITE_URL || 'https://tickgains.com'

export const CLAIM_NUDGE_SUBJECT = 'Your TickGains account is ready for your player'

const art = (name, alt) => ({ src: `${SITE()}/email/${name}.png`, alt })

/** What claiming a profile unlocks, in the order that matters most to someone who just signed up. */
export const claimFeatures = () => [
  { title: 'A dashboard that is yours', text: 'Your week, your streak, your milestones and your goals on one page, the moment you sign in.', image: art('dashboard', 'Example dashboard with the week\'s XP, a 12 day streak and the top skills') },
  { title: 'Plans that follow your real stats', text: 'The planner starts from your actual levels and tracks your progress as you train, instead of starting from scratch.' },
  { title: 'Your plan on your profile', text: 'Show a whole plan as your public goal, with a progress bar that moves every time you gain XP.' },
  { title: 'A Claimed badge and a profile that looks like you', text: 'Everyone sees the profile is really yours. Add a picture, a short bio and links to Discord, Twitch, YouTube or X.', image: art('profile', 'Example claimed profile with a Claimed badge, bio, links and a goal progress bar') },
  { title: 'Notifications about your own progress', text: 'Get told about new records, goals reached, milestones like a fresh 99, new followers, challenges, and who congratulated you.', image: art('notifications', 'Example notifications: a personal record, a congratulation and a goal reached') },
  { title: 'A verified tick in clans', text: 'Join a clan as the owner of your name, so members know you are the real player.' },
]

/** { subject, html, text } for one person. `name` is optional and only used to greet them; the email never includes their address. */
export function claimNudgeEmail({ name = '', unsubscribeUrl = '' } = {}) {
  const site = SITE()
  const hello = String(name || '').trim().slice(0, 40)
  return {
    subject: CLAIM_NUDGE_SUBJECT,
    ...renderEmail({
      preheader: 'Claim your RuneScape name in about a minute and unlock your dashboard, goals and profile.',
      title: hello ? `${hello}, claim your player` : 'Claim your player on TickGains',
      paragraphs: [
        'Thanks for confirming your email. Your account is set up, but it is not linked to a RuneScape name yet. Claiming your player takes about a minute, and this is what you get:',
      ],
      features: claimFeatures(),
      afterFeatures: [
        { text: 'How it works: find your name, get a short code, and send it to us from that account in game. We approve it and your dashboard unlocks.', strong: 'How it works:' },
      ],
      button: { label: 'Claim my profile', url: `${site}/` },
      unsubscribeUrl,
      note: 'You are getting this once because your TickGains account has no claimed profile yet. Claiming never changes anything in your game, and the public profile only says "Claimed", never which account owns it.',
    }),
  }
}
