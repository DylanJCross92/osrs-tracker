// One-off announcement emails the owner sends to everyone who can be emailed (see services/announcements.service.js). Pure: it only builds
// the message, so it is easy to preview and test. To announce something else, add an entry to ANNOUNCEMENTS and a builder for it.
import { renderEmail } from './emailTemplate.js'

const SITE = () => process.env.SITE_URL || 'https://tickgains.com'

export const GRAVEYARD_KEY = 'graveyard-2026-11-25'
export const GRAVEYARD_SUBJECT = 'The Graveyard quest and the Prison of Ræun Agility course are on TickGains'

/** { subject, html, text } for one person. The email never includes their address or name. */
export function graveyardEmail({ unsubscribeUrl = '' } = {}) {
  const site = SITE()
  return {
    subject: GRAVEYARD_SUBJECT,
    ...renderEmail({
      preheader: 'Old School RuneScape\'s new Master quest and Agility course are in the quest tracker, the planner and the calculators.',
      title: 'New in OSRS: The Graveyard and the Prison of Ræun',
      paragraphs: [
        'Old School RuneScape released a new Master-level quest and a new Agility course today, and both are now on TickGains.',
        { text: 'The Graveyard continues Olaf\'s story. You start by talking to Olaf Hradson near Rellekka. It is a Master quest of medium length and ends with a boss fight against R\u00e6un, so the Wiki recommends combat level 95.', strong: 'The Graveyard' },
      ],
      features: [
        { title: 'Rewards', text: '3 quest points, 35,000 Agility and 35,000 Sailing XP, 15,000 Runecraft XP, 10,000 Fletching XP, and two lamps worth 75,000 XP each for a combat skill or Prayer.' },
        { title: 'What you need', text: 'Sailing 65, Agility 65, Woodcutting 56 and Fletching 54, with Olaf\'s Quest, The Fremennik Exiles and Pandemonium finished.' },
        { title: 'A new Agility course', text: 'Finishing the quest unlocks the Prison of R\u00e6un, a course for level 65 Agility and up that mixes rooftop obstacles with a choice of harder or easier routes. Jagex says the fast, high-intensity route gives 30 or more Marks of Grace an hour and the slower one about 12 to 14. The Wiki lists 2,960 XP a lap on the slow route with no shortcuts.' },
      ],
      afterFeatures: [
        { text: 'On TickGains, The Graveyard is in the quest tracker with its rewards, what you still need and the quests to do first. The Prison of R\u00e6un is an Agility method in your plans and the Agility calculator. Both carry a New tag for the next week.', strong: 'On TickGains,' },
        'Sign in and open your planner to bring your plan up to date. The Smart Planner counts the quest\'s XP once your combat level is ready for it.',
      ],
      button: { label: 'Update my planner', url: `${site}/planner` },
      note: 'You are getting this because you have a TickGains account or asked to hear about new features, and this is a one-off announcement.',
      unsubscribeUrl,
      unsubscribeLabel: 'Unsubscribe from news emails',
    }),
  }
}

/** The announcements the owner can send, by key. */
export const ANNOUNCEMENTS = {
  [GRAVEYARD_KEY]: { build: graveyardEmail, subject: GRAVEYARD_SUBJECT },
}
