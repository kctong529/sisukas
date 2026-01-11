import { mount } from 'svelte'
import App from './App.svelte'
import AuthCallback from './pages/AuthCallback.svelte'

const path = window.location.pathname;
const target = document.getElementById("app")!;

if (path === "/auth/callback") {
  mount(AuthCallback, { target });
} else {
  mount(App, { target });
}
