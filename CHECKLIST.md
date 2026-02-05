# ✅ Checklist de Validación - HaruwenWMS

## 🔍 Después de la Modularización

### Scripts y Rutas
- [ ] Todos los archivos JS están en `/js/`
- [ ] Las rutas en `dashboard.html` usan `../js/` correctamente
- [ ] El orden de carga de scripts es correcto
- [ ] No hay scripts duplicados en el HTML

### Funcionalidad Base
- [ ] Login funciona correctamente
- [ ] Redirección a dashboard tras login exitoso
- [ ] Navegación entre vistas (SPA) funciona
- [ ] Sidebar se muestra/oculta correctamente
- [ ] Datos se cargan desde Supabase

### Módulos Principales
- [ ] Dashboard muestra KPIs correctamente
- [ ] Posiciones/Racks se visualizan
- [ ] Pedidos se pueden crear y listar
- [ ] Facturación muestra ventas
- [ ] Inventario lista productos
- [ ] Movimientos muestra trazabilidad
- [ ] Recepción permite entrada de stock

### Notificaciones
- [ ] SweetAlert2 funciona (toasts y modales)
- [ ] Mensajes de error se muestran correctamente
- [ ] Mensajes de éxito aparecen tras operaciones

### Seguridad
- [ ] Páginas protegidas redirigen si no hay sesión
- [ ] Usuario actual se muestra en sidebar
- [ ] Logout funciona y cierra sesión

---

## 🧪 Tests Manuales Críticos

### Flujo de Pedido Completo
1. [ ] Crear un nuevo pedido
2. [ ] Añadir productos al pedido
3. [ ] Guardar pedido en base de datos
4. [ ] Procesar picking del pedido
5. [ ] Validar stock suficiente
6. [ ] Facturar con AFIP (si está configurado)
7. [ ] Descontar stock automáticamente
8. [ ] Verificar movimiento registrado

### Flujo de Recepción
1. [ ] Seleccionar producto
2. [ ] Elegir rack destino
3. [ ] Ingresar cantidad
4. [ ] Procesar recepción
5. [ ] Verificar stock actualizado
6. [ ] Verificar movimiento de entrada

### Responsividad
- [ ] Login responsive en móvil
- [ ] Dashboard responsive en tablet
- [ ] Sidebar colapsable en mobile
- [ ] Tablas scrolleables en pantallas chicas
- [ ] Modales se ven bien en todos los tamaños

---

## 🚀 Antes de Subir a Producción

### Configuración
- [ ] Crear `config.local.js` con credenciales
- [ ] Mover keys de Supabase a variables de entorno
- [ ] Configurar dominio personalizado (si aplica)
- [ ] Habilitar HTTPS

### Performance
- [ ] Minificar JavaScript (si usas build tool)
- [ ] Optimizar imágenes
- [ ] Habilitar cache del navegador
- [ ] Probar velocidad de carga

### Seguridad
- [ ] Validar permisos de base de datos (RLS en Supabase)
- [ ] No exponer keys sensibles en frontend
- [ ] Sanitizar inputs de usuario
- [ ] Configurar CORS correctamente

### Backup
- [ ] Exportar schema de Supabase
- [ ] Hacer backup de datos
- [ ] Documentar proceso de restauración
- [ ] Configurar backups automáticos

---

## 📝 Documentación

- [ ] README.md actualizado
- [ ] ARQUITECTURA.md creada ✅
- [ ] Funciones comentadas con JSDoc
- [ ] Variables de entorno documentadas
- [ ] Proceso de deployment documentado

---

## 🐛 Debugging Común

### "Script not found"
- Verificar rutas relativas (`../js/` vs `js/`)
- Verificar que el archivo existe
- Verificar mayúsculas/minúsculas en nombres

### "Function is not defined"
- Verificar orden de carga de scripts
- Verificar que el módulo que define la función se cargó
- Abrir Console en DevTools para ver errores

### "Cannot read property of undefined"
- Verificar que Supabase devuelve datos
- Verificar que los elementos del DOM existen
- Usar `if (!elemento) return;` para prevenir

### "CORS error"
- Configurar dominios permitidos en Supabase
- Verificar que las URLs son correctas
- Usar HTTPS en producción

---

## 💾 Git Workflow Recomendado

```bash
# Inicializar repo
git init
git add .
git commit -m "feat: estructura modularizada del WMS"

# Antes de cada cambio importante
git checkout -b feature/nombre-feature

# Después de completar la feature
git add .
git commit -m "feat: descripción del cambio"
git checkout main
git merge feature/nombre-feature

# Sincronizar con GitHub (cuando crees el repo)
git remote add origin https://github.com/tu-usuario/haruwenwms.git
git push -u origin main
```

---

## 📊 Métricas de Éxito

### Performance
- Carga inicial: < 2 segundos
- Navegación entre vistas: < 500ms
- Operaciones en Supabase: < 1 segundo

### UX
- Tasa de errores: < 5%
- Tiempo de procesamiento de pedido: < 30 segundos
- Usuarios satisfechos: > 90%

### Técnico
- Cobertura de tests: > 70%
- Tiempo de build: < 30 segundos
- Uptime: > 99.5%

---

**Fecha:** 05/02/2026
**Versión:** 1.0.0 Modularizada
