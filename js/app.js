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

    // 3. Trigger Modal Bienvenida (Solo si es nueva sesión tras login)
    if (!sessionStorage.getItem('welcomeModalShown')) {
        setTimeout(() => {
            mostrarModalBienvenida(window.userProfile);
            sessionStorage.setItem('welcomeModalShown', 'true');
        }, 500);
    }
}

// Iconos por Rol
const ROL_ICONS = {
    'admin': 'crown',
    'administracion': 'crown',
    'ventas': 'tags',
    'deposito': 'box-seam',
    'invitado': 'user'
};

async function cargarPerfilUsuario(userId, email) {
    try {
        const { data: perfil, error } = await _supabase
            .from('perfiles')
            .select('*')
            .eq('id', userId)
            .single();

        if (error) throw error;

        // Guardar en caché global para acceso rápido
        window.userProfile = perfil;

        // Actualizar UI en Vista (Header de Inicio si existe)
        actualizarSaludoHeader();

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
    if (container && container.innerText.trim().length === 0) {
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
document.addEventListener('DOMContentLoaded', async function () {
    console.log('🚀 HaruwenWMS iniciado correctamente');

    // Verificar si estamos en el dashboard
    if (window.location.pathname.includes('dashboard.html')) {
        await checkUser();
        globalNotificador(); // Carga inicial de avisos
    }
});

// ==========================================
// FUNCIONES AUXILIARES GLOBALES
// ==========================================

/**
 * Monitor global de notificaciones (Badges)
 */
async function globalNotificador() {
    const rol = window.currentUserRole;
    if (rol !== 'admin' && rol !== 'administracion') return;

    try {
        const { count } = await _supabase
            .from('pagos')
            .select('id', { count: 'exact' })
            .eq('estado', 'pendiente');

        // Actualizar Badge en Sidebar (Función definida en dashboard_admin.js o replicada)
        const menuItem = document.getElementById('menu-cobranzas');
        if (menuItem) {
            let badge = menuItem.querySelector('.nav-badge');
            if (!badge) {
                badge = document.createElement('span');
                badge.className = 'nav-badge absolute top-1 right-2 w-5 h-5 bg-rose-500 text-white text-[9px] font-black flex items-center justify-center rounded-full border-2 border-slate-900 shadow-lg hidden';
                menuItem.style.position = 'relative';
                menuItem.appendChild(badge);
            }
            if (count > 0) {
                badge.innerText = count;
                badge.classList.remove('hidden');
            } else {
                badge.classList.add('hidden');
            }
        }
    } catch (e) { console.error("Error en notificador:", e); }
}

// Ejecutar cada 2 minutos
setInterval(globalNotificador, 120000);

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

// ==========================================
// MOTOR DE MICRO-ANIMACIONES Y FEEDBACK (Logística de Alta Gama)
// ==========================================

const FeedbackLogistico = {
    /**
     * Éxito en Escaneo: Brillo verde y check animado
     */
    playScannerSuccess: () => {
        // Overlay de pulso verde
        const overlay = document.createElement('div');
        overlay.className = 'fixed inset-0 z-[9999] pointer-events-none flex items-center justify-center border-[20px] border-emerald-500/30 animate-pulse';
        overlay.innerHTML = `
            <div class="bg-emerald-500 text-white w-24 h-24 rounded-full flex items-center justify-center shadow-2xl animate-fade-up">
                <i class="fas fa-check text-5xl"></i>
            </div>
        `;
        document.body.appendChild(overlay);

        // La Patitita "Cute" (Efecto Sello)
        const paw = document.createElement('div');
        paw.className = 'fixed z-[10000] pointer-events-none text-emerald-600/40 animate-paw';
        paw.style.left = (Math.random() * 40 + 30) + '%';
        paw.style.top = (Math.random() * 40 + 30) + '%';
        paw.innerHTML = `<i class="fas fa-paw text-8xl"></i>`;
        document.body.appendChild(paw);

        setTimeout(() => {
            overlay.classList.add('opacity-0', 'transition-opacity', 'duration-500');
            setTimeout(() => { overlay.remove(); paw.remove(); }, 500);
        }, 800);
    },

    /**
     * Error FEFO: Vibración roja (Shake)
     */
    playErrorFEFO: (targetId) => {
        const el = document.getElementById(targetId);
        if (el) {
            el.classList.add('animate-shake', 'ring-4', 'ring-rose-500', 'border-rose-500');
            setTimeout(() => el.classList.remove('animate-shake', 'ring-4', 'ring-rose-500', 'border-rose-500'), 1000);
        }
        if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
    }
};

const FeedbackFinanciero = {
    /**
     * Vuelo de Bolsa: Simula el movimiento de mercadería al depósito
     */
    animarVueloBolsa: () => {
        const bag = document.createElement('div');
        bag.innerHTML = `
            <div class="relative w-16 h-16 bg-white rounded-2xl shadow-2xl border border-indigo-100 flex items-center justify-center overflow-hidden">
                <i class="fas fa-box text-indigo-600 text-3xl"></i>
                <div class="absolute inset-0 bg-indigo-500/10 animate-pulse"></div>
            </div>
        `;
        bag.className = 'fixed z-[10000] pointer-events-none transform-gpu transition-all duration-1000 ease-in-out';
        bag.style.left = '50%';
        bag.style.top = '50%';
        bag.style.transform = 'translate(-50%, -50%) scale(2)';
        document.body.appendChild(bag);

        // Retardo para iniciar vuelo
        setTimeout(() => {
            const target = document.getElementById('menu-movimientos');
            const rect = target ? target.getBoundingClientRect() : { top: 0, left: 0 };

            bag.style.left = (rect.left + 24) + 'px';
            bag.style.top = (rect.top + 24) + 'px';
            bag.style.transform = 'translate(0, 0) scale(0.2) rotate(720deg)';
            bag.style.opacity = '0';
        }, 100);

        setTimeout(() => bag.remove(), 1100);
    }
};

// ==========================================
// CERRAR SESIÓN (Logout Centralizado)
// ==========================================
async function cerrarSesion() {
    try {
        const { error } = await _supabase.auth.signOut();
        if (error) throw error;

        // Limpieza de datos locales
        localStorage.clear();
        sessionStorage.clear();

        // Redirección con limpieza de historial
        if (window.location.pathname.includes('/pages/')) {
            window.location.replace("../index.html");
        } else {
            window.location.replace("index.html");
        }

    } catch (err) {
        console.error("Error al cerrar sesión:", err);
        window.location.reload();
    }
}

// ==========================================
// ACTUALIZACIÓN DINÁMICA DE BIENVENIDA
// ==========================================
function actualizarSaludoHeader() {
    const perfil = window.userProfile;
    if (!perfil) return;

    const elFirstName = document.getElementById("user-first-name");
    const elLastName = document.getElementById("user-last-name");
    const elRole = document.getElementById("global-role-text");
    const elDate = document.getElementById("global-current-date");
    const elIconMobile = document.getElementById("role-icon-mobile");

    const rolKey = (perfil.rol || 'invitado').toLowerCase();
    const iconClass = ROL_ICONS[rolKey] || 'user';

    if (perfil.nombre) {
        const partes = perfil.nombre.split(' ');
        const nombre = partes[0] || "";
        const apellido = partes.slice(1).join(' ') || "";

        if (elFirstName) {
            if (elFirstName.innerText === "Cargando..." || elFirstName.innerText === "") {
                efectoTypewriter(nombre, "user-first-name");
            } else {
                elFirstName.innerText = nombre;
            }
        }
        if (elLastName) elLastName.innerText = apellido;
    }

    if (elRole) elRole.innerText = perfil.rol || "Usuario";
    if (elIconMobile) elIconMobile.className = `fas fa-${iconClass} text-[10px] text-indigo-400 md:hidden`;

    if (elDate) {
        // En mobile (ventana pequeña) mostramos fecha corta y hora
        const ahora = new Date();
        const esMobile = window.innerWidth < 768;
        const opciones = esMobile
            ? { day: 'numeric', month: 'short' }
            : { weekday: 'long', day: 'numeric', month: 'long' };

        let fechaStr = ahora.toLocaleDateString('es-AR', opciones).toUpperCase();
        if (esMobile) fechaStr = fechaStr.replace('.', ''); // Limpiar puntos de abr.

        const horaStr = ahora.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
        elDate.innerText = `${fechaStr} - ${horaStr}`;
    }
}

// ==========================================
// LÓGICA DEL MODAL DE BIENVENIDA
// ==========================================
function mostrarModalBienvenida(perfil) {
    const modal = document.getElementById('welcome-modal');
    if (!modal) return;

    const elName = document.getElementById('modal-user-name');
    const elRole = document.getElementById('modal-user-role');
    const elIcon = document.getElementById('modal-role-icon-container');

    if (perfil) {
        if (elName) elName.innerText = `Hola, ${perfil.nombre?.split(' ')[0] || 'Usuario'}`;
        if (elRole) elRole.innerText = `Acceso ${perfil.rol || 'Usuario'} Pro`;

        const rolKey = (perfil.rol || 'invitado').toLowerCase();
        const iconClass = ROL_ICONS[rolKey] || 'user';
        if (elIcon) elIcon.innerHTML = `<i class="fas fa-${iconClass}"></i>`;
    }

    modal.classList.remove('hidden');
    modal.classList.add('flex');
    document.body.style.overflow = 'hidden'; // Bloquear scroll
}

function cerrarModalBienvenida() {
    const modal = document.getElementById('welcome-modal');
    if (!modal) return;

    modal.classList.add('animate-fadeOut');
    setTimeout(() => {
        modal.classList.remove('flex');
        modal.classList.add('hidden');
        modal.classList.remove('animate-fadeOut');
        document.body.style.overflow = ''; // Habilitar scroll

        // Disparar confeti logístico si el navegador lo permite (opcional)
        FeedbackLogistico.playScannerSuccess();
    }, 500);
}

// ==========================================
// EFECTO TYPEWRITER (Escritura Dinámica)
// ==========================================
function efectoTypewriter(texto, elementoId) {
    const el = document.getElementById(elementoId);
    if (!el) return;

    el.innerText = "";
    let i = 0;
    const speed = 50;

    function type() {
        if (i < texto.length) {
            el.innerText += texto.charAt(i);
            i++;
            setTimeout(type, speed);
        }
    }
    type();
}
