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

function imprimirFactura(facturaId) {
    Notificar.toast("Generando PDF...", "info");
    // Aquí iría la lógica de impresión/PDF
    console.log("Imprimir factura:", facturaId);
}
