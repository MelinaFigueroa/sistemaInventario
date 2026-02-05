// js/pedidos.js - Lógica de pedidos y facturación

// ==========================================
// GESTIÓN DE PEDIDOS
// ==========================================
async function abrirModalPedido() {
    itemsPedidoTemporal = [];
    actualizarListaTemporal();

    const inputCliente = document.getElementById("ped-cliente");
    if (inputCliente) inputCliente.value = "";

    try {
        const { data: prods, error } = await _supabase
            .from("productos")
            .select("id, nombre, sku")
            .order("nombre", { ascending: true });

        if (error) throw error;

        const select = document.getElementById("ped-producto-select");
        if (select) {
            select.innerHTML = prods
                .map((p) => `<option value="${p.id}">${p.nombre} (${p.sku})</option>`)
                .join("");
        }

        document.getElementById("modal-pedido").classList.remove("hidden");
        Notificar.toast("Catálogo cargado", "info");

    } catch (e) {
        console.error("Error al abrir modal:", e);
        Notificar.error("ERROR DE CARGA", "No se pudieron obtener los productos de la base de datos.");
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
    const clienteNombre = document.getElementById("ped-cliente")?.value;

    if (!clienteNombre || itemsPedidoTemporal.length === 0) {
        Notificar.error("DATOS INCOMPLETOS", "Completá el cliente y añadí al menos un producto.");
        return;
    }

    try {
        // 1. Insertar el pedido
        const { data: pedido, error: errorPedido } = await _supabase
            .from("pedidos")
            .insert([{
                cliente_nombre: clienteNombre,
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
async function procesarPicking(pedidoId) {
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

    Swal.fire({
        title: 'Autorizando con AFIP',
        text: 'Esto puede demorar unos segundos...',
        allowOutsideClick: false,
        didOpen: () => { Swal.showLoading(); }
    });

    try {
        // 1. Obtener detalles del pedido
        const { data: pedidoInfo, error: errP } = await _supabase
            .from("pedidos")
            .select(`cliente_nombre, pedido_detalle(cantidad, producto_id, productos(nombre, precios(precio_venta)))`)
            .eq("id", pedidoId)
            .single();

        if (errP) throw new Error("No se pudo obtener la info del pedido");

        // 2. Validar stock disponible
        for (const item of pedidoInfo.pedido_detalle) {
            const { data: stockDisponible } = await _supabase
                .from("posiciones")
                .select("cantidad")
                .eq("producto_id", item.producto_id)
                .gt("cantidad", 0);

            const totalReal = stockDisponible?.reduce((acc, curr) => acc + curr.cantidad, 0) || 0;

            if (totalReal < item.cantidad) {
                Swal.close();
                Notificar.error('STOCK INSUFICIENTE',
                    `Producto: ${item.productos.nombre}\nNecesitás: ${item.cantidad} u.\nDisponible: ${totalReal} u.`);
                return;
            }
        }

        // 3. Calcular total del pedido
        const detalles = pedidoInfo.pedido_detalle;
        let totalPedido = 0;
        detalles.forEach((d) => {
            const precio = d.productos?.precios?.[0]?.precio_venta || 0;
            totalPedido += d.cantidad * precio;
        });

        if (totalPedido <= 0) totalPedido = 100;

        // 4. Invocar AFIP
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

        // 5. Procesar Stock y Movimientos
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

        // 6. Guardar Factura
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

        // 7. Actualizar estado del Pedido
        await _supabase.from("pedidos")
            .update({ estado: "preparado" })
            .eq("id", pedidoId);

        // 8. Éxito
        Swal.close();
        await Swal.fire({
            title: '¡FACTURA GENERADA!',
            html: `Se autorizó el CAE <b>${afipData.cae}</b> con éxito.<br>El stock ha sido descontado.`,
            icon: 'success',
            confirmButtonColor: '#4f46e5'
        });

        renderPedidos();
        if (typeof renderFacturacion === "function") renderFacturacion();

    } catch (e) {
        console.error(e);
        Swal.close();
        Notificar.error('ERROR EN EL PROCESO', e.message);
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
