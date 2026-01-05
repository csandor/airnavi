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
        let seq = null;
        const simpleData = placemark.getElementsByTagName("SimpleData");
        for (let j = 0; j < simpleData.length; j++) {
            if (simpleData[j].getAttribute("name") === "seq") {
                seq = parseInt(simpleData[j].textContent, 10);
                break;
            }
        }

        if (seq === null) {
            throw new Error(`Placemark ${i + 1} is missing "<SimpleData name='seq'>".`);
        }

        // Extract Coordinates
        const coordinatesTag = placemark.getElementsByTagName("coordinates")[0];
        const altitudeModeTag = placemark.getElementsByTagName("altitudeMode")[0];

        if (altitudeModeTag && altitudeModeTag.textContent.trim() !== "absolute") {
            throw new Error(`Placemark ${seq || (i + 1)} has altitudeMode "${altitudeModeTag.textContent.trim()}". Must be "absolute".`);
        }

        if (coordinatesTag) {
            const coordsRaw = coordinatesTag.textContent.trim().split(/\s+/);

            if (coordsRaw.length !== 2) {
                throw new Error(`Placemark ${seq || (i + 1)} has ${coordsRaw.length} points. Only simple 2-point lines are allowed.`);
            }

            const startRaw = coordsRaw[0].split(",");
            const endRaw = coordsRaw[1].split(",");

            if (startRaw.length < 3 || endRaw.length < 3) {
                throw new Error(`Placemark ${seq || (i + 1)} coordinates must be 3D (lon,lat,alt).`);
            }

            const start = {
                lon: parseFloat(startRaw[0]),
                lat: parseFloat(startRaw[1]),
                alt: parseFloat(startRaw[2]),
            };

            const end = {
                lon: parseFloat(endRaw[0]),
                lat: parseFloat(endRaw[1]),
                alt: parseFloat(endRaw[2]),
            };

            lines.push({ seq, start, end });
        }
    }

    // Sort by sequence number
    return lines.sort((a, b) => a.seq - b.seq);
};
