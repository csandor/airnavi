/**
 * Parses KML text content to extract flight lines.
 * 
 * @param {string} kmlText - The raw KML file content.
 * @returns {Array<{seq: number, start: {lat: number, lon: number, alt: number}, end: {lat: number, lon: number, alt: number}}>}
 */
export const parseKML = (kmlText) => {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(kmlText, "text/xml");
    const placemarks = xmlDoc.getElementsByTagName("Placemark");

    const lines = [];

    for (let i = 0; i < placemarks.length; i++) {
        const placemark = placemarks[i];

        // Extract Sequence Number
        let seq = 0;
        const simpleData = placemark.getElementsByTagName("SimpleData");
        for (let j = 0; j < simpleData.length; j++) {
            if (simpleData[j].getAttribute("name") === "seq") {
                seq = parseInt(simpleData[j].textContent, 10);
                break;
            }
        }

        // Extract Coordinates
        const coordinatesTag = placemark.getElementsByTagName("coordinates")[0];
        if (coordinatesTag) {
            const coordsRaw = coordinatesTag.textContent.trim().split(/\s+/);
            if (coordsRaw.length >= 2) {
                const startRaw = coordsRaw[0].split(",");
                const endRaw = coordsRaw[1].split(",");

                const start = {
                    lon: parseFloat(startRaw[0]),
                    lat: parseFloat(startRaw[1]),
                    alt: parseFloat(startRaw[2]) || 0,
                };

                const end = {
                    lon: parseFloat(endRaw[0]),
                    lat: parseFloat(endRaw[1]),
                    alt: parseFloat(endRaw[2]) || 0,
                };

                lines.push({ seq, start, end });
            }
        }
    }

    // Sort by sequence number
    return lines.sort((a, b) => a.seq - b.seq);
};
