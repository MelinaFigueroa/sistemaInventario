// js/renders.js - Funciones de renderizado de datos desde Supabase

// ==========================================
// DASHBOARD
// ==========================================
// La función actualizarDashboard() fue movida a js/dashboard_admin.js para manejo avanzado de roles y KPIs.
// Se mantiene este archivo renders.js enfocado únicamente en el renderizado de tablas y listas.

// ==========================================
// POSICIONES
// ==========================================
async function renderPosiciones() {
    const container = document.getElementById("mapa-posiciones");
    if (!container) return;

    const { data, error } = await _supabase
        .from("posiciones")
        .select("*")
        .order("id", { ascending: true });

    if (error) return;

    container.innerHTML = data.map((pos) => {
        const isVacio = pos.estado === "vacio";
        const cardClass = isVacio ? "opacity-60 border-dashed border-slate-300" : "border-transparent hover:border-indigo-500 shadow-sm";
        return `
        <div onclick="${isVacio ? "" : `openDrawer('${pos.id}', 'Stock Vital Can', ${pos.cantidad}, 'Ubicación en Depósito')`}" 
             class="relative bg-white border-2 p-5 rounded-2xl transition-all cursor-pointer ${cardClass}">
            <div class="flex justify-between mb-3">
                <span class="text-[10px] font-black bg-slate-100 px-2 py-1 rounded text-slate-500">${pos.id}</span>
                ${!isVacio ? '<i class="fas fa-circle text-[8px] text-emerald-500"></i>' : ""}
            </div>
            <div class="flex flex-col items-center">
                <i class="fas ${isVacio ? "fa-plus text-slate-200" : "fa-box text-indigo-600"} text-2xl mb-2"></i>
                <h4 class="font-bold text-slate-800 text-sm uppercase italic">${isVacio ? "Vacío" : "Ocupado"}</h4>
                ${!isVacio ? `<p class="mt-2 text-indigo-700 text-[10px] font-black italic">${pos.cantidad} u.</p>` : ""}
            </div>
        </div>`;
    }).join("");
}

// ==========================================
// PEDIDOS
// ==========================================
let cachedPedidos = [];

async function renderPedidos() {
    const tbody = document.getElementById("lista-pedidos");
    if (!tbody) return;

    const { data, error } = await _supabase
        .from("pedidos")
        .select("*")
        .order("created_at", { ascending: false });

    if (error) return;

    cachedPedidos = data;
    pintarTablaPedidos(data);
}

function filtrarPedidos() {
    const term = document.getElementById("buscar-pedido").value.toLowerCase();
    const filtrados = cachedPedidos.filter(p => {
        const id = p.id.toLowerCase();
        const cliente = (p.cliente_nombre || "").toLowerCase();
        return id.includes(term) || cliente.includes(term);
    });
    pintarTablaPedidos(filtrados);
}

function pintarTablaPedidos(data) {
    const tbody = document.getElementById("lista-pedidos");
    if (!tbody) return;

    tbody.innerHTML = data
        .map(
            (p) => `
        <tr class="hover:bg-slate-50 transition-colors border-b border-slate-50">
            <td class="p-4 text-slate-400">
                <p class="font-black text-slate-800 uppercase">#${p.id.substring(0, 5)}</p>
                <p class="text-[9px] font-bold uppercase">${new Date(p.created_at).toLocaleDateString()}</p>
            </td>
            <td class="p-4 text-slate-700 font-bold uppercase italic">${p.cliente_nombre}</td>
            <td class="p-4 text-center">
                <span class="px-3 py-1 ${p.estado === "pendiente" ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"} text-[9px] font-black rounded-full italic uppercase">
                    ${p.estado}
                </span>
            </td>
            <td class="p-4 text-center">
                <button onclick="generarHojaDeRuta('${p.id}')" class="text-indigo-600 hover:text-indigo-800 p-2 text-lg">
                    <i class="fas ${p.estado === "pendiente" ? "fa-route" : "fa-check-double"}"></i>
                </button>
            </td>
        </tr>`,
        )
        .join("");
}

// ==========================================
// FACTURACIÓN
// ==========================================
let cachedFacturas = [];

async function renderFacturacion() {
    const tbody = document.getElementById("lista-facturas");
    if (!tbody) return;

    // Mejoramos la query para traer el CUIT desde el pedido o cliente si falta en la factura
    // 1. Obtener Facturas (Query original + joins)
    const { data: facturas, error } = await _supabase
        .from("facturas")
        .select(`
            *,
            pedidos (
                cliente_cuit,
                clientes ( cuit )
            )
        `)
        .order("created_at", { ascending: false });

    if (error) {
        console.error("Error cargando facturas:", error);
        return;
    }

    // 2. Obtener Clientes (para fallback de CUIT por nombre)
    // Esto asegura que si la relación falla, lo busquemos por el nombre del cliente
    const { data: clientes } = await _supabase
        .from("clientes")
        .select("nombre, cuit");

    // Mapa de CUITs por Nombre de Cliente (Normalizado)
    const mapaCuits = {};
    if (clientes) {
        clientes.forEach(c => {
            if (c.nombre) mapaCuits[c.nombre.trim().toUpperCase()] = c.cuit;
        });
    }

    // 3. Enriquecer datos con el CUIT final
    const facturasEnriquecidas = facturas.map(f => {
        const cuitRelacion = f.cliente_cuit || f.pedidos?.cliente_cuit || f.pedidos?.clientes?.cuit;
        const nombreNorm = (f.cliente_nombre || "").trim().toUpperCase();

        let cuitFinal = cuitRelacion;
        // Si no hay cuit por relación, buscamos por nombre exacto en el mapa
        if (!cuitFinal || cuitFinal === '---') {
            cuitFinal = mapaCuits[nombreNorm] || "---";
        }

        return {
            ...f,
            cuit_final: cuitFinal
        };
    });

    cachedFacturas = facturasEnriquecidas;
    pintarTablaFacturacion(facturasEnriquecidas);
}

function filtrarFacturas() {
    const term = document.getElementById("buscar-factura").value.toLowerCase();
    const filtradas = cachedFacturas.filter(f => {
        const nro = (f.nro_comprobante || f.id).toLowerCase();
        const cliente = (f.cliente_nombre || "").toLowerCase();
        const cuit = (f.cuit_final || "").toLowerCase();
        const vendedor = (f.usuario || "").toLowerCase();

        return nro.includes(term) ||
            cliente.includes(term) ||
            cuit.includes(term) ||
            vendedor.includes(term);
    });
    pintarTablaFacturacion(filtradas);
}

function pintarTablaFacturacion(data) {
    const tbody = document.getElementById("lista-facturas");
    const kpiVentas = document.getElementById("total-ventas-dia");
    if (!tbody) return;

    let totalHoy = 0;
    const hoy = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD local

    tbody.innerHTML = data
        .map((f, index) => {
            const monto = parseFloat(f.total_final) || 0;

            // Convertimos la fecha de Supabase (UTC) a fecha local (YYYY-MM-DD)
            const fechaLocal = f.created_at ? new Date(f.created_at).toLocaleDateString('en-CA') : '';

            // Solo sumamos al "Total Hoy" si coincide con la fecha local actual
            if (fechaLocal === hoy) {
                totalHoy += monto;
            }

            const nroAMostrar = f.nro_comprobante ? f.nro_comprobante : f.id.substring(0, 8);
            const delay = Math.min(index * 50, 400);

            return `
        <tr class="hover:bg-slate-50 transition-colors border-b border-slate-50 animate-fade-up transform-gpu" style="animation-delay: ${delay}ms">
            <td class="p-4 text-slate-400 text-center">
            <span class="text-[12px] font-bold uppercase">${new Date(f.created_at).toLocaleDateString()}</span><br>
                <span class="text-slate-700 font-black">#${nroAMostrar}</span><br>
                ${f.cae ? `<span class="text-[12px] text-emerald-400 font-normal">CAE: ${f.cae}</span>` : ""}              
            </td>
            <td class="p-4 text-slate-700 uppercase font-black italic">
    ${f.cliente_nombre}
    ${f.cuit_final ? `<br><span class="text-[12px] text-slate-500 font-normal">CUIT: ${f.cuit_final}</span>` : ""}
</td>
            <td class="p-4">
                <div class="flex items-center gap-2">
                    <div class="w-6 h-6 rounded-full bg-indigo-500 flex items-center justify-center text-[10px] text-white font-black shadow-sm">
                        ${(f.usuario || "S").charAt(0).toUpperCase()}
                    </div>
                    <span class="text-xs text-slate-600 font-bold uppercase italic">
                        ${(f.usuario || "S").replace('_', ' ').replace('user', '').trim() || "SISTEMA"}
                    </span>
                </div>
            </td>
            <td class="p-4 text-emerald-600 font-black italic text-sm">$${monto.toLocaleString("es-AR")}</td>
            <td class="p-4 text-center">
                <button onclick="imprimirFactura('${f.id}')" class="text-slate-400 hover:text-indigo-600">
                    <i class="fas fa-print"></i>
                </button>
            </td>
        </tr>`;
        })
        .join("");

    if (kpiVentas) kpiVentas.innerText = `$${totalHoy.toLocaleString("es-AR")}`;
}

// ==========================================
// INVENTARIO
// ==========================================
async function renderInventario() {
    const container = document.getElementById("lista-productos");
    if (!container) return;

    const { data } = await _supabase
        .from("productos")
        .select("*")
        .order("nombre");
    container.innerHTML = data
        .map(
            (prod) => `
        <div class="bg-white rounded-3xl p-5 border border-slate-100 hover:shadow-md transition-all">
            <div class="flex justify-between mb-4">
                <div class="w-12 h-12 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600"><i class="fas ${prod.icono || "fa-paw"} text-2xl"></i></div>
                <span class="text-[10px] font-black text-emerald-600 italic uppercase">Vital Can</span>
            </div>
            <h3 class="font-black text-slate-800 text-lg uppercase italic tracking-tighter">${prod.nombre}</h3>
            <p class="text-[10px] text-slate-400 font-bold mb-4 uppercase">SKU: ${prod.sku}</p>
            <div class="flex justify-between text-xs font-bold italic">
                <span class="text-slate-400 uppercase">Stock Mínimo</span>
                <span class="text-rose-500">${prod.stock_minimo} u.</span>
            </div>
        </div>`,
        )
        .join("");
}

// ==========================================
// RECEPCIÓN
// ==========================================
async function prepararRecepcion() {
    const selectProd = document.getElementById("rec-producto");
    const selectDest = document.getElementById("rec-destino");
    if (!selectProd || !selectDest) return;

    const { data: prods } = await _supabase
        .from("productos")
        .select("id, nombre, sku");

    selectProd.innerHTML =
        '<option value="">Seleccioná Vital Can...</option>' +
        prods
            .map((p) => `<option value="${p.id}" data-sku="${p.sku}">${p.nombre} (${p.sku})</option>`)
            .join("");

    const { data: poss } = await _supabase
        .from("posiciones")
        .select("id, estado");
    selectDest.innerHTML =
        '<option value="">Seleccioná Rack...</option>' +
        poss
            .map(
                (pos) =>
                    `<option value="${pos.id}">${pos.id} ${pos.estado === "vacio" ? "(VACÍO)" : ""}</option>`,
            )
            .join("");
}

// ==========================================
// MOVIMIENTOS
// ==========================================
async function renderMovimientos() {
    const tbody = document.getElementById("tabla-movimientos");
    if (!tbody) return;

    const { data, error } = await _supabase
        .from("movimientos")
        .select(`
            id, created_at, tipo, cantidad, origen, destino, usuario,
            productos ( nombre )
        `)
        .order("created_at", { ascending: false });

    if (error) {
        console.error("Error cargando movimientos:", error);
        return;
    }

    tbody.innerHTML = data.map((mov) => {
        const origen = mov.origen || '---';
        const destino = mov.destino || '---';
        let trazabilidadIcon = 'fa-long-arrow-alt-right';

        if (destino.includes('VENTA') || destino.includes('CLIENTE')) trazabilidadIcon = 'fa-shipping-fast text-rose-400';
        if (origen.includes('PROVEEDOR')) trazabilidadIcon = 'fa-truck-loading text-emerald-400';
        if (origen.includes('RACK') && destino.includes('RACK')) trazabilidadIcon = 'fa-exchange-alt text-indigo-400';
        if (mov.tipo.toUpperCase().includes('AJUSTE')) trazabilidadIcon = 'fa-tools text-amber-500';

        const esEntrada = mov.tipo.toUpperCase() === "ENTRADA";
        const badgeClass = esEntrada
            ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
            : 'bg-rose-100 text-rose-700 border-rose-200';

        const iconTipo = esEntrada ? 'fa-arrow-down' : 'fa-arrow-up';
        const signo = esEntrada ? '+' : '-';
        const colorTexto = esEntrada ? 'text-emerald-600' : 'text-rose-600';

        return `
            <tr class="hover:bg-slate-50 transition-colors border-b border-slate-50">
                <td class="p-4 text-slate-400 text-[10px] uppercase font-bold">
                    ${new Date(mov.created_at).toLocaleDateString()}<br>
                    ${new Date(mov.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </td>
                <td class="p-4 text-slate-800 italic uppercase font-black">
                    ${mov.productos?.nombre || "PRODUCTO SIN NOMBRE"}
                </td>
                <td class="p-4">
                    <span class="px-3 py-1 rounded-full border ${badgeClass} text-[9px] font-black uppercase flex items-center gap-1 w-fit italic">
                        <i class="fas ${iconTipo}"></i> ${mov.tipo}
                    </span>
                </td>
                <td class="p-4 text-indigo-600 font-black">
                    <div class="flex items-center gap-2">
                         <span class="text-xs uppercase italic">${mov.usuario || "SISTEMA"}</span>
                    </div>
                </td>
                <td class="p-4">
                    <div class="flex items-center gap-2">
                        <span class="text-[10px] bg-slate-100 px-2 py-0.5 rounded text-slate-600 font-black">${origen}</span>
                        <i class="fas ${trazabilidadIcon} text-xs"></i>
                        <span class="text-[10px] bg-indigo-50 px-2 py-0.5 rounded text-indigo-700 font-black">${destino}</span>
                    </div>
                </td>
                <td class="p-4">
                    <span class="${colorTexto} font-black italic text-sm">
                        ${signo}${mov.cantidad}
                    </span>
                </td>
            </tr>`;
    }).join("");
}

// ==========================================
// CLIENTES
// ==========================================
let cachedClientes = [];

async function renderClientes() {
    const container = document.getElementById("lista-clientes");
    if (!container) return;

    const { data, error } = await _supabase
        .from("clientes")
        .select("*")
        .order("nombre", { ascending: true });

    if (error) {
        container.innerHTML = `<p class="col-span-full text-center text-rose-500 font-bold py-10">Error al cargar clientes</p>`;
        return;
    }

    cachedClientes = data;
    pintarClientes(data);
}

function filtrarClientes() {
    const term = document.getElementById("buscar-cliente").value.toLowerCase();
    const filtrados = cachedClientes.filter(c =>
        c.nombre.toLowerCase().includes(term) ||
        c.cuit.toLowerCase().includes(term) ||
        (c.direccion || "").toLowerCase().includes(term)
    );
    pintarClientes(filtrados);
}

function pintarClientes(data) {
    const container = document.getElementById("lista-clientes");
    if (!container) return;

    if (data.length === 0) {
        container.innerHTML = `<p class="col-span-full text-center text-slate-400 py-10 font-bold italic uppercase">No se encontraron clientes</p>`;
        return;
    }

    container.innerHTML = data.map((c, index) => {
        const delay = Math.min(index * 100, 500);
        return `
        <div class="bg-white rounded-3xl p-6 border border-slate-100 hover:shadow-lg transition-all group animate-fade-up transform-gpu" style="animation-delay: ${delay}ms">
            <div class="flex justify-between items-start mb-4">
                <div class="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-all">
                    <i class="fas fa-store text-xl"></i>
                </div>
                <span class="text-[10px] font-black ${c.estado === 'deudor' ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'} px-2 py-1 rounded italic uppercase tracking-widest">
                    ${c.estado || 'Activo'}
                </span>
            </div>
            <h3 class="font-black text-slate-800 text-lg uppercase italic tracking-tighter leading-tight mb-1">${c.nombre}</h3>
            <p class="text-[10px] text-slate-400 font-bold mb-4 uppercase tracking-widest">CUIT: ${c.cuit}</p>
            
            <div class="space-y-3 border-t border-slate-50 pt-4">
                <div class="flex items-center gap-2 text-xs text-slate-500 font-bold italic">
                    <i class="fas fa-location-dot text-indigo-400"></i>
                    <span class="truncate">${c.direccion || 'Sin dirección registrada'}</span>
                </div>
                
                <button onclick="abrirCuentaCorriente('${c.id}')" 
                    class="w-full mt-2 py-2 bg-slate-50 hover:bg-slate-900 hover:text-white text-slate-600 rounded-xl text-[10px] font-black uppercase italic transition-all flex items-center justify-center gap-2">
                    <i class="fas fa-file-invoice-dollar"></i> Cuenta Corriente
                </button>
            </div>
        </div>
        `;
    }).join("");
}
