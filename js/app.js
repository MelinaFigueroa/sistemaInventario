// ==========================================
// 1. CONFIGURACIÓN DE SUPABASE
// ==========================================
const _supabase = supabase.createClient(
    "https://omylruckqvesemrlomed.supabase.co",
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9teWxydWNrcXZlc2VtcmxvbWVkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAxNDE0MjIsImV4cCI6MjA4NTcxNzQyMn0.uWe09wGzCnYtIXPXTfhE7Z59iNda2YHjcqFBtKmcopU"
);

// Variables globales de estado
let itemsPedidoTemporal = [];
const USUARIO_ACTUAL = "Meli Dev";

// ==========================================
// 2. CARGADOR DE PÁGINAS (SPA)
// ==========================================
async function loadPage(pageUrl) {
    const container = document.getElementById("view-container");
    if (!container) return;

    // Loader con onda
    container.innerHTML = '<div class="flex justify-center py-20"><i class="fas fa-paw animate-bounce text-4xl text-indigo-500"></i></div>';
    
    // Actualizar URL sin recargar
    const routeName = pageUrl.replace('.html', '');
    window.history.pushState({}, '', `#/${routeName}`);

    try {
        const response = await fetch(pageUrl);
        if (!response.ok) throw new Error("No se encontró: " + pageUrl);
        const content = await response.text();
        
        const parser = new DOMParser();
        const doc = parser.parseFromString(content, "text/html");
        const mainContent = doc.querySelector("main");
        container.innerHTML = mainContent ? mainContent.innerHTML : content;

        // Selector de scripts según la página cargada
        const scripts = {
            "inicio.html": actualizarDashboard,
            "posiciones.html": renderPosiciones,
            "movimientos.html": renderMovimientos,
            "inventario.html": renderInventario,
            "recepcion.html": prepararRecepcion,
            "pedidos.html": renderPedidos,
            "facturacion.html": renderFacturacion 
        };

        for (const [key, func] of Object.entries(scripts)) {
            if (pageUrl.includes(key)) {
                setTimeout(func, 100);
                break;
            }
        }

        if (window.innerWidth < 768) toggleSidebar();
    } catch (error) {
        container.innerHTML = `<div class="bg-red-50 p-6 rounded-2xl text-red-600 border border-red-200 font-black italic uppercase">Error: ${error.message}</div>`;
    }
}

// ==========================================
// 3. FUNCIONES DE RENDERIZADO (SUPABASE)
// ==========================================

async function actualizarDashboard() {
    const kpiStock = document.getElementById("kpi-stock");
    const kpiMovs = document.getElementById("kpi-movs");
    if (!kpiStock || !kpiMovs) return;

    const { data: posData } = await _supabase.from("posiciones").select("cantidad");
    const total = posData ? posData.reduce((acc, curr) => acc + (curr.cantidad || 0), 0) : 0;
    kpiStock.innerText = total.toLocaleString();

    const { count } = await _supabase.from("movimientos").select("*", { count: 'exact', head: true });
    kpiMovs.innerText = count || 0;

    // Nueva lógica para Stock Crítico (menos de 10 unidades)
    const { data: criticos } = await _supabase
        .from("posiciones")
        .select("cantidad")
        .lt("cantidad", 10)
        .gt("cantidad", 0);

    const kpiCritico = document.getElementById("kpi-critico");
    if (kpiCritico) kpiCritico.innerText = criticos ? criticos.length : 0;
}

async function renderPosiciones() {
    const container = document.getElementById("mapa-posiciones");
    if (!container) return;

    const { data, error } = await _supabase.from("posiciones").select("*").order("id", { ascending: true });
    if (error) return;

    container.innerHTML = data.map(pos => {
        const isVacio = pos.estado === "vacio";
        const cardClass = isVacio ? "opacity-60 border-dashed border-slate-300" : "border-transparent hover:border-indigo-500 shadow-sm";
        return `
            <div onclick="${isVacio ? '' : `openDrawer('${pos.id}', 'Carga Vital Can', ${pos.cantidad}, 'Ubicación en Rack')`}" 
                 class="relative bg-white border-2 p-5 rounded-2xl transition-all cursor-pointer ${cardClass}">
                <div class="flex justify-between mb-3">
                    <span class="text-[10px] font-black bg-slate-100 px-2 py-1 rounded text-slate-500">${pos.id}</span>
                    ${!isVacio ? '<i class="fas fa-circle text-[8px] text-emerald-500"></i>' : ''}
                </div>
                <div class="flex flex-col items-center">
                    <i class="fas ${isVacio ? 'fa-plus text-slate-200' : 'fa-box text-indigo-600'} text-2xl mb-2"></i>
                    <h4 class="font-bold text-slate-800 text-sm uppercase italic">${isVacio ? 'Vacío' : 'Ocupado'}</h4>
                    ${!isVacio ? `<p class="mt-2 text-indigo-700 text-[10px] font-black italic">${pos.cantidad} u.</p>` : ''}
                </div>
            </div>`;
    }).join('');
}

async function renderPedidos() {
    const tbody = document.getElementById("lista-pedidos");
    if (!tbody) return;

    const { data, error } = await _supabase.from("pedidos").select("*").order("created_at", { ascending: false });
    if (error) return;

    tbody.innerHTML = data.map(p => `
        <tr class="hover:bg-slate-50 transition-colors border-b border-slate-50">
            <td class="p-4"><p class="font-black text-slate-800 uppercase">#${p.id.substring(0, 5)}</p></td>
            <td class="p-4 text-slate-700 font-bold uppercase italic">${p.cliente_nombre}</td>
            <td class="p-4 text-center">
                <span class="px-3 py-1 ${p.estado === 'pendiente' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'} text-[9px] font-black rounded-full italic uppercase">
                    ${p.estado}
                </span>
            </td>
            <td class="p-4 text-center">
                <button onclick="procesarPicking('${p.id}')" class="text-indigo-600 hover:text-indigo-800 p-2">
                    <i class="fas ${p.estado === 'pendiente' ? 'fa-box-open' : 'fa-check-double'}"></i>
                </button>
            </td>
        </tr>`).join("");
}

async function renderFacturacion() {
    const tbody = document.getElementById("lista-facturas");
    const kpiVentas = document.getElementById("total-ventas-dia");
    if (!tbody) return;

    const { data, error } = await _supabase.from("facturas").select("*").order("created_at", { ascending: false });
    if (error) return;

    let totalDia = 0;
    tbody.innerHTML = data.map(f => {
        totalDia += parseFloat(f.total_final);
        return `
        <tr class="hover:bg-slate-50 transition-colors border-b border-slate-50">
            <td class="p-4 text-slate-400">#${f.id.substring(0, 8)}<br><span class="text-[9px] font-bold uppercase">${new Date(f.created_at).toLocaleDateString()}</span></td>
            <td class="p-4 text-slate-700 uppercase font-black italic">${f.cliente_nombre}</td>
            <td class="p-4">
                <div class="flex items-center gap-2">
                    <div class="w-6 h-6 rounded-full bg-indigo-500 flex items-center justify-center text-[10px] text-white font-black shadow-sm">${f.usuario?.charAt(0) || 'M'}</div>
                    <span class="text-xs text-slate-600 font-bold uppercase italic">${f.usuario || USUARIO_ACTUAL}</span>
                </div>
            </td>
            <td class="p-4 text-emerald-600 font-black italic text-sm">$${parseFloat(f.total_final).toLocaleString('es-AR')}</td>
            <td class="p-4 text-center">
                <button onclick="imprimirFactura('${f.id}')" class="text-slate-400 hover:text-indigo-600"><i class="fas fa-print"></i></button>
            </td>
        </tr>`;
    }).join("");

    if(kpiVentas) kpiVentas.innerText = `$${totalDia.toLocaleString('es-AR')}`;
}

async function renderInventario() {
    const container = document.getElementById("lista-productos");
    if (!container) return;

    const { data } = await _supabase.from("productos").select("*").order("nombre");
    container.innerHTML = data.map(prod => `
        <div class="bg-white rounded-3xl p-5 border border-slate-100 hover:shadow-md transition-all">
            <div class="flex justify-between mb-4">
                <div class="w-12 h-12 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600"><i class="fas ${prod.icono || 'fa-paw'} text-2xl"></i></div>
                <span class="text-[10px] font-black text-emerald-600 italic uppercase">Vital Can</span>
            </div>
            <h3 class="font-black text-slate-800 text-lg uppercase italic tracking-tighter">${prod.nombre}</h3>
            <p class="text-[10px] text-slate-400 font-bold mb-4 uppercase">SKU: ${prod.sku}</p>
            <div class="flex justify-between text-xs font-bold italic">
                <span class="text-slate-400 uppercase">Stock Mínimo</span>
                <span class="text-rose-500">${prod.stock_minimo} u.</span>
            </div>
        </div>`).join("");
}

async function prepararRecepcion() {
    const selectProd = document.getElementById("rec-producto");
    const selectDest = document.getElementById("rec-destino");
    if (!selectProd || !selectDest) return;

    const { data: prods } = await _supabase.from("productos").select("id, nombre, sku");
    selectProd.innerHTML = '<option value="">Seleccioná Vital Can...</option>' + 
        prods.map(p => `<option value="${p.id}">${p.nombre} (${p.sku})</option>`).join('');

    const { data: poss } = await _supabase.from("posiciones").select("id, estado");
    selectDest.innerHTML = '<option value="">Seleccioná Rack...</option>' + 
        poss.map(pos => `<option value="${pos.id}">${pos.id} ${pos.estado === 'vacio' ? '(VACÍO)' : ''}</option>`).join('');
}

async function renderMovimientos() {
    const tbody = document.getElementById("tabla-movimientos");
    if (!tbody) return;

    const { data } = await _supabase.from("movimientos").select("*, productos(nombre)").order("created_at", { ascending: false });
    tbody.innerHTML = data.map(mov => `
        <tr class="text-xs font-bold border-b border-slate-50">
            <td class="p-4 text-slate-400 uppercase italic">${new Date(mov.created_at).toLocaleDateString()}</td>
            <td class="p-4 text-slate-800 uppercase italic font-black">${mov.productos?.nombre || '---'}</td>
            <td class="p-4"><span class="px-2 py-0.5 rounded-full bg-slate-100 text-[9px] font-black italic uppercase">${mov.tipo}</span></td>
            <td class="p-4 text-slate-500 uppercase italic">${mov.origen} → ${mov.destino}</td>
            <td class="p-4 font-black">${mov.cantidad}</td>
        </tr>`).join("");
}

// ==========================================
// 4. LÓGICA DE NEGOCIO (PICKING Y FACTURACIÓN)
// ==========================================

async function procesarPicking(pedidoId) {
    if(!confirm("¿Deseas procesar el Picking (descontar stock) y facturar este pedido?")) return;

    try {
        // 1. Obtener detalles y precios
        const { data: detalles, error } = await _supabase
            .from('pedido_detalle')
            .select(`cantidad, producto_id, productos ( nombre, precios ( precio_venta ) )`)
            .eq('pedido_id', pedidoId);

        if (error) throw error;

        let totalPedido = 0;

        // 2. Por cada producto, descontar de los racks y registrar salida
        for (const item of detalles) {
            const precio = item.productos.precios[0]?.precio_venta || 0;
            totalPedido += (item.cantidad * precio);

            const { data: pos } = await _supabase
                .from('posiciones')
                .select('id, cantidad')
                .eq('producto_id', item.producto_id)
                .gt('cantidad', 0)
                .limit(1).single();

            if (pos) {
                const nuevaCant = pos.cantidad - item.cantidad;
                await _supabase.from('posiciones').update({ 
                    cantidad: nuevaCant, 
                    estado: nuevaCant <= 0 ? 'vacio' : 'ocupado',
                    producto_id: nuevaCant <= 0 ? null : item.producto_id 
                }).eq('id', pos.id);

                await _supabase.from('movimientos').insert([{
                    producto_id: item.producto_id,
                    tipo: 'SALIDA',
                    origen: pos.id,
                    destino: 'Venta Cliente',
                    cantidad: item.cantidad,
                    usuario: USUARIO_ACTUAL
                }]);
            }
        }

        // 3. Crear Factura Final
        await _supabase.from('facturas').insert([{
            pedido_id: pedidoId,
            cliente_nombre: detalles[0]?.cliente_nombre || 'Cliente Vital Can',
            total_neto: totalPedido,
            iva: totalPedido * 0.21,
            total_final: totalPedido * 1.21,
            usuario: USUARIO_ACTUAL
        }]);

        // 4. Actualizar Pedido
        await _supabase.from('pedidos').update({ estado: 'preparado' }).eq('id', pedidoId);

        alert("¡Proceso completado! Stock actualizado y Factura generada.");
        renderPedidos();
    } catch (e) {
        console.error(e);
        alert("Error en el picking/facturación.");
    }
}

// ==========================================
// 5. MODALES Y UI HELPERS
// ==========================================

function toggleSidebar() {
    document.getElementById("sidebar").classList.toggle("-translate-x-full");
}

function openDrawer(posId, prodName, qty, desc) {
    document.getElementById("drawer-pos-id").innerText = "Rack " + posId;
    document.getElementById("drawer-prod-name").innerText = prodName;
    document.getElementById("drawer-prod-qty").innerText = qty;
    document.getElementById("drawer-prod-desc").innerText = desc;
    document.getElementById("drawer").classList.remove("translate-x-full");
    document.getElementById("drawer-overlay").classList.remove("hidden");
}

function closeDrawer() {
    document.getElementById("drawer").classList.add("translate-x-full");
    document.getElementById("drawer-overlay").classList.add("hidden");
}

async function abrirModalPedido() {
    document.getElementById('modal-pedido').classList.remove('hidden');
    itemsPedidoTemporal = [];
    actualizarListaTemporal();
    const { data: prods } = await _supabase.from('productos').select('id, nombre, sku');
    const select = document.getElementById('ped-producto-select');
    select.innerHTML = prods.map(p => `<option value="${p.id}">${p.nombre} (${p.sku})</option>`).join('');
}

function cerrarModalPedido() {
    document.getElementById('modal-pedido').classList.add('hidden');
}

function agregarItemTemporal() {
    const select = document.getElementById('ped-producto-select');
    const cantInput = document.getElementById('ped-cantidad-input');
    if(!cantInput.value || cantInput.value <= 0) return;

    itemsPedidoTemporal.push({
        producto_id: select.value,
        nombre: select.options[select.selectedIndex].text,
        cantidad: parseInt(cantInput.value)
    });
    cantInput.value = '';
    actualizarListaTemporal();
}

function actualizarListaTemporal() {
    const container = document.getElementById('lista-items-temporal');
    if(itemsPedidoTemporal.length === 0) {
        container.innerHTML = '<p class="text-center text-slate-400 text-xs italic py-4">No hay productos añadidos aún.</p>';
        return;
    }
    container.innerHTML = itemsPedidoTemporal.map((item, index) => `
        <div class="flex justify-between items-center p-3 bg-slate-50 rounded-xl mb-2 font-bold text-xs italic uppercase">
            <span>${item.nombre}</span>
            <div class="flex items-center gap-4">
                <span class="bg-indigo-100 text-indigo-700 px-2 py-1 rounded-lg">${item.cantidad} u.</span>
                <button onclick="itemsPedidoTemporal.splice(${index}, 1); actualizarListaTemporal();" class="text-rose-500"><i class="fas fa-trash"></i></button>
            </div>
        </div>`).join('');
}

async function guardarPedidoSupabase() {
    const cliente = document.getElementById('ped-cliente').value;
    if(!cliente || itemsPedidoTemporal.length === 0) return alert("Faltan datos.");

    try {
        const { data: pedido, error } = await _supabase.from('pedidos').insert([{ 
            cliente_nombre: cliente, estado: 'pendiente', total_items: itemsPedidoTemporal.length 
        }]).select().single();
        if(error) throw error;

        const detalles = itemsPedidoTemporal.map(item => ({
            pedido_id: pedido.id,
            producto_id: item.producto_id,
            cantidad: item.cantidad
        }));
        await _supabase.from('pedido_detalle').insert(detalles);

        alert("Pedido guardado.");
        cerrarModalPedido();
        renderPedidos();
    } catch (e) { console.error(e); }
}
async function mostrarUsuario() {
    const userDisplay = document.getElementById("user-name"); // ID en el sidebar
    if (!userDisplay) return;

    // Intentamos obtener el usuario de la sesión de Supabase
    const { data: { user } } = await _supabase.auth.getUser();

    if (user) {
        // Mostramos el nombre si existe en el metadata, sino el email
        userDisplay.innerText = user.user_metadata?.full_name || user.email.split('@')[0];
    } else {
        userDisplay.innerText = "Meli Dev"; // Tu nombre por defecto
    }
}

async function imprimirFactura(facturaId) {
    try {
        // 1. Obtener datos de la factura
        const { data: factura, error: errF } = await _supabase
            .from('facturas')
            .select('*')
            .eq('id', facturaId)
            .single();
        
        if (errF) throw errF;

        // 2. Obtener detalles del pedido asociado
        const { data: detalles, error: errD } = await _supabase
            .from('pedido_detalle')
            .select(`cantidad, productos ( nombre, precio:precios(precio_venta) )`)
            .eq('pedido_id', factura.pedido_id);

        if (errD) throw errD;

        // 3. Generar HTML para la ventana de impresión
        const ventana = window.open('', '_blank');
        
        let filas = detalles.map(d => {
            const precioUnit = d.productos.precio[0]?.precio_venta || 0;
            const subtotal = precioUnit * d.cantidad;
            return `
                <tr>
                    <td style="padding: 5px; border-bottom: 1px solid #eee;">${d.productos.nombre}</td>
                    <td style="text-align: center; padding: 5px; border-bottom: 1px solid #eee;">${d.cantidad}</td>
                    <td style="text-align: right; padding: 5px; border-bottom: 1px solid #eee;">$${precioUnit.toLocaleString('es-AR')}</td>
                    <td style="text-align: right; padding: 5px; border-bottom: 1px solid #eee;">$${subtotal.toLocaleString('es-AR')}</td>
                </tr>
            `;
        }).join('');

        const contenido = `
            <html>
            <head>
                <title>Factura #${factura.id.substring(0,8)}</title>
                <style>
                    body { font-family: sans-serif; padding: 20px; max-width: 800px; mx-auto; }
                    .header { text-align: center; margin-bottom: 20px; text-transform: uppercase; }
                    .info { margin-bottom: 20px; font-size: 12px; color: #555; }
                    table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 12px; }
                    th { text-align: left; background: #f8f8f8; padding: 8px; font-size: 10px; uppercase; }
                    .totales { text-align: right; font-weight: bold; font-size: 14px; margin-top: 10px; }
                    .footer { margin-top: 40px; text-align: center; font-size: 10px; color: #999; }
                </style>
            </head>
            <body>
                <div class="header">
                    <h2>VITAL CAN</h2>
                    <p>Comprobante de Venta</p>
                </div>
                
                <div class="info">
                    <p><strong>Fecha:</strong> ${new Date(factura.created_at).toLocaleString()}</p>
                    <p><strong>Cliente:</strong> ${factura.cliente_nombre}</p>
                    <p><strong>Factura N°:</strong> ${factura.id}</p>
                    <p><strong>Vendedor:</strong> ${factura.usuario || 'Sistema'}</p>
                </div>

                <table>
                    <thead>
                        <tr>
                            <th>Producto</th>
                            <th style="text-align: center;">Cant.</th>
                            <th style="text-align: right;">Unitario</th>
                            <th style="text-align: right;">Subtotal</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${filas}
                    </tbody>
                </table>

                <div class="totales">
                    <p>Subtotal: $${factura.total_neto.toLocaleString('es-AR')}</p>
                    <p>IVA (21%): $${factura.iva.toLocaleString('es-AR')}</p>
                    <p style="font-size: 18px; color: #059669;">TOTAL: $${factura.total_final.toLocaleString('es-AR')}</p>
                </div>

                <div class="footer">
                    <p>Gracias por su compra</p>
                </div>
                
                <script>
                    window.onload = function() { window.print(); }
                </script>
            </body>
            </html>
        `;

        ventana.document.write(contenido);
        ventana.document.close();
    } catch (error) {
        console.error("Error al imprimir:", error);
        alert("No se pudo generar la factura para imprimir.");
    }
}

// Llamá a la función cuando cargue la página
window.addEventListener('DOMContentLoaded', mostrarUsuario);

// Escuchar teclas globales
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { cerrarModalPedido(); closeDrawer(); }
});

// ==========================================
// 6. INICIO
// ==========================================
window.onload = () => loadPage("inicio.html");