This directory defines the high-level concepts, business logic, and architecture of this project using markdown. It is managed by [lat.md](https://www.npmjs.com/package/lat.md) — a tool that anchors source code to these definitions. Install the `lat` command with `npm i -g lat.md` and run `lat --help`.

- [[architecture]] — app shell, configuration, displays, GPS sources, offline basemap, build/PWA
- [[missions]] — KML/TXT/zip mission formats, row order, altitude datum, mission storage
- [[flight]] — flight state machine, auto-start, logic loop, line advance, guidance, log export
