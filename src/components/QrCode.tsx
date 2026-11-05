import React, { useLayoutEffect, useRef, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';

type QrCodeProps = React.ComponentProps<typeof QRCodeSVG> & { size: number };

/**
 * A QR code that stays true at any scale. The library asks for crispEdges,
 * which moves every edge to a whole pixel on its own, so at anything but a
 * whole number of pixels per module (168 px for 29 modules; browser zoom; a
 * hover's scale) the three squares came out uneven, the inner one off centre.
 * Here `size` is rounded to whole pixels per module, sharp at 100 %, and the
 * shapes are drawn exactly as they are at every other scale.
 */
const QrCode = ({ size, value, className = '', ...rest }: QrCodeProps) => {
  const ref = useRef<SVGSVGElement>(null);
  const [fitted, setFitted] = useState(size);
  useLayoutEffect(() => {
    const modules = ref.current?.viewBox.baseVal.width;
    if (modules) setFitted(Math.max(1, Math.round(size / modules)) * modules);
  }, [size, value]);
  return <QRCodeSVG ref={ref} value={value} size={fitted} className={`[&_path]:[shape-rendering:geometricPrecision] ${className}`} {...rest} />;
};

export default QrCode;
