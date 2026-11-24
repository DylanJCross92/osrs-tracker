// What changed on TickGains, by the day it was released, newest first. Only days with something to say are listed, and only what a visitor
// would notice (not behind-the-scenes work).
//
// To add a day: put a new entry at the top with the date as YYYY-MM-DD and one line per change.
//   new       something you could not do before
//   improved  something that works better or looks better
//   fixed     something that was wrong and is now right
// Write for visitors, plainly, one sentence each.
export const KINDS = { new: 'New', improved: 'Improved', fixed: 'Fixed' }

export const RELEASE_NOTES = [
  {
    date: '2026-11-24',
    items: [
      { kind: 'new', text: 'Free-to-play or members is a switch everywhere you plan: the plan settings, the add-skill-goal window, every skill calculator, the quick planner on a profile and the Smart Planner. A free-to-play route uses free methods only (from the wiki\'s free-to-play guides), says which skills it has no free route for, and your choice is remembered for every new plan, in your account too.' },
      { kind: 'new', text: 'Share your plan\'s progress: a Share button in the corner of the progress card opens a window with a clean picture of the pace chart (plan name, finish date, how complete it is, your progress and pace) to download, copy or post, plus a link to the plan.' },
      { kind: 'new', text: 'The dashboard now names your next quest: the one that does the most for the plan you are working on (a quest your route leans on, or one whose XP your plan would otherwise train for), or the best thing to do next. Press it and the tracker opens on that quest.' },
      { kind: 'new', text: 'Combat level badge: every profile, dashboard and top-gainer card now shows the player\'s combat level under their picture, in gold at 100 and up.' },
      { kind: 'improved', text: 'Smart Planner: a combat plan no longer opens with a one-level step, and Hitpoints is no longer counted as extra hours when your Attack, Strength, Defence or Ranged training already raises it.' },
      { kind: 'improved', text: 'Smart Planner: when your gp budget cuts a step short, the step now says what it gave up, and a quest is only turned into a level goal when its XP really reaches that level.' },
      { kind: 'new', text: 'Free-to-play plans now reach level 99 in Prayer, Cooking and Smithing (bones and vile ashes, pizzas, iron platebodies), with rates from the wiki.' },
      { kind: 'new', text: 'No account needed for a dashboard: enter your name in the planner or tracker and the home page becomes your dashboard in this browser. Claiming the profile unlocks goals, a customised profile and your name.' },
      { kind: 'new', text: 'Move your data without an account: a save code (or restore link) carries your plans, quests, diaries, followed players and hours to another device.' },
      { kind: 'new', text: 'Following now tells you what changed since you were last here, such as XP gained and new 99s, signed in or not.' },
      { kind: 'improved', text: 'Signed out, the site now says what is saved in this browser, how to keep it (an account, a save code, the browser\'s keep-it switch, the home screen on iPhone) and what would lose it.' },
    ],
  },
  {
    date: '2026-11-23',
    items: [
      { kind: 'improved', text: 'The planner remembers how many hours a day you play. Change it once and every new plan starts with it, and it follows your account to every device.' },
      { kind: 'new', text: 'A quest and Achievement Diary tracker, open to everyone with no account: tick off every quest and all 48 diary tiers, see your quest points, what each one needs and gives, and which training methods it opens up. There is a Quests link in the main menu, and the planner points to it.' },
      { kind: 'new', text: 'The tracker suggests what to do next in the Smart Planner style: the quests and diary tiers that open the most for you, each with a plain reason. Add your name to see only what you can start now.' },
      { kind: 'improved', text: 'Following a player now needs a free account, and says so: pressing Follow signed out explains it and offers to sign up or log in.' },
      { kind: 'improved', text: 'Signed out, the tracker now says plainly that progress is kept in this browser only, and a free account keeps it on every device.' },
      { kind: 'improved', text: 'The planner now counts a method as ready when you have the diary tier or the quests behind an item it needs, and the quest tracker lists the quests worth doing next.' },
      { kind: 'fixed', text: 'Gemstone Crab no longer shows one flat 40K xp an hour for every level. It now rises with your level and gear, from about 40K to 100K an hour for a strong account.' },
      { kind: 'new', text: 'The planner now shows which quests give an item or unlock a method needs (Goldsmith gauntlets come from Family Crest, Ancient Magicks from Desert Treasure I). Tick the quest off there and it counts everywhere.' },
      { kind: 'new', text: 'Smart Planner quest advice now comes from the OSRS Wiki: 174 quests with their real rewards, requirements, lengths and the combat level each one needs.' },
      { kind: 'new', text: 'Smart Planner plans stay inside the gp you said you can spend, and say so when a plan had to be trimmed to fit.' },
      { kind: 'new', text: 'A "This plan looks wrong" button in the Smart Planner, and a list of what the plan assumed and which quests it left out and why.' },
      { kind: 'new', text: 'Hover a block in the planner\'s finish line to see what is trained there, with the levels, time, XP and profit or cost. Click it to jump to that skill.' },
      { kind: 'new', text: 'Click a recommended plan to open it without saving it. A clear notice and a Save plan button tell you it is not kept until you save.' },
      { kind: 'improved', text: 'The dashboard\'s What\'s next uses your average over the last 7 full days and counts game days (6 AM to 6 AM Eastern), so a level-up no longer shows a day late.' },
      { kind: 'improved', text: 'This week and 30 days now mean the same thing everywhere: the last 7 and the last 30 game days. Discover, leaderboards, clans, share cards and profiles all agree.' },
      { kind: 'improved', text: 'Share cards write numbers the way the site does (for example +2.0M gp), and their date range starts at the edge of the window.' },
      { kind: 'fixed', text: 'Monkey Madness I had the wrong XP in the planner, and Mage Arena I was listed as giving XP when it gives none.' },
      { kind: 'fixed', text: 'Clan weekly XP counts only the history tracked since a player was added, so it can no longer be inflated by an old import.' },
      { kind: 'fixed', text: 'A value such as 999,999 XP now shows as 1M, not 1000K. The Discover XP tile and its popup agree, and the Hitpoints calculator starts at level 10.' },
    ],
  },
  {
    date: '2026-11-22',
    items: [
      { kind: 'new', text: 'The Smart Planner (Beta): answer a few questions and get a step-by-step plan from your real levels, with the reason for every step. Goals include making money, quests, combat, AFK training and hardcore skilling.' },
      { kind: 'new', text: 'The planner start page offers three ways in: a recommended plan, building your own from a skill, or the Smart Planner. The plans page has a New plan card.' },
      { kind: 'improved', text: 'In the Smart Planner, the gp you can spend is shown as piles of gold coins that grow with the amount, and each goal has pictures.' },
      { kind: 'improved', text: 'Smart plans are named after their goal, for example Make money (Smart Planner).' },
      { kind: 'improved', text: 'On Discover, the top gainer and the site XP figure cover the last 24 hours, so they no longer start over at 6 AM.' },
      { kind: 'fixed', text: 'The Training path cards looked broken after a clash of styles. They are back to normal.' },
    ],
  },
  {
    date: '2026-11-21',
    items: [
      { kind: 'new', text: 'An animated level 99 celebration on profiles, and a congratulations card you can share for any 99.' },
      { kind: 'new', text: 'The History tab lists every level 99 with a Share button, and has a highlights chart of 99s and 200M XP that you can show or hide.' },
      { kind: 'new', text: 'A suggested training order in the planner, with the reason for each skill. New and recommended plans start in that order.' },
      { kind: 'new', text: 'Grand Exchange watchlist cards show a small 30-day price line.' },
      { kind: 'improved', text: 'The planner start page leads with the outcome, shows a live Grand Exchange badge and gives each recommended plan a gp figure.' },
      { kind: 'fixed', text: 'Fixed the site restarting when it ran out of memory while drawing level 99 cards.' },
    ],
  },
  {
    date: '2026-11-20',
    items: [
      { kind: 'new', text: 'Grand Exchange: live prices, a GE Prices page, item pages with price charts, and live gp in the planner and calculators.' },
      { kind: 'new', text: 'Watch Grand Exchange items from their page. Your watchlist shows on the GE Prices page and the dashboard.' },
      { kind: 'new', text: 'Tick quests right inside a plan\'s route details, see what each one needs first, and mark quests as already done.' },
      { kind: 'improved', text: 'Everyone can open the site-wide XP graph on Discover.' },
      { kind: 'improved', text: 'Plan cards show the time left, and the welcome page has a Grand Exchange band with live prices.' },
      { kind: 'improved', text: 'Deleting a skill in the planner asks in the site\'s own window.' },
      { kind: 'fixed', text: 'Grand Exchange prices now refresh reliably every five minutes.' },
    ],
  },
  {
    date: '2026-11-19',
    items: [
      { kind: 'new', text: 'Quest shortcuts in the planner, starting with the Runecraft opening.' },
      { kind: 'improved', text: 'Plan cards skip training methods you cannot use, so their time and profit match the plan page.' },
      { kind: 'improved', text: 'Profile claims send a reminder email, then a closing notice, so a claim is not left hanging.' },
    ],
  },
  {
    date: '2026-11-18',
    items: [
      { kind: 'new', text: 'A What\'s next timeline on plan pages, dating each level and goal.' },
      { kind: 'new', text: 'A plan can be the goal on your profile, and goals can be created from the planner.' },
      { kind: 'new', text: 'Profile owners are told who congratulated them. A new Daeyalt essence Runecraft method is in the planner.' },
      { kind: 'improved', text: 'A redesigned notification menu with settings first, and a profile claim badge that clears once seen.' },
      { kind: 'improved', text: 'In the skill editor, Cancel discards your changes and Done became Save. A tidier Clans page, and the homepage highlights clans, compare and accounts.' },
      { kind: 'fixed', text: 'Sharing a plan no longer saves it.' },
    ],
  },
  {
    date: '2026-11-17',
    items: [
      { kind: 'new', text: 'A redesigned planner: a plans overview, a page and link for every plan, per-skill editing, route sharing and Runecraft fixes.' },
      { kind: 'new', text: 'A welcome page for accounts with no claimed profile, where you can claim one in place.' },
      { kind: 'improved', text: 'The week chart has a dashed "usual by now" line on today\'s bar, and the day recap compares today with your usual pace.' },
      { kind: 'improved', text: 'Pace is measured over real elapsed time, not whole game days.' },
      { kind: 'improved', text: 'Clans pages look like the planner, Start a clan opens in a window, and modal close buttons are larger, especially on phones.' },
    ],
  },
  {
    date: '2026-11-16',
    items: [
      { kind: 'new', text: 'A new planner start screen with tabbed results and a method picker with icons.' },
      { kind: 'new', text: 'A feedback form in the corner of the site, a refresh button on the dashboard, and top gainer days on profiles and Discover.' },
      { kind: 'improved', text: 'The top gainer shows hours while the lead is under a day, then days. Pages show loading placeholders instead of blank space.' },
      { kind: 'improved', text: 'The Discover tile for level-ups is now labelled Levels gained.' },
    ],
  },
  {
    date: '2026-11-15',
    items: [
      { kind: 'new', text: 'Clan owners and moderators can add members by name, and the players added are notified.' },
      { kind: 'new', text: 'A dashboard card for your active clan competitions, with your rank in each.' },
      { kind: 'improved', text: 'In the planner, hovering a requirement icon explains why it is a requirement.' },
    ],
  },
  {
    date: '2026-11-14',
    items: [
      { kind: 'new', text: 'Clans: invite links, clan cards, XP competitions, a Clans hub and My clans, Skill of the Week, and join requests.' },
      { kind: 'new', text: 'A dashboard as the home page when you are signed in: your week, plans, what\'s next, milestones, inbox, following and goals.' },
      { kind: 'new', text: 'Profiles show followers and following, streaks and badges. New plan guides and an OSRS XP table page.' },
      { kind: 'improved', text: 'Claiming a profile has an online window and an in-game ping button. A verified profile counts as you on Compare.' },
      { kind: 'fixed', text: 'Clan and competition XP is now counted from the right moment.' },
    ],
  },
  {
    date: '2026-11-13',
    items: [
      { kind: 'improved', text: 'The planner got a pace chart, a mode with no plan yet, methods chosen per level, and sharing without an account.' },
      { kind: 'fixed', text: 'Compare checks the names you type before leaving the form.' },
    ],
  },
  {
    date: '2026-11-11',
    items: [
      { kind: 'new', text: 'Planner overhaul: a timeline for your goals, live progress, requirements and a quest tracker.' },
      { kind: 'new', text: 'Public shareable plans with their own page, a link preview card and a Use this plan button.' },
      { kind: 'new', text: 'Saved plans with a plan switcher, unsaved-change tracking and Save as new. Recommended plans: all skills to 70, 80, 90 or 99, combat 99 and total level.' },
      { kind: 'new', text: 'A My account hub with Overview, Plans, Goals, Quests, Records, Notifications and Settings, and notification preferences.' },
      { kind: 'new', text: 'The planner projects your finish date from your real daily pace and says how early or late you are.' },
      { kind: 'improved', text: 'The progress bar is a timeline spaced by training time, personal record notices come once per game day, and checkboxes match the site\'s theme.' },
      { kind: 'improved', text: 'Plans are saved for your own claimed profile; plans for other players can still be shared.' },
    ],
  },
  {
    date: '2026-11-10',
    items: [
      { kind: 'new', text: 'Accounts: sign up with email, log in, reset your password, and claim a tracked player with an in-game code to get a verified tick.' },
      { kind: 'new', text: 'Follow players with a strip on your homepage, a notification bell and inbox, and profile customization with a picture upload. Public goals come with a share card.' },
      { kind: 'new', text: 'Challenge a friend with a shareable link and preview card, and an email list you can join or leave.' },
      { kind: 'new', text: 'The profile Overview was rebuilt: a week strip, records to beat, a skill board and a road to max. Plus a day recap, a nav search box, and link previews with the player\'s picture, level, XP, rank and weekly gain.' },
      { kind: 'fixed', text: 'iPhones no longer zoom when you tap a field, and browsers stop offering saved logins in player name boxes.' },
      { kind: 'fixed', text: 'A stale tab after an update now reloads itself instead of breaking.' },
    ],
  },
  {
    date: '2026-11-09',
    items: [
      { kind: 'new', text: 'Skill calculators, a page for every skill goal, a method picker and a Profitable strategy.' },
      { kind: 'new', text: 'Compare two players side by side, with rivals. A Records tab with shareable personal records, and a quick planner from any skill row.' },
      { kind: 'new', text: 'Congratulations for new 99s: a strip on the profile, a badge, and pills in the activity feed.' },
      { kind: 'improved', text: 'A game day now runs from 6 AM to 6 AM Eastern, so XP gained overnight counts for the day you played.' },
      { kind: 'improved', text: 'Recent players in search, generated avatars, richer suggestions, and a Discord link in the footer.' },
      { kind: 'fixed', text: 'The 7-day table gain and several mobile layouts were corrected.' },
    ],
  },
  {
    date: '2026-11-08',
    items: [
      { kind: 'new', text: 'A leaderboard page, and a planner overhaul with audited methods, goal cards, global strategies, a budget, a timeline, saved plans and a materials list.' },
      { kind: 'improved', text: 'Share cards show progress to the next level and compare fairly with the previous period.' },
      { kind: 'fixed', text: 'Gains over a period now start from the right snapshot, and imported history from before tracking no longer skews them. Mahogany Homes data was corrected, and numbers have commas.' },
    ],
  },
  {
    date: '2026-11-07',
    items: [
      { kind: 'new', text: 'Player profiles with tabs for achievements, milestones, goals and history, and a Discover page with a live activity feed, leaderboard, spotlight, trending and most improved.' },
      { kind: 'new', text: 'Share cards for a day, a week or a month, a redesigned homepage, and a 7-day XP sparkline on profiles.' },
      { kind: 'improved', text: 'Hiscores are checked every hour for active players and every day for players who have gone quiet.' },
      { kind: 'fixed', text: 'Profile header buttons that could not be clicked now work.' },
    ],
  },
  {
    date: '2026-11-06',
    items: [
      { kind: 'new', text: 'The Account Planner: set skill goals and get a training route, hours and GP estimates.' },
      { kind: 'new', text: 'Shareable weekly progress cards, a period selector for gains, profile badges, and older history imported from Wise Old Man.' },
      { kind: 'improved', text: 'A sticky navigation bar, a new logo and branded link previews.' },
      { kind: 'fixed', text: 'Today\'s gains reset correctly, and training guide XP rates were corrected.' },
    ],
  },
  {
    date: '2026-11-05',
    items: [
      { kind: 'new', text: 'TickGains launched: enter an OSRS name to see XP, level and rank gains, with real skill icons, Sailing, a level progress bar and training recommendations with time to the next level.' },
      { kind: 'new', text: 'Snapshots are grouped by day and expand to the hour, and every player has a page of their own.' },
    ],
  },
]
