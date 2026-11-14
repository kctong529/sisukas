import "./polyfills";

import "./styles/tokens.css";
import "./styles/primitives.css";
import 'bootstrap-icons/font/bootstrap-icons.css'

import { mount } from 'svelte'
import { registerSW } from 'virtual:pwa-register'

import App from './App.svelte'
import AuthVerify from './pages/AuthVerify.svelte'

const path = window.location.pathname;
const target = document.getElementById("app")!;
registerSW({ immediate: true })

if (path === "/auth/verify") {
  mount(AuthVerify, { target });
} else {
  mount(App, { target });
}
