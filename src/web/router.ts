import { createRouter, createWebHistory } from 'vue-router'
import HomePage from './pages/HomePage.vue'
import ToolPage from './pages/ToolPage.vue'
import NotFoundPage from './pages/NotFoundPage.vue'

export const router = createRouter({
  history: createWebHistory(),
  scrollBehavior: () => ({ top: 0 }),
  routes: [
    {
      path: '/',
      name: 'home',
      component: HomePage,
    },
    {
      path: '/tools/:toolId',
      name: 'tool',
      component: ToolPage,
      props: true,
    },
    {
      path: '/:pathMatch(.*)*',
      name: 'not-found',
      component: NotFoundPage,
    },
  ],
})
