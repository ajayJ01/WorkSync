import { createApp } from 'vue'
import './assets/ws-dashboard-shell.css'
import 'bootstrap/dist/css/bootstrap.min.css'
import 'bootstrap/dist/js/bootstrap.bundle.min.js'
import App from './App.vue'
import router from './router'
import { createPinia } from 'pinia'
import ToastPlugin from 'vue-toast-notification'
import 'vue-toast-notification/dist/theme-bootstrap.css'

const toastOptions = {
  position: 'top-right',
  duration: 3000,
  dismissible: true,
  pauseOnHover: true,
  queue: false,
}

const app = createApp(App)

app.use(createPinia())
app.use(router)
app.use(ToastPlugin, toastOptions)

app.mount('#app')
