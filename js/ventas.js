// js/ventas.js - Gestión de Clientes, Catálogo y Reglas de Negocio de Ventas

/**
 * ABM DE CLIENTES (Veteinerarias / Pet Shops)
 */
async function guardarNuevaVeterinaria(datos) {
    try {
        const { error } = await _supabase.from('clientes').insert([datos]);
        if (error) throw error;
        Notificar.toast("Cliente registrado", "success");
        if (typeof renderClientes === 'function') renderClientes();
    } catch (e) {
        Notificar.error("Error", e.message);
    }
}

/**
 * ACTUALIZACIÓN MASIVA DE PRECIOS
 * @param {number} porcentaje - Ej: 10 para aumentar 10%
 * @param {string} marca - Filtro por marca (Vital Can por defecto)
 */
async function actualizarPreciosMasivo(porcentaje, marca = 'Vital Can') {
    try {
        // En un entorno profesional dispararíamos una Edge Function o un procedimiento Postgres
        // Aquí lo hacemos cliente-side para control visual del usuario
        const factor = 1 + (porcentaje / 100);

        const { data: productos } = await _supabase.from('productos').select('id').eq('marca', marca);

        for (const p of productos) {
            const { data: precioActual } = await _supabase.from('precios').select('precio_venta').eq('producto_id', p.id).single();
            if (precioActual) {
                const nuevoPrecio = precioActual.precio_venta * factor;
                await _supabase.from('precios').update({ precio_venta: nuevoPrecio }).eq('producto_id', p.id);
            }
        }

        Notificar.toast(`Precios de ${marca} actualizados un ${porcentaje}%`, "success");
    } catch (e) {
        console.error(e);
        Notificar.error("Error", "No se pudo actualizar el catálogo");
    }
}

/**
 * VALIDACIÓN DE LÍMITE DE CRÉDITO (Regla de Negocio Core)
 * Se ejecuta al seleccionar un cliente en el panel de ventas
 */
async function validarDeudaCliente(clienteId) {
    const { data: cliente } = await _supabase
        .from('clientes')
        .select('estado, saldo_pendiente')
        .eq('id', clienteId)
        .single();

    if (cliente?.estado === 'deudor') {
        Swal.fire({
            title: 'CLIENTE BLOQUEADO',
            text: `Saldo pendiente: $${cliente.saldo_pendiente}. Debe regularizar deuda en el módulo de Cobranzas.`,
            icon: 'error',
            confirmButtonColor: '#f43f5e'
        });
        return false;
    }
    return true;
}

/**
 * PERSISTENCIA DE PEDIDO CON CONTROL DE INTEGRIDAD
 */
async function guardarPedidoSeguro(pedidoData, items) {
    try {
        // 1. Validar crédito una última vez antes de insertar
        const esValido = await validarDeudaCliente(pedidoData.cliente_id);
        if (!esValido) return;

        // 2. Insertar cabecera
        const { data: pedido, error: errP } = await _supabase
            .from('pedidos')
            .insert([pedidoData])
            .select()
            .single();

        if (errP) throw errP;

        // 3. Insertar detalle (Simulando transacción: si falla, borrar cabecera o marcar error)
        const detalles = items.map(it => ({ ...it, pedido_id: pedido.id }));
        const { error: errD } = await _supabase.from('pedido_detalle').insert(detalles);

        if (errD) {
            // Rollback manual (Borrar el pedido fallido)
            await _supabase.from('pedidos').delete().eq('id', pedido.id);
            throw new Error("Error cargando detalles del pedido");
        }

        Notificar.toast("Pedido generado y pendiente de armado", "success");
        return pedido.id;

    } catch (e) {
        console.error(e);
        Notificar.error("Error Grave", e.message);
    }
}
