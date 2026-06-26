// Minimal ZIP (stored, no compression) + KMZ builder

function crc32(buf) {
    const table = (() => {
        const t = new Uint32Array(256);
        for (let i = 0; i < 256; i++) {
            let c = i;
            for (let j = 0; j < 8; j++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
            t[i] = c;
        }
        return t;
    })();
    let crc = 0xFFFFFFFF;
    for (let i = 0; i < buf.length; i++) crc = table[(crc ^ buf[i]) & 0xFF] ^ (crc >>> 8);
    return (crc ^ 0xFFFFFFFF) >>> 0;
}

function uint16LE(n) { return [n & 0xFF, (n >> 8) & 0xFF]; }
function uint32LE(n) { return [n & 0xFF, (n >> 8) & 0xFF, (n >> 16) & 0xFF, (n >> 24) & 0xFF]; }

function buildZip(filename, content) {
    const enc = new TextEncoder();
    const nameBytes = enc.encode(filename);
    const dataBytes = enc.encode(content);

    const crc = crc32(dataBytes);
    const size = dataBytes.length;
    const nameLen = nameBytes.length;

    // Local file header
    const localHeader = new Uint8Array([
        0x50, 0x4B, 0x03, 0x04, // signature
        0x14, 0x00,              // version needed: 2.0
        0x00, 0x00,              // flags
        0x00, 0x00,              // compression: stored
        0x00, 0x00, 0x00, 0x00, // mod time/date (zero)
        ...uint32LE(crc),
        ...uint32LE(size),       // compressed size
        ...uint32LE(size),       // uncompressed size
        ...uint16LE(nameLen),
        0x00, 0x00,              // extra field length
        ...nameBytes,
    ]);

    const localOffset = 0;
    const centralOffset = localHeader.length + size;

    // Central directory entry
    const centralEntry = new Uint8Array([
        0x50, 0x4B, 0x01, 0x02, // signature
        0x14, 0x00,              // version made by
        0x14, 0x00,              // version needed
        0x00, 0x00,              // flags
        0x00, 0x00,              // compression: stored
        0x00, 0x00, 0x00, 0x00, // mod time/date
        ...uint32LE(crc),
        ...uint32LE(size),
        ...uint32LE(size),
        ...uint16LE(nameLen),
        0x00, 0x00,              // extra field length
        0x00, 0x00,              // file comment length
        0x00, 0x00,              // disk number start
        0x00, 0x00,              // internal attributes
        0x00, 0x00, 0x00, 0x00, // external attributes
        ...uint32LE(localOffset),
        ...nameBytes,
    ]);

    const centralSize = centralEntry.length;

    // End of central directory
    const eocd = new Uint8Array([
        0x50, 0x4B, 0x05, 0x06, // signature
        0x00, 0x00,              // disk number
        0x00, 0x00,              // disk with central dir
        0x01, 0x00,              // entries on disk
        0x01, 0x00,              // total entries
        ...uint32LE(centralSize),
        ...uint32LE(centralOffset),
        0x00, 0x00,              // comment length
    ]);

    const total = localHeader.length + size + centralSize + eocd.length;
    const out = new Uint8Array(total);
    let pos = 0;
    out.set(localHeader, pos); pos += localHeader.length;
    out.set(dataBytes, pos);   pos += size;
    out.set(centralEntry, pos); pos += centralSize;
    out.set(eocd, pos);

    return out;
}

function escapeXml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

export function buildKML(history) {
    const schemaFields = [
        { name: 'LineID',      type: 'string' },
        { name: 'Date',        type: 'string' },
        { name: 'StartTime',   type: 'string' },
        { name: 'EndTime',     type: 'string' },
        { name: 'Duration_s',  type: 'float'  },
        { name: 'Direction',   type: 'string' },
        { name: 'Completion',  type: 'float'  },
        { name: 'MaxXTrack_m', type: 'float'  },
        { name: 'MaxAltDiff_m',type: 'float'  },
        { name: 'MaxSpeed_kmh',type: 'float'  },
        { name: 'MaxHdgDiff_deg', type: 'float' },
    ];

    const schemaSimpleFields = schemaFields
        .map(f => `    <SimpleField type="${f.type}" name="${f.name}"><displayName>${f.name}</displayName></SimpleField>`)
        .join('\n');

    const placemarks = history.map(session => {
        if (!session.path || session.path.length < 2) return '';

        const coords = session.path
            .map(p => `${p.lon.toFixed(7)},${p.lat.toFixed(7)},${(p.alt || 0).toFixed(1)}`)
            .join('\n                ');

        const sd = (name, value) => `        <SimpleData name="${name}">${escapeXml(value)}</SimpleData>`;

        return `
  <Placemark>
    <name>${escapeXml(session.lineId)}</name>
    <ExtendedData>
      <SchemaData schemaUrl="#flightSchema">
${sd('LineID', session.lineId)}
${sd('Date', session.date)}
${sd('StartTime', session.startTime)}
${sd('EndTime', session.endTime)}
${sd('Duration_s', session.duration.toFixed(1))}
${sd('Direction', session.direction)}
${sd('Completion', session.completionPct)}
${sd('MaxXTrack_m', session.stats.maxDistanceToLine.toFixed(1))}
${sd('MaxAltDiff_m', session.stats.maxAltDiff.toFixed(1))}
${sd('MaxSpeed_kmh', (session.stats.maxSpeed * 3.6).toFixed(1))}
${sd('MaxHdgDiff_deg', session.stats.maxHeadingDiff.toFixed(1))}
      </SchemaData>
    </ExtendedData>
    <LineString>
      <altitudeMode>absolute</altitudeMode>
      <coordinates>
                ${coords}
      </coordinates>
    </LineString>
  </Placemark>`;
    }).join('\n');

    return `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
<Document>
  <name>AirNavi Flight Logs</name>
  <Schema name="flightSchema" id="flightSchema">
${schemaSimpleFields}
  </Schema>
${placemarks}
</Document>
</kml>`;
}

export function downloadKMZ(history) {
    if (history.length === 0) {
        alert("No flight logs to download.");
        return;
    }

    const kml = buildKML(history);
    const kmzBytes = buildZip('doc.kml', kml);
    const blob = new Blob([kmzBytes], { type: 'application/vnd.google-earth.kmz' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const now = new Date();
    const date = now.toISOString().slice(0, 10);
    const time = now.toTimeString().slice(0, 8).replace(/:/g, '-');
    a.download = `flight_logs_${date}_${time}.kmz`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}
