import { defineStore } from 'pinia';
import axios from 'axios';

import qs from 'qs';

axios.defaults.baseURL = 'http://localhost:1337/api';

import router from '/@/router';



export const  useAuthStore = defineStore( {
  id: 'auth',
  state: () => ({
    currentUser:  localStorage.getItem('x') ? JSON.parse(localStorage.getItem('x'))  : null,
    authorization: localStorage.getItem('authorization') || null,
    loginError: null,
    processing: false,
    registerError: null,
    forgotMailSuccess: null,
    resetPasswordSuccess: null,
  }),
  getters: {
    currentUser: function (state)  {
      console.log("Estado",state.currentUser);
      if (state.currentUser) {
        return JSON.parse(state.currentUser);
      }},
    delegacion: (state) =>
      !state.currentUser ? 'solar' : state.currentUser.delegacion,
    processing: (state) => state.processing,
    loginError: (state) => state.loginError,
    forgotMailSuccess: (state) => state.forgotMailSuccess,
    resetPasswordSuccess: (state) => state.resetPasswordSuccess,
    registerError: (state) => state.registerError,
    esMaster: (state) =>
      !state.currentUser
        ? false
        : state.currentUser.role.id === 1
        ? true
        : false,
    esDelegado: (state) =>
      !state.currentUser
        ? false
        : state.currentUser.role.id === 3
        ? true
        : false,
    esDistribuidor: (state) =>
      !state.currentUser
        ? false
        : state.currentUser.role.id === 4
        ? true
        : false,
    esDcoordinador: (state) =>
      !state.currentUser
        ? false
        : state.currentUser.role.id === 10
        ? true
        : false,
    esTecnico: (state) =>
      !state.currentUser
        ? false
        : state.currentUser.role.id === 5
        ? true
        : false,
    esSemi: (state) =>
      !state.currentUser
        ? false
        : state.currentUser.role.id === 9
        ? true
        : false,
    esAutoSat: (state) => state.currentUser?.autosat,
    logueado: (state) => !!state.currentUser,
  },
  actions: {

    setToken(payload) {
      this.$state.authorization = payload;
    },
    setUser(payload) {
      console.log(payload);
      this.$state.currentUser = payload;
      this.$state.processing = false;
      this.$state.loginError = null;
    },
    setLogout() {
      this.$state.currentUser = null;
      this.$state.processing = false;
      this.$state.loginError = null;
    },
    setProcessing(payload) {
      this.$state.processing = payload;
      this.$state.loginError = null;
      this.$state.registerError = null;
    },
    setError(payload) {
      console.log(payload);
      this.$state.loginError = payload;
      this.$state.currentUser = null;
      this.$state.processing = false;
    },
    setForgotMailSuccess() {
      this.$state.loginError = null;
      this.$state.currentUser = null;
      this.$state.processing = false;
      this.$state.forgotMailSuccess = true;
    },
    setRegisterError(payload) {
      this.$state.registerError = payload;
      this.$state.processing = false;
    },
    setResetPasswordSuccess() {
      this.$state.loginError = null;
      this.$state.currentUser = null;
      this.$state.processing = false;
      this.$state.resetPasswordSuccess = true;
    },
    clearError() {
      this.$state.loginError = null;
      this.$state.registerError = null;
    },

    async login(email, password) {
      try {
        this.clearError();
        this.setProcessing(true);



        
        let data = qs.stringify({
          'identifier': 'daniel@adaki.net',
          'password': 'Daniel1995=' 
        });

        let response = await axios.post('/auth/local', data, {

          headers: {

            'Content-Type': 'application/x-www-form-urlencoded'

          }

        });

        data = response.data;

        this.guardarToken(data.jwt);

        response = await axios.get('/users/me?populate=*', {

          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization' : `Bearer ${data.jwt}`
          
          }})



          data = response.data;

          this.guardarUser(data);

          window.axios=axios.defaults.headers.common['Authorization'] = `Bearer ${data.jwt}`;
        



          router.push({ name: 'Home' });

      } catch (err) {
        console.log(err);

        console.log(err.response);



        this.setError(err.response);

      }
    },
    guardarToken(payload) {
      try {
        this.setToken(payload);
        localStorage.setItem('authorization', payload);
      } catch (error) {
        console.log('error', error);
      }
    },
    guardarUser(payload) {
      try {
        this.setUser(payload);
        localStorage.setItem('x', JSON.stringify(payload));
      } catch (error) {
        console.log('error', error);
      }
    },
    async autoLogin() {
      try {
        const _t = localStorage.getItem('authorization');

        const header = { Authorization: `Bearer ${_t}` };
        const setting = { headers: header };

        const { data } = await axios.get('/users/me', setting);

        this.guardarToken(_t);
        this.guardarUser(data);

        Router.push({ name: 'home' });
      } catch (error) {
        console.log(error.error);
      }
    },
    signOut() {
      this.setToken(null);
      this.setUser(null);
      this.setLogout();

      localStorage.clear();
      Router.push({ name: 'login' });


    },
    async forgotPassword(payload) {
      try {
        this.clearError();
        this.setProcessing(true);
        await axios.post('/auth/forgot-password', { email: payload.email });

        this.clearError();
        this.setForgotMailSuccess();
      } catch (error) {

        const { data } = error.response;
        if (data) {
          data.message.forEach((err) => {
            err.messages.forEach((x) => {
              if (x.id === 'Auth.form.error.user.not-exist') {
                this.setError('El usuario no se encuentra registrado en la plataforma.');
              } else {
                this.setError(x.message);
              }
            });
          });
        }

        setTimeout(() => {
          this.clearError();
        }, 3000);
      }
    },
    async resetPassword(payload) {
      try {
        this.clearError();
        this.setProcessing(true);
        await axios.post('/auth/reset-password', {
          code: payload.resetPasswordCode,
          password: payload.newPassword,
          passwordConfirmation: payload.confirmationPassword,
        });

        this.clearError();
        this.setResetPasswordSuccess();
      } catch (error) {
        console.log(error);
        console.log(error.response);
        const { data } = error.response;
        if (data) {
          data.message.forEach((err) => {
            err.messages.forEach((x) => {
              if (x.id === 'Auth.form.error.user.not-exist') {
                this.setError('El usuario no se encuentra registrado en la plataforma.');
              } else {
                this.setError(x.message);
              }
            });
          });
        }

        setTimeout(() => {
          this.clearError();
        }, 3000);
      }
    },

  },
});
