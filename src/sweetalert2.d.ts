// Import JS without runtime CSS injection; Vite bundles the stylesheet separately.
declare module 'sweetalert2/dist/sweetalert2.esm.js' {
  export { default } from 'sweetalert2';
}
