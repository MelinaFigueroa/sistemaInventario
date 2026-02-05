// js/finanzas.js - Gestión de Cobranzas, Auditoría de Saldos y Storage

/**
 * REGISTRO DE PAGOS CON SUBIDA DE COMPROBANTE AL STORAGE
 * @param {Object} pagoData - Datos del pago (cliente_id, monto, metodo_pago, notas)
 * @param {File} archivo - El archivo de imagen (comprobante)
 */
async function registrarPago(pagoData, archivo) {
    try {
        Swal.fire({
            title: 'Registrando Pago...',
            text: 'Subiendo comprobante y guardando datos',
            allowOutsideClick: false,
            didOpen: () => { Swal.showLoading(); }
        });

        let urlComprobante = null;

        // 1. Subida al Storage si hay archivo
        if (archivo) {
            const fileExt = archivo.name.split('.').pop();
            const fileName = `${Date.now()}_${pagoData.cliente_id}.${fileExt}`;
            const filePath = `comprobantes/${fileName}`;

            const { data: storageData, error: storageError } = await _supabase.storage
                .from('comprobantes')
                .upload(filePath, archivo);

            if (storageError) throw new Error("Error subiendo comprobante: " + storageError.message);

            // Obtener la URL pública
            const { data: { publicUrl } } = _supabase.storage
                .from('comprobantes')
                .getPublicUrl(filePath);

            urlComprobante = publicUrl;
        }

        // 2. Insertar en la tabla 'pagos'
        const { error: insertError } = await _supabase.from('pagos').insert([{
            cliente_id: pagoData.cliente_id,
            monto: pagoData.monto,
            metodo_pago: pagoData.metodo_pago,
            comprobante_url: urlComprobante,
            estado: 'pendiente', // Siempre entra como pendiente para revisión admin
            notas: pagoData.notas,
            usuario_carga: USUARIO_ACTUAL
        }]);

        if (insertError) throw insertError;

        Swal.close();
        await Swal.fire({
            title: '¡PAGO REGISTRADO!',
            text: 'El pago ha sido cargado y está pendiente de aprobación por Administración.',
            icon: 'success',
            confirmButtonColor: '#4f46e5'
        });

        if (typeof loadPage === 'function') loadPage('inicio.html');

    } catch (err) {
        console.error("Error en registrarPago:", err);
        Swal.close();
        Notificar.error("ERROR", err.message);
    }
}

/**
 * APROBACIÓN DE PAGO (Solo para Admin / Administracion)
 */
async function aprobarPago(pagoId) {
    try {
        const { data, error } = await _supabase
            .from('pagos')
            .update({ estado: 'aprobado', fecha_aprobacion: new Date().toISOString() })
            .eq('id', pagoId)
            .select('cliente_id')
            .single();

        if (error) throw error;

        Notificar.toast("Pago aprobado con éxito", "success");

        // Al aprobar un pago, recalculamos automáticamente el saldo del cliente
        if (data.cliente_id) {
            await actualizarSaldoCliente(data.cliente_id);
        }

        // Refrescar vista si existe la función
        if (typeof renderPagosPendientes === 'function') renderPagosPendientes();

    } catch (err) {
        console.error("Error en aprobarPago:", err);
        Notificar.error("ERROR", "No se pudo aprobar el pago.");
    }
}

/**
 * RECALCULA EL SALDO DE UN CLIENTE ESPECÍFICO
 */
async function actualizarSaldoCliente(clienteId) {
    try {
        // 1. Obtener nombre del cliente (para buscar facturas que usan nombre por ahora)
        const { data: cliente } = await _supabase.from('clientes').select('nombre').eq('id', clienteId).single();
        if (!cliente) return;

        // 2. Sumar Facturas
        const { data: facturas } = await _supabase.from('facturas').select('total_final').eq('cliente_nombre', cliente.nombre);
        const totalVentas = facturas?.reduce((acc, f) => acc + (f.total_final || 0), 0) || 0;

        // 3. Sumar Pagos Aprobados
        const { data: pagos } = await _supabase.from('pagos').select('monto').eq('cliente_id', clienteId).eq('estado', 'aprobado');
        const totalPagos = pagos?.reduce((acc, p) => acc + (p.monto || 0), 0) || 0;

        const saldo = totalVentas - totalPagos;

        // 4. Actualizar estado (Umbral de $500 para considerar deuda activa)
        const nuevoEstado = saldo > 500 ? 'deudor' : 'activo';

        await _supabase.from('clientes').update({
            estado: nuevoEstado,
            saldo_pendiente: saldo // Asumiendo que existe el campo, si no, solo actualiza estado
        }).eq('id', clienteId);

        console.log(`Balance Cliente ${cliente.nombre}: $${saldo} (${nuevoEstado})`);
    } catch (err) {
        console.error("Error actualizando saldo:", err);
    }
}

/**
 * AUDITORÍA GLOBAL DE SALDOS - Recorre todos los clientes
 * Se recomienda correr esto al iniciar el Dashboard de Admin
 */
async function ejecutarAuditoriaGlobalSaldos() {
    try {
        console.log("💳 Iniciando Auditoría Global de Saldos...");
        const { data: clientes } = await _supabase.from('clientes').select('id');

        for (const c of clientes) {
            await actualizarSaldoCliente(c.id);
        }

        console.log("✅ Auditoría completada.");
    } catch (err) {
        console.error("Error auditoría global:", err);
    }
}
