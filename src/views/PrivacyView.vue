<template>
  <div class="card info-page">
    <h1>Privacy</h1>
    <p class="info-updated">Plain-language summary of how TickGains handles data.</p>
    <h2>What we store</h2>
    <ul>
      <li>
        <b>Public OSRS hiscores data</b> for the usernames people choose to track: skill XP, levels and ranks, saved as
        timestamped snapshots, plus history imported from Wise Old Man where available. This is public information.
      </li>
      <li>Derived data such as milestones and achievements calculated from those snapshots.</li>
    </ul>
    <h2>What we don't do</h2>
    <ul>
      <li>You never need an account to track players, and TickGains never asks for your OSRS login. Accounts are optional and only keep your own settings (see "Accounts" below). The optional email list is separate.</li>
      <li>Searching or tracking a name doesn't change anything on the OSRS account.</li>
    </ul>
    <h2>Accounts</h2>
    <p>
      You can create an account with an email address and a password. We store the email, a salted one-way hash of the password
      (never the password itself), when the account was made, and a few settings you choose to sync: your OSRS name, your rivals and
      your preferred gain period. Signed-in browsers keep a cookie so you stay logged in for 30 days. When you are signed in we also keep, with your account, the browser data that
      makes the site follow you between devices: saved planner plans and goals, recent searches, the players you follow and which
      congratulations you have sent or hidden, plus a list of notifications about things like claims and the players you follow. The site owner can see the plans an account has saved, listed by the player each plan is for and without the account's email, to understand how the planner is used.
      An account does not give anyone else access to or control over any OSRS profile. You can change your password on the account page,
      and you can ask us to delete your account and its saved settings from the contact page. Password reset emails are sent through Resend. If you confirm your email but never claim a player, we send you one reminder email about a day later that explains what claiming gives you. It has an unsubscribe link, and we remember that you unsubscribed so it is not sent again.
    </p>
    <h2>Profile claims</h2>
    <p>
      A signed-in account can ask to claim a tracked OSRS name. We create a short one-time code and store it with the link between
      your account and that name. To verify the claim you send the code to the site owner in a private message in the game, and the
      owner enters it to approve it. A claimed profile shows a "Claimed" label to everyone, but never says which account owns it. If you
      delete your account (ask us on the contact page), your claims are removed and the profile becomes unclaimed. Claiming does not
      change anything on the OSRS account, and we never ask for your OSRS password.
    </p>
    <h2>Customised profiles</h2>
    <p>
      The owner of a claimed profile can add a short bio, links to Discord, Twitch, YouTube or X, public
      goals, and a picture. This is shown to everyone who views that profile. Pictures are shrunk in your browser and stored with the
      profile; you can remove them at any time, and site admins can remove content that breaks the rules.
    </p>
    <h2>Usage analytics</h2>
    <p>
      TickGains uses Google Tag Manager and Google Analytics to understand which pages and features are used. These
      tools may set cookies and collect technical information such as pages visited, device and approximate location.
      When a new player is added to the tracker, the name that was added is sent along as an event, so TickGains can see which players are being looked up. Player names are public OSRS names, and visitors are never tied to a name or an account. You can block these tools with your browser's privacy settings or an extension.
    </p>
    <p>
      TickGains also keeps its own simple record of what is used, so the site can be improved: an event such as "page opened", "refresh pressed" or "plan saved", the day and time it happened, and a few
      non-personal details like which page, skill or tab was involved. This record has no IP address and no cookie, and it never includes names,
      emails or anything you type.
    </p>
    <p>
      To see how one visit unfolds, your browser keeps a random number (32 letters and digits) in its local storage and sends it with these events. It is not tied to your name, your
      device or your IP address, and it is replaced by a new one after 90 days. The site owner can follow the steps recorded under one number in order. If you sign in, the
      number is linked to your account, so what was done in that browser before and after you signed in is shown together under your account (the owner sees your email and any player name you have claimed).
      If your browser sends Do Not Track or Global Privacy Control, no number is created or sent, and an existing one is removed. You can also clear it at any time by clearing this site's data in your browser.
    </p>
    <p>
      If you use the Account Planner without signing in, the plans saved in your browser (the skills, levels, hours per day and any player name you entered) are also copied to the site owner's records under that same random number, so the owner can see what kinds of plans people make. A plan that was shared by link is already public; this copy is not. Nothing is copied when your browser sends Do Not Track or Global Privacy Control. When you sign in, your plans sync to your account instead and this copy is removed. Copies are replaced when your plans change and deleted after about 13 months without an update.
    </p>
    <p>
      If you are signed in, an event is also stored with your account number, so different accounts can be counted and so the site owner can see which accounts were active on a given day; if your browser sends Do Not Track
      or Global Privacy Control, it is stored without one. These events are deleted after about 13 months. When an account is deleted, its events are no longer linked to it, and the random numbers that were linked to it are removed from them.
    </p>
    <h2>Congratulations</h2>
    <p>
      When someone reaches a new 99, visitors can click a "Congratulate" button. To allow one click per visitor per achievement,
      TickGains stores a salted, one-way hash of the visitor's IP address with the click. The address itself is never stored,
      and the hash can't be turned back into it.
    </p>
    <h2>Email updates</h2>
    <p>
      If you choose to sign up for news and new-feature emails, TickGains stores your email address, the date, and which
      form you used (for example the footer). It is only used to send you TickGains news and is never sold. A mail service is used to tell the site owner about each new sign-up, and later to send the emails themselves. Every email will include
      a link to unsubscribe in one click. There is no account, and no signing up is needed to use
      the site. To be removed sooner, use the <RouterLink to="/contact">contact page</RouterLink>.
    </p>
    <h2>Your browser</h2>
    <p>Some preferences (like your selected gains period or a saved plan in the planner) are kept in your browser's local storage on your own device.</p>
    <h2>Questions or removal requests</h2>
    <p>If you'd like a tracked username removed, get in touch via the <RouterLink to="/contact">contact page</RouterLink>.</p>
  </div>
</template>

<script setup>
import { setPageMeta } from '@/utils/pageMeta'
setPageMeta({ title: 'Privacy Policy', description: 'How TickGains handles data: public OSRS hiscores snapshots, optional accounts, an optional email list and usage analytics.', path: '/privacy' })
</script>
