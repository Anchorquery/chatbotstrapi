import { defineStore } from 'pinia';
import axios from 'axios';
import router from '/@/router';

export const useAuthStore = defineStore('auth', {
  state: () => ({
    currentUser: localStorage.getItem('x') || null,
    authorization: localStorage.getItem('authorization') || null,
    loginError: null,
    processing: false,
    registerError: null,
    forgotMailSuccess: null,
    resetPasswordSuccess: null,
  }),
  getters: {
    currentUser: (state) => state.currentUser,
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

    async login(payload) {
      try {
        this.clearError();
        this.setProcessing(true);

        const { data } = await axios.post('auth/local', {
          identifier: payload.email,
          password: payload.password,
        });

        if (!data.first_login) {
          const header = {
            Authorization: `Bearer ${data.jwt}`,
          };
          const setting = { headers: header };

          await axios.put(`users/${data.user.id}`, { first_login: true }, setting);
        }

        this.guardarToken(data.jwt);
        this.guardarUser(data.user);

        if (data.user.role.id === '1' || data.user.role.id === '3') {
          router.push({ name: 'home' });
        } else {
          router.push({ name: 'home' });
        }
      } catch (err) {
        console.log(err);
        if (err.response) {
          if (err.response.status === 500) {
            const e = err.response.data;
            this.setError(e);
            return;
          } else {
            const e = err.response.data;
            this.setError(e);
            return;
          }
        } else if (err.request) {
          const e = 'Tiempo de espera excedido o solicitud no enviada, intente nuevamente';
          this.setError(e);
          return;
        } else {
          this.setError(err);
          return;
        }
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

        router.push({ name: 'home' });
      } catch (error) {
        console.log(error.error);
      }
    },
    signOut() {
      this.setToken(null);
      this.setUser(null);
      this.setLogout();

      localStorage.clear();
      router.push({ name: 'login' });


    },
    async forgotPassword(payload) {
      try {
        this.clearError();
        this.setProcessing(true);
        await axios.post('/auth/forgot-password', { email: payload.email });

        this.clearError();
        this.setForgotMailSuccess();
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
    clearError() {
      this.loginError = null;
      this.registerError = null;
    },
  },
});
