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
      congratulations you have sent or hidden, plus a list of notifications about things like claims and the players you follow.
      An account does not give anyone else access to or control over any OSRS profile. You can change your password on the account page,
      and you can ask us to delete your account and its saved settings from the contact page. Password reset emails are sent through Resend.
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
      The owner of a claimed profile can add a short bio, a "currently training" line, links to Discord, Twitch, YouTube or X, public
      goals, and a picture. This is shown to everyone who views that profile. Pictures are shrunk in your browser and stored with the
      profile; you can remove them at any time, and site admins can remove content that breaks the rules.
    </p>
    <h2>Usage analytics</h2>
    <p>
      TickGains uses Google Tag Manager and Google Analytics to understand which pages and features are used. These
      tools may set cookies and collect technical information such as pages visited, device and approximate location.
      When a new player is added to the tracker, the name that was added is sent along as an event, so TickGains can see which players are being looked up. Player names are public OSRS names, and visitors are never tied to a name or an account. You can block these tools with your browser's privacy settings or an extension.
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
setPageMeta({ title: 'Privacy', description: 'How TickGains handles data: public OSRS hiscores snapshots, optional accounts, an optional email list, and usage analytics.', path: '/privacy' })
</script>
