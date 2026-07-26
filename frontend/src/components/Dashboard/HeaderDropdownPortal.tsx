import { useEffect, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";

interface HeaderDropdownPortalProps {
  anchorRef: RefObject<HTMLElement | null>;
  children: ReactNode;
  className?: string;
  open: boolean;
  width?: number;
  onClose: () => void;
}

export default function HeaderDropdownPortal({
  anchorRef,
  children,
  className = "",
  open,
  width = 360,
  onClose,
}: HeaderDropdownPortalProps) {
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  useLayoutEffect(() => {
    if (!open) return;

    const updatePosition = () => {
      const anchor = anchorRef.current;
      if (!anchor) return;

      const rect = anchor.getBoundingClientRect();
      const margin = 12;
      const left = Math.max(
        margin,
        Math.min(window.innerWidth - width - margin, rect.right - width)
      );

      setPosition({
        top: rect.bottom + 10,
        left,
      });
    };

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);

    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [anchorRef, open, width]);

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      const anchor = anchorRef.current;
      const dropdown = dropdownRef.current;

      if (anchor?.contains(target) || dropdown?.contains(target)) return;

      onClose();
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleEscape);

    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleEscape);
    };
  }, [anchorRef, onClose, open]);

  if (!open) return null;

  return createPortal(
    <div
      ref={dropdownRef}
      className={`fixed z-[var(--dashboard-z-dropdown)] ${className}`}
      style={{ top: position.top, left: position.left, width }}
    >
      {children}
    </div>,
    document.body
  );
}
