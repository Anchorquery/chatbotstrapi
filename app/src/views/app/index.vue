<template>
	<app-layout>
	<transition name="fade" mode="out-in">
			<router-view />
	</transition>
	</app-layout>
</template>

<script>
import AppLayout from "/@/layouts/AppLayout.vue";
// Nombre de transiciones 1-) slither
export default {
	components: {
			"app-layout": AppLayout
	}
};
</script>
