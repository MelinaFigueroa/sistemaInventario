// ==========================================
// 1. CONFIGURACIÓN Y ESTADO
// ==========================================
const _supabase = supabase.createClient(
    "https://omylruckqvesemrlomed.supabase.co",
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9teWxydWNrcXZlc2VtcmxvbWVkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAxNDE0MjIsImV4cCI6MjA4NTcxNzQyMn0.uWe09wGzCnYtIXPXTfhE7Z59iNda2YHjcqFBtKmcopU",
);

let itemsPedidoTemporal = [];
let USUARIO_ACTUAL = "Sistema";

// ==========================================
// 2. SISTEMA DE NOTIFICACIONES (SweetAlert2)
// ==========================================
const Notificar = {
    toast(mensaje, icono = 'success') {
        Swal.fire({
            text: mensaje,
            icon: icono,
            toast: true,
            position: 'top-end',
            showConfirmButton: false,
            timer: 3000,
            timerProgressBar: true,
            background: '#ffffff',
            color: '#1e293b'
        });
    },
    error(titulo, mensaje) {
        Swal.fire({
            title: titulo,
            text: mensaje,
            icon: 'error',
            confirmButtonColor: '#4f46e5',
            background: '#ffffff',
            confirmButtonText: 'ENTENDIDO'
        });
    },
    exito(titulo, mensaje) {
        Swal.fire({
            title: titulo,
            html: mensaje,
            icon: 'success',
            confirmButtonColor: '#4f46e5'
        });
    }
};

// ==========================================
// 2. CARGADOR DE PÁGINAS (SPA)
// ==========================================
async function loadPage(pageUrl) {
    const container = document.getElementById("view-container");
    if (!container) return;
    container.innerHTML = '<div class="flex justify-center py-20"><i class="fas fa-paw animate-bounce text-4xl text-indigo-500"></i></div>';

    try {
        const response = await fetch(pageUrl);
        const content = await response.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(content, "text/html");
        container.innerHTML = doc.querySelector("main") ? doc.querySelector("main").innerHTML : content;

        // Disparar renders según página
        if (pageUrl.includes("posiciones")) renderPosiciones();
        if (pageUrl.includes("pedidos")) renderPedidos();
        if (pageUrl.includes("facturacion")) renderFacturacion();
        if (pageUrl.includes("inicio")) actualizarDashboard();
        if (pageUrl.includes("movimientos")) renderMovimientos();
        if (pageUrl.includes("inventario")) renderInventario();
        if (pageUrl.includes("recepcion")) prepararRecepcion();

    } catch (error) {
        Notificar.error("ERROR", "No se pudo cargar la página.");
    }
}

// ==========================================
// 3. FUNCIONES DE RENDERIZADO (SUPABASE)
// ==========================================

async function actualizarDashboard() {
    const kpiStock = document.getElementById("kpi-stock");
    const kpiMovs = document.getElementById("kpi-movs");
    const kpiCritico = document.getElementById("kpi-critico");
    const contenedorAlertas = document.getElementById("contenedor-alertas");

    if (!kpiStock || !kpiMovs) return;

    // 1. Stock Total (Sumamos todas las posiciones)
    const { data: posData } = await _supabase.from("posiciones").select("cantidad");
    const total = posData ? posData.reduce((acc, curr) => acc + Math.max(0, curr.cantidad || 0), 0) : 0;
    kpiStock.innerText = total.toLocaleString();

    // 2. Contador de Movimientos
    const { count } = await _supabase.from("movimientos").select("*", { count: "exact", head: true });
    kpiMovs.innerText = count || 0;

    // 3. Lógica de Stock Crítico y Alertas (Logística)
    // Traemos productos y sus posiciones relacionadas
    const { data: productosCriticos } = await _supabase
        .from("productos")
        .select(`
            id, nombre, sku, stock_minimo,
            posiciones (cantidad)
        `);

    if (productosCriticos) {
        // Filtramos: Sumamos stock de todas las posiciones del producto y comparamos con su mínimo
        const alertas = productosCriticos.filter(p => {
            const stockActual = p.posiciones?.reduce((acc, curr) => acc + (curr.cantidad || 0), 0) || 0;
            // Si no tiene stock_minimo definido, usamos 5 por defecto
            return stockActual < (p.stock_minimo || 5);
        });

        // Actualizamos el KPI numérico (el de la tarjeta naranja)
        if (kpiCritico) kpiCritico.innerText = alertas.length;

        // Llenamos el panel de "Alertas Prioritarias" (contenedor-alertas)
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

async function renderPedidos() {
    const tbody = document.getElementById("lista-pedidos");
    if (!tbody) return;

    const { data, error } = await _supabase
        .from("pedidos")
        .select("*")
        .order("created_at", { ascending: false });
    if (error) return;

    tbody.innerHTML = data
        .map(
            (p) => `
        <tr class="hover:bg-slate-50 transition-colors border-b border-slate-50">
            <td class="p-4"><p class="font-black text-slate-800 uppercase">#${p.id.substring(0, 5)}</p></td>
            <td class="p-4 text-slate-700 font-bold uppercase italic">${p.cliente_nombre}</td>
            <td class="p-4 text-center">
                <span class="px-3 py-1 ${p.estado === "pendiente" ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"} text-[9px] font-black rounded-full italic uppercase">
                    ${p.estado}
                </span>
            </td>
            <td class="p-4 text-center">
                <button onclick="procesarPicking('${p.id}')" class="text-indigo-600 hover:text-indigo-800 p-2">
                    <i class="fas ${p.estado === "pendiente" ? "fa-box-open" : "fa-check-double"}"></i>
                </button>
            </td>
        </tr>`,
        )
        .join("");
}

async function renderFacturacion() {
    const tbody = document.getElementById("lista-facturas");
    const kpiVentas = document.getElementById("total-ventas-dia");
    if (!tbody) return;

    // Traemos todos los campos, incluyendo los nuevos
    const { data, error } = await _supabase
        .from("facturas")
        .select("*")
        .order("created_at", { ascending: false });
    if (error) return;

    let totalDia = 0;
    tbody.innerHTML = data
        .map((f) => {
            totalDia += parseFloat(f.total_final);

            // Si nro_comprobante no existe todavía, usamos el ID corto como backup
            const nroAMostrar = f.nro_comprobante
                ? f.nro_comprobante
                : f.id.substring(0, 8);

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
        // 1. Lógica de trazabilidad e íconos
        const origen = mov.origen || '---';
        const destino = mov.destino || '---';
        let trazabilidadIcon = 'fa-long-arrow-alt-right';
        
        if (destino.includes('VENTA') || destino.includes('CLIENTE')) trazabilidadIcon = 'fa-shipping-fast text-rose-400';
        if (origen.includes('PROVEEDOR')) trazabilidadIcon = 'fa-truck-loading text-emerald-400';
        if (origen.includes('RACK') && destino.includes('RACK')) trazabilidadIcon = 'fa-exchange-alt text-indigo-400';
if (mov.tipo.toUpperCase().includes('AJUSTE')) trazabilidadIcon = 'fa-tools text-amber-500';
        // 2. Lógica de colores (Entrada vs Salida)
        const esEntrada = mov.tipo.toUpperCase() === "ENTRADA";
        const badgeClass = esEntrada 
            ? 'bg-emerald-100 text-emerald-700 border-emerald-200' 
            : 'bg-rose-100 text-rose-700 border-rose-200';

        const iconTipo = esEntrada ? 'fa-arrow-down' : 'fa-arrow-up';
        const signo = esEntrada ? '+' : '-';
        const colorTexto = esEntrada ? 'text-emerald-600' : 'text-rose-600';

        // 3. UN SOLO RETURN con toda la fila armada
        return `
            <tr class="hover:bg-slate-50 transition-colors border-b border-slate-50">
                <td class="p-4 text-slate-400 text-[10px] uppercase font-bold">
                    ${new Date(mov.created_at).toLocaleDateString()}<br>
                    ${new Date(mov.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
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

//BUSCADOR/FILTRO RENDER MOVIMIENTOS

function filtrarMovimientos() {
    const term = document.getElementById('buscar-movimiento').value.toLowerCase();
    const filas = document.querySelectorAll('#tabla-movimientos tr');

    filas.forEach(fila => {
        const texto = fila.innerText.toLowerCase();
        fila.style.display = texto.includes(term) ? '' : 'none';
    });
}

//EXPORTAR PDF
function exportarTablaAExcel(idTabla, nombreArchivo = 'reporte-vitalcan') {
    const tabla = document.getElementById(idTabla);
    // Buscamos el body si la tabla está vacía o el elemento mismo
    const filas = Array.from(tabla.querySelectorAll('tr'));
    
    if (filas.length <= 1) { // 1 porque el header siempre está
        return Notificar.error("SIN DATOS", "No hay movimientos para exportar en este momento.");
    }

    // El BOM permite que Excel reconozca los acentos y la Ñ correctamente
    const BOM = "\uFEFF";
    const contenidoCsv = filas.map(fila => {
        const celdas = Array.from(fila.querySelectorAll('th, td'));
        return celdas.map(celda => {
            // Limpiamos el texto de saltos de línea y comillas
            let texto = celda.innerText.replace(/\n/g, ' ').replace(/"/g, '""').trim();
            return `"${texto}"`;
        }).join(';'); // Punto y coma es mejor para el Excel en español
    }).join('\n');

    const blob = new Blob([BOM + contenidoCsv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    
    link.setAttribute("href", url);
    link.setAttribute("download", `${nombreArchivo}_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    Notificar.toast("Descargando reporte de trazabilidad...", "success");
}


// ==========================================
// 4. LÓGICA DE NEGOCIO (PICKING Y FACTURACIÓN)
// ==========================================

async function procesarPicking(pedidoId) {
    // 1. Confirmación Moderna
    const { isConfirmed } = await Swal.fire({
        title: '¿Procesar Salida?',
        text: "Se generará la factura en AFIP y se descontará el stock.",
        icon: 'question',
        showCancelButton: true,
        confirmButtonColor: '#4f46e5',
        cancelButtonColor: '#94a3b8',
        confirmButtonText: 'SÍ, PROCESAR',
        cancelButtonText: 'CANCELAR'
    });

    if (!isConfirmed) return;

    //notificador con sweet alert

const Notificar = {
    // Para éxitos o avisos rápidos (Toast)
    toast(mensaje, icono = 'success') {
        Swal.fire({
            text: mensaje,
            icon: icono,
            toast: true,
            position: 'top-end',
            showConfirmButton: false,
            timer: 3000,
            timerProgressBar: true,
            background: '#ffffff',
            color: '#1e293b'
        });
    },
    // Para errores graves o validaciones (Modal)
    error(titulo, mensaje) {
        Swal.fire({
            title: titulo,
            text: mensaje,
            icon: 'error',
            confirmButtonColor: '#4f46e5', // El indigo-600 que usás
            background: '#ffffff',
            confirmButtonText: 'ENTENDIDO'
        });
    }
};

    // Loader: Bloqueamos la pantalla mientras AFIP responde
    Swal.fire({
        title: 'Autorizando con AFIP',
        text: 'Esto puede demorar unos segundos...',
        allowOutsideClick: false,
        didOpen: () => { Swal.showLoading(); }
    });

    try {
        // 1. Obtener detalles
        const { data: pedidoInfo, error: errP } = await _supabase
            .from("pedidos")
            .select(`cliente_nombre, pedido_detalle(cantidad, producto_id, productos(nombre, precios(precio_venta)))`)
            .eq("id", pedidoId)
            .single();

        if (errP) throw new Error("No se pudo obtener la info del pedido");

        // VALIDACIÓN DE STOCK
        for (const item of pedidoInfo.pedido_detalle) {
            const { data: stockDisponible } = await _supabase
                .from("posiciones")
                .select("cantidad")
                .eq("producto_id", item.producto_id)
                .gt("cantidad", 0);
            
            const totalReal = stockDisponible?.reduce((acc, curr) => acc + curr.cantidad, 0) || 0;

            if (totalReal < item.cantidad) {
                Notificar.error('STOCK INSUFICIENTE', 
                    `Producto: ${item.productos.nombre}\nNecesitás: ${item.cantidad} u.\nDisponible: ${totalReal} u.`);
                return; 
            }
        }

        const detalles = pedidoInfo.pedido_detalle;
        let totalPedido = 0;
        detalles.forEach((d) => {
            const precio = d.productos?.precios?.[0]?.precio_venta || 0;
            totalPedido += d.cantidad * precio;
        });

        if (totalPedido <= 0) totalPedido = 100;

        // 2. Invocar AFIP
        const { data: afipData, error: afipError } = await _supabase.functions.invoke("afip-invoice", {
            body: {
                pedidoId: pedidoId,
                total: totalPedido,
                cliente: pedidoInfo.cliente_nombre || "Consumidor Final",
            }
        });

        if (afipError || !afipData || !afipData.success) {
            throw new Error(afipData?.error || "AFIP no respondió correctamente");
        }

        // 3. Procesar Stock y Movimientos
        for (const item of detalles) {
            const { data: pos } = await _supabase
                .from("posiciones")
                .select("id, cantidad")
                .eq("producto_id", item.producto_id)
                .gt("cantidad", 0)
                .limit(1).single();

            if (pos) {
                const nuevaCant = pos.cantidad - item.cantidad;
                await _supabase.from("posiciones").update({
                    cantidad: nuevaCant,
                    estado: nuevaCant <= 0 ? "vacio" : "ocupado",
                    producto_id: nuevaCant <= 0 ? null : item.producto_id,
                }).eq("id", pos.id);

                await _supabase.from("movimientos").insert([{
                    producto_id: item.producto_id,
                    tipo: "SALIDA",
                    origen: pos.id,
                    destino: "Venta (CAE " + afipData.cae + ")",
                    cantidad: item.cantidad,
                    usuario: USUARIO_ACTUAL,
                }]);
            }
        }

 // 4. Guardar Factura en la Base de Datos
        await _supabase.from("facturas").insert([{
            pedido_id: pedidoId,
            cliente_nombre: pedidoInfo.cliente_nombre,
            total_neto: totalPedido,
            iva: totalPedido * 0.21,
            total_final: totalPedido * 1.21,
            usuario: USUARIO_ACTUAL,
            cae: afipData.cae,
            cae_vto: afipData.caeFchVto,
            nro_comprobante: afipData.nroComprobante,
        }]);

        // 5. Actualizar estado del Pedido a "preparado"
        await _supabase.from("pedidos")
            .update({ estado: "preparado" })
            .eq("id", pedidoId);

        // ÉXITO FINAL: Cerramos el loader y mostramos el CAE
        Swal.close(); 
        
        await Swal.fire({
            title: '¡FACTURA GENERADA!',
            html: `Se autorizó el CAE <b>${afipData.cae}</b> con éxito.<br>El stock ha sido descontado.`,
            icon: 'success',
            confirmButtonColor: '#4f46e5'
        });

        // Refrescar las listas para ver los cambios
        renderPedidos();
        if (typeof renderFacturacion === "function") renderFacturacion();

    } catch (e) {
        console.error(e);
        Swal.close();
        Notificar.error('ERROR EN EL PROCESO', e.message);
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

async function abrirModalPosicion() {
    const { value: nombreRack } = await Swal.fire({
        title: 'CREAR NUEVO RACK',
        input: 'text',
        inputLabel: 'Identificador (Ej: A-12, PASILLO-1)',
        inputPlaceholder: 'Escribí el nombre del rack...',
        showCancelButton: true,
        confirmButtonColor: '#4f46e5',
        confirmButtonText: 'CREAR AHORA',
        cancelButtonText: 'CANCELAR',
        inputValidator: (value) => { if (!value) return '¡El nombre es obligatorio!'; }
    });

    if (nombreRack) {
        const { error } = await _supabase.from('posiciones').insert([{ id: nombreRack.toUpperCase(), estado: 'vacio', cantidad: 0 }]);
        if (error) {
            Notificar.error('ERROR', 'Ese nombre de rack ya existe o hubo un problema de conexión.');
        } else {
            Notificar.toast(`Rack ${nombreRack.toUpperCase()} creado`);
            renderPosiciones();
        }
    }
}

async function abrirModalPedido() {
    // 1. Limpieza inicial para que no queden restos de un pedido anterior
    itemsPedidoTemporal = [];
    actualizarListaTemporal();
    
    // Limpiamos el input del cliente si existe
    const inputCliente = document.getElementById("ped-cliente");
    if (inputCliente) inputCliente.value = "";

    try {
        // 2. Traemos los productos de Supabase
        const { data: prods, error } = await _supabase
            .from("productos")
            .select("id, nombre, sku")
            .order("nombre", { ascending: true });

        if (error) throw error;

        // 3. Llenamos el select con los productos de Vital Can
        const select = document.getElementById("ped-producto-select");
        if (select) {
            select.innerHTML = prods
                .map((p) => `<option value="${p.id}">${p.nombre} (${p.sku})</option>`)
                .join("");
        }

        // 4. Mostramos el modal (quitamos la clase 'hidden')
        document.getElementById("modal-pedido").classList.remove("hidden");
        
        // 5. Un Toast sutil de que cargó todo bien
        Notificar.toast("Catálogo cargado", "info");

    } catch (e) {
        console.error("Error al abrir modal:", e);
        // Usamos tu alerta personalizada de error
        Notificar.error("ERROR DE CARGA", "No se pudieron obtener los productos de la base de datos.");
    }
}

async function abrirModalProducto() {
    const { value: formValues } = await Swal.fire({
        title: 'NUEVO PRODUCTO VITAL CAN',
        html: `
            <div class="text-left">
                <label class="text-[10px] font-black text-slate-400 uppercase ml-2">Nombre Comercial</label>
                <input id="swal-nombre" class="swal2-input !mt-1 !mb-4" placeholder="Ej: Vital Can Adulto 15kg">
                
                <label class="text-[10px] font-black text-slate-400 uppercase ml-2">SKU / Código de Barras (Escaneá ahora)</label>
                <input id="swal-sku" class="swal2-input !mt-1 !mb-4" placeholder="Escaneá con el celu...">
                
                <label class="text-[10px] font-black text-slate-400 uppercase ml-2">Stock Mínimo (Alerta)</label>
                <input id="swal-minimo" type="number" class="swal2-input !mt-1" placeholder="Ej: 10">
            </div>
        `,
        focusConfirm: false,
        showCancelButton: true,
        confirmButtonColor: '#4f46e5',
        confirmButtonText: 'GUARDAR PRODUCTO',
        cancelButtonText: 'CANCELAR',
        background: '#ffffff',
        didOpen: () => {
            // Ponemos el foco en el SKU por si quieren escanear de una
            document.getElementById('swal-sku').focus();
        },
        preConfirm: () => {
            const nombre = document.getElementById('swal-nombre').value;
            const sku = document.getElementById('swal-sku').value;
            const minimo = document.getElementById('swal-minimo').value;
            
            if (!nombre || !sku) {
                Swal.showValidationMessage('¡Nombre y SKU son obligatorios!');
                return false;
            }
            return { nombre, sku, stock_minimo: minimo };
        }
    });

    if (formValues) {
        try {
            const { error } = await _supabase.from('productos').insert([
                { 
                    nombre: formValues.nombre.toUpperCase(), 
                    sku: formValues.sku.toUpperCase(), 
                    stock_minimo: parseInt(formValues.stock_minimo) || 5 
                }
            ]);

            if (error) throw error;

            Notificar.toast("Producto guardado correctamente");
            renderInventario(); // Refresca la grilla que tenés abajo
        } catch (err) {
            Notificar.error("ERROR AL GUARDAR", "Es posible que el SKU ya exista en la base de datos.");
        }
    }
}
async function abrirModalNuevoProducto() {
    // 1. Intentamos recuperar lo que el OCR leyó del remito (si existe)
    const nombreSugerido = localStorage.getItem('temp_nombre_nuevo') || '';
    const skuSugerido = localStorage.getItem('temp_sku_nuevo') || '';

    const { value: formValues } = await Swal.fire({
        title: 'DAR DE ALTA NUEVO PRODUCTO',
        html: `
            <div class="text-left space-y-4 p-2">
                <div>
                    <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest italic">Nombre del Producto (Vital Can)</label>
                    <input id="swal-nombre" 
                           value="${nombreSugerido}" 
                           class="swal2-input w-full m-0 rounded-xl border-slate-200 text-sm font-bold uppercase" 
                           placeholder="Ej: BALANCED ADULTO 20KG">
                </div>
                
                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest italic">Código SKU / Barra</label>
                        <div class="flex gap-1">
                            <input id="swal-sku" 
                                   value="${skuSugerido}" 
                                   class="swal2-input w-full m-0 rounded-xl border-slate-200 text-sm font-bold" 
                                   placeholder="779...">
                            <button type="button" onclick="escanearSKUNuevo()" class="bg-indigo-100 text-indigo-600 px-3 rounded-xl hover:bg-indigo-600 hover:text-white transition-all">
                                <i class="fas fa-barcode"></i>
                            </button>
                        </div>
                    </div>
                    <div>
                        <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest italic">Stock Mínimo</label>
                        <input id="swal-minimo" type="number" class="swal2-input w-full m-0 rounded-xl border-slate-200 text-sm font-bold" placeholder="5">
                    </div>
                </div>
                
                <div class="bg-slate-50 p-3 rounded-2xl border border-dashed border-slate-200 mt-2">
                    <p class="text-[9px] font-black text-slate-400 uppercase mb-1">¿No subiste el remito?</p>
                    <button type="button" onclick="document.getElementById('rec-pdf').click(); Swal.close();" class="text-indigo-600 font-bold text-xs flex items-center gap-2 hover:underline">
                        <i class="fas fa-magic"></i> Escanear remito ahora
                    </button>
                </div>
            </div>
        `,
        focusConfirm: false,
        showCancelButton: true,
        confirmButtonText: 'GUARDAR PRODUCTO',
        cancelButtonText: 'CANCELAR',
        confirmButtonColor: '#4f46e5',
        preConfirm: () => {
            const nombre = document.getElementById('swal-nombre').value;
            const sku = document.getElementById('swal-sku').value;
            const minimo = document.getElementById('swal-minimo').value;
            
            if (!nombre || !sku) {
                Swal.showValidationMessage('Nombre y SKU son obligatorios');
                return false;
            }
            return { nombre: nombre.toUpperCase(), sku, stock_minimo: parseInt(minimo) || 0 };
        }
    });

    if (formValues) {
        try {
            const { data, error } = await _supabase
                .from('productos')
                .insert([formValues])
                .select();

            if (error) throw error;

            // Limpiamos los temporales para que no aparezcan en el próximo producto nuevo
            localStorage.removeItem('temp_nombre_nuevo');
            localStorage.removeItem('temp_sku_nuevo');

            await cargarProductosSelect(); 
            
            if (data && data[0]) {
                document.getElementById('rec-producto').value = data[0].id;
                Notificar.toast("Producto creado y seleccionado", "success");
            }

            Swal.fire('¡LISTO!', 'El producto ya está disponible.', 'success');

        } catch (err) {
            console.error(err);
            Swal.fire('ERROR', 'No se pudo crear. Revisá que el SKU no esté repetido.', 'error');
        }
    }
}

async function escanearSKUNuevo() {
    const { value: codigo } = await Swal.fire({
        title: 'ESCANEAR CÓDIGO',
        input: 'text',
        inputPlaceholder: 'Escaneá la bolsa...',
        showCancelButton: true,
        confirmButtonText: 'LISTO'
    });

    if (codigo) {
        const inputSku = document.getElementById('swal-sku');
        if (inputSku) inputSku.value = codigo;
        // Re-abrimos el modal de nuevo producto (porque Swal.fire cerró el anterior)
        // Nota: En una app pro, esto se maneja mejor con estados, 
        // pero para salir del paso, podés llamar a abrirModalNuevoProducto() de nuevo
    }
}

function cerrarModalPedido() {
    document.getElementById("modal-pedido").classList.add("hidden");
}

function agregarItemTemporal() {
    const select = document.getElementById("ped-producto-select");
    const cantInput = document.getElementById("ped-cantidad-input");
    if (!cantInput.value || cantInput.value <= 0) return;

    itemsPedidoTemporal.push({
        producto_id: select.value,
        nombre: select.options[select.selectedIndex].text,
        cantidad: parseInt(cantInput.value),
    });
    cantInput.value = "";
    actualizarListaTemporal();
}

function actualizarListaTemporal() {
    const container = document.getElementById("lista-items-temporal");
    if (itemsPedidoTemporal.length === 0) {
        container.innerHTML =
            '<p class="text-center text-slate-400 text-xs italic py-4">No hay productos añadidos aún.</p>';
        return;
    }
    container.innerHTML = itemsPedidoTemporal
        .map(
            (item, index) => `
        <div class="flex justify-between items-center p-3 bg-slate-50 rounded-xl mb-2 font-bold text-xs italic uppercase">
            <span>${item.nombre}</span>
            <div class="flex items-center gap-4">
                <span class="bg-indigo-100 text-indigo-700 px-2 py-1 rounded-lg">${item.cantidad} u.</span>
                <button onclick="itemsPedidoTemporal.splice(${index}, 1); actualizarListaTemporal();" class="text-rose-500"><i class="fas fa-trash"></i></button>
            </div>
        </div>`,
        )
        .join("");
}

async function guardarPedidoSupabase() {
    const cliente = document.getElementById("ped-cliente").value;
    if (!cliente || itemsPedidoTemporal.length === 0)
        return alert("Faltan datos.");

    try {
        const { data: pedido, error } = await _supabase
            .from("pedidos")
            .insert([
                {
                    cliente_nombre: cliente,
                    estado: "pendiente",
                    total_items: itemsPedidoTemporal.length,
                },
            ])
            .select()
            .single();
        if (error) throw error;

        const detalles = itemsPedidoTemporal.map((item) => ({
            pedido_id: pedido.id,
            producto_id: item.producto_id,
            cantidad: item.cantidad,
        }));
        await _supabase.from("pedido_detalle").insert(detalles);

        alert("Pedido guardado.");
        cerrarModalPedido();
        renderPedidos();
    } catch (e) {
        console.error(e);
    }
}
async function mostrarUsuario() {
    const userSidebarName = document.getElementById("user-sidebar-name");
    const userSidebarInitial = document.getElementById("user-sidebar-initial");
    const userHeaderGreeting = document.getElementById("user-header-greeting");

    // Intentamos obtener el usuario de la sesión de Supabase
    const {
        data: { user },
    } = await _supabase.auth.getUser();

    if (user) {
        // Obtenemos nombre o email
        const nombreCompleto = user.user_metadata?.full_name || user.email;
        const nombreCorto = nombreCompleto.split("@")[0]; // Si es email, sacamos lo de antes del @
        const inicial = nombreCompleto.charAt(0).toUpperCase();

        // Actualizar Sidebar
        if (userSidebarName) userSidebarName.innerText = nombreCorto;
        if (userSidebarInitial) userSidebarInitial.innerText = inicial;

        // Actualizar Saludo Header (Solo si existe en el HTML actual)
        if (userHeaderGreeting)
            userHeaderGreeting.innerText = `Bienvenida/o, ${nombreCorto}`;

        // Actualizar variable global para facturacion
        USUARIO_ACTUAL = nombreCorto;
    }
}

async function imprimirFactura(facturaId) {
    try {
        // 1. Obtener datos de la factura
        const { data: factura, error: errF } = await _supabase
            .from("facturas")
            .select("*")
            .eq("id", facturaId)
            .single();

        if (errF) throw errF;

        // 2. Obtener detalles del pedido asociado
        // Usamos la relación con productos para traer el nombre y el precio
        const { data: detalles, error: errD } = await _supabase
            .from("pedido_detalle")
            .select(`cantidad, productos ( nombre, precios ( precio_venta ) )`)
            .eq("pedido_id", factura.pedido_id);

        if (errD) throw errD;

        // 3. Generar la ventana de impresión
        const ventana = window.open("", "_blank");

        // Generar filas de la tabla
        let filas = detalles.map((d) => {
            const precioUnit = d.productos?.precios?.[0]?.precio_venta || 0;
            const subtotal = precioUnit * d.cantidad;
            return `
                <tr>
                    <td class="py-3 border-b border-slate-50">${d.productos.nombre}</td>
                    <td class="py-3 border-b border-slate-50 text-center">${d.cantidad}</td>
                    <td class="py-3 border-b border-slate-50 text-right">$${precioUnit.toLocaleString("es-AR")}</td>
                    <td class="py-3 border-b border-slate-50 text-right font-black">$${subtotal.toLocaleString("es-AR")}</td>
                </tr>
            `;
        }).join("");

        // Generar Datos para el QR oficial de AFIP
        const datosQR = {
            ver: 1,
            fecha: new Date(factura.created_at).toISOString().split("T")[0],
            cuit: 27344838890,
            puntoVta: 1,
            tipoCmp: parseInt(factura.tipo_comprobante) || 6,
            nroCmp: parseInt(factura.nro_comprobante),
            importe: factura.total_final,
            moneda: "PES",
            ctz: 1,
            codAut: factura.cae
        };
        
        const qrBase64 = btoa(JSON.stringify(datosQR));
        const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent("https://www.afip.gob.ar/fe/qr/?p=" + qrBase64)}`;

        const contenido = `
            <html>
            <head>
                <title>Factura #${factura.nro_comprobante}</title>
                <script src="https://cdn.tailwindcss.com"></script>
                <style>
                    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&display=swap');
                    @media print { .no-print { display: none; } }
                    body { font-family: 'Inter', sans-serif; background: #f8fafc; }
                </style>
            </head>
            <body class="p-10">
                <div class="max-w-3xl mx-auto bg-white shadow-xl rounded-3xl overflow-hidden border border-slate-100">
                    <div class="bg-slate-900 p-8 text-white flex justify-between items-center">
                        <div>
                            <h1 class="text-5xl font-black italic tracking-tighter">FACTURA</h1>
                            <p class="text-slate-400 text-sm mt-1">Punto de Venta: 00001 | Comp. N°: ${factura.nro_comprobante.toString().padStart(8, '0')}</p>
                        </div>
                        <div class="text-right">
                            <h2 class="text-2xl font-bold italic uppercase">Vital Can</h2>
                            <p class="text-xs text-slate-400 font-bold">CUIT: 27344838890</p>
                            <p class="text-xs text-slate-400 italic">Responsable Inscripto</p>
                        </div>
                    </div>

                    <div class="p-8">
                        <div class="flex justify-between border-b border-slate-100 pb-6 mb-6">
                            <div>
                                <p class="text-[10px] font-black text-slate-400 uppercase tracking-widest">Receptor</p>
                                <p class="text-lg font-bold text-slate-800 uppercase italic">${factura.cliente_nombre}</p>
                                <p class="text-xs text-slate-500 font-bold italic">CUIT: ${factura.cliente_cuit || '0'}</p>
                            </div>
                            <div class="text-right">
                                <p class="text-[10px] font-black text-slate-400 uppercase tracking-widest">Fecha de Emisión</p>
                                <p class="font-bold text-slate-800 italic">${new Date(factura.created_at).toLocaleDateString()}</p>
                            </div>
                        </div>

                        <table class="w-full mb-8">
                            <thead>
                                <tr class="text-[10px] font-black text-slate-400 uppercase border-b border-slate-100">
                                    <th class="text-left pb-2">Descripción</th>
                                    <th class="text-center pb-2">Cant.</th>
                                    <th class="text-right pb-2">Precio Unit.</th>
                                    <th class="text-right pb-2">Subtotal</th>
                                </tr>
                            </thead>
                            <tbody class="text-sm font-bold italic text-slate-600">
                                ${filas}
                            </tbody>
                        </table>

                        <div class="flex justify-between items-end mt-12 pt-6 border-t border-slate-100">
                            <div class="flex items-center gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                                <img src="${qrUrl}" class="w-24 h-24 shadow-sm bg-white p-1">
                                <div>
                                    <p class="text-[10px] font-black text-slate-500 uppercase">CAE: <span class="text-slate-900">${factura.cae}</span></p>
                                    <p class="text-[10px] font-black text-slate-500 uppercase">Vto. CAE: <span class="text-slate-900">${factura.cae_vto}</span></p>
                                    <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/d/d4/AFIP_logo.svg/2560px-AFIP_logo.svg.png" class="h-4 mt-2 opacity-50">
                                </div>
                            </div>

                            <div class="text-right">
                                <p class="text-slate-400 text-xs font-bold uppercase italic">Total de la Operación</p>
                                <p class="text-5xl font-black text-emerald-600 italic tracking-tighter">$${factura.total_final.toLocaleString("es-AR")}</p>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="text-center mt-8 no-print">
                    <button onclick="window.print()" class="bg-indigo-600 hover:bg-indigo-700 text-white px-10 py-4 rounded-2xl font-black shadow-xl transition-all uppercase italic tracking-wider">
                        <i class="fas fa-print mr-2"></i> Imprimir Comprobante
                    </button>
                </div>
            </body>
            </html>
        `;

        ventana.document.write(contenido);
        ventana.document.close();
    } catch (error) {
        console.error("Error al imprimir:", error);
        alert("Error: " + error.message);
    }
}

//ESCANER DE CAMARA PARA CODIGO DE BARRAS

async function activarEscaner() {
    const { value: codigo } = await Swal.fire({
        title: 'ESCANEAR PRODUCTO',
        input: 'text',
        inputPlaceholder: 'Escaneá el código de barras...',
        showCancelButton: true,
        confirmButtonText: 'BUSCAR',
        inputAttributes: { 'autofocus': 'true' }
    });

    if (codigo) {
        const select = document.getElementById('rec-producto');
        // Buscamos el producto que tenga ese SKU en su texto
        const opcion = Array.from(select.options).find(opt => opt.text.includes(codigo));
        
        if (opcion) {
            select.value = opcion.value;
            Notificar.exito("Producto Identificado", opcion.text);
        } else {
            Notificar.error("No Encontrado", "El código no coincide con ningún producto.");
        }
    }
}

async function subirRemito(archivo) {
    const fileExt = archivo.name.split('.').pop();
    const fileName = `${Date.now()}_remito.${fileExt}`;
    const filePath = `remitos/${fileName}`;

    // Subimos al bucket "logistica" (aseguráte de crearlo en Supabase)
    const { data, error } = await _supabase.storage
        .from('logistica')
        .upload(filePath, archivo);

    if (error) throw error;

    // Obtenemos la URL pública
    const { data: urlData } = _supabase.storage
        .from('logistica')
        .getPublicUrl(filePath);

    return urlData.publicUrl;
}

async function confirmarIngresoReal() {
    const fileInput = document.getElementById('rec-pdf');
    const archivo = fileInput.files[0];
    
    // Alerta de carga
    Swal.fire({
        title: 'PROCESANDO INGRESO',
        text: 'Subiendo documento y actualizando stock...',
        allowOutsideClick: false,
        didOpen: () => { Swal.showLoading(); }
    });

    try {
        let urlRemito = null;
        if (archivo) {
            urlRemito = await subirRemito(archivo);
        }

        // Guardamos el movimiento con la URL del PDF
        const { error } = await _supabase
            .from('movimientos')
            .insert([{
                producto_id: document.getElementById('rec-producto').value,
                cantidad: document.getElementById('rec-cantidad').value,
                tipo: 'ENTRADA',
                origen: 'PROVEEDOR',
                destino: document.getElementById('rec-destino').value,
                remito_url: urlRemito, // <--- Guardamos la URL aquí
                usuario: 'OPERARIO_VITALCAN'
            }]);

        if (error) throw error;

        Swal.fire('¡ÉXITO!', 'Mercadería recibida y documento guardado.', 'success');
        
    } catch (err) {
        console.error(err);
        Notificar.error("ERROR", "No se pudo procesar la recepción.");
    }
}

// Función estética para el label
async function actualizarNombreArchivo(input) {
    const file = input.files[0];
    if (!file) return;

    document.getElementById('label-archivo').innerText = `Procesando: ${file.name}...`;

    // Iniciamos la lectura automática
    Tesseract.recognize(file, 'spa').then(({ data: { text } }) => {
    // Si el operario tiene el modal de "Nuevo Producto" abierto o lo va a abrir:
    const esProductoNuevo = text.includes('NUEVO') || text.includes('DESCONOCIDO'); 
    
    if (esProductoNuevo) {
        // Buscamos algo que parezca un nombre de Vital Can (Mayúsculas largas)
        const matchNombre = text.match(/[A-Z]{4,}\s[A-Z]{4,}\s\d+KG/);
        if (matchNombre) {
            // Guardamos temporalmente para el modal
            localStorage.setItem('temp_nombre_nuevo', matchNombre[0]);
        }
    }
        
        // 1. Intentar buscar el Número de Remito (Patrón común: XXX-XXXX)
        const matchRemito = text.match(/\d{3,4}-\d{4,8}/);
        if (matchRemito) {
            document.getElementById('rec-remito').value = matchRemito[0];
        }

        // 2. Intentar buscar la Cantidad (Número cerca de palabras como 'unidades' o 'cant')
        const matchCant = text.match(/(?:CANT|CANTIDAD|UNIDADES)[:\s]+(\d+)/i);
        if (matchCant) {
            document.getElementById('rec-cantidad').value = matchCant[1];
        }

        Notificar.toast("Datos del remito extraídos", "info");
        document.getElementById('label-archivo').innerText = `Archivo listo: ${file.name}`;
    });
}

// Llamá a la función cuando cargue la página
window.addEventListener("DOMContentLoaded", mostrarUsuario);

// Escuchar teclas globales
document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
        cerrarModalPedido();
        closeDrawer();
    }
});

document.addEventListener('DOMContentLoaded', () => {
    // Si estamos en la sección de movimientos, cargamos los datos
    if (document.getElementById('tabla-movimientos')) {
        renderMovimientos();
    }
});

// ==========================================
// 6. INICIO
// ==========================================
window.onload = () => loadPage("inicio.html");
