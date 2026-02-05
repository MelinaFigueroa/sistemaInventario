// ==========================================
// HaruwenWMS - Sistema de Gestión de Inventario
// app.js - Archivo principal (limpio y modular)
// ==========================================

// NOTA: Este archivo debe cargarse DESPUÉS de todos los módulos
// Orden de carga en HTML:
// 1. config.js (Supabase, variables globales)
// 2. router.js (SPA navigation)
// 3. renders.js (funciones de renderizado)
// 4. ui.js (modales, drawers, UI)
// 5. pedidos.js (lógica de pedidos)
// 6. recepcion.js (recepción de mercadería)
// 7. movimientos.js (trazabilidad)
// 8. app.js (este archivo - inicialización)

// ==========================================
// FUNCIONES DE INICIALIZACIÓN
// ==========================================
async function checkUser() {
    const { data: { user } } = await _supabase.auth.getUser();

    if (!user) {
        // Si estamos en una página dentro de /pages/, redirigir al index.html raíz
        if (window.location.pathname.includes('/pages/')) {
            window.location.href = "../index.html";
        } else {
            window.location.href = "index.html";
        }
        return;
    }

    // Actualizar UI con info del usuario
    USUARIO_ACTUAL = user.email?.split('@')[0] || "Usuario";
    const elementoNombre = document.getElementById("user-sidebar-name");
    const elementoGreeting = document.getElementById("user-header-greeting");
    const elementoInitial = document.getElementById("user-sidebar-initial");

    if (elementoNombre) {
        elementoNombre.innerText = user.email || "Usuario";
    }

    if (elementoGreeting) {
        elementoGreeting.innerText = `Bienvenida/o, ${USUARIO_ACTUAL}`;
    }

    if (elementoInitial) {
        elementoInitial.innerText = USUARIO_ACTUAL.charAt(0).toUpperCase();
    }
}

// ==========================================
// INICIALIZACIÓN AL CARGAR LA PÁGINA
// ==========================================
document.addEventListener('DOMContentLoaded', function () {
    console.log('🚀 HaruwenWMS iniciado correctamente');

    // Verificar si estamos en el dashboard
    if (window.location.pathname.includes('dashboard.html')) {
        checkUser();
    }
});

// ==========================================
// FUNCIONES AUXILIARES GLOBALES
// ==========================================

// Formatear fecha para mostrar en UI
function formatearFecha(fecha) {
    return new Date(fecha).toLocaleDateString('es-AR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    });
}

// Formatear moneda
function formatearMoneda(monto) {
    return new Intl.NumberFormat('es-AR', {
        style: 'currency',
        currency: 'ARS'
    }).format(monto);
}

// Log de debug (solo en desarrollo)
function debug(mensaje, datos = null) {
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        console.log(`[DEBUG] ${mensaje}`, datos || '');
    }
}
