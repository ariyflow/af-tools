import '@fontsource-variable/inter'
import './styles/main.css'
import { createApp } from 'vue'
import App from './App.vue'
import { router } from './router'
import { i18n, getInitialLocale } from './i18n'
import { initTheme } from './composables/useTheme'

initTheme()
document.documentElement.lang = getInitialLocale()

createApp(App).use(router).use(i18n).mount('#app')
