// js/dashboard_admin.js - Inteligencia de Datos y Mando Central

/**
 * FUNCIÓN CENTRAL: Se dispara cuando el router carga 'inicio.html'
 */
async function actualizarDashboard() {
    // Verificamos si _supabase existe antes de arrancar para evitar pantalla blanca
    if (typeof _supabase === 'undefined') {
        console.error("CRÍTICO: _supabase no está definido. Revisá config.js");
        return;
    }

    const rol = (window.currentUserRole || "").toLowerCase();

    // 1. Mostrar/Ocultar secciones según Rol
    configurarVisibilidadSegunRol(rol);

    // 2. Cargar Datos Básicos (Comunes)
    renderizarFechaActual();
    if (typeof actualizarSaludoHeader === 'function') actualizarSaludoHeader();
    await cargarKpisStock();
    await cargarKpisLogistica();

    // 3. Cargar Datos Pro (Admin / Administracion / Ventas)
    // Agregamos 'ventas' a la condición y manejamos posibles acentos
    if (rol === 'admin' || rol === 'administracion' || rol === 'administración' || rol === 'ventas') {
        await cargarKpisFinancieros();
        await cargarFeedPagos();
        await cargarSaludCartera();
    }
}

/**
 * CONFIGURAR INTERFAZ SEGÚN PERFIL
 */
function configurarVisibilidadSegunRol(rol) {
    const adminKPIs = document.getElementById('admin-kpis');
    const adminFeed = document.getElementById('admin-feed');
    const accountingCard = document.getElementById('admin-accounting-card');
    const btnRecepcion = document.getElementById('btn-quick-recepcion');
    const btnCobranza = document.getElementById('btn-quick-cobranza');
    const btnInventario = document.getElementById('btn-quick-inventario');
    const btnMovimientos = document.getElementById('btn-quick-movimientos');
    const btnClientes = document.getElementById('btn-quick-clientes');
    const btnVentas = document.getElementById('btn-quick-ventas');
    const warehouseKPIs = document.getElementById('warehouse-kpis');

    // Manejo de normalización de roles
    const normalizedRol = rol.toLowerCase();

    // Reseteamos visibilidad base
    if (normalizedRol === 'admin' || normalizedRol === 'administracion' || normalizedRol === 'administración') {
        if (adminKPIs) adminKPIs.classList.remove('hidden');
        if (adminFeed) adminFeed.classList.remove('hidden');
        if (warehouseKPIs) warehouseKPIs.classList.remove('hidden');
        if (accountingCard) accountingCard.classList.remove('hidden');

        [btnRecepcion, btnCobranza, btnInventario, btnMovimientos, btnClientes, btnVentas].forEach(b => {
            if (b) b.classList.remove('hidden');
        });
    } else if (normalizedRol === 'ventas') {
        if (adminKPIs) {
            adminKPIs.classList.remove('hidden');
            const elEficiencia = document.getElementById('kpi-eficiencia')?.closest('div');
            if (elEficiencia) elEficiencia.classList.add('hidden');
        }
        if (adminFeed) adminFeed.classList.remove('hidden');

        if (warehouseKPIs) {
            warehouseKPIs.classList.remove('hidden');
            const elMovimientosCard = document.getElementById('kpi-movimientos-hoy')?.closest('.bg-white');
            if (elMovimientosCard) elMovimientosCard.classList.add('hidden');
        }

        if (accountingCard) accountingCard.classList.add('hidden');

        if (btnRecepcion) btnRecepcion.classList.add('hidden');
        if (btnCobranza) btnCobranza.classList.remove('hidden');
        if (btnInventario) btnInventario.classList.remove('hidden');
        if (btnMovimientos) btnMovimientos.classList.add('hidden');
        if (btnClientes) btnClientes.classList.remove('hidden');
        if (btnVentas) btnVentas.classList.remove('hidden');
    } else { // Depósito u otros
        if (adminKPIs) adminKPIs.classList.add('hidden');
        if (adminFeed) adminFeed.classList.add('hidden');
        if (warehouseKPIs) warehouseKPIs.classList.remove('hidden');
        if (accountingCard) accountingCard.classList.add('hidden');

        if (btnRecepcion) btnRecepcion.classList.remove('hidden');
        if (btnCobranza) btnCobranza.classList.add('hidden');
        if (btnInventario) btnInventario.classList.remove('hidden');
        if (btnMovimientos) btnMovimientos.classList.remove('hidden');
        if (btnClientes) btnClientes.classList.add('hidden');
        if (btnVentas) btnVentas.classList.add('hidden');
    }
}

/**
 * KPIS FINANCIEROS: Ventas Hoy y Pagos Pendientes con Animaciones
 */
async function cargarKpisFinancieros() {
    try {
        const hoy = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD local

        // 1. Facturas de Hoy (Filtrado por fecha local)
        const { data: facturas, error: errFact } = await _supabase
            .from('facturas')
            .select('total_final, created_at')
            .order('created_at', { ascending: false })
            .limit(1000);

        if (errFact) console.warn("Error leyendo facturas:", errFact.message);

        const totalVentas = facturas?.reduce((acc, f) => {
            if (!f.created_at) return acc;
            // Convertimos la fecha de Supabase (UTC) a fecha local (YYYY-MM-DD)
            const fechaLocal = new Date(f.created_at).toLocaleDateString('en-CA');
            if (fechaLocal === hoy) {
                return acc + (parseFloat(f.total_final) || 0);
            }
            return acc;
        }, 0) || 0;

        const elVentas = document.getElementById('kpi-ventas-hoy');
        if (elVentas) {
            const valorAnterior = parseFloat(elVentas.innerText.replace(/[^0-9.-]+/g, "")) || 0;
            animarValor('kpi-ventas-hoy', valorAnterior, totalVentas, true);
        }

        // 2. Pagos a Validar (Pendientes)
        const { count, error: errPagos } = await _supabase
            .from('pagos')
            .select('id', { count: 'exact' })
            .eq('estado', 'pendiente');

        if (errPagos) console.warn("Error leyendo pagos:", errPagos.message);

        const elPagosCount = document.getElementById('kpi-cobranzas-pendientes');
        if (elPagosCount) {
            const countAnterior = parseInt(elPagosCount.innerText) || 0;
            animarValor('kpi-cobranzas-pendientes', countAnterior, count || 0, false);
        }

        // 3. Eficiencia (Pedidos entregados hoy / Total hoy)
        const { data: pedidosStats } = await _supabase
            .from('pedidos')
            .select('estado, created_at')
            .order('created_at', { ascending: false })
            .limit(1000);

        const pedsHoy = pedidosStats?.filter(p => {
            if (!p.created_at) return false;
            return new Date(p.created_at).toLocaleDateString('en-CA') === hoy;
        }) || [];

        const entregadosHoy = pedsHoy.filter(p => p.estado === 'entregado').length || 0;
        const totalHoy = pedsHoy.length || 0;
        const eficiencia = totalHoy > 0 ? Math.round((entregadosHoy / totalHoy) * 100) : 0;

        const elEficiencia = document.getElementById('kpi-eficiencia');
        const elPercent = document.getElementById('efficiency-percent');
        if (elEficiencia) elEficiencia.innerText = `${entregadosHoy} / ${totalHoy} Peds.`;
        if (elPercent) elPercent.innerText = `${eficiencia}%`;

        actualizarBadgeSidebar(count || 0);
    } catch (err) { console.error("Error general en KPIs Financieros:", err); }
}

/**
 * ANIMACIÓN DE CONTADOR NUMÉRICO
 */
function animarValor(id, inicio, fin, esMoneda = false) {
    const obj = document.getElementById(id);
    if (!obj) return;
    if (inicio === fin) {
        obj.innerText = esMoneda ? formatearMoneda(fin) : fin;
        return;
    }

    let start = null;
    const duracion = 800;

    function step(timestamp) {
        if (!start) start = timestamp;
        const progreso = Math.min((timestamp - start) / duracion, 1);
        const valorActual = progreso * (fin - inicio) + inicio;

        obj.innerText = esMoneda ? formatearMoneda(valorActual) : Math.floor(valorActual);

        if (progreso < 1) {
            window.requestAnimationFrame(step);
        } else {
            obj.innerText = esMoneda ? formatearMoneda(fin) : fin;
        }
    }
    window.requestAnimationFrame(step);
}

/**
 * FEED DE PAGOS: Validación en Tiempo Real
 */
async function cargarFeedPagos() {
    const contenedor = document.getElementById('feed-pagos-pendientes');
    if (!contenedor) return;

    try {
        const { data: pagos, error } = await _supabase
            .from('pagos')
            .select(`
                id, monto, metodo_pago, created_at, comprobante_url,
                clientes ( nombre )
            `)
            .eq('estado', 'pendiente')
            .order('created_at', { ascending: false })
            .limit(5);

        if (error) {
            console.warn("Error en Feed Pagos:", error.message);
            contenedor.innerHTML = '<p class="text-[10px] text-rose-400 text-center">Error cargando pagos</p>';
            return;
        }

        if (!pagos || pagos.length === 0) {
            contenedor.innerHTML = '<p class="text-[10px] text-slate-400 text-center py-4 font-bold uppercase italic">Sin pagos que validar</p>';
            return;
        }

        contenedor.innerHTML = pagos.map(p => `
            <div class="flex items-center justify-between p-3 bg-slate-50 rounded-2xl border border-slate-100 group hover:shadow-md transition-all">
                <div class="flex items-center gap-3">
                    <div class="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-emerald-500 shadow-sm">
                        <i class="fas fa-money-bill-transfer"></i>
                    </div>
                    <div>
                        <p class="text-[10px] font-black text-slate-800 italic uppercase leading-none">${p.clientes?.nombre || 'Cliente'}</p>
                        <p class="text-[9px] font-black text-emerald-600 mt-1">${formatearMoneda(p.monto)}</p>
                    </div>
                </div>
                <button onclick="abrirValidacionPago('${p.id}', '${p.comprobante_url}')" 
                    class="w-8 h-8 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center hover:bg-slate-900 hover:text-white transition-all">
                    <i class="fas fa-eye text-[10px]"></i>
                </button>
            </div>
        `).join('');

    } catch (err) {
        console.error("Error cargando feed:", err);
    }
}

/**
 * KPIS DE LOGÍSTICA: Movimientos del día
 */
async function cargarKpisLogistica() {
    try {
        const hoy = new Date().toLocaleDateString('en-CA');
        const { data: movs, error } = await _supabase
            .from('movimientos')
            .select('created_at')
            .order('created_at', { ascending: false })
            .limit(1000);

        if (error) throw error;

        const countHoy = movs?.filter(m => {
            if (!m.created_at) return false;
            return new Date(m.created_at).toLocaleDateString('en-CA') === hoy;
        }).length || 0;

        const elMovs = document.getElementById('kpi-movs-hoy');
        if (elMovs) elMovs.innerText = countHoy;
    } catch (err) {
        console.error("Error cargando logistica:", err);
    }
}

/**
 * STOCK CRÍTICO: Basado en Stock Mínimo
 */
async function cargarKpisStock() {
    try {
        const { data: productos } = await _supabase
            .from('productos')
            .select('id, nombre, sku, stock_minimo, posiciones(cantidad)');

        let totalCalculado = 0;
        let listaCritica = [];

        productos?.forEach(p => {
            const stockActual = p.posiciones?.reduce((acc, pos) => acc + (pos.cantidad || 0), 0) || 0;
            totalCalculado += stockActual;

            if (stockActual <= (p.stock_minimo || 5)) {
                listaCritica.push({ nombre: p.nombre, sku: p.sku, stock: stockActual });
            }
        });

        // UI Stock Total
        const elStock = document.getElementById('kpi-total-stock');
        if (elStock) elStock.innerText = totalCalculado || 0;

        // UI Lista Crítica
        const elLista = document.getElementById('lista-stock-critico');
        if (elLista) {
            if (listaCritica.length === 0) {
                elLista.innerHTML = '<p class="text-xs text-indigo-300 italic">No hay productos en riesgo.</p>';
            } else {
                elLista.innerHTML = listaCritica.slice(0, 5).map(p => `
                    <div class="flex justify-between items-center bg-white/5 p-3 rounded-2xl border border-white/10">
                        <div>
                            <p class="text-[10px] font-black uppercase text-white tracking-widest leading-none">${p.nombre}</p>
                            <p class="text-[8px] text-indigo-300 mt-1">SKU: ${p.sku}</p>
                        </div>
                        <div class="px-3 py-1 bg-rose-500/20 text-rose-400 rounded-full font-black text-[10px]">
                            ${p.stock} <span class="text-[8px] opacity-70">U.</span>
                        </div>
                    </div>
                `).join('');
            }
        }
    } catch (err) { console.error(err); }
}

/**
 * SALUD DE CARTERA: Gráfico de Clientes
 */
async function cargarSaludCartera() {
    try {
        const { data: clientes, error } = await _supabase.from('clientes').select('*');

        if (error) {
            console.error("Error al cargar clientes:", error.message);
            return;
        }

        const activos = clientes?.filter(c => c.estado === 'activo').length || 0;
        const deudores = clientes?.filter(c => c.estado === 'deudor').length || 0;

        const elActivos = document.getElementById('chart-activos');
        const elDeudores = document.getElementById('chart-deudores');

        if (elActivos) elActivos.innerText = activos;
        if (elDeudores) elDeudores.innerText = deudores;

    } catch (err) { console.error("Error en Salud Cartera:", err); }
}

/**
 * MODAL DE VALIDACIÓN DE COMPROBANTE
 */
function abrirValidacionPago(pagoId, url) {
    const modal = document.getElementById('modal-comprobante');
    const img = document.getElementById('modal-img-comprobante');
    const btnAprobar = document.getElementById('btn-aprobar-pago');
    const btnRechazar = document.getElementById('btn-rechazar-pago');

    if (img) img.src = url || 'https://via.placeholder.com/400x600?text=Sin+Imagen';

    // Configurar botones
    if (btnAprobar) {
        btnAprobar.onclick = async () => {
            if (typeof aprobarPago === 'function') {
                await aprobarPago(pagoId);
                cerrarModalComprobante();
                actualizarDashboard();
            }
        };
    }

    if (btnRechazar) {
        btnRechazar.onclick = async () => {
            const { isConfirmed } = await Swal.fire({
                title: '¿Rechazar Pago?',
                text: "El pago volverá a estado rechazado y no impactará en el saldo.",
                icon: 'warning',
                showCancelButton: true,
                confirmButtonColor: '#f43f5e',
                cancelButtonColor: '#94a3b8',
                confirmButtonText: 'Sí, Rechazar',
                cancelButtonText: 'Cancelar'
            });

            if (isConfirmed) {
                await _supabase.from('pagos').update({ estado: 'rechazado' }).eq('id', pagoId);
                cerrarModalComprobante();
                actualizarDashboard();
                Notificar.toast("Pago rechazado", "info");
            }
        };
    }

    if (modal) modal.classList.remove('hidden');
}

function cerrarModalComprobante() {
    const modal = document.getElementById('modal-comprobante');
    if (modal) modal.classList.add('hidden');
}

/**
 * BADGE DE NOTIFICACIÓN EN SIDEBAR
 */
function actualizarBadgeSidebar(count) {
    const menuItem = document.getElementById('menu-cobranzas');
    if (!menuItem) return;

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

function renderizarFechaActual() {
    const el = document.getElementById('global-current-date');
    if (el) {
        const ahora = new Date();
        const opciones = { weekday: 'long', day: 'numeric', month: 'long' };
        const fechaStr = ahora.toLocaleDateString('es-AR', opciones).toUpperCase();
        const horaStr = ahora.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
        el.innerText = `${fechaStr} - ${horaStr}`;
    }
}

/**
 * MENÚ DE EXPORTACIÓN CONTABLE
 */
async function abrirMenuExportacion() {
    const { value: formValues } = await Swal.fire({
        title: 'EXPORTAR LIBRO IVA VENTAS',
        html: `
            <div class="space-y-4 py-4 text-left font-bold uppercase italic">
                <label class="text-[10px] text-slate-400">Mes a Exportar</label>
                <select id="swal-mes" class="w-full p-3 bg-slate-50 rounded-xl border border-slate-200 font-bold">
                    <option value="1">Enero</option><option value="2">Febrero</option>
                    <option value="3">Marzo</option><option value="4">Abril</option>
                    <option value="5">Mayo</option><option value="6">Junio</option>
                    <option value="7">Julio</option><option value="8">Agosto</option>
                    <option value="9">Septiembre</option><option value="10">Octubre</option>
                    <option value="11">Noviembre</option><option value="12">Diciembre</option>
                </select>
                <label class="text-[10px] text-slate-400">Año</label>
                <input id="swal-anio" type="number" value="${new Date().getFullYear()}" class="w-full p-3 bg-slate-50 rounded-xl border border-slate-200 font-bold">
            </div>
        `,
        focusConfirm: false,
        confirmButtonText: 'Generar CSV',
        preConfirm: () => {
            return {
                mes: document.getElementById('swal-mes').value,
                anio: document.getElementById('swal-anio').value
            }
        }
    });

    if (formValues) {
        if (typeof exportarLibroIVAVentas === 'function') {
            await exportarLibroIVAVentas(formValues.mes, formValues.anio);
        }
    }
}

/**
 * IMPORTADOR BANCARIO
 */
async function abrirImportadorBancario() {
    const { value: file } = await Swal.fire({
        title: 'CONCILIACIÓN BANCARIA',
        text: 'Seleccioná el extracto CSV del banco (Formato: Fecha, Detalle, Monto)',
        input: 'file',
        inputAttributes: {
            'accept': '.csv',
            'aria-label': 'Subir extracto bancario'
        },
        confirmButtonText: 'Procesar y Conciliar',
        confirmButtonColor: '#10b981'
    });

    if (file) {
        const reader = new FileReader();
        reader.onload = async (e) => {
            const csvText = e.target.result;
            if (typeof procesarCSVMovimientosBancarios === 'function') {
                await procesarCSVMovimientosBancarios(csvText);
                actualizarDashboard();
            }
        };
        reader.readAsText(file);
    }
}