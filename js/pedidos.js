// js/pedidos.js - Lógica de pedidos y facturación

// ==========================================
// GESTIÓN DE PEDIDOS
// ==========================================
async function abrirModalPedido() {
    itemsPedidoTemporal = [];
    actualizarListaTemporal();

    try {
        // 1. Cargar Productos
        const { data: prods, error: errorP } = await _supabase
            .from("productos")
            .select("id, nombre, sku")
            .order("nombre", { ascending: true });

        if (errorP) throw errorP;

        const selectProd = document.getElementById("ped-producto-select");
        if (selectProd) {
            selectProd.innerHTML = prods
                .map((p) => `<option value="${p.id}">${p.nombre} (${p.sku})</option>`)
                .join("");
        }

        // 2. Cargar Clientes
        const { data: clientes, error: errorC } = await _supabase
            .from("clientes")
            .select("id, nombre, cuit, estado") // Traemos el estado para el control
            .order("nombre", { ascending: true });

        if (errorC) throw errorC;

        const selectCli = document.getElementById("ped-cliente-select");
        if (selectCli) {
            selectCli.innerHTML = '<option value="">Seleccioná un cliente...</option>' +
                clientes.map((c) => `<option value="${c.id}" data-cuit="${c.cuit}" data-estado="${c.estado}">${c.nombre}</option>`).join("");

            // Listener proactivo para bloqueo de deudores
            selectCli.onchange = (e) => {
                const opt = e.target.options[e.target.selectedIndex];
                const estado = opt.getAttribute('data-estado');
                const btnGuardar = document.getElementById("btn-confirmar-pedido");

                if (estado === 'deudor') {
                    if (btnGuardar) {
                        btnGuardar.disabled = true;
                        btnGuardar.classList.add('opacity-50', 'cursor-not-allowed', 'bg-slate-400');
                        btnGuardar.classList.remove('bg-indigo-600');
                    }
                    Swal.fire({
                        title: 'CLIENTE BLOQUEADO',
                        text: 'Este cliente es DEUDOR. No se pueden cargar pedidos hasta que regularice su situación en Administración.',
                        icon: 'warning',
                        confirmButtonColor: '#f43f5e'
                    });
                } else {
                    if (btnGuardar) {
                        btnGuardar.disabled = false;
                        btnGuardar.classList.remove('opacity-50', 'cursor-not-allowed', 'bg-slate-400');
                        btnGuardar.classList.add('bg-indigo-600');
                    }
                }
            };
        }

        document.getElementById("modal-pedido").classList.remove("hidden");
        Notificar.toast("Datos cargados", "info");

    } catch (e) {
        console.error("Error al abrir modal:", e);
        Notificar.error("ERROR DE CARGA", "No se pudieron obtener los datos de la base de datos.");
    }
}

function cerrarModalPedido() {
    document.getElementById("modal-pedido").classList.add("hidden");
    itemsPedidoTemporal = [];
    actualizarListaTemporal();
}

function agregarItemTemporal() {
    const select = document.getElementById("ped-producto-select");
    const cantidadInput = document.getElementById("ped-cantidad-input");

    const productoId = select.value;
    const productoNombre = select.options[select.selectedIndex].text;
    const cantidad = parseInt(cantidadInput.value);

    if (!productoId || cantidad <= 0) {
        Notificar.error("DATOS INCOMPLETOS", "Seleccioná un producto y una cantidad válida.");
        return;
    }

    // Verificar si ya existe en la lista temporal
    const existente = itemsPedidoTemporal.find(item => item.productoId === productoId);
    if (existente) {
        existente.cantidad += cantidad;
    } else {
        itemsPedidoTemporal.push({
            productoId,
            productoNombre,
            cantidad
        });
    }

    cantidadInput.value = "";
    actualizarListaTemporal();
    Notificar.toast(`${productoNombre} añadido`, "success");
}

function actualizarListaTemporal() {
    const contenedor = document.getElementById("lista-items-temporal");
    if (!contenedor) return;

    if (itemsPedidoTemporal.length === 0) {
        contenedor.innerHTML = '<p class="text-center text-slate-400 text-xs italic py-4">No hay productos añadidos aún.</p>';
    } else {
        contenedor.innerHTML = itemsPedidoTemporal.map((item, idx) => `
            <div class="flex justify-between items-center py-2 px-3 bg-slate-50 rounded-xl mb-2">
                <div>
                    <p class="text-xs font-bold text-slate-800">${item.productoNombre}</p>
                    <p class="text-[10px] text-slate-400">Cantidad: ${item.cantidad}</p>
                </div>
                <button onclick="eliminarItemTemporal(${idx})" class="text-rose-400 hover:text-rose-600">
                    <i class="fas fa-trash-alt text-xs"></i>
                </button>
            </div>
        `).join("");
    }
}

function eliminarItemTemporal(indice) {
    itemsPedidoTemporal.splice(indice, 1);
    actualizarListaTemporal();
}

async function guardarPedidoSupabase() {
    const selectCli = document.getElementById("ped-cliente-select");
    const clienteId = selectCli?.value;
    const clienteNombre = selectCli?.options[selectCli.selectedIndex]?.text;
    const clienteCuit = selectCli?.options[selectCli.selectedIndex]?.getAttribute('data-cuit') || "0";

    if (!clienteId || itemsPedidoTemporal.length === 0) {
        Notificar.error("DATOS INCOMPLETOS", "Seleccioná un cliente y añadí al menos un producto.");
        return;
    }

    try {
        // 0. Validación de Crédito (Seguridad Financiera)
        const { data: cliente, error: errC } = await _supabase
            .from("clientes")
            .select("estado")
            .eq("id", clienteId)
            .single();

        if (cliente?.estado === "deudor") {
            Swal.fire({
                title: 'CLIENTE DEUDOR BLOQUEADO',
                text: 'Este cliente tiene facturas impagas y no puede generar nuevos pedidos.',
                icon: 'error',
                confirmButtonColor: '#f43f5e'
            });
            return;
        }

        // 1. Insertar el pedido
        const { data: pedido, error: errorPedido } = await _supabase
            .from("pedidos")
            .insert([{
                cliente_id: clienteId, // Link real para integridad
                cliente_nombre: clienteNombre,
                cliente_cuit: clienteCuit,
                estado: "pendiente"
            }])
            .select()
            .single();

        if (errorPedido) throw errorPedido;

        // 2. Insertar los detalles del pedido
        const detalles = itemsPedidoTemporal.map(item => ({
            pedido_id: pedido.id,
            producto_id: item.productoId,
            cantidad: item.cantidad
        }));

        const { error: errorDetalles } = await _supabase
            .from("pedido_detalle")
            .insert(detalles);

        if (errorDetalles) throw errorDetalles;

        Notificar.toast("Pedido guardado exitosamente", "success");
        cerrarModalPedido();
        if (typeof renderPedidos === 'function') renderPedidos();

    } catch (e) {
        console.error("Error guardando pedido:", e);
        Notificar.error("ERROR", "No se pudo guardar el pedido.");
    }
}

// ==========================================
// PROCESAMIENTO DE PICKING Y FACTURACIÓN
// ==========================================
// ==========================================
// LOGÍSTICA: PICKING Y HOJA DE RUTA (FEFO)
// ==========================================
async function generarHojaDeRuta(pedidoId) {
    try {
        Swal.fire({
            title: 'Calculando ruta óptima...',
            text: 'Buscando lotes por vencimiento (FEFO)',
            allowOutsideClick: false,
            didOpen: () => { Swal.showLoading(); }
        });

        // 1. Obtener ítems del pedido
        const { data: detalles, error: errD } = await _supabase
            .from("pedido_detalle")
            .select(`
                cantidad,
                producto_id,
                productos ( nombre, sku )
            `)
            .eq("pedido_id", pedidoId);

        if (errD) throw errD;

        let hojaDeRuta = [];

        // 2. Para cada ítem, buscar la mejor posición (FEFO)
        for (const item of detalles) {
            // Buscamos lotes de este producto ordenados por vencimiento (el que vence primero arriba)
            const { data: lotesDisponibles, error: errL } = await _supabase
                .from("lotes")
                .select(`
                    id,
                    numero_lote,
                    vencimiento,
                    cantidad_actual,
                    posicion_id,
                    posiciones ( id )
                `)
                .eq("producto_id", item.producto_id)
                .gt("cantidad_actual", 0)
                .order("vencimiento", { ascending: true });

            if (errL) throw errL;

            let cantidadRestante = item.cantidad;

            for (const lote of lotesDisponibles) {
                if (cantidadRestante <= 0) break;

                const cantidadAPickear = Math.min(lote.cantidad_actual, cantidadRestante);

                hojaDeRuta.push({
                    rack: lote.posicion_id,
                    producto: item.productos.nombre,
                    sku: item.productos.sku,
                    cantidad: cantidadAPickear,
                    lote: lote.numero_lote,
                    vencimiento: lote.vencimiento
                });

                cantidadRestante -= cantidadAPickear;
            }

            if (cantidadRestante > 0) {
                Notificar.error("STOCK INSUFICIENTE", `No hay suficiente stock FEFO para ${item.productos.nombre}`);
            }
        }

        // 3. Ordenar ruta lógicamente por nombre de Rack (A1, A2, B1...)
        hojaDeRuta.sort((a, b) => a.rack.localeCompare(b.rack));

        Swal.close();

        // 4. Mostrar Hoja de Ruta al operario
        const htmlRuta = `
            <div class="text-left space-y-4 max-h-[60vh] overflow-y-auto">
                ${hojaDeRuta.map(r => `
                    <div class="p-4 bg-slate-50 border-l-4 border-indigo-500 rounded-r-2xl">
                        <div class="flex justify-between items-start mb-2">
                            <span class="bg-indigo-600 text-white px-3 py-1 rounded-full font-black text-xs italic uppercase tracking-tighter">
                                RACK: ${r.rack}
                            </span>
                            <span class="text-[10px] font-bold text-rose-500 uppercase italic">Vence: ${formatearFecha(r.vencimiento)}</span>
                        </div>
                        <p class="font-black text-slate-800 uppercase italic leading-tight">${r.producto}</p>
                        <div class="flex justify-between items-center mt-2 border-t border-slate-200 pt-2">
                            <span class="text-[10px] text-slate-400 font-bold uppercase">Lote: ${r.lote}</span>
                            <span class="text-xl font-black text-indigo-700 italic">${r.cantidad} <small class="text-[10px]">u.</small></span>
                        </div>
                    </div>
                `).join('')}
            </div>
            <button onclick="Swal.close(); abrirValidadorPedido('${pedidoId}')" 
                class="w-full bg-emerald-500 text-white py-4 rounded-2xl font-black mt-6 shadow-lg shadow-emerald-100 uppercase italic flex items-center justify-center gap-2">
                <i class="fas fa-barcode"></i> EMPEZAR VALIDACIÓN
            </button>
        `;

        Swal.fire({
            title: 'RUTA DE PICKING (FEFO)',
            html: htmlRuta,
            showConfirmButton: false,
            width: '95%',
            customClass: {
                popup: 'rounded-3xl'
            }
        });

    } catch (e) {
        console.error("Error generando hoja de ruta:", e);
        Swal.close();
        Notificar.error("ERROR", "No se pudo generar la hoja de ruta.");
    }
}

// ==========================================
// VALIDACIÓN POR CÁMARA (CHECKLIST)
// ==========================================
let validacionActual = {
    pedidoId: null,
    itemsRestantes: [],
    itemsEscaneados: []
};

async function abrirValidadorPedido(pedidoId) {
    try {
        const { data: detalles, error } = await _supabase
            .from("pedido_detalle")
            .select(`cantidad, productos(nombre, sku)`)
            .eq("pedido_id", pedidoId);

        if (error) throw error;

        validacionActual = {
            pedidoId: pedidoId,
            itemsRestantes: detalles.map(d => ({ ...d, escaneados: 0 })),
            itemsEscaneados: []
        };

        renderizarValidador();

    } catch (e) {
        console.error(e);
        Notificar.error("ERROR", "No se pudo iniciar la validación.");
    }
}

function renderizarValidador() {
    const totalItems = validacionActual.itemsRestantes.reduce((acc, i) => acc + i.cantidad, 0);
    const escaneadosCount = validacionActual.itemsEscaneados.length;
    const progreso = (escaneadosCount / totalItems) * 100;

    Swal.fire({
        title: 'VALIDACIÓN DE PEDIDO',
        html: `
            <div class="text-left">
                <div class="mb-4 bg-slate-100 rounded-2xl p-4 overflow-hidden relative">
                    <div class="h-2 bg-indigo-200 absolute bottom-0 left-0 transition-all duration-500" style="width: ${progreso}%"></div>
                    <div class="flex justify-between items-center relative">
                        <span class="text-[10px] font-black uppercase text-slate-500 italic">Progreso de Picking</span>
                        <span class="text-xl font-black text-indigo-600 italic">${escaneadosCount}/${totalItems}</span>
                    </div>
                </div>

                <div class="space-y-2 mb-6 max-h-[40vh] overflow-y-auto" id="checklist-picking">
                    ${validacionActual.itemsRestantes.map(item => `
                        <div class="flex justify-between items-center p-3 rounded-xl border-2 ${item.escaneados >= item.cantidad ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-slate-100'}">
                            <div class="min-w-0">
                                <p class="text-xs font-black text-slate-800 uppercase italic truncate">${item.productos.nombre}</p>
                                <p class="text-[9px] font-bold text-slate-400">SKU: ${item.productos.sku}</p>
                            </div>
                            <div class="text-right flex-shrink-0 ml-4">
                                <span class="font-black ${item.escaneados >= item.cantidad ? 'text-emerald-600' : 'text-slate-400'} italic">
                                    ${item.escaneados}/${item.cantidad}
                                </span>
                            </div>
                        </div>
                    `).join('')}
                </div>

                <div class="grid grid-cols-2 gap-3">
                    <button onclick="cerrarValidador()" class="bg-slate-200 text-slate-600 py-4 rounded-2xl font-black uppercase italic text-xs">Cancelar</button>
                    <button onclick="escanearProductoPicking()" class="bg-indigo-600 text-white py-4 rounded-2xl font-black uppercase italic text-xs flex items-center justify-center gap-2">
                        <i class="fas fa-camera"></i> ESCANEAR
                    </button>
                </div>

                ${escaneadosCount >= totalItems ? `
                    <button onclick="finalizarValidation()" class="w-full bg-emerald-500 text-white py-5 rounded-2xl font-black uppercase italic mt-4 shadow-xl shadow-emerald-100 animate-pulse">
                        <i class="fas fa-check-circle"></i> TODO VALIDADO - FACTURAR
                    </button>
                ` : ''}
            </div>
        `,
        showConfirmButton: false,
        allowOutsideClick: false,
        width: '95%'
    });
}

function escanearProductoPicking() {
    if (typeof abrirScannerMobile !== 'function') return;

    abrirScannerMobile((skuEscaneado) => {
        const itemIndex = validacionActual.itemsRestantes.findIndex(i => i.productos.sku === skuEscaneado && i.escaneados < i.cantidad);

        if (itemIndex !== -1) {
            validacionActual.itemsRestantes[itemIndex].escaneados++;
            validacionActual.itemsEscaneados.push(skuEscaneado);
            Notificar.toast("Producto validado correctamente", "success");
            renderizarValidador();
        } else {
            const pertenece = validacionActual.itemsRestantes.find(i => i.productos.sku === skuEscaneado);
            if (pertenece) {
                Notificar.error("CANTIDAD EXCEDIDA", "Ya escaneaste todas las unidades de este producto.");
            } else {
                Notificar.error("¡ALERTA ROJA!", `El SKU ${skuEscaneado} no pertenece a este pedido.`);
            }
            renderizarValidador();
        }
    });
}

function cerrarValidador() {
    Swal.close();
}

async function finalizarValidation() {
    const pedidoId = validacionActual.pedidoId;
    cerrarValidador();
    procesarPicking(pedidoId);
}

// ==========================================
// PROCESAMIENTO DE PICKING Y FACTURACIÓN (REAL)
// ==========================================
async function procesarPicking(pedidoId) {
    const { isConfirmed } = await Swal.fire({
        title: '¿Confirmar Salida y Facturar?',
        text: "Se generará el comprobante legal y se descontará el stock físico.",
        icon: 'question',
        showCancelButton: true,
        confirmButtonColor: '#10b981',
        cancelButtonColor: '#94a3b8',
        confirmButtonText: 'SÍ, FINALIZAR',
        cancelButtonText: 'REVISAR'
    });

    if (!isConfirmed) return;

    Swal.fire({
        title: 'Autorizando con AFIP',
        text: 'Generando CAE y descontando stock...',
        allowOutsideClick: false,
        didOpen: () => { Swal.showLoading(); }
    });

    try {
        const { data: pedidoInfo, error: errP } = await _supabase
            .from("pedidos")
            .select(`cliente_nombre, cliente_cuit, pedido_detalle(cantidad, producto_id, productos(nombre, precios(precio_venta)))`)
            .eq("id", pedidoId)
            .single();

        if (errP) throw new Error("No se pudo obtener la info del pedido");

        let totalPedido = 0;
        pedidoInfo.pedido_detalle.forEach((d) => {
            const precio = d.productos?.precios?.[0]?.precio_venta || 0;
            totalPedido += d.cantidad * precio;
        });

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

        for (const item of pedidoInfo.pedido_detalle) {
            let cantPendiente = item.cantidad;
            const { data: lotes } = await _supabase
                .from("lotes")
                .select("id, cantidad_actual, posicion_id")
                .eq("producto_id", item.producto_id)
                .gt("cantidad_actual", 0)
                .order("vencimiento", { ascending: true });

            for (const lote of lotes) {
                if (cantPendiente <= 0) break;
                const cantADescontar = Math.min(lote.cantidad_actual, cantPendiente);

                await _supabase.from("lotes").update({
                    cantidad_actual: lote.cantidad_actual - cantADescontar
                }).eq("id", lote.id);

                const { data: pos } = await _supabase.from("posiciones").select("cantidad").eq("id", lote.posicion_id).single();
                const nuevaCantPos = pos.cantidad - cantADescontar;

                await _supabase.from("posiciones").update({
                    cantidad: nuevaCantPos,
                    estado: nuevaCantPos <= 0 ? "vacio" : "ocupado",
                    producto_id: nuevaCantPos <= 0 ? null : item.producto_id,
                }).eq("id", lote.posicion_id);

                await _supabase.from("movimientos").insert([{
                    producto_id: item.producto_id,
                    tipo: "SALIDA",
                    origen: lote.posicion_id,
                    destino: "Venta (CAE " + afipData.cae + ")",
                    cantidad: cantADescontar,
                    usuario: USUARIO_ACTUAL,
                }]);

                cantPendiente -= cantADescontar;
            }
        }

        await _supabase.from("facturas").insert([{
            pedido_id: pedidoId,
            cliente_nombre: pedidoInfo.cliente_nombre,
            cliente_cuit: pedidoInfo.cliente_cuit,
            total_neto: totalPedido,
            iva: totalPedido * 0.21,
            total_final: totalPedido * 1.21,
            usuario: USUARIO_ACTUAL,
            cae: afipData.cae,
            cae_vto: afipData.caeFchVto,
            nro_comprobante: afipData.nroComprobante,
        }]);

        await _supabase.from("pedidos").update({ estado: "preparado" }).eq("id", pedidoId);

        Swal.close();
        await Swal.fire({
            title: '¡DESPACHO EXITOSO!',
            html: `CAE: <b>${afipData.cae}</b><br>Pedido finalizado y stock actualizado.`,
            icon: 'success',
            confirmButtonColor: '#4f46e5'
        });

        renderPedidos();
        if (typeof renderFacturacion === "function") renderFacturacion();

    } catch (e) {
        console.error(e);
        Swal.close();
        Notificar.error('ERROR EN FACTURACIÓN', e.message);
    }
}

async function imprimirFactura(facturaId) {
    try {
        Notificar.toast("Preparando documento...", "info");

        // 1. Obtener datos de la factura
        const { data: factura, error: errF } = await _supabase
            .from("facturas")
            .select("*")
            .eq("id", facturaId)
            .single();

        if (errF) throw new Error("No se pudo obtener la factura");

        // 2. Obtener detalles del pedido relacionado para listar productos
        const { data: detalles, error: errD } = await _supabase
            .from("pedido_detalle")
            .select(`
                cantidad,
                productos ( nombre, sku )
            `)
            .eq("pedido_id", factura.pedido_id);

        if (errD) throw new Error("No se pudieron obtener los detalles del pedido");

        // 3. Crear ventana de impresión
        const printWindow = window.open('', '_blank', 'width=800,height=800');

        // Formatear items para la tabla
        const itemsHtml = detalles.map(d => `
            <tr>
                <td style="padding: 12px; border-bottom: 1px solid #f1f5f9;">
                    <div style="font-weight: bold; color: #1e293b;">${d.productos?.nombre || 'Producto'}</div>
                    <div style="font-size: 10px; color: #64748b;">SKU: ${d.productos?.sku || '---'}</div>
                </td>
                <td style="padding: 12px; border-bottom: 1px solid #f1f5f9; text-align: center; font-weight: bold;">${d.cantidad}</td>
                <td style="padding: 12px; border-bottom: 1px solid #f1f5f9; text-align: right; font-weight: bold;">$---</td>
            </tr>
        `).join('');

        const fechaDoc = new Date(factura.created_at).toLocaleDateString('es-AR', {
            day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
        });

        printWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Factura Vital Can - #${factura.nro_comprobante || 'DOC'}</title>
                <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&display=swap" rel="stylesheet">
                <style>
                    body { font-family: 'Inter', sans-serif; margin: 0; padding: 40px; color: #334155; line-height: 1.5; }
                    .invoice-card { max-width: 800px; margin: auto; }
                    .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 4px solid #4f46e5; padding-bottom: 20px; margin-bottom: 30px; }
                    .brand { font-size: 28px; font-weight: 900; color: #4f46e5; font-style: italic; letter-spacing: -1px; }
                    .invoice-info { text-align: right; }
                    .invoice-info h1 { margin: 0; font-size: 20px; color: #1e293b; text-transform: uppercase; }
                    .client-box { background: #f8fafc; padding: 20px; border-radius: 16px; margin-bottom: 30px; border: 1px solid #e2e8f0; }
                    .label { font-size: 10px; font-weight: 900; color: #94a3b8; text-transform: uppercase; margin-bottom: 4px; }
                    table { width: 100%; border-collapse: collapse; }
                    th { text-align: left; font-size: 11px; text-transform: uppercase; color: #64748b; padding: 12px; background: #f1f5f9; }
                    .totals { margin-top: 30px; border-top: 2px solid #f1f5f9; padding-top: 20px; }
                    .total-row { display: flex; justify-content: flex-end; gap: 40px; margin-bottom: 8px; }
                    .grand-total { font-size: 24px; font-weight: 900; color: #4f46e5; border-top: 2px solid #4f46e5; padding-top: 10px; margin-top: 10px; }
                    .afip-footer { margin-top: 60px; padding: 20px; border: 2px dashed #e2e8f0; border-radius: 16px; display: flex; justify-content: space-between; align-items: center; }
                    .cae-data { font-size: 12px; font-weight: bold; }
                    @media print { .no-print { display: none; } }
                </style>
            </head>
            <body>
                <div class="invoice-card">
                    <div class="header">
                        <div>
                            <div class="brand">VITAL CAN WMS</div>
                            <p style="font-size: 12px; color: #64748b; margin: 5px 0;">Distribuidora de Alimentos Balanceados<br>Buenos Aires, Argentina</p>
                        </div>
                        <div class="invoice-info">
                            <h1>FACTURA ELECTRÓNICA</h1>
                            <p style="font-weight: bold; margin: 5px 0;">Nro: ${factura.nro_comprobante || 'PENDIENTE'}</p>
                            <p style="font-size: 12px; color: #64748b; margin: 0;">Fecha: ${fechaDoc}</p>
                        </div>
                    </div>

                    <div class="client-box">
                        <div class="label">Receptor / Cliente</div>
                        <div style="font-size: 18px; font-weight: 900; color: #1e293b; text-transform: uppercase; font-style: italic;">${factura.cliente_nombre}</div>
                        ${factura.cliente_cuit ? `<div style="font-size: 13px; margin-top: 5px;">CUIT: ${factura.cliente_cuit}</div>` : ''}
                    </div>

                    <table>
                        <thead>
                            <tr>
                                <th>Descripción del Producto</th>
                                <th style="text-align: center;">Cantidad</th>
                                <th style="text-align: right;">Total Item</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${itemsHtml}
                        </tbody>
                    </table>

                    <div class="totals">
                        <div class="total-row">
                            <span style="color: #64748b;">Subtotal Neto (21%)</span>
                            <span style="font-weight: bold;">$${parseFloat(factura.total_neto).toLocaleString('es-AR')}</span>
                        </div>
                        <div class="total-row">
                            <span style="color: #64748b;">IVA Inscripto</span>
                            <span style="font-weight: bold;">$${parseFloat(factura.iva).toLocaleString('es-AR')}</span>
                        </div>
                        <div class="total-row grand-total">
                            <span>TOTAL A PAGAR</span>
                            <span>$${parseFloat(factura.total_final).toLocaleString('es-AR')}</span>
                        </div>
                    </div>

                    <div class="afip-footer">
                        <div class="cae-data">
                            <div>CAE Nro: ${factura.cae || '---'}</div>
                            <div style="color: #64748b; font-size: 10px; margin-top: 4px;">Vto. CAE: ${factura.cae_vto || '---'}</div>
                        </div>
                        <div style="text-align: right;">
                            <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/e/e4/Logo_AFIP.svg/1200px-Logo_AFIP.svg.png" height="30">
                            <div style="font-size: 8px; color: #94a3b8; margin-top: 4px;">Comprobante Autorizado por AFIP</div>
                        </div>
                    </div>

                    <div class="no-print" style="margin-top: 50px; text-align: center;">
                        <button onclick="window.print()" style="background: #4f46e5; color: white; padding: 16px 32px; border: none; border-radius: 12px; font-weight: 900; cursor: pointer; text-transform: uppercase; box-shadow: 0 10px 15px -3px rgba(79, 70, 229, 0.4);">
                            <i class="fas fa-print"></i> Imprimir Comprobante
                        </button>
                    </div>
                </div>
            </body>
            </html>
        `);
        printWindow.document.close();

    } catch (e) {
        console.error("Error en impresión:", e);
        Notificar.error("ERROR", "No se pudo generar el documento para imprimir.");
    }
}
