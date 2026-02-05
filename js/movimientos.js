// js/movimientos.js - Módulo de gestión de movimientos y trazabilidad

// ==========================================
// REGISTRO MANUAL DE MOVIMIENTOS
// ==========================================

async function registrarMovimientoManual(tipo, productoId, origen, destino, cantidad) {
    try {
        const { error } = await _supabase.from("movimientos").insert([{
            producto_id: productoId,
            tipo: tipo.toUpperCase(),
            origen: origen,
            destino: destino,
            cantidad: cantidad,
            usuario: USUARIO_ACTUAL
        }]);

        if (error) throw error;

        Notificar.toast("Movimiento registrado", "success");
        if (typeof renderMovimientos === 'function') renderMovimientos();

    } catch (error) {
        console.error("Error registrando movimiento:", error);
        Notificar.error("ERROR", "No se pudo registrar el movimiento.");
    }
}

// ==========================================
// AJUSTE DE INVENTARIO
// ==========================================

async function ajustarInventario(posicionId, nuevaCantidad, motivo = "Ajuste manual") {
    try {
        // 1. Obtener info actual
        const { data: posActual } = await _supabase
            .from("posiciones")
            .select("cantidad, producto_id")
            .eq("id", posicionId)
            .single();

        if (!posActual || !posActual.producto_id) {
            Notificar.error("ERROR", "La posición no tiene producto asignado.");
            return;
        }

        const diferencia = nuevaCantidad - (posActual.cantidad || 0);

        // 2. Actualizar posición
        await _supabase.from("posiciones").update({
            cantidad: nuevaCantidad,
            estado: nuevaCantidad > 0 ? "ocupado" : "vacio"
        }).eq("id", posicionId);

        // 3. Registrar movimiento de ajuste
        await _supabase.from("movimientos").insert([{
            producto_id: posActual.producto_id,
            tipo: "AJUSTE",
            origen: posicionId,
            destino: posicionId,
            cantidad: Math.abs(diferencia),
            usuario: USUARIO_ACTUAL,
            observaciones: motivo
        }]);

        Notificar.toast("Inventario ajustado correctamente", "success");

        if (typeof renderPosiciones === 'function') renderPosiciones();
        if (typeof actualizarDashboard === 'function') actualizarDashboard();

    } catch (error) {
        console.error("Error ajustando inventario:", error);
        Notificar.error("ERROR", "No se pudo ajustar el inventario.");
    }
}

// ==========================================
// TRANSFERENCIA ENTRE POSICIONES
// ==========================================

async function transferirEntreRacks(origenId, destinoId, cantidad) {
    try {
        // 1. Validar origen
        const { data: posOrigen } = await _supabase
            .from("posiciones")
            .select("cantidad, producto_id")
            .eq("id", origenId)
            .single();

        if (!posOrigen || posOrigen.cantidad < cantidad) {
            Notificar.error("STOCK INSUFICIENTE", "No hay suficiente stock en el rack origen.");
            return;
        }

        const productoId = posOrigen.producto_id;

        // 2. Actualizar origen
        const nuevaCantOrigen = posOrigen.cantidad - cantidad;
        await _supabase.from("posiciones").update({
            cantidad: nuevaCantOrigen,
            estado: nuevaCantOrigen > 0 ? "ocupado" : "vacio",
            producto_id: nuevaCantOrigen > 0 ? productoId : null
        }).eq("id", origenId);

        // 3. Actualizar destino
        const { data: posDestino } = await _supabase
            .from("posiciones")
            .select("cantidad")
            .eq("id", destinoId)
            .single();

        const nuevaCantDestino = (posDestino?.cantidad || 0) + cantidad;
        await _supabase.from("posiciones").update({
            cantidad: nuevaCantDestino,
            producto_id: productoId,
            estado: "ocupado"
        }).eq("id", destinoId);

        // 4. Actualizar Lotes (Crítico para Trazabilidad)
        // Buscamos el lote que está en el origen y lo movemos al destino
        const { data: lotesOrigen } = await _supabase
            .from("lotes")
            .select("id, numero_lote, cantidad_actual")
            .eq("producto_id", productoId)
            .eq("posicion_id", origenId)
            .gt("cantidad_actual", 0)
            .limit(1);

        if (lotesOrigen && lotesOrigen.length > 0) {
            const lote = lotesOrigen[0];
            // En una versión más compleja separaríamos el lote si movemos solo una parte,
            // por ahora actualizamos la posición del lote principal si se mueve todo o parte.
            await _supabase.from("lotes").update({
                posicion_id: destinoId
            }).eq("id", lote.id);
        }

        // 5. Registrar movimiento de Auditoría
        await _supabase.from("movimientos").insert([{
            producto_id: productoId,
            tipo: "TRANSFERENCIA",
            origen: origenId,
            destino: destinoId,
            cantidad: cantidad,
            usuario: USUARIO_ACTUAL,
            referencia: `Traspaso entre racks (Auditoría Automática)`
        }]);

        Notificar.toast("Transferencia completada y Auditada", "success");

        if (typeof renderPosiciones === 'function') renderPosiciones();
        if (typeof renderMovimientos === 'function') renderMovimientos();

    } catch (error) {
        console.error("Error en transferencia:", error);
        Notificar.error("ERROR", "No se pudo completar la transferencia.");
    }
}
