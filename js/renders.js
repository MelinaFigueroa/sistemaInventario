// js/renders.js - Funciones de renderizado de datos desde Supabase

// ==========================================
// DASHBOARD
// ==========================================
async function actualizarDashboard() {
    const kpiStock = document.getElementById("kpi-stock");
    const kpiMovs = document.getElementById("kpi-movs");
    const kpiCritico = document.getElementById("kpi-critico");
    const contenedorAlertas = document.getElementById("contenedor-alertas");

    if (!kpiStock || !kpiMovs) return;

    // 1. Stock Total
    const { data: posData } = await _supabase.from("posiciones").select("cantidad");
    const total = posData ? posData.reduce((acc, curr) => acc + Math.max(0, curr.cantidad || 0), 0) : 0;
    kpiStock.innerText = total.toLocaleString();

    // 2. Contador de Movimientos
    const { count } = await _supabase.from("movimientos").select("*", { count: "exact", head: true });
    kpiMovs.innerText = count || 0;

    // 3. Stock Crítico y Alertas
    const { data: productosCriticos } = await _supabase
        .from("productos")
        .select(`
            id, nombre, sku, stock_minimo,
            posiciones (cantidad)
        `);

    if (productosCriticos) {
        const alertas = productosCriticos.filter(p => {
            const stockActual = p.posiciones?.reduce((acc, curr) => acc + (curr.cantidad || 0), 0) || 0;
            return stockActual < (p.stock_minimo || 5);
        });

        if (kpiCritico) kpiCritico.innerText = alertas.length;

        if (contenedorAlertas) {
            if (alertas.length === 0) {
                contenedorAlertas.innerHTML = '<p class="text-xs text-slate-400 italic">No hay alertas críticas pendientes.</p>';
            } else {
                contenedorAlertas.innerHTML = alertas.map(p => {
                    const stockActual = p.posiciones?.reduce((acc, curr) => acc + (curr.cantidad || 0), 0) || 0;
                    return `
                    <div class="flex justify-between items-center bg-white p-4 rounded-2xl border-l-4 border-l-rose-500 shadow-sm mb-3">
                        <div>
                            <p class="text-[10px] font-black text-slate-400 uppercase tracking-widest">SKU: ${p.sku}</p>
                            <h4 class="text-sm font-black text-slate-800 uppercase italic">${p.nombre}</h4>
                        </div>
                        <div class="text-right">
                            <p class="text-xs font-black ${stockActual <= 0 ? 'text-rose-600' : 'text-amber-500'}">${stockActual} u.</p>
                            <p class="text-[9px] font-bold text-slate-400 uppercase italic">Mín: ${p.stock_minimo || 5}</p>
                        </div>
                    </div>`;
                }).join("");
            }
        }
    }
}

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
                <button onclick="procesarPicking('${p.id}')" class="text-indigo-600 hover:text-indigo-800 p-2 text-lg">
                    <i class="fas ${p.estado === "pendiente" ? "fa-box-open" : "fa-check-double"}"></i>
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

    const { data, error } = await _supabase
        .from("facturas")
        .select("*")
        .order("created_at", { ascending: false });

    if (error) return;

    cachedFacturas = data;
    pintarTablaFacturacion(data);
}

function filtrarFacturas() {
    const term = document.getElementById("buscar-factura").value.toLowerCase();
    const filtradas = cachedFacturas.filter(f => {
        const nro = (f.nro_comprobante || f.id).toLowerCase();
        const cliente = (f.cliente_nombre || "").toLowerCase();
        const cuit = (f.cliente_cuit || "").toLowerCase();
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

    let totalDia = 0;
    tbody.innerHTML = data
        .map((f) => {
            totalDia += parseFloat(f.total_final);
            const nroAMostrar = f.nro_comprobante ? f.nro_comprobante : f.id.substring(0, 8);

            return `
        <tr class="hover:bg-slate-50 transition-colors border-b border-slate-50">
            <td class="p-4 text-slate-400">
                <span class="text-slate-700 font-black">#${nroAMostrar}</span><br>
                <span class="text-[9px] font-bold uppercase">${new Date(f.created_at).toLocaleDateString()}</span>
            </td>
            <td class="p-4 text-slate-700 uppercase font-black italic">
    ${f.cliente_nombre}
    ${f.cliente_cuit ? `<br><span class="text-[8px] text-slate-400 font-bold">CUIT: ${f.cliente_cuit}</span>` : ""}
    ${f.cae ? `<br><span class="text-[8px] text-emerald-500 font-normal">CAE: ${f.cae}</span>` : ""}
</td>
            <td class="p-4">
                <div class="flex items-center gap-2">
                    <div class="w-6 h-6 rounded-full bg-indigo-500 flex items-center justify-center text-[10px] text-white font-black shadow-sm">${f.usuario?.charAt(0) || "M"}</div>
                    <span class="text-xs text-slate-600 font-bold uppercase italic">${f.usuario || ""}</span>
                </div>
            </td>
            <td class="p-4 text-emerald-600 font-black italic text-sm">$${parseFloat(f.total_final).toLocaleString("es-AR")}</td>
            <td class="p-4 text-center">
                <button onclick="imprimirFactura('${f.id}')" class="text-slate-400 hover:text-indigo-600">
                    <i class="fas fa-print"></i>
                </button>
            </td>
        </tr>`;
        })
        .join("");

    if (kpiVentas) kpiVentas.innerText = `$${totalDia.toLocaleString("es-AR")}`;
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
            .map((p) => `<option value="${p.id}">${p.nombre} (${p.sku})</option>`)
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

    container.innerHTML = data.map(c => `
        <div class="bg-white rounded-3xl p-6 border border-slate-100 hover:shadow-lg transition-all group">
            <div class="flex justify-between items-start mb-4">
                <div class="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-all">
                    <i class="fas fa-store text-xl"></i>
                </div>
                <span class="text-[10px] font-black bg-emerald-100 text-emerald-700 px-2 py-1 rounded italic uppercase tracking-widest">Activo</span>
            </div>
            <h3 class="font-black text-slate-800 text-lg uppercase italic tracking-tighter leading-tight mb-1">${c.nombre}</h3>
            <p class="text-[10px] text-slate-400 font-bold mb-4 uppercase tracking-widest">CUIT: ${c.cuit}</p>
            <div class="flex items-center gap-2 text-xs text-slate-500 font-bold italic border-t border-slate-50 pt-4">
                <i class="fas fa-location-dot text-indigo-400"></i>
                <span>${c.direccion || 'Sin dirección registrada'}</span>
            </div>
        </div>
    `).join("");
}
