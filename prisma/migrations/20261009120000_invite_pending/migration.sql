-- Invitaciones por correo: un usuario invitado no tiene contraseña hasta que
-- la crea desde el enlace. Los existentes no cambian.
ALTER TABLE "User" ALTER COLUMN "passwordHash" DROP NOT NULL;
