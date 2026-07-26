import { useEffect, useState } from "react";
import { obtenerIniciales } from "../../utils/avatar";

type UserAvatarProps = {
  fotoPerfilUrl?: string | null;
  nombres?: string | null;
  apellidos?: string | null;
  size?: number;
  className?: string;
};

export default function UserAvatar({
  fotoPerfilUrl,
  nombres,
  apellidos,
  size = 44,
  className = "",
}: UserAvatarProps) {
  const [imageFailed, setImageFailed] = useState(false);
  const initials = obtenerIniciales(nombres, apellidos);

  useEffect(() => {
    setImageFailed(false);
  }, [fotoPerfilUrl]);

  return (
    <span
      className={`relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-blue-500 text-sm font-black text-white ${className}`}
      style={{ width: size, height: size }}
    >
      {fotoPerfilUrl && !imageFailed ? (
        <img
          src={fotoPerfilUrl}
          alt={`Foto de ${nombres || "usuario"}`}
          className="h-full w-full object-cover"
          onError={() => {
            console.warn("No se pudo cargar la foto de perfil.");
            setImageFailed(true);
          }}
        />
      ) : (
        <span aria-hidden="true">{initials || "U"}</span>
      )}
    </span>
  );
}
