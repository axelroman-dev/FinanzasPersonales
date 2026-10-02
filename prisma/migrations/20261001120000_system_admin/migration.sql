-- Se elimina el asistente de configuración inicial: el admin del sistema se
-- crea al arrancar con la contraseña de ADMIN_PASSWORD
ALTER TABLE "AppConfig" DROP COLUMN "setupCodeHash";
ALTER TABLE "AppConfig" DROP COLUMN "setupAttempts";
