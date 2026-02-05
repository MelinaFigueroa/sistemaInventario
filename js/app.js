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
        if (window.location.pathname.includes('/pages/')) {
            window.location.href = "../index.html";
        } else {
            window.location.href = "index.html";
        }
        return;
    }

    // 1. Cargar Perfil y Permisos
    await cargarPerfilUsuario(user.id, user.email);

    // 2. Actualizar UI General
    USUARIO_ACTUAL = user.email?.split('@')[0] || "Usuario";
    const elementoGreeting = document.getElementById("user-header-greeting");
    if (elementoGreeting) {
        elementoGreeting.innerText = `Bienvenida/o, ${USUARIO_ACTUAL}`;
    }
}

async function cargarPerfilUsuario(userId, email) {
    try {
        const { data: perfil, error } = await _supabase
            .from('perfiles')
            .select('*')
            .eq('id', userId)
            .single();

        if (error) throw error;

        // Actualizar Card de Usuario
        const elementoNombre = document.getElementById("user-sidebar-name");
        const elementoRol = document.querySelector(".text-indigo-400.font-black.uppercase"); // El label de rol en el card

        if (elementoNombre) {
            // Si el perfil tiene nombre, usarlo, sino el email
            elementoNombre.innerText = perfil.nombre || email;
        }

        if (elementoRol) {
            elementoRol.innerText = perfil.rol || "Usuario";
        }

        // Aplicar restricciones visuales
        aplicarPermisosSidebar(perfil.rol);

    } catch (err) {
        console.error("Error cargando perfil:", err);
        // Fallback básico si falla la tabla perfiles
        aplicarPermisosSidebar('invitado');
    }
}

// Variable global para persistir el rol
window.currentUserRole = 'invitado';

function aplicarPermisosSidebar(rol) {
    window.currentUserRole = rol?.toLowerCase() || 'invitado';

    const menuIds = [
        'menu-dashboard', 'menu-consulta', 'menu-pedidos',
        'menu-facturacion', 'menu-clientes', 'menu-recepcion',
        'menu-posiciones', 'menu-inventario', 'menu-movimientos'
    ];

    menuIds.forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;

        if (tienePermiso(id)) {
            el.classList.remove('hidden');
        } else {
            el.classList.add('hidden');
        }
    });

    // Forzar renderizado inicial si el dashboard está vacío
    const container = document.getElementById('view-container');
    if (container && container.innerHTML.includes('fa-paw')) {
        loadPage('inicio.html');
    }
}

// Función centralizada de seguridad
function tienePermiso(idOMenu) {
    const rol = window.currentUserRole;

    // Mapeo unificado: ID de Menú -> Página HTML relacionada
    const permisos = {
        'admin': ['*'], // Comodín para todo
        'administracion': ['menu-dashboard', 'menu-consulta', 'menu-pedidos', 'menu-facturacion', 'menu-cobranzas', 'menu-clientes', 'menu-inventario', 'menu-movimientos', 'inicio.html', 'consulta.html', 'pedidos.html', 'facturacion.html', 'cobranzas.html', 'clientes.html', 'inventario.html', 'movimientos.html'],
        'ventas': ['menu-dashboard', 'menu-consulta', 'menu-pedidos', 'menu-cobranzas', 'menu-clientes', 'menu-inventario', 'inicio.html', 'consulta.html', 'pedidos.html', 'cobranzas.html', 'clientes.html', 'inventario.html'],
        'deposito': ['menu-dashboard', 'menu-consulta', 'menu-pedidos', 'menu-recepcion', 'menu-posiciones', 'menu-inventario', 'menu-movimientos', 'inicio.html', 'consulta.html', 'pedidos.html', 'recepcion.html', 'posiciones.html', 'inventario.html', 'movimientos.html'],
        'invitado': ['menu-dashboard', 'menu-consulta', 'inicio.html', 'consulta.html']
    };

    const misAccesos = permisos[rol] || permisos['invitado'];

    if (misAccesos.includes('*')) return true;

    // El idOMenu puede ser el ID del <li> o el nombre del archivo .html
    return misAccesos.includes(idOMenu);
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
