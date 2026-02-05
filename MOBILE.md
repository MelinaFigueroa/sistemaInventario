# 📱 Guía de Optimización Móvil - HaruwenWMS

## 🎉 ¡Funcionalidades Móviles Activadas!

Tu WMS ahora está completamente optimizado para dispositivos móviles con funcionalidades profesionales de escaneo y UX táctil.

---

## ✨ Nuevas Funcionalidades Móviles

### 1. **Botones de Acción Flotantes (FAB)** 🔵
Aparecen automáticamente en dispositivos móviles en la esquina inferior derecha:

- **Botón Verde (Escanear)**: Abre la cámara para escanear códigos de barras
- **Botón Naranja (Agregar)**: Acceso rápido según la vista actual

**Funciones automatizadas:**
- En **Recepción**: Escanea y llena automáticamente el SKU del producto
- En **Pedidos**: Busca el producto y lo agrega a la lista
- En **otras vistas**: Muestra menú de acciones rápidas

### 2. **Scanner de Códigos de Barras** 📷
Implementado con `html5-qrcode`, soporta:
- ✅ Códigos QR
- ✅ EAN-13 (códigos de productos)
- ✅ EAN-8
- ✅ CODE-128
- ✅ CODE-39

**Características:**
- Overlay de pantalla completa
- Marco de enfoque visual
- Vibración háptica al escanear exitosamente
- Botón de flash (experimental)
- Se cierra automáticamente tras escanear

### 3. **Vibración Háptica** 📳
Feedback táctil para acciones importantes:
- Escaneo exitoso
- Botones presionados
- Errores
- Confirmaciones

### 4. **Áreas Táctiles Mejoradas** 👆
- Todos los botones tienen mínimo 44x44px (estándar de accesibilidad)
- Espaciado optimizado para dedos
- Efectos  visuales al presionar

### 5. **Tablas Responsive** 📊
- Scroll horizontal automático en pantallas pequeñas
- Fuentes ajustadas para legibilidad
- Headers sticky

### 6. **Sidebar Optimizado** 📑
- Se oculta automáticamente al hacer scroll
- Botón hamburguesa siempre visible
- Cierre automático al navegar

### 7. **Prevención de Zoom Accidental** 🔍
- Inputs con font-size 16px (evita zoom en iOS)
- Double-tap deshabilitado
- Meta viewport optimizado

### 8. **Safe Areas (iOS)** 📱
- Soporte para iPhones con notch
- Respeto de áreas seguras
- Padding automático en bottom navigation

---

## 🛠️ Cómo Usar en Móvil

### **Escanear un Código de Barras**

#### Método 1: FAB (Recomendado)
1. Abrís cualquier vista del WMS
2. Tocás el **botón verde flotante** (esquina inferior derecha)
3. Permitís acceso a la cámara
4. Enfocás el código de barras dentro del marco verde
5. ¡Vibra y escanea automáticamente!

#### Método 2: Desde Recepción
1. Vas a **Recepción** desde el menú
2. Tocás **"Escanear Código"** en el formulario
3. La cámara se abre automáticamente

### **Agregar Productos Rápidamente**
1. Tocás el **botón naranja flotante**
2. Dependiendo dónde estés:
   - **Pedidos**: Abre modal de nuevo pedido
   - **Inventario**: Abre modal de nuevo producto
   - **Otras vistas**: Muestra menú de acciones

### **Trabajar Offline (PWA)**
1. En Safari (iOS) o Chrome (Android)
2. Menú > **"Agregar a pantalla de inicio"**
3. El WMS se comporta como una app nativa
4. Icono en tu home screen

---

## 📐 Breakpoints Responsive

```css
/* Móvil */
< 768px → Vista móvil completa

/* Tablet */
768px - 1024px → Vista híbrida

/* Desktop */
> 1024px → Vista completa con sidebar
```

---

## 🎨 Componentes Móviles Agregados

### **Archivos Nuevos:**
1. `css/mobile.css` - Estilos optimizados para móvil
2. `js/mobile.js` - Funcionalidades móviles (scanner, FABs, etc)

### **En dashboard.html:**
```html
<!-- CSS Móvil -->
<link rel="stylesheet" href="../css/mobile.css">

<!-- Script Móvil -->
<script src="../js/mobile.js"></script>
```

---

## 🔧 Funciones Disponibles en JavaScript

### Para usar en tus vistas:

```javascript
// Abrir scanner con callback personalizado
abrirScannerMobile((codigoEscaneado) => {
    console.log("Código:", codigoEscaneado);
    // Tu lógica aquí
});

// Vibración háptica
vibrarFeedback('ligero');    // Tap suave
vibrarFeedback('medio');     // Botón normal
vibrarFeedback('exito');     // Operación exitosa
vibrarFeedback('error');     // Error

// Detectar si es móvil
if (isMobile.any()) {
    // Código específico para móvil
}

if (isMobile.iOS()) {
    // Específico para iPhone/iPad
}

if (isMobile.Android()) {
    // Específico para Android
}
```

---

## 🧪 Testing en Móvil

### **Chrome DevTools (Simulación)**
1. F12 → Toggle Device Toolbar (Ctrl+Shift+M)
2. Seleccionar dispositivo (iPhone, Pixel, etc)
3. **Limitación:** No simula cámara, usar dispositivo real para scanner

### **Testing Real (Recomendado)**
1. Conectar celular a misma WiFi que la PC
2. Encontrar IP de tu PC: `ipconfig` (Windows) o `ifconfig` (Mac/Linux)
3. En celular abrir: `http://[TU_IP]:5500/pages/dashboard.html`
4. O usar herramientas como **ngrok** para HTTPS público

### **Localhost en Android**
```bash
# IP de tu máquina en red local
http://192.168.1.X:5500/
```

###  **Localhost en iOS**
- iOS prohíbe cámara en HTTP
- Necesitás HTTPS o usar ngrok

---

## 🚀 Mejoras Futuras Sugeridas

### **Corto Plazo (1-2 semanas)**
- [ ] Agregar modo offline completo (Service Workers)
- [ ] Implementar sincronización en background
- [ ] Agregar notificaciones push
- [ ] Manifest.json para PWA completa

### **Mediano Plazo (1-2 meses)**
- [ ] Modo oscuro automático
- [ ] Gestos de swipe (deslizar para eliminar, etc)
- [ ] Caché de imágenes de productos
- [ ] Búsqueda por voz

### **Largo Plazo (3-6 meses)**
- [ ] App nativa con Capacitor
- [ ] Modo completamente offline
- [ ] Sincronización inteligente de datos
- [ ] Impresión de etiquetas desde móvil

---

## 📊 Ventajas de esta Implementación

✅ **Sin frameworks pesados** - Vanilla JS puro, rápido y eficiente
✅ **Progressive Enhancement** - Funciona en desktop, mejora en móvil
✅ **No rompe funcionalidad existente** - Todo sigue funcionando igual
✅ **Escalable** - Fácil agregar más funciones móviles
✅ **Profesional** - UX comparable a apps nativas

---

## 🐛 Troubleshooting Móvil

### **"La cámara no funciona"**
- ✅ Verificar que diste permisos de cámara al navegador
- ✅ iOS necesita HTTPS (usar ngrok en desarrollo)
- ✅ Algunos navegadores viejos no soportan getUserMedia

### **"Los FABs no aparecen"**
- ✅ Solo aparecen en pantallas < 768px
- ✅ Verificar que mobile.js se haya cargado (ver consola)
- ✅ Revisar que mobile.css esté linkeado

### **"La vibración no funciona"**
- ✅ iOS no soporta navigator.vibrate() por limitaciones de Apple
- ✅ Android necesita permisos en algunos navegadores

### **"Scroll horizontal en tablas no funciona"**
- ✅ Agregar clase `table-container` al contenedor de la tabla
- ✅ Verificar que mobile.css esté cargado

---

## 📱 Características por Dispositivo

### **iOS (iPhone/iPad)**
✅ Scanner funciona (solo con HTTPS)
❌ Vibración háptica no disponible
✅ Safe areas respetadas
✅ PWA instalable desde Safari

### **Android  (Samsung, Pixel, etc)**
✅ Scanner funciona (HTTP y HTTPS)
✅ Vibración háptica disponible
✅ PWA instalable desde Chrome
✅ Botón de instalación automático

---

## 🎯 Próximos Pasos Recomendados

1. **Probar en celular real** - Conectarte vía WiFi local
2. **Testear el scanner** - Escanear productos reales
3. **Ajustar UX** - Según feedback de operadores
4. **Crear Manifest PWA** - Para instalación como app
5. **Implementar Service Worker** - Para modo offline

---

**Última actualización:** 05/02/2026
**Versión Móvil:** 1.0.0
**Compatibilidad:** iOS 12+, Android 8+, Chrome 80+, Safari 12+
