import { mount } from 'svelte'
<<<<<<< HEAD
import App from './App.svelte'
import AuthVerify from './pages/AuthVerify.svelte'

const path = window.location.pathname;
const target = document.getElementById("app")!;

if (path === "/auth/verify") {
  mount(AuthVerify, { target });
} else {
  mount(App, { target });
}
=======
import './app.css'
import App from './App.svelte'

const app = mount(App, {
  target: document.getElementById('app')!,
})

export default app
>>>>>>> main
