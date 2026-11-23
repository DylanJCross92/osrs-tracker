<template>
  <!-- Each skeleton is the loaded module's own markup and classes with placeholder text, so it takes up the same height. -->
  <header v-if="kind === 'head'" class="card dash-head dash-sk" aria-busy="true" aria-label="Loading your profile">
    <div class="dash-who" aria-hidden="true">
      <span class="dash-avatar sk" />
      <div class="dash-who-text">
        <p class="dash-hi sk sk-w120">Welcome back</p>
        <h1 class="sk sk-w220">Player name</h1>
        <p class="dash-sub sk sk-w300">Total 2277 · 1,234,567,890 XP · updated today</p>
      </div>
    </div>
    <div class="dash-head-actions" aria-hidden="true"><span class="dash-refresh sk sk-w110">Refresh</span></div>
  </header>

  <section v-else-if="kind === 'week'" class="card ov-week dash-sk" aria-busy="true" aria-label="Loading your week">
    <header class="ov-week-head">
      <div>
        <h2>This week</h2>
        <p class="ov-sub sk sk-w160">Tap a day for its recap.</p>
      </div>
      <div class="ov-week-total" aria-hidden="true">
        <b class="sk sk-w120">+000,000</b>
        <span class="sk sk-w180">XP in 7 days · +0.0M in 30</span>
      </div>
    </header>
    <div class="ov-week-body" aria-hidden="true">
      <div class="ov-bars">
        <div v-for="(h, i) in BAR_HEIGHTS" :key="i" class="ov-bar">
          <span class="ov-bar-xp sk">0.0k</span>
          <span class="ov-bar-track"><i class="sk" :style="{ height: `${h}%` }" /></span>
          <span class="ov-bar-day sk">Mon</span>
          <span class="ov-bar-skills" />
        </div>
      </div>
      <div class="ov-facts">
        <div v-for="n in 3" :key="n" class="ov-fact">
          <span class="sk sk-icon26" />
          <span><b class="sk sk-w140">0-day streak</b><small class="sk sk-w100">Longest: 0 days</small></span>
        </div>
      </div>
    </div>
  </section>

  <section v-else-if="kind === 'clans'" class="card dash-card dclan dash-sk" aria-busy="true" aria-labelledby="dash-clans-sk">
    <header class="dash-card-head">
      <h2 id="dash-clans-sk">Active Clan Competitions</h2>
      <span class="dash-more sk sk-w100">All my clans</span>
    </header>
    <ul class="dclan-comps" aria-hidden="true">
      <li v-for="n in 2" :key="n">
        <span class="dclan-comp is-running">
          <span class="dclan-ico sk" />
          <span class="dclan-main"><b class="sk sk-w60p">Competition title</b><small class="sk sk-w40p">Clan name · ends in 0 days</small></span>
          <span class="dclan-rank"><b class="sk sk-w40">#1</b><small class="sk sk-w60">of 10 · +0.0M</small></span>
        </span>
      </li>
    </ul>
  </section>

  <section v-else-if="kind === 'plans'" class="card dash-card is-compact dash-sk" aria-busy="true" aria-labelledby="dash-plans-sk">
    <header class="dash-card-head">
      <h2 id="dash-plans-sk">Your plans</h2>
      <span class="dash-more sk sk-w100">All plans</span>
    </header>
    <ul class="dash-plans" aria-hidden="true">
      <li v-for="n in 3" :key="n" class="dash-plan">
        <div class="dash-plan-top">
          <span class="dash-plan-name sk sk-w200">Plan name goes here</span>
          <span class="dash-plan-right"><b class="dash-plan-pct sk sk-w40">00%</b></span>
        </div>
        <div class="dash-bar is-thin"><i class="sk" style="width: 40%" /></div>
        <p class="dash-plan-meta is-muted sk sk-w80p">0 of 0 goals about 0h to go finish Jan 1, 2027</p>
      </li>
    </ul>
  </section>

  <section v-else-if="kind === 'next'" class="card dash-card dash-sk" aria-busy="true" aria-labelledby="dash-next-sk">
    <header class="dash-card-head">
      <h2 id="dash-next-sk">What's next</h2>
      <span class="dash-hint sk sk-w180">by your average over the last 7 full days</span>
    </header>
    <ol class="dtl" aria-hidden="true">
      <li v-for="n in 2" :key="n" class="dtl-stop">
        <span class="dtl-dot" />
        <div class="dtl-date"><b class="sk sk-w80">Jan 1</b><small class="sk sk-w100">Mon · in 0 days</small></div>
        <ul class="dtl-items">
          <li class="dtl-item">
            <span class="sk sk-icon24" />
            <span class="dtl-text"><b class="sk sk-w180">Skill level 00</b><small class="sk sk-w120">0,000 XP to go</small></span>
          </li>
        </ul>
      </li>
    </ol>
  </section>

  <section v-else-if="kind === 'following'" class="card fol dash-sk" aria-busy="true" aria-labelledby="dash-fol-sk">
    <header class="fol-head">
      <h2 id="dash-fol-sk">Following</h2>
      <span class="fol-more sk sk-w120">Compare players</span>
    </header>
    <ul class="fol-list" aria-hidden="true">
      <li v-for="n in 3" :key="n">
        <span class="fol-card">
          <span class="fol-avatar sk" />
          <span class="fol-main"><span class="fol-name sk sk-w60p">Player name</span><small class="fol-event sk sk-w80p">Mostly Skill this week</small></span>
          <span class="fol-gain"><b class="sk sk-w60">+0.0M</b><small class="sk sk-w40">today</small></span>
        </span>
      </li>
    </ul>
  </section>

  <section v-else-if="kind === 'milestones'" class="card dash-card dash-sk" aria-busy="true" aria-labelledby="dash-ms-sk">
    <header class="dash-card-head">
      <h2 id="dash-ms-sk">Recent milestones</h2>
      <span class="dash-more sk sk-w120">All achievements</span>
    </header>
    <ul class="dm-list" aria-hidden="true">
      <li v-for="n in 3" :key="n" class="dm-item">
        <span class="dm-ico sk" />
        <span class="dm-text"><b class="sk sk-w180">Reached level 00</b><small class="sk sk-w120">Skill · 0 days ago</small></span>
      </li>
    </ul>
  </section>

  <section v-else-if="kind === 'goals'" class="card dash-card dash-sk" aria-busy="true" aria-labelledby="dash-goals-sk">
    <header class="dash-card-head">
      <h2 id="dash-goals-sk">Goals</h2>
      <span class="dash-more sk sk-w80">All goals</span>
    </header>
    <ul class="dash-goals" aria-hidden="true">
      <li v-for="n in 3" :key="n" class="dash-goal">
        <span class="sk sk-icon26" />
        <div class="dash-goal-main">
          <div class="dash-goal-top"><b class="sk sk-w180">Skill to level 99</b><span class="dash-goal-pct sk sk-w40">00%</span></div>
          <div class="dash-bar"><i class="sk" style="width: 45%" /></div>
          <small class="sk sk-w140">0,000,000 XP to go</small>
        </div>
      </li>
    </ul>
  </section>
</template>

<script setup>
defineProps({
  // head | week | clans | plans | next | following | milestones | goals
  kind: { type: String, required: true },
})

// A week of bars of different heights reads as a chart, not a block.
const BAR_HEIGHTS = [35, 60, 25, 80, 50, 40, 65]
</script>
