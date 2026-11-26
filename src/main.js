import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import './assets/main.css'
import { watchInteraction } from './utils/analytics'

createApp(App).use(createPinia()).use(router).mount('#app')
watchInteraction()
