import { mount } from 'svelte'
import "./polyfills";
import { registerSW } from 'virtual:pwa-register'
import App from './App.svelte'
import AuthVerify from './pages/AuthVerify.svelte'
import 'bootstrap-icons/font/bootstrap-icons.css'

const path = window.location.pathname;
const target = document.getElementById("app")!;
registerSW({ immediate: true })

if (path === "/auth/verify") {
  mount(AuthVerify, { target });
} else {
  mount(App, { target });
}
