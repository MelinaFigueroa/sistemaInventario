// js/config.js
const _supabase = supabase.createClient(
    "https://omylruckqvesemrlomed.supabase.co",
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9teWxydWNrcXZlc2VtcmxvbWVkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAxNDE0MjIsImV4cCI6MjA4NTcxNzQyMn0.uWe09wGzCnYtIXPXTfhE7Z59iNda2YHjcqFBtKmcopU" 
);

let itemsPedidoTemporal = [];
let USUARIO_ACTUAL = "Sistema";

const Notificar = {
    toast(mensaje, icono = 'success') {
        Swal.fire({
            text: mensaje, icon: icono, toast: true, position: 'top-end',
            showConfirmButton: false, timer: 3000, timerProgressBar: true
        });
    },
    error(titulo, mensaje) {
        Swal.fire({
            title: titulo, text: mensaje, icon: 'error',
            confirmButtonColor: '#4f46e5', confirmButtonText: 'ENTENDIDO'
        });
    },
    exito(titulo, mensaje) {
        Swal.fire({
            title: titulo, html: mensaje, icon: 'success', confirmButtonColor: '#4f46e5'
        });
    }
};