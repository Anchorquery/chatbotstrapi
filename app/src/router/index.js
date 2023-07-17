import { createRouter, createWebHashHistory, createWebHistory } from 'vue-router';

import {useAuthStore} from '/@/store/index.js';


const routes = [
  {
    path: '/',
    name: 'Home',
    component: () => import('/@/views/Home.vue'),
    config: {
      title: 'Chat',

    },
    meta: {
      authenticated: true,
    }
  },
  {
    path: '/login',
    name: 'login',
    component: () => import('/@/views/login/index.vue'),
    config: {
      title: 'Login',

    },
    meta: {
      free: true,
    }
  },
];





 const Router = createRouter({
  scrollBehavior: () => ({ left: 0, top: 0 }),
  // activo hash modo hash
  
  history: createWebHashHistory(),

  routes,
});



Router.beforeEach((to, from, next) => {

  document.title = to.title || "EOOS";

  

  const user = localStorage.getItem('x') || null;

  // accedo al store de auth para sacar el currentUser






  if (to.matched.some(record => record.meta.free)) {

    next();
  } else if ( user  ) {
    if (to.matched.some(record => record.meta.authenticated)) {
      next();
    }
  } else {
    
    next({ name: "login" });
  }
});




export default Router;



