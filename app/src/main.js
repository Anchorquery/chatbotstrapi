import { createApp } from 'vue'
import './style.css'
import App from './App.vue'
import  Router  from '/@/router' ;

import vuetify from '/@/plugins/vuetify';
import { createPinia }from 'pinia';

import axios from '/@/plugins/axios';

createApp(App).use(vuetify).use(Router).use(createPinia()).mount('#app')


