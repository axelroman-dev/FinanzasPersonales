# Changelog

## [0.8.1](https://github.com/axelroman-dev/FinanzasPersonales/compare/v0.8.0...v0.8.1) (2026-10-05)


### Correcciones

* **transactions:** limpiar también los select y las fechas de los filtros ([#42](https://github.com/axelroman-dev/FinanzasPersonales/issues/42)) ([352990a](https://github.com/axelroman-dev/FinanzasPersonales/commit/352990afea30240a291f38c8c8f427ed1205dc88))

## [0.8.0](https://github.com/axelroman-dev/FinanzasPersonales/compare/v0.7.0...v0.8.0) (2026-10-05)


### Nuevas funciones

* **reports:** mostrar lo que quedó sin registrar según los ajustes de cuenta ([#40](https://github.com/axelroman-dev/FinanzasPersonales/issues/40)) ([0f3723c](https://github.com/axelroman-dev/FinanzasPersonales/commit/0f3723cca0a1a19d243fa45b47be8154f0b3ea06))


### Correcciones

* **transactions:** mostrar el balance inicial en blanco y con guion ([#39](https://github.com/axelroman-dev/FinanzasPersonales/issues/39)) ([737cbe1](https://github.com/axelroman-dev/FinanzasPersonales/commit/737cbe1e893b380313d8c47eecefab84029defee))

## [0.7.0](https://github.com/axelroman-dev/FinanzasPersonales/compare/v0.6.1...v0.7.0) (2026-10-03)


### Nuevas funciones

* **export:** incluir los adjuntos de los movimientos en el respaldo ([#37](https://github.com/axelroman-dev/FinanzasPersonales/issues/37)) ([d2903f9](https://github.com/axelroman-dev/FinanzasPersonales/commit/d2903f900ef5fcc54b8171042b93ba7662a7b6bc))

## [0.6.1](https://github.com/axelroman-dev/FinanzasPersonales/compare/v0.6.0...v0.6.1) (2026-10-03)


### Correcciones

* **ui:** adaptar la app a celular y tablet y confirmar con modales ([#35](https://github.com/axelroman-dev/FinanzasPersonales/issues/35)) ([613700c](https://github.com/axelroman-dev/FinanzasPersonales/commit/613700ccda0e42ee08208d225ef0810fa03caa01))

## [0.6.0](https://github.com/axelroman-dev/FinanzasPersonales/compare/v0.5.0...v0.6.0) (2026-10-03)


### Nuevas funciones

* **attachments:** adjuntar fotos y PDF de recibos a los movimientos ([#33](https://github.com/axelroman-dev/FinanzasPersonales/issues/33)) ([9680800](https://github.com/axelroman-dev/FinanzasPersonales/commit/9680800009588f786ef4f02e01d21bc787eb301f))
* **transactions:** fecha con hora, selector de cuenta por tipo y edición de movimientos ([#31](https://github.com/axelroman-dev/FinanzasPersonales/issues/31)) ([e3172e6](https://github.com/axelroman-dev/FinanzasPersonales/commit/e3172e623cee4e66318435ffce3c5d8f3d1fc236))


### Correcciones

* **accounts:** eliminar cuentas con transferencias sin dejar datos a medias ([#34](https://github.com/axelroman-dev/FinanzasPersonales/issues/34)) ([26f9f7f](https://github.com/axelroman-dev/FinanzasPersonales/commit/26f9f7f4e72baa9d2548f74a588af23a185d91af))

## [0.5.0](https://github.com/axelroman-dev/FinanzasPersonales/compare/v0.4.0...v0.5.0) (2026-10-02)


### Nuevas funciones

* agregar favicon con el icono de cartera del sidebar ([#30](https://github.com/axelroman-dev/FinanzasPersonales/issues/30)) ([2fa0e07](https://github.com/axelroman-dev/FinanzasPersonales/commit/2fa0e073a6f5c86686b36bdd279ed21d26099712))


### Correcciones

* **balance:** no descontar las suscripciones ya pagadas este mes ([#29](https://github.com/axelroman-dev/FinanzasPersonales/issues/29)) ([5d022e3](https://github.com/axelroman-dev/FinanzasPersonales/commit/5d022e32cad6c0c30b9a6bac4358b8366ceb1f69))
* **forms:** limpiar formularios al abrirlos y elegir la categoría de suscripciones ([#26](https://github.com/axelroman-dev/FinanzasPersonales/issues/26)) ([415a2cf](https://github.com/axelroman-dev/FinanzasPersonales/commit/415a2cf8631fea77657e5472d97f6abb03090457))

## [0.4.0](https://github.com/axelroman-dev/FinanzasPersonales/compare/v0.3.1...v0.4.0) (2026-10-02)


### Nuevas funciones

* **categories:** quitar el tipo Ambos y permitir eliminar categorías principales ([#25](https://github.com/axelroman-dev/FinanzasPersonales/issues/25)) ([80f357e](https://github.com/axelroman-dev/FinanzasPersonales/commit/80f357e3c6e87f3590ce0c30b02b0882aef0cb86))
* **profile:** exportar e importar mis datos y zona de peligro ([#23](https://github.com/axelroman-dev/FinanzasPersonales/issues/23)) ([a15bd49](https://github.com/axelroman-dev/FinanzasPersonales/commit/a15bd491db468d4607bd34a23ef0aa05f9fa7073))

## [0.3.1](https://github.com/axelroman-dev/FinanzasPersonales/compare/v0.3.0...v0.3.1) (2026-10-02)


### Correcciones

* **import:** restaurar cada usuario del backup global en su propia cuenta ([#21](https://github.com/axelroman-dev/FinanzasPersonales/issues/21)) ([dcf87b5](https://github.com/axelroman-dev/FinanzasPersonales/commit/dcf87b5fd8f66189d79da4efc6cbea640eefb0be))

## [0.3.0](https://github.com/axelroman-dev/FinanzasPersonales/compare/v0.2.0...v0.3.0) (2026-10-02)


### ⚠ BREAKING CHANGES

* **auth:** ADMIN_PASSWORD es obligatoria en el .env. Se elimina el asistente /setup y scripts/reset-admin-password.ts; el admin del sistema es admin@finanzas.local.

### Nuevas funciones

* **accounts:** registrar balance inicial y ajustes de cuenta como movimientos ([#18](https://github.com/axelroman-dev/FinanzasPersonales/issues/18)) ([5e7f6e2](https://github.com/axelroman-dev/FinanzasPersonales/commit/5e7f6e299240097a544eaac7e3e51f8d6c5a1f70))
* **auth:** admin del sistema con contraseña desde ADMIN_PASSWORD ([#20](https://github.com/axelroman-dev/FinanzasPersonales/issues/20)) ([4327018](https://github.com/axelroman-dev/FinanzasPersonales/commit/43270182af6d25aba99611eca83e4d9a4c14f8fe))

## [0.2.0](https://github.com/axelroman-dev/FinanzasPersonales/compare/v0.1.2...v0.2.0) (2026-09-23)


### ⚠ BREAKING CHANGES

* **setup:** se eliminan las variables ADMIN_EMAIL, ADMIN_PASSWORD y ADMIN_NAME. Las instalaciones nuevas crean el admin desde /setup con el código que aparece en los logs. Las instalaciones que ya tienen admin no cambian.

### Nuevas funciones

* **setup:** asistente de configuración inicial en lugar de credenciales por defecto ([#16](https://github.com/axelroman-dev/FinanzasPersonales/issues/16)) ([fb95dfc](https://github.com/axelroman-dev/FinanzasPersonales/commit/fb95dfc970486185361b7dc4706189c76cced247))

## [0.1.2](https://github.com/axelroman-dev/FinanzasPersonales/compare/v0.1.1...v0.1.2) (2026-09-23)


### Correcciones

* **balances:** corregir la deuda de tarjetas al pagarlas y los errores de MSI ([#14](https://github.com/axelroman-dev/FinanzasPersonales/issues/14)) ([ecfae3d](https://github.com/axelroman-dev/FinanzasPersonales/commit/ecfae3d2590a8f8b4739320267cceb72438de1ac))
* **deps:** actualizar next y next-auth por vulnerabilidades de seguridad ([#10](https://github.com/axelroman-dev/FinanzasPersonales/issues/10)) ([4d6cf1a](https://github.com/axelroman-dev/FinanzasPersonales/commit/4d6cf1a97990f3f443a9ed45a2d076f4f429ba66))
* **transactions:** ajustar balances al editar movimientos y validar propiedad de cuentas ([#12](https://github.com/axelroman-dev/FinanzasPersonales/issues/12)) ([22e658f](https://github.com/axelroman-dev/FinanzasPersonales/commit/22e658f21a361b553274d580b278d7390511d286))

## [0.1.1](https://github.com/axelroman-dev/FinanzasPersonales/compare/v0.1.0...v0.1.1) (2026-09-23)


### Correcciones

* **auth:** cerrar la sesión de usuarios desactivados o eliminados ([#8](https://github.com/axelroman-dev/FinanzasPersonales/issues/8)) ([90ca95d](https://github.com/axelroman-dev/FinanzasPersonales/commit/90ca95dcc33ca63166b0ecaaa799345e04dc18b5))
