# Changelog

## [0.3.0](https://github.com/axelroman-dev/FinanzasPersonales/compare/v0.2.0...v0.3.0) (2026-09-26)


### Nuevas funciones

* **accounts:** registrar balance inicial y ajustes de cuenta como movimientos ([#18](https://github.com/axelroman-dev/FinanzasPersonales/issues/18)) ([5e7f6e2](https://github.com/axelroman-dev/FinanzasPersonales/commit/5e7f6e299240097a544eaac7e3e51f8d6c5a1f70))

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
