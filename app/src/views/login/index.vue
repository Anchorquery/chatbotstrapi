<template>
	<v-container>
			<v-row justify="center">
					<v-col cols="12" sm="8" md="6">
							<v-card>
									<v-card-title class="text-center">Iniciar sesión</v-card-title>
									<v-card-text>
											<v-form @submit.prevent="login">
													<v-text-field
															v-model="email"
															label="Correo electrónico"
															required
															:rules="emailRules"
													></v-text-field>
													<v-text-field
															v-model="password"
															label="Contraseña"
															type="password"
															required
															:rules="passwordRules"
													></v-text-field>
													<v-btn type="submit" color="primary">Iniciar sesión</v-btn>
											</v-form>
									</v-card-text>
							</v-card>
					</v-col>
			</v-row>
	</v-container>
</template>

<script>

import { defineComponent, computed,ref  } from 'vue'
import { useAuthStore } from '/@/store/index.js'
//import { useRouter } from 'vue-router';

export default defineComponent({
  setup() {
    const email = ref('daniel@adaki.net');
    const password = ref('Daniel1995=');
				const authStore = useAuthStore();
    const emailRules = [
      value => !!value || 'El correo electrónico es obligatorio',
      value => /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/.test(value) || 'El correo electrónico debe ser válido',
    ];
    const passwordRules = [
      value => !!value || 'La contraseña es obligatoria',
      value => value.length >= 8 || 'La contraseña debe tener al menos 8 caracteres',
    ];

 //   const router = useRouter();

   async function  login() {

					// vvalido las reglas de validacion
						if (!emailRules.every(rule => rule(email.value, true) === true)) {
								return;
						}
						if (!passwordRules.every(rule => rule(password.value, true) === true)) {
								return;
						}

					await authStore.login(email.value, password.value);
   
    }

    return {
      email,
      password,
      emailRules,
      passwordRules,
      login,
    };
  },
});
</script>






