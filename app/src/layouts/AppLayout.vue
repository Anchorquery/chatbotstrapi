<template>
  <v-app>
  <v-content>
  
    <topnav />
    <slot></slot>
 
</v-content>
</v-app>
</template>

<script>
import Topnav from "/@/components/Topnav.vue";

export default {
  components: {
    topnav: Topnav,
  },
  data() {},
  computed: {},
  methods: {},
};
</script>
<style>
main {
  margin-top: 100px;
}
@media only screen and (min-width: 1600px) {
  main {
    margin-top: 120px;
  }
  .sub-hidden main,
  .menu-sub-hidden main,
  .menu-hidden main {
    margin-left: 225px;
  }
}
@media only screen and (min-width: 1440px) {
  main {
    margin-top: 120px;
  }
  .sub-hidden main,
  .menu-sub-hidden main,
  .menu-hidden main {
    margin-left: 225px;
  }
}
</style>
