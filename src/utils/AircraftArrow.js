// Aircraft arrow shared by the minimap (drawn on its canvas) and the full map
// (rasterised once into a MapLibre icon): dark navy fill with a white outline so it
// stands out on the light OSM basemap and on the dark-blue flight line.
export const AIRCRAFT_FILL = '#001a4d';
export const AIRCRAFT_OUTLINE = '#ffffff';

/** Draws the arrow centred on the current origin, pointing up (-Y), `size` px tall. */
export const drawAircraftArrow = (ctx, size) => {
    const s = size / 2;
    ctx.beginPath();
    ctx.moveTo(0, -s);
    ctx.lineTo(s * 0.75, s);
    ctx.lineTo(0, s * 0.6);
    ctx.lineTo(-s * 0.75, s);
    ctx.closePath();
    ctx.lineJoin = 'round';
    ctx.lineWidth = Math.max(1.5, size / 12);
    ctx.strokeStyle = AIRCRAFT_OUTLINE;
    ctx.stroke();
    ctx.fillStyle = AIRCRAFT_FILL;
    ctx.fill();
};

/** The arrow as ImageData for map.addImage; `size` px tall, drawn at `pixelRatio`. */
export const aircraftArrowImage = (size, pixelRatio = 1) => {
    const px = Math.ceil((size + 6) * pixelRatio);
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = px;
    const ctx = canvas.getContext('2d');
    ctx.scale(pixelRatio, pixelRatio);
    ctx.translate(px / pixelRatio / 2, px / pixelRatio / 2);
    drawAircraftArrow(ctx, size);
    return ctx.getImageData(0, 0, px, px);
};
