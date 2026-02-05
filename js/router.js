// js/router.js - Sistema de Navegación SPA Avanzado

/**
 * Carga una página dinámicamente con soporte para Historial, Breadcrumbs y Lazy Loading
 */
async function loadPage(pageUrl, saveHistory = true) {
    // 0. Seguridad: Validar permisos antes de procesar
    if (typeof tienePermiso === 'function' && !tienePermiso(pageUrl)) {
        renderAccesoDenegado();
        return;
    }

    const container = document.getElementById("view-container");
    if (!container) return;

    // Loader Premium
    container.innerHTML = `
        <div class="flex flex-col items-center justify-center py-24 animate-pulse">
            <div class="w-16 h-16 border-4 border-indigo-500/20 border-t-indigo-600 rounded-full animate-spin"></div>
            <p class="mt-4 font-black uppercase italic text-[10px] text-slate-400 tracking-widest leading-loose">Sincronizando Depósito...</p>
        </div>
    `;

    try {
        const fullUrl = pageUrl.includes('/') ? pageUrl : `./${pageUrl}`;
        const response = await fetch(fullUrl);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

        const content = await response.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(content, "text/html");

        // Inyectar contenido
        container.innerHTML = doc.querySelector("main") ? doc.querySelector("main").innerHTML : content;

        // 1. Manejo de Historial (Browser Support)
        if (saveHistory) {
            history.pushState({ page: pageUrl }, "", `#${pageUrl.replace('.html', '')}`);
        }

        // 2. Actualizar Breadcrumbs
        actualizarBreadcrumbs(pageUrl);

        // 3. Lazy Loading de Módulos (Carga bajo demanda)
        await cargarModulosNecesarios(pageUrl);

        // 4. Inicializar UI
        if (typeof closeSidebar === 'function') closeSidebar();
        if (typeof actualizarVisibilidadFABs === 'function') actualizarVisibilidadFABs(pageUrl);

        // Disparar lógica de cada módulo
        ejecutarInicializadores(pageUrl);

    } catch (error) {
        console.error(error);
        container.innerHTML = `
            <div class="py-20 text-center">
                <i class="fas fa-exclamation-triangle text-4xl text-rose-500 mb-4"></i>
                <p class="font-black text-slate-800 uppercase italic">Error de Conexión</p>
                <p class="text-xs text-slate-400 mt-2">No se pudo cargar la vista: ${pageUrl}</p>
            </div>
        `;
    }
}

/**
 * Escucha el botón de "Atrás" del navegador
 */
window.onpopstate = function (event) {
    if (event.state && event.state.page) {
        loadPage(event.state.page, false);
    } else {
        loadPage('inicio.html', false);
    }
};

/**
 * Sistema dinámico de Breadcrumbs
 */
function actualizarBreadcrumbs(pageUrl) {
    const breadContainer = document.getElementById("breadcrumb-container");
    if (!breadContainer) return;

    const nombrePagina = pageUrl.replace('.html', '').toUpperCase();
    const mapping = {
        'inicio': 'Dashboard',
        'pedidos': 'Gestión de Pedidos',
        'facturacion': 'Administración > Ventas',
        'cobranzas': 'Caja > Registrar Cobranza',
        'recepcion': 'Logística > Recepción',
        'posiciones': 'Mapa > Almacenamiento',
        'inventario': 'Stock > Inventario Real',
        'movimientos': 'Auditoría > Trazabilidad',
        'consulta': 'Buscador Pro'
    };

    const label = mapping[nombrePagina.toLowerCase()] || nombrePagina;

    breadContainer.innerHTML = `
        <div class="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-slate-400 italic">
            <span class="hover:text-indigo-600 cursor-pointer" onclick="loadPage('inicio.html')">HARUWEN</span>
            <i class="fas fa-chevron-right text-[8px] opacity-30"></i>
            <span class="text-indigo-600">${label}</span>
        </div>
    `;
}

/**
 * Carga scripts solo cuando se necesitan
 */
const scriptsCargados = new Set();
async function cargarModulosNecesarios(pageUrl) {
    const mapping = {
        'inicio.html': ['../js/dashboard_admin.js', '../js/finanzas.js'],
        'facturacion.html': ['../js/finanzas.js'],
        'cobranzas.html': ['../js/finanzas.js'],
        'clientes.html': ['../js/finanzas.js'],
        'consulta.html': ['../js/consulta.js']
    };

    const scripts = mapping[pageUrl];
    if (scripts) {
        for (const src of scripts) {
            if (!scriptsCargados.has(src)) {
                await new Promise((resolve) => {
                    const script = document.createElement('script');
                    script.src = src;
                    script.onload = resolve;
                    document.body.appendChild(script);
                    scriptsCargados.add(src);
                });
            }
        }
    }
}

function ejecutarInicializadores(pageUrl) {
    if (pageUrl.includes("posiciones")) renderPosiciones();
    if (pageUrl.includes("pedidos")) renderPedidos();
    if (pageUrl.includes("facturacion")) renderFacturacion();
    if (pageUrl.includes("clientes")) renderClientes();
    if (pageUrl.includes("inicio")) actualizarDashboard();
    if (pageUrl.includes("movimientos")) renderMovimientos();
    if (pageUrl.includes("inventario")) renderInventario();
    if (pageUrl.includes("recepcion")) prepararRecepcion();
}

/**
 * Vista de Acceso Denegado Premium
 */
function renderAccesoDenegado() {
    const container = document.getElementById("view-container");
    container.innerHTML = `
        <div class="flex flex-col items-center justify-center py-20 animate-fadeIn">
            <div class="w-24 h-24 bg-rose-50 rounded-full flex items-center justify-center mb-6 shadow-inner">
                <i class="fas fa-user-lock text-4xl text-rose-500"></i>
            </div>
            <h2 class="text-2xl font-black text-slate-800 uppercase italic tracking-tighter">Acceso Restringido</h2>
            <p class="text-slate-400 font-bold text-xs mt-2 text-center max-w-xs uppercase italic tracking-wider">
                Tu perfil actual no posee las credenciales para operar en esta terminal.
            </p>
            <button onclick="loadPage('inicio.html')" 
                class="mt-8 px-8 py-4 bg-slate-900 text-white rounded-2xl font-black uppercase italic text-xs tracking-widest shadow-xl active:scale-95 transition-all">
                Volver al Dashboard
            </button>
        </div>
    `;
    Notificar.error("ERROR DE NIVEL", "No tenés permiso para este módulo.");
}