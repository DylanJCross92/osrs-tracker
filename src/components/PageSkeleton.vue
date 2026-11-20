<template>
  <!-- Loading placeholders for the main pages. Like DashSkeleton, each one is built from the loaded page's own classes with
       placeholder text, so it takes up about the same room and the page does not jump when the real content arrives. -->

  <!-- Home: the example profile -->
  <div v-if="kind === 'home-example'" class="card home-preview dash-sk" aria-busy="true" aria-label="Loading an example profile">
    <div class="home-preview-main" aria-hidden="true">
      <div class="home-preview-head">
        <span class="home-preview-avatar sk" />
        <div><span class="home-preview-label sk sk-w100">Example profile</span><h3 class="sk sk-w140">Player name</h3></div>
      </div>
      <div class="home-preview-stats">
        <div><span class="sk sk-w60">Overall</span><b class="sk sk-w60">2,277</b></div>
        <div><span class="sk sk-w80">Gained</span><b class="sk sk-w80">+000,000</b></div>
        <div class="wide"><span class="sk sk-w60">Total XP</span><b class="sk sk-w140">000,000,000</b></div>
      </div>
      <div class="home-preview-gains">
        <span class="home-preview-label sk sk-w100">Recent XP gains</span>
        <ul><li v-for="n in 3" :key="n"><span class="sk sk-icon20" /><span class="sk sk-w120">Skill name</span></li></ul>
      </div>
      <span class="btn btn-primary sk sk-w160">View Example Profile</span>
    </div>
    <div class="home-preview-chart" aria-hidden="true"><span class="home-preview-label sk sk-w100">XP progression</span><div class="sk sk-chart" /></div>
  </div>

  <!-- Home: community activity -->
  <template v-else-if="kind === 'home-community'">
    <div class="home-tiles dash-sk" aria-busy="true" aria-label="Loading community activity">
      <div v-for="n in 2" :key="n" class="card home-tile" aria-hidden="true"><span class="sk sk-w120">Players tracked</span><b class="sk sk-w100">0,000</b></div>
    </div>
    <div class="home-community dash-sk" aria-hidden="true">
      <div v-for="n in 2" :key="n" class="card">
        <h3 class="sk sk-w180">Top gainers today</h3>
        <ol class="home-list">
          <li v-for="i in 5" :key="i"><a><span class="disc-rank sk">{{ i }}</span><span class="sk sk-w140">Player name</span><b class="sk sk-w60">+0.0M</b></a></li>
        </ol>
      </div>
    </div>
  </template>

  <!-- Discover: the activity feed and the leaderboard -->
  <div v-else-if="kind === 'discover'" class="disc-grid dash-sk" aria-busy="true" aria-label="Loading the latest activity">
    <section class="card disc-feed">
      <div class="disc-head"><h2><span class="disc-live-dot" /> Live activity</h2><span class="disc-updated sk sk-w100">updated now</span></div>
      <div class="range-tabs disc-chips" aria-hidden="true"><span v-for="l in ['All', 'Level-ups', '99s', 'Big gains', 'Milestones']" :key="l" class="sk sk-pill">{{ l }}</span></div>
      <ul class="disc-events" aria-hidden="true">
        <li v-for="n in 7" :key="n" class="disc-event"><a><span class="disc-event-icon sk" /><span class="disc-event-text"><b class="sk sk-w200">Player reached Skill level 00</b></span><small class="sk sk-w40">4h</small></a></li>
      </ul>
    </section>
    <section class="card disc-board">
      <div class="disc-head"><h2>Leaderboard</h2><span class="disc-more sk sk-w120">Full leaderboard</span></div>
      <div class="range-tabs" aria-hidden="true"><span v-for="l in ['Today', '7 days', '30 days']" :key="l" class="sk sk-pill">{{ l }}</span></div>
      <ol class="disc-board-list" aria-hidden="true">
        <li v-for="n in 10" :key="n"><a><span class="disc-rank sk">{{ n }}</span><span class="disc-board-main"><span class="disc-board-name sk sk-w140">Player name</span><span class="disc-bar"><span class="sk" :style="{ width: `${100 - n * 8}%` }" /></span></span><span class="disc-board-xp sk sk-w60">+0.0M</span></a></li>
      </ol>
    </section>
  </div>

  <!-- Leaderboard: the ranked list -->
  <ol v-else-if="kind === 'leaderboard'" class="disc-board-list lb-list dash-sk" aria-busy="true" aria-label="Loading the leaderboard">
    <li v-for="n in 14" :key="n" aria-hidden="true"><a><span class="disc-rank sk">{{ n }}</span><span class="disc-board-main"><span class="disc-board-name sk sk-w160">Player name</span><span class="disc-bar"><span class="sk" :style="{ width: `${100 - n * 6}%` }" /></span></span><span class="lb-meta sk sk-w60">2,277</span><span class="disc-board-xp sk sk-w60">+0.0M</span></a></li>
  </ol>

  <!-- Items: the price table -->
  <div v-else-if="kind === 'items'" class="gx-sk dash-sk" aria-busy="true" aria-label="Loading the prices">
    <div v-for="n in 12" :key="n" class="gx-sk-row" aria-hidden="true"><span class="sk gx-sk-icon" /><span class="sk sk-w160">Item name</span><span class="sk sk-w60 gx-sk-price">3,727</span></div>
  </div>

  <!-- Clans: the directory -->
  <template v-else-if="kind === 'clans'">
    <section class="card clan-card dash-sk" aria-busy="true" aria-label="Loading the clans">
      <header class="dash-card-head"><h2>All clans</h2><span class="sk sk-w200 sk-tall">Sort and search</span></header>
      <ul class="clans-grid" aria-hidden="true">
        <li v-for="n in 6" :key="n"><ClanCardSkeleton /></li>
      </ul>
    </section>
  </template>

  <!-- My clans -->
  <section v-else-if="kind === 'my-clans'" class="clan-mine-group dash-sk" aria-busy="true" aria-label="Loading your clans">
    <h2 class="clan-mine-group-h">Clans you are in</h2>
    <div class="clan-mine-grid" aria-hidden="true"><ClanCardSkeleton v-for="n in 3" :key="n" /></div>
  </section>

  <!-- One clan -->
  <template v-else-if="kind === 'clan'">
    <header class="card clan-head dash-sk" aria-busy="true" aria-label="Loading the clan">
      <div class="clan-head-main" aria-hidden="true">
        <p class="clan-kicker sk sk-w60">Clan</p>
        <h1 class="sk sk-w300">Clan name</h1>
        <p class="clan-desc sk sk-w60p">A line about the clan goes here.</p>
        <p class="clan-meta sk sk-w200">0 members · created Jan 1</p>
      </div>
      <span class="btn btn-ghost sk sk-w140" aria-hidden="true">Copy page link</span>
    </header>
    <div class="clan-grid dash-sk" aria-hidden="true">
      <div class="clan-main">
        <section class="card clan-card">
          <header class="dash-card-head"><h2>Competitions</h2></header>
          <ul class="clan-comps"><li v-for="n in 2" :key="n" class="clan-comp"><span class="clan-comp-link"><span class="clan-comp-icon sk" /><span class="clan-comp-body"><b class="sk sk-w200">Competition title</b><small class="sk sk-w140">Skill XP · ends soon</small></span></span></li></ul>
        </section>
        <section class="card clan-card">
          <header class="dash-card-head"><h2>Members</h2></header>
          <ul class="clan-members"><li v-for="n in 5" :key="n" class="clan-member"><span class="clan-avatar sk" /><span class="clan-who"><span class="clan-name sk sk-w140">Player name</span><small class="sk sk-w100">Overall 2,277</small></span></li></ul>
        </section>
      </div>
      <aside class="clan-side"><section class="card clan-card"><h2>Invite people</h2><p class="sk sk-w80p">Share this link to invite.</p><span class="btn btn-ghost sk sk-w140">Copy invite link</span></section></aside>
    </div>
  </template>

  <!-- One competition -->
  <template v-else-if="kind === 'competition'">
    <header class="card cmt-hero dash-sk" aria-busy="true" aria-label="Loading the competition">
      <div class="cmt-hero-top" aria-hidden="true"><span class="cmt-clan sk sk-w140">Clan name</span><span class="cmt-pill-status sk sk-w80">Running</span></div>
      <div class="cmt-hero-main" aria-hidden="true">
        <span class="cmt-hero-icon sk" />
        <div class="cmt-hero-title"><h1 class="sk sk-w300">Competition title</h1><p><span class="cmt-tag sk sk-w80">Skill XP</span> <span class="cmt-tag sk sk-w80">0 members</span> <span class="cmt-tag sk sk-w80">7 days</span></p></div>
      </div>
      <div class="cmt-timeline" aria-hidden="true">
        <div class="cmt-tl-ends">
          <div class="cmt-tl-end"><span class="sk sk-w40">Starts</span><b class="sk sk-w100">Mon, Jan 1</b><small class="sk sk-w60">6:00 AM</small></div>
          <div class="cmt-tl-end is-right"><span class="sk sk-w40">Ends</span><b class="sk sk-w100">Mon, Jan 8</b><small class="sk sk-w60">6:00 AM</small></div>
        </div>
        <div class="cmt-track"><i class="sk" style="width: 40%" /></div>
      </div>
    </header>
    <section class="card dash-sk" aria-hidden="true">
      <h2>Standings</h2>
      <ol class="disc-board-list"><li v-for="n in 6" :key="n"><a><span class="disc-rank sk">{{ n }}</span><span class="disc-board-main"><span class="disc-board-name sk sk-w140">Player name</span><span class="disc-bar"><span class="sk" :style="{ width: `${100 - n * 12}%` }" /></span></span><span class="disc-board-xp sk sk-w60">+0.0M</span></a></li></ol>
    </section>
  </template>

  <!-- A profile's tabs and overview -->
  <template v-else-if="kind === 'profile'">
    <nav class="profile-tabs dash-sk" aria-busy="true" aria-label="Loading the profile"><span v-for="l in ['Overview', 'Stats', 'Achievements', 'Records', 'Goals', 'History']" :key="l" class="sk sk-pill">{{ l }}</span></nav>
    <DashSkeleton kind="week" />
    <section class="card ov-skills dash-sk" aria-hidden="true">
      <header class="ov-head"><div><h2>Skill board</h2><p class="ov-sub sk sk-w200">Every skill at a glance.</p></div></header>
      <div class="ov-skill-grid">
        <div v-for="n in 24" :key="n" class="ov-skill"><span class="sk sk-icon26" /><b class="ov-skill-level sk sk-w40">99</b><span class="ov-skill-name sk sk-w60">Skill</span><span class="ov-meter ov-skill-meter"><i class="sk" style="width: 60%" /></span><small class="ov-skill-xp sk sk-w40">0.0M</small></div>
      </div>
    </section>
  </template>

  <!-- A list inside a profile tab (records, achievements, timeline) -->
  <section v-else-if="kind === 'rows'" class="card dash-sk" aria-busy="true" :aria-label="`Loading ${label}`">
    <h2>{{ label }}</h2>
    <ul class="dm-list" aria-hidden="true">
      <li v-for="n in rowCount" :key="n" class="dm-item"><span class="dm-ico sk" /><span class="dm-text"><b class="sk sk-w200">Something happened</b><small class="sk sk-w140">Skill · 0 days ago</small></span></li>
    </ul>
  </section>

  <!-- Just the rows, for inside a card that already has its heading -->
  <ul v-else-if="kind === 'list'" class="dm-list dash-sk" aria-busy="true" :aria-label="`Loading ${label}`">
    <li v-for="n in rowCount" :key="n" class="dm-item" aria-hidden="true"><span class="dm-ico sk" /><span class="dm-text"><b class="sk sk-w200">Something happened</b><small class="sk sk-w140">Skill · 0 days ago</small></span></li>
  </ul>

  <!-- The three record tiles on the overview -->
  <div v-else-if="kind === 'records-grid'" class="ov-rec-grid dash-sk" aria-busy="true" aria-label="Loading records">
    <div v-for="n in 3" :key="n" class="ov-rec" aria-hidden="true"><span class="ov-rec-ico sk" /><span class="sk sk-w100">BIGGEST DAY</span><b class="sk sk-w80">0.0M XP</b><small class="sk sk-w100">Set Jan 1</small><span class="ov-meter"><i class="sk" style="width: 40%" /></span></div>
  </div>

  <!-- Compare: both players -->
  <template v-else-if="kind === 'compare'">
    <section class="card dash-sk" aria-busy="true" aria-label="Loading both players">
      <div class="sk-vs" aria-hidden="true">
        <div class="sk-vs-side"><span class="sk sk-avatar" /><b class="sk sk-w120">Player one</b><small class="sk sk-w80">Overall 2,277</small></div>
        <span class="sk sk-w40">vs</span>
        <div class="sk-vs-side"><span class="sk sk-avatar" /><b class="sk sk-w120">Player two</b><small class="sk sk-w80">Overall 2,277</small></div>
      </div>
    </section>
    <section class="card dash-sk" aria-hidden="true">
      <ul class="dm-list"><li v-for="n in 5" :key="n" class="dm-item"><span class="dm-ico sk" /><span class="dm-text"><b class="sk sk-w180">Total XP gained</b><small class="sk sk-w100">0.0M vs 0.0M</small></span></li></ul>
    </section>
  </template>

  <!-- A shared plan -->
  <template v-else-if="kind === 'plan'">
    <section class="card sp-head dash-sk" aria-busy="true" aria-label="Loading the plan">
      <h1 class="sk sk-w300">Plan name</h1>
      <p class="sk sk-w200">A plan by a player</p>
    </section>
    <section class="card dash-sk" aria-hidden="true">
      <ul class="dm-list"><li v-for="n in 5" :key="n" class="dm-item"><span class="dm-ico sk" /><span class="dm-text"><b class="sk sk-w200">Skill 1 to 99</b><small class="sk sk-w140">0,000,000 XP · about 0 h</small></span></li></ul>
    </section>
  </template>
</template>

<script setup>
import { h } from 'vue'
import DashSkeleton from '@/components/dashboard/DashSkeleton.vue'

defineProps({
  // list | records-grid | home-example | home-community | discover | leaderboard | items | clans | my-clans | clan | competition | profile | rows | compare | plan
  kind: { type: String, required: true },
  // For kind "rows": the heading and how many placeholder rows.
  label: { type: String, default: 'Loading' },
  rowCount: { type: Number, default: 4 },
})

// One clan card (the same shape as ClanListCard), used by the directory and My clans.
const ClanCardSkeleton = () =>
  h('div', { class: 'clans-card' }, [
    h('div', { class: 'clans-card-top' }, [h('b', { class: 'sk sk-w140' }, 'Clan name')]),
    h('p', { class: 'clans-card-desc sk sk-w80p' }, 'A line about the clan goes here.'),
    h('div', { class: 'clans-card-stats' }, [h('span', { class: 'sk sk-w80' }, '0 members'), h('span', { class: 'sk sk-w100' }, '+0.0M XP this week')]),
    h('div', { class: 'clans-card-people' }, [h('span', { class: 'clans-faces' }, [h('span', { class: 'clans-face sk' }), h('span', { class: 'clans-face sk' })]), h('span', { class: 'clans-names sk sk-w140' }, 'Name and name')]),
  ])
</script>
