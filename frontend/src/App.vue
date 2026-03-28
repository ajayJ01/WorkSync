<template>
  <router-view />
   <ChatBot v-if="!route.meta.hideChatbot" />
</template>

<script setup>
import { useRoute } from 'vue-router'
import ChatBot from "@/components/ChatBot.vue";

const route = useRoute()
</script>

<style scoped>  
body {
  background-color: #f8f9fa;
}

.nav-link.active {
  background-color: #0d6efd;
  border-radius: 5px;
  font-weight: bold;
}
</style>
