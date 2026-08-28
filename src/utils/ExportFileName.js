// Shared file-naming scheme for flight log exports (CSV/KML/KMZ):
// flight_logs_<mission name without extension>_<date>_<time>
export const buildExportFileName = (missionFileName) => {
    const missionName = (missionFileName || 'mission').replace(/\.[^./\\]+$/, '');
    const now = new Date();
    const date = now.toISOString().slice(0, 10);
    const time = now.toTimeString().slice(0, 8).replace(/:/g, '-');
    return `flight_logs_${missionName}_${date}_${time}`;
};
